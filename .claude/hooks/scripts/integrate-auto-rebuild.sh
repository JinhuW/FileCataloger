#!/bin/bash

# Integration script for Auto-Rebuild Hook
# This script integrates with Claude Code's hook system

set -euo pipefail

PROJECT_ROOT="/Users/jinhu/Development/File_Cataloger_Project/FileCataloger"
HOOK_DIR="${PROJECT_ROOT}/.claude/hooks"
SCRIPTS_DIR="${HOOK_DIR}/scripts"
CHANGE_ANALYZER="${SCRIPTS_DIR}/change-analyzer.js"
BUILD_REPORTER="${SCRIPTS_DIR}/build-reporter.js"
AUTO_REBUILD="${SCRIPTS_DIR}/auto-rebuild.sh"
CHANGE_LOG="/tmp/claude_fc_changes.log"
ANALYSIS_FILE="/tmp/claude_fc_analysis.json"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
RESET='\033[0m'

# Change to project directory
cd "$PROJECT_ROOT"

# Function to handle different hook triggers
handle_hook() {
    local trigger="${1:-PostToolUse}"
    local tool_name="${TOOL_NAME:-}"
    local file_path="${FILE_PATH:-}"

    case "$trigger" in
        "PostToolUse")
            # Track changes from Edit/Write operations
            if [[ "$tool_name" =~ ^(Edit|MultiEdit|Write)$ ]] && [ -n "$file_path" ]; then
                echo "$file_path" >> "$CHANGE_LOG"

                # Quick feedback
                echo -e "${CYAN}📝 Change tracked: ${file_path##*/}${RESET}"

                # Check if we should analyze
                local change_count=$(wc -l < "$CHANGE_LOG" 2>/dev/null | tr -d ' ')
                if [ "$change_count" -ge 3 ]; then
                    analyze_and_build
                fi
            fi
            ;;

        "SessionIdle"|"BatchComplete")
            # Process any pending changes
            if [ -s "$CHANGE_LOG" ]; then
                echo -e "${YELLOW}⏸  Processing pending changes...${RESET}"
                analyze_and_build
            fi
            ;;

        "SessionEnd")
            # Final build and cleanup
            if [ -s "$CHANGE_LOG" ]; then
                echo -e "${YELLOW}🏁 Final build before session end...${RESET}"
                analyze_and_build
            fi
            cleanup
            ;;

        *)
            # Manual trigger
            if [ -s "$CHANGE_LOG" ]; then
                analyze_and_build
            else
                echo -e "${BLUE}ℹ️  No changes to process${RESET}"
            fi
            ;;
    esac
}

# Function to analyze changes and build
analyze_and_build() {
    # Run change analyzer
    echo -e "${CYAN}🔍 Analyzing changes...${RESET}"
    node "$CHANGE_ANALYZER" "$CHANGE_LOG" > "$ANALYSIS_FILE"

    # Check if build should be skipped
    if grep -q '"skip": true' "$ANALYSIS_FILE"; then
        echo -e "${GREEN}✅ Build recently completed - skipping${RESET}"
        return
    fi

    # Run build reporter with analysis
    echo -e "${CYAN}🔨 Starting intelligent rebuild...${RESET}"
    node "$BUILD_REPORTER" analysis "$ANALYSIS_FILE"

    # Clear change log after successful build
    > "$CHANGE_LOG"
}

# Function to cleanup
cleanup() {
    rm -f "$CHANGE_LOG" "$ANALYSIS_FILE"
    echo -e "${GREEN}✅ Cleanup complete${RESET}"
}

# Main execution
main() {
    # Get trigger type from argument or environment
    local trigger="${1:-${CLAUDE_HOOK_TRIGGER:-PostToolUse}}"

    # Handle the hook
    handle_hook "$trigger"
}

# Execute if run directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi