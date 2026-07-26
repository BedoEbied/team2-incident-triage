#!/usr/bin/env bash
# Integration smoke test — Team 2, AI Incident & Log Triage.
# Run from anywhere once the backend is up on :4000.
#
#   bash scripts/smoke.sh
#
# Checks the golden numbers derived from the real 893-entry corpus. A failure here
# means the parser or the grouper is wrong, and nothing downstream can be trusted.

set -uo pipefail

BASE="${BASE:-http://localhost:4000/api}"
PASS=0
FAIL=0

ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAIL=$((FAIL+1)); }
note() { printf '\n\033[1m%s\033[0m\n' "$1"; }

note "1. Health"
if curl -sf "$BASE/health" | grep -q '"ok"'; then ok "GET /health"; else bad "GET /health"; fi

note "2. Auth"
TOKEN=$(curl -sf -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"oncall@demo.io","password":"demo1234"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin).get("token",""))' 2>/dev/null)

if [ -n "$TOKEN" ]; then ok "POST /auth/login returned a token"; else bad "POST /auth/login"; exit 1; fi

if curl -s -o /dev/null -w '%{http_code}' "$BASE/incidents" | grep -q '401'; then
  ok "unauthenticated /incidents is rejected with 401"
else
  bad "unauthenticated /incidents should be 401"
fi

AUTH=(-H "Authorization: Bearer $TOKEN")

note "3. Golden numbers"
curl -sf "${AUTH[@]}" "$BASE/incidents?sort=occurrences&order=desc" > /tmp/smoke-incidents.json
python3 - <<'PY'
import json, sys
d = json.load(open('/tmp/smoke-incidents.json'))
items = d.get('items', [])
total_occ = sum(i['occurrences'] for i in items)
top = max(items, key=lambda i: i['occurrences']) if items else None
checks = [
    ("incident count is 10", len(items) == 10, len(items)),
    ("occurrences sum to 893", total_occ == 893, total_occ),
    ("largest incident is 661", top and top['occurrences'] == 661, top['occurrences'] if top else None),
    ("largest is Critical", top and top['severity'] == 'Critical', top['severity'] if top else None),
    ("largest is the access_token incident",
     top and 'access_token' in (top['title'] + top['summary'] + top['rootCause']).lower()
     or (top and 'auth token' in top['title'].lower()), top['title'] if top else None),
]
for label, passed, actual in checks:
    print(("  \033[32mPASS\033[0m  " if passed else "  \033[31mFAIL\033[0m  ") + f"{label}  (got {actual})")
sys.exit(0 if all(c[1] for c in checks) else 1)
PY
if [ $? -eq 0 ]; then PASS=$((PASS+5)); else FAIL=$((FAIL+1)); fi

note "4. Stats"
curl -sf "${AUTH[@]}" "$BASE/stats" > /tmp/smoke-stats.json
python3 - <<'PY'
import json
s = json.load(open('/tmp/smoke-stats.json'))
sev = sum(s['bySeverity'].values()); st = sum(s['byStatus'].values())
trend = s.get('trend', [])
in_range = all('2026-04-23' <= t['date'] <= '2026-05-20' for t in trend)
for label, passed, actual in [
    ("bySeverity sums to total", sev == s['total'], f"{sev} vs {s['total']}"),
    ("byStatus sums to total", st == s['total'], f"{st} vs {s['total']}"),
    ("trend has 5 dated points", len(trend) == 5, len(trend)),
    ("trend dates inside 2026-04-23..2026-05-20", in_range, [t['date'] for t in trend]),
    ("topIncidents present", len(s.get('topIncidents', [])) > 0, len(s.get('topIncidents', []))),
]:
    print(("  \033[32mPASS\033[0m  " if passed else "  \033[31mFAIL\033[0m  ") + f"{label}  (got {actual})")
PY

note "5. Incident detail + status round-trip"
ID=$(python3 -c "import json;print(json.load(open('/tmp/smoke-incidents.json'))['items'][0]['id'])")
if curl -sf "${AUTH[@]}" "$BASE/incidents/$ID" | grep -q '"entries"'; then
  ok "GET /incidents/:id returns related log entries"
else
  bad "GET /incidents/:id missing entries"
fi

curl -sf "${AUTH[@]}" -X PATCH "$BASE/incidents/$ID" \
  -H 'Content-Type: application/json' -d '{"status":"Investigating"}' > /dev/null
if curl -sf "${AUTH[@]}" "$BASE/incidents/$ID" | grep -q '"Investigating"'; then
  ok "PATCH status persists"
else
  bad "PATCH status did not persist"
fi
if curl -sf "${AUTH[@]}" "$BASE/incidents/$ID" | grep -q '"history"'; then
  ok "status change is recorded in history"
else
  bad "history missing from incident detail"
fi

note "6. Graceful handling of an unsupported log file"
printf 'this is not a winston inspect dump\njust plain text\n' > /tmp/smoke-bad.log
CODE=$(curl -s -o /tmp/smoke-bad-resp.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$BASE/uploads" -F 'files=@/tmp/smoke-bad.log')
if [ "$CODE" = "400" ] && grep -q 'UNSUPPORTED_LOG_FORMAT' /tmp/smoke-bad-resp.json; then
  ok "bad upload returns 400 UNSUPPORTED_LOG_FORMAT"
else
  bad "bad upload returned $CODE ($(cat /tmp/smoke-bad-resp.json))"
fi

note "Result"
printf '  %d passed, %d failed\n\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
