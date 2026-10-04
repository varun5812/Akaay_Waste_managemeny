import sys
sys.path.insert(0, '.')
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
import main, ai_engine

test_cases = [
    'what is do when dry waste in road',
    'What items go into the green wet-waste bin versus blue dry-waste bin?',
    'both dry in water , what we need to do',
    'if dry waste and wat waste is mix',
    'what to do with dry waste',
    'what is dry waste',
    'My morning garbage has not been collected today. What should I do?',
    'how to despodse wst waste',
    'How can I reduce household waste?',
    'There is an overflowing public bin spilling waste on the road.',
    'What is the penalty for illegal dumping and how do I report roadside debris?',
    'who won the 1994 world cup'
]

print("TESTING UPGRADED ANSWERING STYLE & DIFFERENTIATION:\n")
for q in test_cases:
    res = ai_engine.analyze_and_route(q, 201, main.rows)
    print("="*70)
    print("USER QUERY:", q)
    print(f"ROUTING: {res['level']} | TRIGGER_REPORT: {res.get('trigger_report_flow')}")
    print("ANSWER:\n" + res['reply'])
    print()
