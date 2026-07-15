from __future__ import annotations

import os
from pathlib import Path
from typing import Optional


from langchain_core.messages import SystemMessage, HumanMessage
from utils import get_llm
from session_store import store_put

INDEX_PATH = Path(__file__).parent / "knowledge_base" / "index"

_vector_store = None


def _load_index():
    global _vector_store
    if _vector_store is not None:
        return _vector_store
    if not INDEX_PATH.exists():
        print("[knowledge_agent] No FAISS index found at", INDEX_PATH)
        return None
    try:
        from langchain_community.vectorstores import FAISS
        from langchain_huggingface import HuggingFaceEmbeddings

        embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
        )
        _vector_store = FAISS.load_local(
            str(INDEX_PATH), embeddings, allow_dangerous_deserialization=True
        )
        print(f"[knowledge_agent] FAISS index loaded from {INDEX_PATH}")
        return _vector_store
    except Exception as e:
        print(f"[knowledge_agent] Failed to load FAISS index: {e}")
        return None


KNOWLEDGE_SYSTEM = """You are a knowledgeable assistant for openSenseMap, a citizen science environmental sensor network.
Use the numbered context sections below to answer the user's question accurately and concisely.
Cite sources inline using [1], [2], etc. whenever you use information from a specific section.
At the end of your answer, list the sources you cited as:
Quellen: [1] Name, [2] Name  (in German if answer is in German)
Sources: [1] Name, [2] Name  (in English if answer is in English)

Only list sources you actually cited. If context doesn't help, answer from general knowledge without citations.
Do not use Markdown tables. Use plain prose with bold (**word**) only for key terms.

Context:
{context}"""

NO_INDEX_SYSTEM = """You are a knowledgeable assistant for openSenseMap, a citizen science environmental sensor network.
Answer questions about sensor phenomena (temperature, PM2.5, CO2, humidity, etc.), senseBox hardware,
environmental measurement standards, and the openSenseMap platform.
Answer in the same language as the user's question."""


async def knowledge_agent_node(state: dict) -> dict:
    from agents import _step

    prev_steps = state.get("steps") or []
    language = state.get("language", "en")
    session_id = state.get("session_id", "anon")
    query = state["query"]

    vs = _load_index()
    rag_result_key: Optional[str] = state.get("rag_result_key")
    steps = list(prev_steps)

    if vs is not None:
        try:
            docs = vs.similarity_search(query, k=4)
            source_labels = {
                "opensensemap_overview": "openSenseMap Übersicht",
                "phenomena": "Messphänomene",
                "sensor_types": "senseBox Sensortypen",
            }
            numbered_chunks = []
            for i, doc in enumerate(docs, 1):
                src_file = Path(doc.metadata.get("source", "")).stem
                label = source_labels.get(src_file, src_file)
                numbered_chunks.append(f"[{i}] (Quelle: {label})\n{doc.page_content}")
            context = "\n\n".join(numbered_chunks)
            rag_result_key = store_put(session_id, "rag_last", {
                "query": query,
                "chunks": [d.page_content for d in docs],
            })
            steps.append(_step("knowledge_agent", f"Retrieved {len(docs)} context chunks from FAISS"))
            system_prompt = KNOWLEDGE_SYSTEM.format(context=context)
        except Exception as e:
            steps.append(_step("knowledge_agent", f"RAG retrieval error: {e}, falling back to LLM"))
            system_prompt = NO_INDEX_SYSTEM
    else:
        steps.append(_step("knowledge_agent", "No index available, answering from LLM knowledge"))
        system_prompt = NO_INDEX_SYSTEM

    llm = get_llm(temperature=0.3)
    response = await llm.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=query),
    ])

    print(f"[knowledge_agent] request_id={state.get('request_id')} query={query!r} index_used={vs is not None}")

    return {
        "filters": {},
        "map_actions": [],
        "result_device_ids": [],
        "agent_raw_output": response.content,
        "answer": response.content,
        "agent_used": "knowledge_agent",
        "rag_result_key": rag_result_key,
        "steps": steps + [_step("knowledge_agent", "Answer synthesized")],
    }
