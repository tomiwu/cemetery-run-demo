#!/usr/bin/env bash
# Create the standard labels. Safe to run again (--force updates).
set -euo pipefail
REPO="${1:-tomiwu/cemetery-run-demo}"
label() { gh label create "$1" --repo "$REPO" --color "$2" --description "$3" --force; }
label "Sandcastle"         "F9A825" "Issues for the Sandcastle loop"
label "needs-validation"   "C5DEF5" "Waiting for a check by Tomasz or the owner bot"
label "hardware"           "5319E7" "Needs a real device (not for the loop)"
label "priority: critical" "B60205" "Do first"
label "priority: high"     "D93F0B" ""
label "priority: medium"   "FBCA04" "Default when no priority label is set"
label "priority: low"      "0E8A16" ""
label "prd"                "0052CC" "Product requirements"
