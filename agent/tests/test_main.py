import os
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_query_requires_api_key():
    if not os.getenv("OPENAI_API_KEY"):
        pytest.skip("No OPENAI_API_KEY — skipping live LLM test")


def test_query_response_shape():
    if not os.getenv("OPENAI_API_KEY"):
        pytest.skip("No OPENAI_API_KEY — skipping live LLM test")
    r = client.post("/query", json={"query": "active outdoor sensors", "language": "en"})
    assert r.status_code == 200
    data = r.json()
    for key in ("answer", "filters", "mapActions", "resultDeviceIds", "agentUsed", "steps", "confidence", "requestId"):
        assert key in data, f"Missing key: {key}"
    assert "X-Request-Id" in r.headers


def test_query_x_request_id_header():
    if not os.getenv("OPENAI_API_KEY"):
        pytest.skip("No OPENAI_API_KEY — skipping live LLM test")
    r = client.post("/query", json={"query": "show me sensors in berlin", "language": "de"})
    assert r.status_code == 200
    assert "X-Request-Id" in r.headers
    assert len(r.headers["X-Request-Id"]) == 36  # UUID length
