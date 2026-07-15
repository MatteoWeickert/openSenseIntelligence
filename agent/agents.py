from typing import TypedDict, Optional, Literal, get_args
from pydantic import BaseModel, Field
from langchain_core.messages import SystemMessage, HumanMessage
from utils import get_llm, geocode_location, get_phenomenon_list
from session_store import store_get, store_put


class AgentState(TypedDict, total=False):
    query: str
    language: str
    history: list
    session_id: str
    filter_cache_key: Optional[str]
    rag_result_key: Optional[str]
    next_agent: str
    confidence: float
    agent_raw_output: str
    filters: dict
    map_actions: list
    result_device_ids: list
    answer: str
    agent_used: str
    steps: list
    request_id: str


# ── Pydantic output schemas ────────────────────────────────────────────────────

class SupervisorOutput(BaseModel):
    next_agent: str = Field(description="filter, map, knowledge, or fallback")
    confidence: float = Field(default=0.9)


# Mirrors the device status/exposure enums openSenseMap itself defines
# (app/db/schema/enum.ts) — using Literal here means the structured-output
# call can only ever return one of these values, by construction, instead of
# relying on the prompt text alone to keep the model from hallucinating.
StatusLiteral = Literal["active", "inactive", "old"]
ExposureLiteral = Literal["indoor", "outdoor", "mobile", "unknown"]


class FilterOutput(BaseModel):
    status: list[StatusLiteral] = Field(
        default=[],
        description="Device status values explicitly requested by the user. Empty list if not mentioned.",
    )
    exposure: list[ExposureLiteral] = Field(
        default=[],
        description="Device exposure values explicitly requested by the user. Empty list if not mentioned.",
    )
    tags: list[str] = Field(
        default=[],
        description=(
            "Freeform tag/keyword filters the user explicitly typed (e.g. 'Schule', 'Balkon'). "
            "Empty list if the user did not mention any specific tag."
        ),
    )
    location_name: Optional[str] = Field(
        default=None,
        description=(
            "Normalized place name with country for Nominatim geocoding. "
            "ALWAYS include when ANY city, region, or country is mentioned. "
            "Examples: 'Münster, Germany', 'Berlin, Germany', 'Vienna, Austria'. "
            "Only null when NO location is mentioned at all."
        ),
    )
    phenomenon: Optional[str] = Field(
        default=None,
        description=(
            "Canonical phenomenon name from the provided list. "
            "Set when the user wants to filter by measurement type. "
            "Null when not mentioned."
        ),
    )
    zoom: Optional[float] = Field(
        default=None,
        description="Map zoom: continent=3, country=5, region=7, city=10, neighborhood=13",
    )


class MapOutput(BaseModel):
    location_name: str = Field(description="Normalized place + country for geocoding, e.g. 'Frankfurt, Germany'")
    zoom: float = Field(description="Zoom: continent=3, country=5, region=7, city=10")
    place_label: str = Field(description="Short display name shown to the user, e.g. 'Frankfurt'")


# ── Prompts ────────────────────────────────────────────────────────────────────

SUPERVISOR_SYSTEM = """You are a routing supervisor for openSenseIntelligence, the AI layer of openSenseMap.
Classify the user's query into exactly one category:

  filter     — user wants to find, filter, or browse sensors on the map by location/type/phenomenon
  map        — user ONLY wants to navigate or zoom the map to a location (no sensor data interest)
  knowledge  — user wants to learn about phenomena, sensor hardware, measurement standards,
               health guidelines, what openSenseMap is, or how sensors work
  fallback   — greeting, off-topic, or completely unrelated to sensors/environment/maps

CRITICAL — always "filter", never "knowledge":
  "Zeige Temperatursensoren in Berlin" → filter
  "Welche aktiven Sensoren gibt es in München?" → filter

CRITICAL — always "knowledge", never "filter":
  "Was ist PM2.5?" → knowledge
  "Wie gefährlich ist Feinstaub?" → knowledge
  "Was messen senseBoxen?" → knowledge

Return JSON: {"next_agent": "filter"|"map"|"knowledge"|"fallback", "confidence": 0.0-1.0}

Examples:
"Zeige Outdoorsensoren in Köln"         → filter
"Sensoren mit CO2-Messung"              → filter
"Navigiere nach Frankfurt"              → map
"Zoom to Hamburg"                       → map
"Was ist PM2.5?"                        → knowledge
"Wie hoch darf Feinstaub sein?"         → knowledge
"Was messen senseBoxen?"                → knowledge
"Was ist eine senseBox?"                → knowledge
"Hallo"                                 → fallback
"Was ist 2+2?"                          → fallback"""

FILTER_SYSTEM = """Extract structured filter parameters from the user query for openSenseMap.
You do NOT write the user-facing answer.

Available phenomena: {phenomena_list}

Valid status: {status_options}
Valid exposure: {exposure_options}

Only set status/exposure/tags when the user's message explicitly asks for that kind of filtering.
Leave them as empty lists otherwise — never guess, never return every valid option at once.

location_name — ALWAYS extract when any city, region, or country is mentioned:
  "in Berlin"       → "Berlin, Germany"
  "in Münster"      → "Münster, Germany"
  "in Wien"         → "Vienna, Austria"
  "in der Schweiz"  → "Switzerland"
  Only null when ZERO location is mentioned.

phenomenon — pick the closest match from the available phenomena list above.
  warm/Temperatur/temperature → "Temperatur"
  Feuchtigkeit/humidity      → "rel. Luftfeuchte"
  Luftdruck/pressure         → "Luftdruck"
  Feinstaub/PM/particulate   → "PM2.5"
  CO2/Kohlendioxid           → "CO2"
  Licht/light                → "Beleuchtungsstärke"
  Lärm/Schall/noise          → "Schallpegel"
  Null when not mentioned.

zoom: city=10, region=7, country=5, continent=3

Return JSON: {{status, exposure, tags, location_name, phenomenon, zoom}}"""

MAP_NAV_SYSTEM = """The user wants to navigate the map to a location — no sensor data needed.
Extract the place name and zoom level.
location_name: normalized + country for geocoding, e.g. "Berlin, Germany".
zoom: continent=3, country=5, region=7, city=10, neighborhood=13.
Return JSON: {location_name, zoom, place_label}"""


# ── Helper ──────────────────────────────────────────────────────────────────────

def _step(agent: str, summary: str) -> dict:
    return {"agent": agent, "summary": summary}


# ── Agent nodes ────────────────────────────────────────────────────────────────

async def supervisor_node(state: AgentState) -> dict:
    llm = get_llm().with_structured_output(SupervisorOutput)
    for attempt in range(3):
        try:
            result: SupervisorOutput = await llm.ainvoke([
                SystemMessage(content=SUPERVISOR_SYSTEM),
                HumanMessage(content=state["query"]),
            ])
            break
        except Exception as e:
            print(f"[supervisor] LLM attempt {attempt + 1} failed: {e}")
            if attempt == 2:
                prev_steps = state.get("steps") or []
                return {
                    "next_agent": "fallback",
                    "confidence": 0.0,
                    "steps": prev_steps + [_step("supervisor", f"LLM error: {e}")],
                }

    next_agent = result.next_agent.strip().lower()
    if next_agent not in ("filter", "map", "knowledge", "fallback"):
        next_agent = "fallback"
    confidence = max(0.0, min(1.0, result.confidence))

    print(f"[supervisor] request_id={state.get('request_id')} next={next_agent!r} confidence={confidence:.2f}")
    prev_steps = state.get("steps") or []
    return {
        "next_agent": next_agent,
        "confidence": confidence,
        "steps": prev_steps + [_step("supervisor", f"Routed to '{next_agent}' ({confidence:.0%} confidence)")],
    }


async def filter_agent_node(state: AgentState) -> dict:
    language = state.get("language", "en")
    session_id = state.get("session_id", "anon")
    prev_steps = state.get("steps") or []

    # Per-session filter discovery: fetch available phenomena once per session
    filter_cache_key = state.get("filter_cache_key")
    if filter_cache_key:
        phenomena = store_get(filter_cache_key) or []
    else:
        phenomena = await get_phenomenon_list()
        filter_cache_key = store_put(session_id, "filter_discovery", phenomena)

    phenomena_str = ", ".join(phenomena) if phenomena else "Temperatur, rel. Luftfeuchte, Luftdruck, PM2.5, PM10, CO2"
    steps = list(prev_steps) + [_step("filter_agent", f"Discovered {len(phenomena)} available phenomena")]

    llm = get_llm().with_structured_output(FilterOutput)
    messages = [
        SystemMessage(content=FILTER_SYSTEM.format(
            phenomena_list=phenomena_str,
            status_options=", ".join(get_args(StatusLiteral)),
            exposure_options=", ".join(get_args(ExposureLiteral)),
        )),
        HumanMessage(content=f"Language: {language}\nQuery: {state['query']}"),
    ]
    result: Optional[FilterOutput] = None
    for attempt in range(3):
        try:
            result = await llm.ainvoke(messages)
            break
        except Exception as e:
            print(f"[filter_agent] LLM attempt {attempt + 1} failed: {e}")
            if attempt == 2:
                de = language == "de"
                fallback_answer = (
                    "Der Filterdienst ist gerade nicht verfuegbar. Bitte versuch es erneut."
                    if de else
                    "The filter service is temporarily unavailable. Please try again."
                )
                return {
                    "filters": {},
                    "map_actions": [],
                    "result_device_ids": [],
                    "agent_raw_output": "",
                    "answer": fallback_answer,
                    "agent_used": "filter_agent",
                    "filter_cache_key": filter_cache_key,
                    "steps": steps + [_step("filter_agent", f"LLM error after 3 attempts: {e}")],
                }

    filters: dict = {}
    if result.status:
        filters["status"] = result.status
    if result.exposure:
        filters["exposure"] = result.exposure
    if result.tags:
        filters["tags"] = result.tags
    if result.phenomenon:
        filters["phenomenon"] = [result.phenomenon]

    coords = None
    if result.location_name:
        coords = await geocode_location(result.location_name)

    map_actions = []
    if coords:
        zoom = result.zoom if result.zoom is not None else 10.0
        map_actions.append({
            "type": "flyTo",
            "longitude": coords["longitude"],
            "latitude": coords["latitude"],
            "zoom": zoom,
        })

    location_label = coords.get("display_name", result.location_name) if coords else result.location_name
    answer = _build_filter_answer(result, location_label, language)

    step_note = f"Filters: {list(filters.keys())}"
    if result.phenomenon:
        step_note += f", phenomenon='{result.phenomenon}'"
    if location_label:
        step_note += f", location='{result.location_name}'"
    print(f"[filter_agent] request_id={state.get('request_id')} {step_note}")

    return {
        "filters": filters,
        "map_actions": map_actions,
        "result_device_ids": [],
        "agent_raw_output": answer,
        "answer": answer,
        "agent_used": "filter_agent",
        "filter_cache_key": filter_cache_key,
        "steps": steps + [_step("filter_agent", step_note)],
    }


async def map_agent_node(state: AgentState) -> dict:
    language = state.get("language", "en")
    prev_steps = state.get("steps") or []

    llm = get_llm().with_structured_output(MapOutput)
    result: MapOutput = await llm.ainvoke([
        SystemMessage(content=MAP_NAV_SYSTEM),
        HumanMessage(content=f"Language: {language}\nQuery: {state['query']}"),
    ])

    coords = await geocode_location(result.location_name)
    map_actions = []

    if coords:
        map_actions.append({
            "type": "flyTo",
            "longitude": coords["longitude"],
            "latitude": coords["latitude"],
            "zoom": result.zoom,
        })
        label = coords.get("display_name", result.place_label)
        answer = (
            f"Navigiere zur Karte nach {result.place_label}."
            if language == "de" else
            f"Navigating the map to {result.place_label}."
        )
    else:
        label = result.place_label
        answer = (
            f"Der Ort '{result.place_label}' konnte nicht gefunden werden."
            if language == "de" else
            f"Could not find '{result.place_label}' on the map."
        )

    print(f"[map_agent] request_id={state.get('request_id')} place={result.place_label!r} geocoded={coords is not None}")
    return {
        "map_actions": map_actions,
        "filters": {},
        "result_device_ids": [],
        "agent_raw_output": answer,
        "answer": answer,
        "agent_used": "map_agent",
        "steps": list(prev_steps) + [_step("map_agent", f"Resolved '{result.place_label}' geocoded={coords is not None}")],
    }


# ── Answer builder ─────────────────────────────────────────────────────────────

def _build_filter_answer(result: FilterOutput, location_label: Optional[str], language: str) -> str:
    de = language == "de"
    parts: list[str] = []

    if result.phenomenon:
        if de:
            parts.append(f"Filter gesetzt für Phänomen: **{result.phenomenon}**.")
        else:
            parts.append(f"Filter set for phenomenon: **{result.phenomenon}**.")

    if location_label:
        short = location_label.split(",")[0].strip()
        if de:
            parts.append(f"Karte zeigt: {short}.")
        else:
            parts.append(f"Map showing: {short}.")

    if result.exposure:
        exp_de = {"outdoor": "Außen", "indoor": "Innen", "mobile": "Mobil", "unknown": "Unbekannt"}
        exp_str = ", ".join(exp_de.get(e, e) if de else e for e in result.exposure)
        if de:
            parts.append(f"Aufstellung: {exp_str}.")
        else:
            parts.append(f"Exposure: {exp_str}.")

    if result.status:
        status_str = ", ".join(result.status)
        if de:
            parts.append(f"Status: {status_str}.")
        else:
            parts.append(f"Status: {status_str}.")

    if not parts:
        return (
            "Klick auf **Filter anwenden** um die Karte zu filtern."
            if de else
            "Click **Apply Filters** to filter the map."
        )

    cta = (
        "Klick auf **Filter anwenden** um die Filter zu setzen."
        if de else
        "Click **Apply Filters** to apply these filters to the map."
    )
    return " ".join(parts) + " " + cta
