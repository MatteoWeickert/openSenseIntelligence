import pytest
from agents import AgentState
from main import finalizer_node


def _base_state(**overrides) -> AgentState:
    state: AgentState = {
        "query": "test query",
        "language": "en",
        "history": [],
        "next_agent": "",
        "confidence": None,
        "agent_raw_output": "",
        "filters": None,
        "map_actions": None,
        "result_device_ids": [],
        "answer": None,
        "agent_used": None,
        "steps": [],
        "request_id": "test-id",
    }
    state.update(overrides)  # type: ignore[typeddict-item]
    return state


def test_finalizer_fallback_english():
    """When no answer set, finalizer returns English static fallback."""
    state = _base_state()
    result = finalizer_node(state)
    assert "answer" in result
    assert len(result["answer"]) > 0
    assert result.get("agent_used") == "fallback"


def test_finalizer_fallback_german():
    """When no answer set and language is 'de', returns German static fallback."""
    state = _base_state(language="de")
    result = finalizer_node(state)
    answer = result["answer"]
    assert "Ich" in answer or "openSenseMap" in answer


def test_finalizer_passes_through_existing_answer():
    """When specialist already set answer, finalizer does not overwrite it."""
    state = _base_state(answer="Sensor X in Berlin: 22.1 °C.", agent_used="filter_agent")
    result = finalizer_node(state)
    assert "answer" not in result  # finalizer only updates answer when missing


def test_finalizer_preserves_agent_used():
    """agent_used from specialist is not overwritten when answer already exists."""
    state = _base_state(answer="Navigating to Berlin.", agent_used="map_navigation")
    result = finalizer_node(state)
    assert result.get("agent_used") is None or result.get("agent_used") == "map_navigation"


def test_finalizer_appends_step():
    """Finalizer always appends its own step."""
    state = _base_state(
        answer="Found 5 sensors.",
        agent_used="filter_agent",
        steps=[{"agent": "intent_classifier", "summary": "filter_query"}],
    )
    result = finalizer_node(state)
    steps = result.get("steps", [])
    assert any(s["agent"] == "finalizer" for s in steps)
    assert len(steps) == 2
