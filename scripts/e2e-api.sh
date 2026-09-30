#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
COOKIE_JAR=$(mktemp)

cleanup() {
  rm -f "$COOKIE_JAR"
}
trap cleanup EXIT

echo "Starting Cairn API End-to-End Verification against $BASE_URL"

# 1. Trigger Demo Run
echo "[1/9] Initializing demo workflow and run..."
DEMO_RESP=$(curl -s -f -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/demo/run")
WORKFLOW_ID=$(echo "$DEMO_RESP" | node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync(0, "utf-8")); console.log(d.workflow.id);')
RUN_ID=$(echo "$DEMO_RESP" | node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync(0, "utf-8")); console.log(d.run.id);')

echo "  Created Workflow ID: $WORKFLOW_ID"
echo "  Created Run ID: $RUN_ID"

# 2. Advance Run through Pipeline Stages
echo "[2/9] Advancing run through pipeline state machine..."
CURRENT_STATUS="queued"
STEP=1
while [ "$CURRENT_STATUS" != "complete" ] && [ "$CURRENT_STATUS" != "failed" ] && [ $STEP -le 15 ]; do
  ADV_RESP=$(curl -s -f -X POST -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/runs/$RUN_ID/advance")
  CURRENT_STATUS=$(echo "$ADV_RESP" | node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync(0, "utf-8")); console.log(d.status);')
  CURRENT_STAGE=$(echo "$ADV_RESP" | node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync(0, "utf-8")); console.log(d.stage);')
  echo "  Step $STEP: stage=$CURRENT_STAGE, status=$CURRENT_STATUS"
  STEP=$((STEP + 1))
done

if [ "$CURRENT_STATUS" != "complete" ]; then
  echo "ERROR: Run did not reach complete status (got $CURRENT_STATUS)"
  exit 1
fi

# 3. Inspect Run Details and Counts
echo "[3/9] Verifying run counts and recent events..."
RUN_DETAILS=$(curl -s -f -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/runs/$RUN_ID")
RECORD_COUNT=$(echo "$RUN_DETAILS" | node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync(0, "utf-8")); console.log(d.counts.recordsKept);')
echo "  Run verified with $RECORD_COUNT records kept."

# 4. List Records with Search and Filter
echo "[4/9] Querying records..."
RECORDS_RESP=$(curl -s -f -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/runs/$RUN_ID/records?limit=5")
RECORD_ID=$(echo "$RECORDS_RESP" | node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync(0, "utf-8")); console.log(d.items[0]?.id || "");')

if [ -z "$RECORD_ID" ]; then
  echo "ERROR: No records returned for run"
  exit 1
fi
echo "  Found record ID: $RECORD_ID"

# 5. Inspect Evidence Receipt
echo "[5/9] Fetching receipt evidence and located text window..."
RECEIPT_RESP=$(curl -s -f -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/records/$RECORD_ID/receipts/job_title")
EVIDENCE_QUOTE=$(echo "$RECEIPT_RESP" | node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync(0, "utf-8")); console.log(d.receipt.evidence);')
echo "  Verified receipt evidence: $EVIDENCE_QUOTE"

# 6. List Sources
echo "[6/9] Verifying permitted sources..."
SOURCES_RESP=$(curl -s -f -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/runs/$RUN_ID/sources")
SOURCE_COUNT=$(echo "$SOURCES_RESP" | node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync(0, "utf-8")); console.log(d.items.length);')
echo "  Run has $SOURCE_COUNT sources."

# 7. Check Diff
echo "[7/9] Checking run diff..."
DIFF_RESP=$(curl -s -f -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/runs/$RUN_ID/diff")
ADDED_COUNT=$(echo "$DIFF_RESP" | node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync(0, "utf-8")); console.log(d.summary.added);')
echo "  Run diff summary: $ADDED_COUNT added records."

# 8. Export in CSV, JSON, and XLSX
echo "[8/9] Testing exports in CSV, JSON, and XLSX..."
for FORMAT in "json" "csv" "xlsx"; do
  EXP_RESP=$(curl -s -f -X POST -H "Content-Type: application/json" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -d "{\"format\":\"$FORMAT\"}" "$BASE_URL/api/runs/$RUN_ID/export")
  EXP_URL=$(echo "$EXP_RESP" | node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync(0, "utf-8")); console.log(d.url);')
  echo "  Export format $FORMAT generated: $EXP_URL"
done

# 9. Verify Run Controls on a Second Run
echo "[9/9] Verifying run controls (pause, resume, cancel)..."
SECOND_RUN=$(curl -s -f -X POST -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/workflows/$WORKFLOW_ID/runs")
SECOND_RUN_ID=$(echo "$SECOND_RUN" | node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync(0, "utf-8")); console.log(d.id);')
PREV_RUN_ID=$(echo "$SECOND_RUN" | node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync(0, "utf-8")); console.log(d.previousRunId);')

if [ "$PREV_RUN_ID" != "$RUN_ID" ]; then
  echo "ERROR: Second run did not link to previousRunId (got $PREV_RUN_ID, expected $RUN_ID)"
  exit 1
fi
echo "  Second run linked to previousRunId: $PREV_RUN_ID"

# Advance to discovering
curl -s -f -X POST -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/runs/$SECOND_RUN_ID/advance" > /dev/null

# Pause
PAUSE_RESP=$(curl -s -f -X POST -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/runs/$SECOND_RUN_ID/pause")
PAUSE_STATUS=$(echo "$PAUSE_RESP" | node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync(0, "utf-8")); console.log(d.status);')
echo "  Run paused: status=$PAUSE_STATUS"

# Resume
RESUME_RESP=$(curl -s -f -X POST -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/runs/$SECOND_RUN_ID/resume")
RESUME_STATUS=$(echo "$RESUME_RESP" | node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync(0, "utf-8")); console.log(d.status);')
echo "  Run resumed: status=$RESUME_STATUS"

# Cancel
CANCEL_RESP=$(curl -s -f -X POST -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/runs/$SECOND_RUN_ID/cancel")
CANCEL_STATUS=$(echo "$CANCEL_RESP" | node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync(0, "utf-8")); console.log(d.status);')
echo "  Run cancelled: status=$CANCEL_STATUS"

echo "All Cairn API End-to-End checks passed successfully."
