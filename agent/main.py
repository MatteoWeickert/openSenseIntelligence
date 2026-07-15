import time
import uuid
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from langgraph.graph import StateGraph, END
from agents import (
    AgentState,
    supervisor_node,
    filter_agent_node,
    map_agent_node,
)
from knowledge_agent import knowledge_agent_node


def finalizer_node(state: AgentState) -> dict:
    """Pass-through finalizer. Only generates a fallback answer when no specialist ran."""
    updates: dict = {}

    if not state.get("answer"):
        language = state.get("language", "en")
        updates["answer"] = (
            "Ich kann Ihnen bei der Suche nach Sensordaten auf openSenseMap helfen. "
            "Fragen Sie nach einem Standort, Sensortyp oder einem Phänomen."
            if language == "de" else
            "I can help you find sensor data on openSenseMap. "
            "Ask about a location, sensor type, or a phenomenon."
        )
        updates["agent_used"] = "fallback"

    agent_used = updates.get("agent_used") or state.get("agent_used") or "fallback"
    print(f"[finalizer] request_id={state.get('request_id')} agent_used={agent_used}")
    prev_steps = state.get("steps") or []
    updates["steps"] = prev_steps + [{"agent": "finalizer", "summary": "Response finalized"}]
    return updates


def build_graph():
    graph: StateGraph = StateGraph(AgentState)

    graph.add_node("supervisor", supervisor_node)
    graph.add_node("filter_agent", filter_agent_node)
    graph.add_node("map_agent", map_agent_node)
    graph.add_node("knowledge_agent", knowledge_agent_node)
    graph.add_node("finalizer", finalizer_node)

    graph.set_entry_point("supervisor")

    graph.add_conditional_edges(
        "supervisor",
        lambda state: state.get("next_agent", "fallback"),
        {
            "filter": "filter_agent",
            "map": "map_agent",
            "knowledge": "knowledge_agent",
            "fallback": "finalizer",
        },
    )

    graph.add_edge("filter_agent", "finalizer")
    graph.add_edge("map_agent", "finalizer")
    graph.add_edge("knowledge_agent", "finalizer")
    graph.add_edge("finalizer", END)

    return graph.compile()


agent_graph = build_graph()

app = FastAPI(title="openSenseIntelligence Agent")


class QueryRequest(BaseModel):
    query: str
    language: str = "en"
    history: list = []
    session_id: Optional[str] = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/query")
async def query_endpoint(req: QueryRequest):
    request_id = str(uuid.uuid4())
    session_id = req.session_id or str(uuid.uuid4())
    t0 = time.monotonic()

    result: AgentState = await agent_graph.ainvoke({
        "query": req.query,
        "language": req.language,
        "history": req.history or [],
        "session_id": session_id,
        "filter_cache_key": None,
        "rag_result_key": None,
        "next_agent": "",
        "confidence": None,
        "agent_raw_output": "",
        "filters": None,
        "map_actions": None,
        "result_device_ids": [],
        "answer": None,
        "agent_used": None,
        "steps": [],
        "request_id": request_id,
    })

    duration_ms = int((time.monotonic() - t0) * 1000)
    print(
        f"[query] request_id={request_id} session_id={session_id} "
        f"agent_used={result.get('agent_used')} duration_ms={duration_ms}"
    )

    body = {
        "answer": result.get("answer") or "",
        "filters": result.get("filters") or {},
        "mapActions": result.get("map_actions") or [],
        "resultDeviceIds": result.get("result_device_ids") or [],
        "agentUsed": result.get("agent_used") or "fallback",
        "steps": result.get("steps") or [],
        "confidence": result.get("confidence") if result.get("confidence") is not None else 0.9,
        "requestId": request_id,
        "sessionId": session_id,
    }

    r = JSONResponse(content=body)
    r.headers["X-Request-Id"] = request_id
    r.headers["X-Session-Id"] = session_id
    return r
