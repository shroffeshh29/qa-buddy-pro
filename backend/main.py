"""
QA Buddy Pro - Backend API
FastAPI server that powers the dashboard: RAG queries, test plan/case
generation, flaky test analysis, and Jira/Outlook integrations.
"""
import os
import io
import pandas as pd
import requests
from requests.auth import HTTPBasicAuth
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
JIRA_BASE_URL = os.getenv("JIRA_BASE_URL")
JIRA_EMAIL = os.getenv("JIRA_EMAIL")
JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN")
JIRA_PROJECT_KEY = os.getenv("JIRA_PROJECT_KEY")
COLLECTION_NAME = "qa_knowledge"

app = FastAPI(title="QA Buddy Pro API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Loading embedding model...")
embed_model = SentenceTransformer("all-MiniLM-L6-v2")
qdrant = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
groq_client = Groq(api_key=GROQ_API_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
jira_auth = HTTPBasicAuth(JIRA_EMAIL, JIRA_API_TOKEN)
print("Backend ready.")


class RagQuery(BaseModel):
    question: str


class TestPlanRequest(BaseModel):
    requirement: str


class TestCaseRequest(BaseModel):
    requirement: str


class FlakyAnalysisRequest(BaseModel):
    csv_text: str


class JiraFetchRequest(BaseModel):
    issue_key: str


class JiraCreateBugRequest(BaseModel):
    summary: str
    description: str


@app.get("/api/health")
def health():
    return {"status": "ok", "message": "QA Buddy Pro backend is running"}


@app.post("/api/rag-query")
def rag_query(req: RagQuery):
    query_vector = embed_model.encode(req.question).tolist()

    results = qdrant.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        limit=3,
    )
    context_items = [r.payload["text"] for r in results]
    context_text = "\n".join(f"- {item}" for item in context_items)

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
    query_vector = embed_model.encode(req.requirement).tolist()
    results = qdrant.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        limit=3,
    )
    context_text = "\n".join(f"- {r.payload['text']}" for r in results)

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

    supabase.table("test_plans").insert({
        "requirement": req.requirement,
        "generated_plan": plan,
        "source": "manual",
    }).execute()

    return {"plan": plan}


@app.post("/api/test-cases")
def generate_test_cases(req: TestCaseRequest):
    query_vector = embed_model.encode(req.requirement).tolist()
    results = qdrant.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        limit=3,
    )
    context_text = "\n".join(f"- {r.payload['text']}" for r in results)

    completion = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {
                "role": "system",
                "content": "You are a QA engineer. Generate test cases as a markdown table "
                            "with columns: ID, Title, Steps, Expected Result, Priority. "
                            "Cover positive, negative, and edge cases.",
            },
            {
                "role": "user",
                "content": f"Similar past test cases for reference:\n{context_text}\n\n"
                            f"Requirement:\n{req.requirement}",
            },
        ],
        temperature=0.3,
    )
    cases = completion.choices[0].message.content

    supabase.table("test_cases").insert({
        "requirement": req.requirement,
        "generated_cases": cases,
        "source": "manual",
    }).execute()

    return {"cases": cases}


@app.post("/api/flaky-analyzer")
def analyze_flaky_tests(req: FlakyAnalysisRequest):
    df = pd.read_csv(io.StringIO(req.csv_text))
    grouped = df.groupby("test_name")["status"].apply(list)

    results = []
    for test_name, statuses in grouped.items():
        total = len(statuses)
        passes = statuses.count("pass")
        fails = statuses.count("fail")
        flips = sum(1 for i in range(1, len(statuses)) if statuses[i] != statuses[i - 1])
        flip_rate = flips / (total - 1) if total > 1 else 0
        is_flaky = passes > 0 and fails > 0

        results.append({
            "test_name": test_name,
            "total_runs": total,
            "pass_rate": round(passes / total, 2),
            "flip_rate": round(flip_rate, 2),
            "flaky": is_flaky,
        })

    flaky_tests = [r for r in results if r["flaky"]]

    summary = "No flaky tests detected."
    if flaky_tests:
        flaky_names = ", ".join(r["test_name"] for r in flaky_tests)
        completion = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are a senior SDET. Given a list of flaky test names and "
                                "their pass/fail patterns, suggest the 2-3 most likely categories "
                                "of root cause (e.g. race conditions, test data dependency, "
                                "environment/network flakiness, timing issues). Be concise.",
                },
                {
                    "role": "user",
                    "content": f"Flaky tests detected: {flaky_names}\n\nFull data: {results}",
                },
            ],
            temperature=0.3,
        )
        summary = completion.choices[0].message.content

    supabase.table("flaky_analysis_runs").insert({
        "total_tests": len(results),
        "flaky_count": len(flaky_tests),
        "summary": summary,
    }).execute()

    return {"results": results, "summary": summary}


def _adf_to_text(adf: dict) -> str:
    """Jira Cloud returns descriptions in a nested 'document' format. Flatten to plain text."""
    if not adf:
        return ""
    parts = []

    def walk(node):
        if isinstance(node, dict):
            if node.get("type") == "text":
                parts.append(node.get("text", ""))
            for child in node.get("content", []) or []:
                walk(child)
        elif isinstance(node, list):
            for child in node:
                walk(child)

    walk(adf)
    return " ".join(parts)


@app.post("/api/jira/fetch-issue")
def jira_fetch_issue(req: JiraFetchRequest):
    url = f"{JIRA_BASE_URL}/rest/api/3/issue/{req.issue_key}"
    resp = requests.get(url, auth=jira_auth, headers={"Accept": "application/json"})
    resp.raise_for_status()
    data = resp.json()
    fields = data["fields"]

    result = {
        "key": data["key"],
        "summary": fields.get("summary", ""),
        "description": _adf_to_text(fields.get("description")),
        "status": fields.get("status", {}).get("name", ""),
    }

    supabase.table("jira_sync_log").insert({
        "direction": "pull",
        "jira_key": data["key"],
        "action_detail": "fetched ticket for test plan/case generation",
    }).execute()

    return result


@app.post("/api/jira/create-bug")
def jira_create_bug(req: JiraCreateBugRequest):
    url = f"{JIRA_BASE_URL}/rest/api/3/issue"
    payload = {
        "fields": {
            "project": {"key": JIRA_PROJECT_KEY},
            "summary": req.summary[:255],
            "description": {
                "type": "doc",
                "version": 1,
                "content": [
                    {"type": "paragraph", "content": [{"type": "text", "text": req.description}]}
                ],
            },
            "issuetype": {"name": "Bug"},
        }
    }
    resp = requests.post(url, auth=jira_auth, json=payload, headers={"Accept": "application/json"})
    resp.raise_for_status()
    data = resp.json()

    supabase.table("jira_sync_log").insert({
        "direction": "push",
        "jira_key": data["key"],
        "action_detail": "created bug report",
    }).execute()

    return {"key": data["key"], "url": f"{JIRA_BASE_URL}/browse/{data['key']}"}