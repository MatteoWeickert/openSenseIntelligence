import os
import httpx
from langchain_openai import ChatOpenAI

OSEM_API = os.getenv("OSEM_API_URL", "https://api.opensensemap.org")
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

_PHENOMENON_FALLBACK = [
    "Temperatur", "rel. Luftfeuchte", "Luftdruck",
    "PM2.5", "PM10", "CO2", "Beleuchtungsstärke",
    "UV-Intensität", "Schallpegel",
]


def get_llm(temperature: float = 0.0) -> ChatOpenAI:
    return ChatOpenAI(
        model=os.getenv("LLM_MODEL", "gpt-oss-120b"),
        api_key=os.getenv("OPENAI_API_KEY"),
        base_url=os.getenv("OPENAI_BASE_URL"),
        temperature=temperature,
        timeout=20.0,
        max_retries=0,
    )


async def geocode_location(place_name: str) -> dict | None:
    """Convert a place name to lon/lat using Nominatim. Returns None on failure."""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                NOMINATIM_URL,
                params={"q": place_name, "format": "json", "limit": 1},
                headers={"User-Agent": "openSenseIntelligence/1.0 (opensensemap.org)"},
                timeout=5.0,
            )
            if r.status_code == 200:
                results = r.json()
                if results:
                    place = results[0]
                    lon = float(place["lon"])
                    lat = float(place["lat"])
                    print(f"[geocode] '{place_name}' -> ({lon:.4f}, {lat:.4f})")
                    return {
                        "longitude": lon,
                        "latitude": lat,
                        "display_name": place.get("display_name", place_name),
                    }
    except Exception as e:
        print(f"[geocode] error for '{place_name}': {e}")
    return None


async def get_phenomenon_list() -> list[str]:
    """Fetch available phenomena from openSenseMap; falls back to a static list."""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{OSEM_API}/phenomenon", timeout=10.0)
            if r.status_code == 200:
                data = r.json()
                if isinstance(data, list):
                    names = [p.get("name", "") for p in data if p.get("name")]
                    if names:
                        return names
    except Exception:
        pass
    return _PHENOMENON_FALLBACK


async def search_devices(
    filters: dict,
    latitude: float | None = None,
    longitude: float | None = None,
    radius_km: int = 25,
    phenomenon: str | None = None,
) -> list[dict]:
    """Query openSenseMap /boxes.
    - near=lon,lat,dist(m) for geographic filtering (OSEM API native filter).
    - phenomenon= pre-filters to boxes that have a sensor for that phenomenon.
    No full=true — keeps response lightweight and avoids API incompatibilities."""
    params: dict[str, str] = {"limit": "10"}
    if filters.get("status"):
        params["status"] = filters["status"][0]
    if filters.get("exposure"):
        params["exposure"] = filters["exposure"][0]
    if phenomenon:
        params["phenomenon"] = phenomenon
    if latitude is not None and longitude is not None:
        # openSenseMap near= format: longitude,latitude,maxdistance(m)
        params["near"] = f"{longitude},{latitude},{radius_km * 1000}"

    print(f"[search_devices] params={params}")
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{OSEM_API}/boxes", params=params, timeout=15.0)
            count = len(r.json()) if r.status_code == 200 else f"err:{r.status_code}"
            print(f"[search_devices] status={r.status_code} count={count}")
            if r.status_code == 200:
                return r.json()
    except Exception as e:
        print(f"[search_devices] error: {e}")
    return []


async def get_measurement_summary(box_id: str, phenomenon: str) -> dict:
    """Return the latest measurement for a specific device/phenomenon pair."""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{OSEM_API}/boxes/{box_id}", timeout=5.0)
            if r.status_code == 200:
                box = r.json()
                for sensor in box.get("sensors", []):
                    if phenomenon.lower() in sensor.get("title", "").lower():
                        last = sensor.get("lastMeasurement") or {}
                        return {
                            "sensor_id": sensor.get("_id"),
                            "phenomenon": sensor.get("title"),
                            "value": last.get("value"),
                            "unit": sensor.get("unit"),
                            "timestamp": last.get("createdAt"),
                        }
    except Exception as e:
        print(f"[get_measurement] box_id={box_id} error: {e}")
    return {}
