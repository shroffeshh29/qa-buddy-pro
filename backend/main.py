"""
QA Buddy Pro - Backend API
FastAPI server that powers the dashboard: RAG queries, test plan/case
generation, flaky test analysis, and Jira/Outlook integrations.
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from groq import Groq
from supabase import create_client

load_dotenv()

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
COLLECTION_NAME = "qa_knowledge"

app = FastAPI(title="QA Buddy Pro API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load these once at startup, not on every request - much faster
print("Loading embedding model...")
embed_model = SentenceTransformer("all-MiniLM-L6-v2")
qdrant = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
groq_client = Groq(api_key=GROQ_API_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
print("Backend ready.")


class RagQuery(BaseModel):
    question: str


class TestPlanRequest(BaseModel):
    requirement: str


@app.get("/api/health")
def health():
    return {"status": "ok", "message": "QA Buddy Pro backend is running"}


@app.post("/api/rag-query")
def rag_query(req: RagQuery):
    # 1. Embed the question
    query_vector = embed_model.encode(req.question).tolist()

    # 2. Search Qdrant for the most relevant test cases
    results = qdrant.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        limit=3,
    )
    context_items = [r.payload["text"] for r in results]
    context_text = "\n".join(f"- {item}" for item in context_items)

    # 3. Ask Groq to answer using only that context
    completion = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {
                "role": "system",
                "content": "You are a QA knowledge assistant. Answer using only the "
                            "provided context. If the context doesn't cover the question, "
                            "say so explicitly rather than guessing.",
            },
            {
                "role": "user",
                "content": f"Context:\n{context_text}\n\nQuestion: {req.question}",
            },
        ],
        temperature=0.3,
    )
    answer = completion.choices[0].message.content

    return {"answer": answer, "context_used": context_items}


@app.post("/api/test-plan")
def generate_test_plan(req: TestPlanRequest):
    # 1. Find similar past context (same retrieval pattern as rag-query)
    query_vector = embed_model.encode(req.requirement).tolist()
    results = qdrant.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        limit=3,
    )
    context_text = "\n".join(f"- {r.payload['text']}" for r in results)

    # 2. Ask Groq to write a structured test plan
    completion = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {
                "role": "system",
                "content": "You are a senior QA lead. Write a structured test plan in "
                            "markdown with these sections: Scope, Objectives, Test Strategy, "
                            "Entry/Exit Criteria, Risks, Resources, Schedule.",
            },
            {
                "role": "user",
                "content": f"Similar past test cases for reference:\n{context_text}\n\n"
                            f"Requirement:\n{req.requirement}",
            },
        ],
        temperature=0.3,
    )
    plan = completion.choices[0].message.content

    # 3. Save it to Supabase so it's remembered
    supabase.table("test_plans").insert({
        "requirement": req.requirement,
        "generated_plan": plan,
        "source": "manual",
    }).execute()

    return {"plan": plan}