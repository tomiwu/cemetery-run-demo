#!/usr/bin/env bash
# Set branch protection on main: every CI job required, PR required, no force push, no deletion.
# Run on the host with GH_TOKEN = the repo PAT (Administration read/write). Safe to run again.
set -euo pipefail
REPO="${REPO:-tomiwu/cemetery-run-demo}"
gh api -X PUT "repos/$REPO/branches/main/protection" --input - <<'JSON'
{
  "required_status_checks": {
    "strict": false,
    "contexts": ["format", "lint", "typecheck", "test", "build", "e2e"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": true,
  "required_conversation_resolution": false
}
JSON
gh api "repos/$REPO/branches/main/protection" --jq '{checks: .required_status_checks.contexts, admins: .enforce_admins.enabled, force: .allow_force_pushes.enabled, pr: (.required_pull_request_reviews != null)}'
