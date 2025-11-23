#!/bin/bash

# FileCataloger Build Check and Refresh Hook
# Automatically validates and refreshes the application after file changes
# Author: Claude Code Hook System

set -euo pipefail

# Read input from Claude Code
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd')

# Function to log messages (only visible in transcript mode)
log() {
  echo "[Build Hook] $1" >&2
}

# Function to send feedback to Claude
send_feedback() {
  local decision="${1:-}"
  local reason="${2:-}"
  local additional_context="${3:-}"

  jq -n \
    --arg decision "$decision" \
    --arg reason "$reason" \
    --arg context "$additional_context" \
    '{
      decision: (if $decision != "" then $decision else null end),
      reason: $reason,
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: $context
      }
    }'
}

# Only process file modification tools
if [[ "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "Edit" && "$TOOL_NAME" != "NotebookEdit" ]]; then
  log "Skipping non-file-modification tool: $TOOL_NAME"
  exit 0
fi

# Skip non-source files (unless they're important config files)
if [[ -n "$FILE_PATH" ]]; then
  # Check if it's a source or config file
  if [[ ! "$FILE_PATH" =~ \.(ts|tsx|js|jsx|json|md)$ ]] && \
     [[ ! "$FILE_PATH" =~ (package\.json|tsconfig|webpack|\.env) ]]; then
    log "Skipping non-source file: $FILE_PATH"
    exit 0
  fi
fi

cd "$CWD" || exit 1

# Track if we found any issues
ISSUES_FOUND=false
ISSUE_MESSAGES=""

# 1. Check TypeScript compilation
log "Running TypeScript type check..."
if ! yarn typecheck 2>&1 | tee /tmp/typecheck_output.txt; then
  ISSUES_FOUND=true
  TYPECHECK_ERRORS=$(tail -20 /tmp/typecheck_output.txt)
  ISSUE_MESSAGES="TypeScript compilation errors detected:\n$TYPECHECK_ERRORS\n\n"
  log "TypeScript errors found"
fi

# 2. Check if the development server is running
DEV_SERVER_RUNNING=false
if pgrep -f "electron.*FileCataloger" > /dev/null 2>&1; then
  DEV_SERVER_RUNNING=true
  log "Development server is running"
else
  log "Development server is not running"
fi

# 3. Check for linting issues (non-blocking, just informational)
log "Running linter..."
LINT_OUTPUT=""
if yarn lint 2>&1 | tee /tmp/lint_output.txt | grep -q "error"; then
  LINT_ERRORS=$(grep -A 2 "error" /tmp/lint_output.txt | head -10)
  if [[ -n "$LINT_ERRORS" ]]; then
    ISSUE_MESSAGES="${ISSUE_MESSAGES}Linting issues detected (non-blocking):\n$LINT_ERRORS\n\n"
    log "Linting issues found (non-blocking)"
  fi
fi

# 4. Handle native module changes specially
if [[ "$FILE_PATH" =~ src/native/ ]]; then
  log "Native module change detected, rebuild may be required"
  ISSUE_MESSAGES="${ISSUE_MESSAGES}ℹ️ Native module file modified. Run 'yarn rebuild:native' if functionality is affected.\n"
fi

# 5. Check if main process files were changed (requires app restart)
NEEDS_RESTART=false
if [[ "$FILE_PATH" =~ src/main/ ]] || [[ "$FILE_PATH" =~ src/preload/ ]]; then
  NEEDS_RESTART=true
  log "Main process file changed - app restart recommended"
fi

# 6. Prepare response based on findings
if [[ "$ISSUES_FOUND" == "true" ]]; then
  # Block if there are TypeScript errors
  send_feedback "block" \
    "⚠️ Build issues detected. Please fix TypeScript errors before continuing." \
    "$ISSUE_MESSAGES"
elif [[ "$NEEDS_RESTART" == "true" ]] && [[ "$DEV_SERVER_RUNNING" == "true" ]]; then
  # Inform about needed restart but don't block
  send_feedback "" \
    "ℹ️ Main process file changed. The dev server will auto-reload." \
    "File $FILE_PATH modified. Electron will restart automatically via yarn dev.\n$ISSUE_MESSAGES"
elif [[ -n "$ISSUE_MESSAGES" ]]; then
  # Non-blocking issues (like lint warnings)
  send_feedback "" \
    "✓ Changes applied successfully with minor issues" \
    "$ISSUE_MESSAGES"
else
  # Everything is good
  if [[ "$DEV_SERVER_RUNNING" == "true" ]]; then
    log "All checks passed - application will hot-reload"
    echo "✅ Build validated successfully. Application is hot-reloading..."
  else
    log "All checks passed - dev server not running"
    echo "✅ Build validated. Run 'yarn dev' to start the application."
  fi
fi

# Clean up temp files
rm -f /tmp/typecheck_output.txt /tmp/lint_output.txt

exit 0