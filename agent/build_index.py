#!/usr/bin/env python3
"""Build FAISS index from Markdown files in knowledge_base/docs/.

Usage:
    python build_index.py

Requires OPENAI_API_KEY (and optionally OPENAI_BASE_URL) to be set.
Reads all .md files from knowledge_base/docs/, splits them into chunks,
embeds them with OpenAI text-embedding-3-small, and saves the FAISS index
to knowledge_base/index/ — ready to be used by the knowledge agent.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

DOCS_DIR = Path(__file__).parent / "knowledge_base" / "docs"
INDEX_DIR = Path(__file__).parent / "knowledge_base" / "index"


def main() -> None:
    if not os.getenv("OPENAI_API_KEY"):
        print("Error: OPENAI_API_KEY is not set.", file=sys.stderr)
        sys.exit(1)

    try:
        from langchain_community.document_loaders import TextLoader
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        from langchain_community.vectorstores import FAISS
        from langchain_huggingface import HuggingFaceEmbeddings
    except ImportError as e:
        print(f"Missing dependency: {e}\nRun: pip install langchain-community langchain-huggingface faiss-cpu sentence-transformers", file=sys.stderr)
        sys.exit(1)

    md_files = sorted(DOCS_DIR.glob("**/*.md"))
    if not md_files:
        print(f"No Markdown files found in {DOCS_DIR}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading {len(md_files)} Markdown file(s)...")
    all_docs = []
    for path in md_files:
        loader = TextLoader(str(path), encoding="utf-8")
        all_docs.extend(loader.load())

    splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=60)
    chunks = splitter.split_documents(all_docs)
    print(f"Split into {len(chunks)} chunks")

    # Local multilingual model — no API key needed, handles German + English
    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    )

    print("Embedding chunks (this may take a moment)...")
    vs = FAISS.from_documents(chunks, embeddings)

    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    vs.save_local(str(INDEX_DIR))
    print(f"Index saved to {INDEX_DIR}  ({len(chunks)} chunks from {len(all_docs)} documents)")


if __name__ == "__main__":
    main()
