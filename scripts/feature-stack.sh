#!/usr/bin/env bash
# Manage the `## Current Feature` and `## Feature Stack` sections of CLAUDE.md.
#
# Subcommands:
#   set   <name>   Set Current Feature to <name>. Stack is not touched.
#   push  <name>   Push current onto stack top, then set Current to <name>.
#   pop            Pop stack top and set it as Current.
#   drop  <name>   Remove <name> from stack (Current untouched).
#   list           Print Current + Stack (human-readable).
#   read-stack     Emit stack entries as `name|pushed_date` lines (top first).
#
# Side effect: updates CLAUDE.md.
# Exit: 0 success, 1 failure.

set -euo pipefail

CLAUDE_MD="${CLAUDE_PROJECT_DIR:-$(pwd)}/CLAUDE.md"
TODAY=$(date +%Y-%m-%d)

ensure_file() {
  if [ ! -f "$CLAUDE_MD" ]; then
    printf '# 프로젝트 가이드\n\n' > "$CLAUDE_MD"
  fi
}

get_current() {
  [ -f "$CLAUDE_MD" ] || return 0
  awk '
    /^## Current Feature$/{flag=1; next}
    /^## /{flag=0}
    flag && /^- name:/{sub(/^- name: */, ""); print; exit}
    flag && /^- \*\*이름\*\*:/{sub(/^- \*\*이름\*\*: */, ""); print; exit}
  ' "$CLAUDE_MD"
}

# Each line: "name|pushed_date"  (top = first line)
get_stack() {
  [ -f "$CLAUDE_MD" ] || return 0
  awk '
    /^## Feature Stack$/{flag=1; next}
    /^## /{flag=0}
    flag && /^- name:/ {
      line=$0
      sub(/^- name: */, "", line)
      name=line; date=""
      if (match(line, / \(pushed: [^)]+\)/)) {
        name=substr(line, 1, RSTART-1)
        date=substr(line, RSTART+10, RLENGTH-11)
      }
      printf "%s|%s\n", name, date
    }
  ' "$CLAUDE_MD"
}

write_current() {
  local name="$1"
  ensure_file
  perl -i -0777 -pe 's/\n*## Current Feature\n(?:-[^\n]*\n)*//g' "$CLAUDE_MD"
  {
    printf '\n## Current Feature\n'
    printf -- '- name: %s\n' "$name"
    printf -- '- updated: %s\n' "$TODAY"
  } >> "$CLAUDE_MD"
}

# Replace the Feature Stack section with the given entries.
# Input on stdin: lines of "name|date" (top first). Empty input clears the section.
write_stack_stdin() {
  ensure_file
  local content
  content=$(cat)
  perl -i -0777 -pe 's/\n*## Feature Stack\n(?:-[^\n]*\n)*//g' "$CLAUDE_MD"
  if [ -n "$content" ]; then
    {
      printf '\n## Feature Stack\n'
      while IFS='|' read -r n d; do
        [ -z "$n" ] && continue
        if [ -n "$d" ]; then
          printf -- '- name: %s (pushed: %s)\n' "$n" "$d"
        else
          printf -- '- name: %s\n' "$n"
        fi
      done <<<"$content"
    } >> "$CLAUDE_MD"
  fi
}

case "${1:-list}" in
  set)
    NAME="${2:-}"
    [ -n "$NAME" ] || { echo "❌ 'set' requires a name." >&2; exit 1; }
    write_current "$NAME"
    echo "✓ Current Feature = $NAME"
    ;;
  push)
    NAME="${2:-}"
    [ -n "$NAME" ] || { echo "❌ 'push' requires a name." >&2; exit 1; }
    CURRENT=$(get_current)
    STACK=$(get_stack)
    if [ -n "$CURRENT" ] && [ "$CURRENT" != "$NAME" ]; then
      COMBINED=$(printf '%s|%s\n' "$CURRENT" "$TODAY")
      if [ -n "$STACK" ]; then
        COMBINED=$(printf '%s\n%s' "$COMBINED" "$STACK")
      fi
      # Dedupe: drop any prior occurrence of CURRENT or NAME (NAME shouldn't sit in the stack after becoming Current)
      NEW_STACK=$(awk -F'|' -v n="$NAME" '!seen[$1]++ && $1!=n' <<<"$COMBINED")
      printf '%s' "$NEW_STACK" | write_stack_stdin
      echo "✓ push: Current = $NAME (이전 '$CURRENT' → 스택 top)"
    else
      echo "ℹ️ push 할 Current 가 없거나 같은 이름 — 단순 set 처리"
    fi
    write_current "$NAME"
    ;;
  pop)
    STACK=$(get_stack)
    if [ -z "$STACK" ]; then
      echo "❌ 스택이 비어 있습니다." >&2; exit 1
    fi
    TOP=$(head -n1 <<<"$STACK")
    REST=$(tail -n +2 <<<"$STACK")
    TOP_NAME="${TOP%%|*}"
    printf '%s' "$REST" | write_stack_stdin
    write_current "$TOP_NAME"
    echo "✓ pop: Current = $TOP_NAME (스택에서 꺼냄)"
    ;;
  drop)
    NAME="${2:-}"
    [ -n "$NAME" ] || { echo "❌ 'drop' requires a name." >&2; exit 1; }
    STACK=$(get_stack)
    NEW_STACK=$(awk -F'|' -v n="$NAME" '$1!=n' <<<"$STACK")
    if [ "$STACK" = "$NEW_STACK" ]; then
      echo "❌ 스택에 '$NAME' 없음." >&2; exit 1
    fi
    printf '%s' "$NEW_STACK" | write_stack_stdin
    echo "✓ drop: '$NAME' 을 스택에서 제거"
    ;;
  list)
    CURRENT=$(get_current)
    STACK=$(get_stack)
    echo "Current: ${CURRENT:-(없음)}"
    if [ -n "$STACK" ]; then
      echo "Stack (top → bottom):"
      awk -F'|' '{
        if ($2 != "") printf "  %d) %s (pushed: %s)\n", NR, $1, $2
        else          printf "  %d) %s\n", NR, $1
      }' <<<"$STACK"
    else
      echo "Stack: (비어 있음)"
    fi
    ;;
  read-stack)
    get_stack
    ;;
  *)
    echo "❌ Unknown subcommand: $1" >&2
    echo "Usage: feature-stack.sh {set|push|pop|drop|list|read-stack} [name]" >&2
    exit 1
    ;;
esac
