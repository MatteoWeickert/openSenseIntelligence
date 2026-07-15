"""
Standalone diagnostic script — run BEFORE rebuilding Docker to verify each
external dependency and API call works correctly.

Usage (from the agent/ directory):
    python test_pipeline.py

Does NOT require Docker or a running API. Does NOT require an LLM API key
for the first 6 tests. Test 7 optionally checks the LLM intent classifier.
"""
import asyncio
import os
import sys
import time
from dotenv import load_dotenv

load_dotenv()

import httpx

OSEM_API = os.getenv("OSEM_API_URL", "https://api.opensensemap.org")
NOMINATIM = "https://nominatim.openstreetmap.org/search"

MUENSTER_LON, MUENSTER_LAT = 7.6261, 51.9607
BERLIN_LON, BERLIN_LAT = 13.4050, 52.5200

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
WARN = "\033[33mWARN\033[0m"

results: list[tuple[str, bool, str]] = []


def record(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    icon = PASS if ok else FAIL
    print(f"  [{icon}] {name}{': ' + detail if detail else ''}")


# ── Test 1: Nominatim reachable ────────────────────────────────────────────────
async def test_nominatim_reachable():
    print("\n=== 1. Nominatim geocoding ===")
    async with httpx.AsyncClient() as c:
        r = await c.get(
            NOMINATIM,
            params={"q": "Münster, Germany", "format": "json", "limit": "1"},
            headers={"User-Agent": "openSenseIntelligence-test/1.0"},
            timeout=8.0,
        )
    record("HTTP 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code != 200:
        return None

    data = r.json()
    record("non-empty result", bool(data), f"got {len(data)} result(s)")
    if not data:
        return None

    place = data[0]
    lon, lat = float(place["lon"]), float(place["lat"])
    lon_ok = abs(lon - MUENSTER_LON) < 0.5
    lat_ok = abs(lat - MUENSTER_LAT) < 0.5
    record("Münster coordinates correct", lon_ok and lat_ok, f"({lon:.4f}, {lat:.4f})")
    return {"longitude": lon, "latitude": lat}


# ── Test 2: Nominatim for Berlin ───────────────────────────────────────────────
async def test_nominatim_berlin():
    async with httpx.AsyncClient() as c:
        r = await c.get(
            NOMINATIM,
            params={"q": "Berlin, Germany", "format": "json", "limit": "1"},
            headers={"User-Agent": "openSenseIntelligence-test/1.0"},
            timeout=8.0,
        )
    data = r.json() if r.status_code == 200 else []
    lon = float(data[0]["lon"]) if data else None
    lat = float(data[0]["lat"]) if data else None
    ok = lon is not None and abs(lon - BERLIN_LON) < 0.5 and abs(lat - BERLIN_LAT) < 0.5
    record("Berlin coordinates correct", ok, f"({lon:.4f}, {lat:.4f})" if lon else "no results")


# ── Test 3: OSEM API reachable ─────────────────────────────────────────────────
async def test_osem_reachable():
    print("\n=== 2. OSEM API: /boxes without phenomenon ===")
    params = {
        "near": f"{MUENSTER_LON},{MUENSTER_LAT},25000",
        "limit": "5",
    }
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{OSEM_API}/boxes", params=params, timeout=15.0)
    record("HTTP 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code != 200:
        return None
    devices = r.json()
    record("devices returned", len(devices) > 0, f"{len(devices)} device(s) near Münster")
    if devices:
        d = devices[0]
        record("device has _id", "_id" in d)
        record("device has name", "name" in d)
    return devices


# ── Test 4: OSEM API with phenomenon parameter ─────────────────────────────────
async def test_osem_with_phenomenon():
    print("\n=== 3. OSEM API: /boxes WITH phenomenon=Temperatur ===")
    print("     (Expected: 0 results — phenomenon filter is broken in OSEM API)")
    params = {
        "near": f"{MUENSTER_LON},{MUENSTER_LAT},25000",
        "phenomenon": "Temperatur",
        "limit": "5",
    }
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{OSEM_API}/boxes", params=params, timeout=15.0)
    count = len(r.json()) if r.status_code == 200 else "error"
    if count == 0:
        print(f"  [{WARN}] OSEM phenomenon filter returned 0 devices (confirmed broken — we no longer use it)")
    else:
        record("OSEM phenomenon filter returns devices", True, f"{count} device(s)")


# ── Test 5: OSEM /boxes/{id} measurement fetch ────────────────────────────────
async def test_measurement_fetch(devices: list[dict] | None):
    print("\n=== 4. OSEM measurement fetch: /boxes/{id} ===")
    if not devices:
        print(f"  [{WARN}] Skipped — no devices from test 2")
        return

    box_id = devices[0]["_id"]
    box_name = devices[0].get("name", box_id)

    async with httpx.AsyncClient() as c:
        r = await c.get(f"{OSEM_API}/boxes/{box_id}", timeout=8.0)
    record("HTTP 200", r.status_code == 200, f"status={r.status_code} device='{box_name}'")
    if r.status_code != 200:
        return

    box = r.json()
    sensors = box.get("sensors", [])
    record("has sensors", len(sensors) > 0, f"{len(sensors)} sensor(s)")

    temp_sensor = next(
        (s for s in sensors if "temperatur" in s.get("title", "").lower()),
        None,
    )
    if temp_sensor:
        last = temp_sensor.get("lastMeasurement") or {}
        val = last.get("value")
        unit = temp_sensor.get("unit", "?")
        ts = (last.get("createdAt") or "")[:19]
        record("temperature reading found", val is not None, f"{val} {unit} at {ts}")
    else:
        print(f"  [{WARN}] No temperature sensor on device '{box_name}' — trying next")
        # try a second device
        if len(devices) > 1:
            box_id2 = devices[1]["_id"]
            async with httpx.AsyncClient() as c:
                r2 = await c.get(f"{OSEM_API}/boxes/{box_id2}", timeout=8.0)
            if r2.status_code == 200:
                sensors2 = r2.json().get("sensors", [])
                t2 = next((s for s in sensors2 if "temperatur" in s.get("title", "").lower()), None)
                if t2:
                    last2 = t2.get("lastMeasurement") or {}
                    record("temperature reading found (device 2)", last2.get("value") is not None,
                           f"{last2.get('value')} {t2.get('unit', '?')}")
                    return
        record("temperature reading found", False, "no temp sensor in first 2 devices")


# ── Test 6: utils.py imports ───────────────────────────────────────────────────
async def test_utils_imports():
    print("\n=== 5. utils.py + agents.py imports ===")
    try:
        from utils import get_llm, geocode_location, search_devices, get_measurement_summary
        record("utils.py imports OK", True)
    except Exception as e:
        record("utils.py imports OK", False, str(e))
        return False

    try:
        from agents import (
            AgentState, classify_intent_node, filter_agent_node,
            map_navigation_node, _build_filter_answer, _build_navigation_answer,
        )
        record("agents.py imports OK", True)
    except Exception as e:
        record("agents.py imports OK", False, str(e))
        return False

    return True


# ── Test 7: template answer builder ───────────────────────────────────────────
async def test_templates():
    print("\n=== 6. Template answer builders (no LLM) ===")
    from agents import _build_filter_answer, _build_navigation_answer

    # Case: 0 devices, German, with location
    a = _build_filter_answer("Münster, Germany", 0, None, {}, {}, "de")
    record("0 devices DE with loc", "keine Sensoren" in a and "Münster" in a, repr(a[:80]))

    # Case: 0 devices, German, without location
    a = _build_filter_answer(None, 0, None, {}, {}, "de")  # type: ignore
    record("0 devices DE no loc", "keine" in a.lower(), repr(a[:80]))

    # Case: measurement available, German
    m = {"value": "18.5", "unit": "°C", "timestamp": "2025-01-15T10:00:00Z", "box_name": "Teststation"}
    a = _build_filter_answer("Münster, Germany", 5, "Temperatur", m, {}, "de")
    record("measurement present DE", "18.5" in a and "°C" in a, repr(a[:100]))

    # Case: no measurement, German
    a = _build_filter_answer("Berlin, Germany", 3, "Temperatur", {}, {}, "de")
    record("no measurement DE", "kein" in a.lower(), repr(a[:100]))

    # Case: listing (no phenomenon), German
    a = _build_filter_answer("Berlin, Germany", 20, None, {}, {"exposure": ["outdoor"]}, "de")
    record("listing DE", "20" in a and ("Außen" in a or "outdoor" in a or "20" in a), repr(a[:100]))

    # Navigation answers
    n = _build_navigation_answer("Berlin", True, "de")
    record("navigation found DE", "Berlin" in n, repr(n))
    n = _build_navigation_answer("Atlantis", False, "de")
    record("navigation not found DE", "nicht" in n, repr(n))


# ── Test 8: LLM intent classifier (optional) ──────────────────────────────────
async def test_intent_classifier():
    print("\n=== 7. LLM intent classifier (requires OPENAI_API_KEY) ===")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print(f"  [{WARN}] Skipped — OPENAI_API_KEY not set")
        return

    from agents import classify_intent_node

    cases = [
        ("Wie warm ist es in Berlin?", "filter_query"),
        ("Was ist die Temperatur in Münster?", "filter_query"),
        ("Zeige alle Outdoorsensoren in Berlin", "filter_query"),
        ("Navigiere nach Frankfurt", "map_navigation"),
        ("Zoom to Germany", "map_navigation"),
        ("Hallo", "fallback"),
    ]

    for query, expected in cases:
        state = {
            "query": query, "language": "de", "history": [],
            "next_agent": "", "confidence": None, "agent_raw_output": "",
            "filters": None, "map_actions": None, "result_device_ids": [],
            "answer": None, "agent_used": None, "steps": [], "request_id": "diag",
        }
        try:
            result = await classify_intent_node(state)
            got = result.get("next_agent", "?")
            conf = result.get("confidence", 0)
            ok = got == expected
            record(
                f"classify '{query[:35]}...'",
                ok,
                f"got={got!r} expected={expected!r} conf={conf:.0%}",
            ) if len(query) > 35 else record(
                f"classify '{query}'",
                ok,
                f"got={got!r} expected={expected!r} conf={conf:.0%}",
            )
        except Exception as e:
            record(f"classify '{query[:35]}'", False, str(e))


# ── Test 9: full filter_agent_node for Münster (optional) ─────────────────────
async def test_filter_agent_muenster():
    print("\n=== 8. filter_agent_node end-to-end for 'Wie warm ist es in Münster?' ===")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print(f"  [{WARN}] Skipped — OPENAI_API_KEY not set")
        return

    from agents import filter_agent_node

    state = {
        "query": "Wie warm ist es in Münster?",
        "language": "de", "history": [],
        "next_agent": "filter_query", "confidence": 0.95,
        "agent_raw_output": "", "filters": None, "map_actions": None,
        "result_device_ids": [], "answer": None, "agent_used": None,
        "steps": [], "request_id": "diag-muenster",
    }
    t0 = time.monotonic()
    try:
        result = await filter_agent_node(state)
        elapsed = time.monotonic() - t0
        devices_found = len(result.get("result_device_ids", []))
        has_map_action = bool(result.get("map_actions"))
        answer = result.get("answer", "")
        has_value = "°C" in answer or "°" in answer

        record("map action produced", has_map_action, str(result.get("map_actions", [])))
        record("devices found", devices_found > 0, f"{devices_found} device ID(s)")
        record("answer contains temperature", has_value, f"answer={answer[:100]!r}")
        record("answer is not hallucinated", "etwa X °C" not in answer, f"answer={answer[:80]!r}")
        print(f"  elapsed: {elapsed:.1f}s")
        print(f"  answer: {answer}")
    except Exception as e:
        record("filter_agent_node ran without error", False, str(e))


# ── Main ───────────────────────────────────────────────────────────────────────
async def main():
    print("=" * 60)
    print("openSenseIntelligence — Pipeline Diagnostics")
    print(f"OSEM_API_URL: {OSEM_API}")
    print("=" * 60)

    # Sequentially — each test may depend on previous
    print("\n=== 1. Nominatim geocoding ===")
    muenster_coords = await test_nominatim_reachable()
    await test_nominatim_berlin()

    devices = await test_osem_reachable()
    await test_osem_with_phenomenon()
    await test_measurement_fetch(devices)

    imports_ok = await test_utils_imports()
    if imports_ok:
        await test_templates()
        await test_intent_classifier()
        await test_filter_agent_muenster()

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    for name, ok, detail in results:
        icon = PASS if ok else FAIL
        print(f"  [{icon}] {name}" + (f": {detail}" if detail else ""))
    print(f"\n{passed} passed, {failed} failed")
    if failed:
        print("\nFix the FAIL items above before rebuilding Docker.")
        sys.exit(1)
    else:
        print("\nAll checks passed. Safe to rebuild Docker:")
        print("  docker compose up --build agent")


if __name__ == "__main__":
    asyncio.run(main())
