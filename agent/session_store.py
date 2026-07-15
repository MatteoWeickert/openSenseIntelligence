from typing import Any, Optional
from datetime import datetime, timedelta

SESSION_TTL_MINUTES = 60

_store: dict[str, tuple[Any, datetime]] = {}


def store_put(session_id: str, namespace: str, value: Any) -> str:
    key = f"{session_id}:{namespace}"
    _store[key] = (value, datetime.utcnow())
    return key


def store_get(cache_key: str) -> Optional[Any]:
    entry = _store.get(cache_key)
    if entry is None:
        return None
    value, created_at = entry
    if datetime.utcnow() - created_at > timedelta(minutes=SESSION_TTL_MINUTES):
        del _store[cache_key]
        return None
    return value


def evict_expired() -> int:
    now = datetime.utcnow()
    cutoff = timedelta(minutes=SESSION_TTL_MINUTES)
    expired = [k for k, (_, ts) in _store.items() if now - ts > cutoff]
    for k in expired:
        del _store[k]
    return len(expired)
