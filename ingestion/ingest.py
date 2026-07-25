"""
QA Buddy Pro - Ingestion Script
Reads test cases from a CSV, turns each row into an embedding using
sentence-transformers (runs locally, no external API needed), and
uploads them into a Qdrant Cloud collection.
"""
import os
import uuid
import pandas as pd
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

load_dotenv(dotenv_path="../backend/.env")

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
COLLECTION_NAME = "qa_knowledge"

print("Loading embedding model (first run downloads it, ~90MB, be patient)...")
model = SentenceTransformer("all-MiniLM-L6-v2")

print("Connecting to Qdrant...")
client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

existing = [c.name for c in client.get_collections().collections]
if COLLECTION_NAME not in existing:
    print(f"Creating collection '{COLLECTION_NAME}'...")
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=384, distance=Distance.COSINE),
    )
else:
    print(f"Collection '{COLLECTION_NAME}' already exists, adding to it.")

csv_path = "../sample_data/test_cases_sample.csv"
df = pd.read_csv(csv_path)
print(f"Loaded {len(df)} rows from {csv_path}")

points = []
for _, row in df.iterrows():
    text = f"{row['title']}. Feature: {row['feature']}. Steps: {row['steps']}. Expected: {row['expected_result']}."
    vector = model.encode(text).tolist()
    points.append(
        PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={
                "test_id": row["id"],
                "feature": row["feature"],
                "title": row["title"],
                "steps": row["steps"],
                "expected_result": row["expected_result"],
                "priority": row["priority"],
                "text": text,
            },
        )
    )

print(f"Uploading {len(points)} embedded points to Qdrant...")
client.upsert(collection_name=COLLECTION_NAME, points=points)
print("Done. Ingestion complete.")