#!/usr/bin/env bash
# Print the project's Current Feature name (from CLAUDE.md) to stdout.
# Empty output + exit 0 when no feature is set — callers decide how to handle.
#
# Format (v1.5.7+): inside "## Current Feature" section, look for
#   - name: <feature-name>
# Legacy format (pre v1.5.7) also supported for backward compat:
#   - **이름**: <feature-name>
#
# Usage (in a command's bash block):
#   NAME=$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-current-feature.sh")

set -euo pipefail

CLAUDE_MD="${CLAUDE_PROJECT_DIR:-$(pwd)}/CLAUDE.md"

if [ ! -f "$CLAUDE_MD" ]; then
  exit 0
fi

awk '
/^## Current Feature$/{flag=1; next}
/^## /{flag=0}
flag && /^- name:/{sub(/^- name: */, ""); print; exit}
flag && /^- \*\*이름\*\*:/{sub(/^- \*\*이름\*\*: */, ""); print; exit}
' "$CLAUDE_MD"
