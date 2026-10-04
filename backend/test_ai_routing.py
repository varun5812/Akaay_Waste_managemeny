import json
import sys
import urllib.request

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def test_query(msg, history=None):
    payload = json.dumps({'message': msg, 'history': history or []}).encode('utf-8')
    req = urllib.request.Request('http://127.0.0.1:8000/api/chat', data=payload, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        print(f"=== QUERY: {msg} ===")
        print(f"Level: {res['level']} | Latency: {res['response_time_ms']}ms | TriggerReport: {res.get('trigger_report_flow')}")
        print(f"Doc: {res['source_document']}")
        print(f"Reply:\n{res['reply']}\n" + "-"*60 + "\n")
        return res

print("TESTING 6 INTENT CATEGORIES:\n")

# 1. Greetings
test_query("hello")

# 2. FAQ
test_query("what goes in the blue bin")

# 3. RAG
test_query("what is the fine for illegal dumping")

# 4. LLM Specific Item
test_query("can I recycle a greasy pizza box")

# 5. Multi-turn Follow-up Context
test_query("how to dispose of cooking oil")
test_query("can I pour it down the sink", history=[{"role": "user", "text": "how to dispose of cooking oil"}])

# 6. Complaint / Reporting
test_query("the garbage truck missed my street today and bins are overflowing")

# 7. Unknown / Out of Domain
test_query("who won the 1994 world cup")
