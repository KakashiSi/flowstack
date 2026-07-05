#!/usr/bin/env python3
import urllib.request, json

API_KEY = "5ac830ddaa276d14320257efcef0ad54"

URLS = [
    "https://pflow.org/",
    "https://pflow.org/guide",
    "https://pflow.org/tools",
    "https://pflow.org/blog",
    "https://pflow.org/blog/what-is-pflow",
    "https://pflow.org/blog/best-ai-workflow-tools-2026",
    "https://pflow.org/blog/reduce-ai-agent-costs",
    "https://pflow.org/blog/free-ai-workflow-tools",
    "https://pflow.org/vs/pflow-vs-make",
    "https://pflow.org/vs/pflow-vs-n8n",
    "https://pflow.org/vs/pflow-vs-zapier",
]

payload = json.dumps({"type": "URL_UPDATED", "urls": URLS}).encode()
req = urllib.request.Request(
    "https://api.speedyindex.com/v2/task/google/indexing",
    data=payload,
    headers={"Authorization": API_KEY, "Content-Type": "application/json"},
    method="POST"
)
with urllib.request.urlopen(req) as r:
    print(json.dumps(json.loads(r.read()), indent=2))
