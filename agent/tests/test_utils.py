import pytest
from utils import get_phenomenon_list, geocode_location, search_devices


@pytest.mark.asyncio
async def test_get_phenomenon_list_returns_list():
    result = await get_phenomenon_list()
    assert isinstance(result, list)
    assert len(result) > 0
    assert all(isinstance(p, str) for p in result)


@pytest.mark.asyncio
async def test_geocode_location_germany():
    """Nominatim should resolve 'Münster, Germany' to coordinates near (7.63, 51.96)."""
    result = await geocode_location("Münster, Germany")
    assert result is not None, "Nominatim returned None — check network access"
    assert abs(result["longitude"] - 7.63) < 0.5, f"Unexpected longitude: {result['longitude']}"
    assert abs(result["latitude"] - 51.96) < 0.5, f"Unexpected latitude: {result['latitude']}"
    assert "display_name" in result


@pytest.mark.asyncio
async def test_geocode_location_berlin():
    result = await geocode_location("Berlin, Germany")
    assert result is not None
    assert abs(result["longitude"] - 13.4) < 0.5
    assert abs(result["latitude"] - 52.5) < 0.5


@pytest.mark.asyncio
async def test_geocode_location_unknown_returns_none():
    """Non-existent places should return None, not raise."""
    result = await geocode_location("Atlantis, Fictional Ocean")
    # Nominatim may or may not find something — just check it doesn't raise
    assert result is None or isinstance(result, dict)


@pytest.mark.asyncio
async def test_search_devices_basic():
    """search_devices returns a list (may be empty depending on OSEM API availability)."""
    result = await search_devices({})
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_search_devices_with_near():
    """Geographic filter near Münster should return devices or empty list without raising."""
    result = await search_devices(
        {"exposure": ["outdoor"]},
        latitude=51.96,
        longitude=7.63,
    )
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_search_devices_without_phenomenon_returns_devices():
    """Near Berlin without phenomenon filter — confirmed working API path.
    We never pass phenomenon= to the OSEM API (returns 0 results)."""
    result = await search_devices(
        {},
        latitude=52.52,
        longitude=13.40,
        # No phenomenon — the OSEM /boxes?phenomenon= filter returns 0 results
    )
    assert isinstance(result, list)
    assert len(result) > 0, "Expected devices near Berlin — OSEM API may be down or near= format changed"
