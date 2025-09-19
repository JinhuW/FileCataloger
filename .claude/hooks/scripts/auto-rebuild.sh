#!/bin/bash

# FileCataloger Auto-Rebuild Hook Script
# Intelligently rebuilds the application after code changes
# Version: 1.0.0

set -euo pipefail

# Configuration
PROJECT_ROOT="/Users/jinhu/Development/File_Cataloger_Project/FileCataloger"
CHANGE_LOG="/tmp/claude_fc_changes.log"
BUILD_STATE="/tmp/claude_fc_build_state"
DEV_SERVER_PID_FILE="/tmp/claude_fc_dev.pid"
BUILD_LOG="/tmp/claude_fc_build.log"
HOOK_CONFIG="${PROJECT_ROOT}/.claude/hooks/post-code-completion.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# Change to project directory
cd "$PROJECT_ROOT"

# Function to log with timestamp
log() {
    echo -e "${CYAN}[$(date '+%H:%M:%S')]${RESET} $1"
}

# Function to detect changed file types
detect_changes() {
    local changes_file="$1"
    local has_source=false
    local has_native=false
    local has_config=false
    local has_styles=false
    local has_tests=false

    if [ -f "$changes_file" ]; then
        while IFS= read -r file; do
            case "$file" in
                *.ts|*.tsx|*.js|*.jsx)
                    if [[ "$file" == *"test"* ]] || [[ "$file" == *"spec"* ]]; then
                        has_tests=true
                    else
                        has_source=true
                    fi
                    ;;
                *.cc|*.h|*.gyp)
                    has_native=true
                    ;;
                *.json|webpack.*.js|tsconfig*)
                    has_config=true
                    ;;
                *.css|*.scss|*.less|tailwind.config.*)
                    has_styles=true
                    ;;
            esac
        done < "$changes_file"
    fi

    echo "$has_source:$has_native:$has_config:$has_styles:$has_tests"
}

# Function to check if dev server is running
is_dev_running() {
    if [ -f "$DEV_SERVER_PID_FILE" ]; then
        local pid=$(cat "$DEV_SERVER_PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# Function to stop dev server gracefully
stop_dev_server() {
    if is_dev_running; then
        local pid=$(cat "$DEV_SERVER_PID_FILE")
        log "${YELLOW}⏹  Stopping dev server (PID: $pid)...${RESET}"
        kill -TERM "$pid" 2>/dev/null || true
        sleep 1
        if kill -0 "$pid" 2>/dev/null; then
            kill -KILL "$pid" 2>/dev/null || true
        fi
        rm -f "$DEV_SERVER_PID_FILE"
    fi
}

# Function to start dev server in background
start_dev_server() {
    log "${GREEN}🚀 Starting development server...${RESET}"
    nohup yarn dev > "$BUILD_LOG" 2>&1 &
    local pid=$!
    echo "$pid" > "$DEV_SERVER_PID_FILE"

    # Wait a bit to check if it started successfully
    sleep 2
    if kill -0 "$pid" 2>/dev/null; then
        log "${GREEN}✅ Dev server started (PID: $pid)${RESET}"
        log "   📝 Logs: tail -f $BUILD_LOG"
    else
        log "${RED}❌ Failed to start dev server${RESET}"
        tail -n 10 "$BUILD_LOG" 2>/dev/null
        rm -f "$DEV_SERVER_PID_FILE"
        return 1
    fi
}

# Function to perform smart rebuild
smart_rebuild() {
    local changes="$1"
    IFS=':' read -r has_source has_native has_config has_styles has_tests <<< "$changes"

    local rebuild_needed=false
    local restart_needed=false
    local commands=()

    # Determine what needs to be done
    if [ "$has_native" = "true" ]; then
        log "${BOLD}🔨 Native code changes detected${RESET}"
        commands+=("yarn rebuild:native")
        rebuild_needed=true
        restart_needed=true
    fi

    if [ "$has_config" = "true" ]; then
        log "${BOLD}⚙️  Configuration changes detected${RESET}"
        rebuild_needed=true
        restart_needed=true
    fi

    if [ "$has_source" = "true" ]; then
        log "${BOLD}📦 Source code changes detected${RESET}"
        commands+=("yarn typecheck")
        commands+=("yarn lint")
        rebuild_needed=true
    fi

    if [ "$has_styles" = "true" ]; then
        log "${BOLD}🎨 Style changes detected${RESET}"
        rebuild_needed=true
    fi

    if [ "$has_tests" = "true" ]; then
        log "${BOLD}🧪 Test changes detected${RESET}"
        commands+=("yarn test --run")
    fi

    # Execute build commands
    if [ ${#commands[@]} -gt 0 ] || [ "$rebuild_needed" = "true" ]; then
        echo ""
        log "${BLUE}${BOLD}═══════════════════════════════════════${RESET}"
        log "${BLUE}${BOLD}🔄 AUTO-REBUILD INITIATED${RESET}"
        log "${BLUE}${BOLD}═══════════════════════════════════════${RESET}"

        # Run validation commands first
        for cmd in "${commands[@]}"; do
            log "📋 Running: ${CYAN}$cmd${RESET}"
            if $cmd > /tmp/cmd_output.log 2>&1; then
                log "${GREEN}  ✅ Success${RESET}"
            else
                log "${YELLOW}  ⚠️  Warning: Check output${RESET}"
                tail -n 5 /tmp/cmd_output.log | sed 's/^/     /'
            fi
        done

        # Rebuild if needed
        if [ "$rebuild_needed" = "true" ]; then
            log "🏗️  Building application..."
            if yarn build > /tmp/build_output.log 2>&1; then
                log "${GREEN}  ✅ Build successful${RESET}"
            else
                log "${RED}  ❌ Build failed${RESET}"
                tail -n 10 /tmp/build_output.log | sed 's/^/     /'
                return 1
            fi
        fi

        # Restart dev server if needed
        if [ "$restart_needed" = "true" ] && is_dev_running; then
            log "♻️  Restarting dev server..."
            stop_dev_server
            start_dev_server
        elif ! is_dev_running && [ "$CLAUDE_AUTO_START_DEV" = "true" ]; then
            start_dev_server
        fi

        log "${BLUE}${BOLD}═══════════════════════════════════════${RESET}"
        log "${GREEN}${BOLD}✨ Auto-rebuild complete${RESET}"
        log "${BLUE}${BOLD}═══════════════════════════════════════${RESET}"
        echo ""
    else
        log "📝 Minor changes detected - no rebuild needed"
    fi
}

# Function to track changes
track_change() {
    local file_path="$1"
    if [ -n "$file_path" ] && [ "$file_path" != "null" ]; then
        echo "$file_path" >> "$CHANGE_LOG"

        # Remove duplicates
        if [ -f "$CHANGE_LOG" ]; then
            sort -u "$CHANGE_LOG" > "${CHANGE_LOG}.tmp"
            mv "${CHANGE_LOG}.tmp" "$CHANGE_LOG"
        fi
    fi
}

# Main execution
main() {
    # Get context from Claude Code environment variables
    local tool_name="${TOOL_NAME:-}"
    local file_path="${FILE_PATH:-}"
    local session_state="${CLAUDE_SESSION_STATE:-active}"

    # Initialize change log if it doesn't exist
    touch "$CHANGE_LOG"

    # Handle different triggers
    case "$tool_name" in
        "Edit"|"MultiEdit"|"Write")
            # Track the changed file
            track_change "$file_path"

            # Get change count
            local change_count=$(wc -l < "$CHANGE_LOG" | tr -d ' ')

            # Check if we should trigger rebuild
            if [ "$change_count" -ge 3 ] || [[ "$file_path" == *"package.json"* ]]; then
                log "🔍 Analyzing ${change_count} changed files..."
                local changes=$(detect_changes "$CHANGE_LOG")
                smart_rebuild "$changes"

                # Clear change log after rebuild
                > "$CHANGE_LOG"
            else
                log "📝 Change tracked (${change_count}/3) - ${file_path##*/}"
            fi
            ;;

        "SessionIdle"|"BatchComplete")
            # Session idle or batch complete - check for pending changes
            if [ -s "$CHANGE_LOG" ]; then
                local change_count=$(wc -l < "$CHANGE_LOG" | tr -d ' ')
                log "⏸  Session idle with ${change_count} pending changes"

                local changes=$(detect_changes "$CHANGE_LOG")
                smart_rebuild "$changes"

                # Clear change log
                > "$CHANGE_LOG"
            fi
            ;;

        "SessionEnd")
            # Clean up on session end
            log "👋 Session ending - cleaning up..."

            # Final build if there are changes
            if [ -s "$CHANGE_LOG" ]; then
                local changes=$(detect_changes "$CHANGE_LOG")
                smart_rebuild "$changes"
            fi

            # Optionally stop dev server
            if [ "$CLAUDE_STOP_DEV_ON_END" = "true" ]; then
                stop_dev_server
            fi

            # Clean up temporary files
            rm -f "$CHANGE_LOG" "$BUILD_STATE"
            ;;

        *)
            # Manual trigger or unknown
            if [ -s "$CHANGE_LOG" ]; then
                local changes=$(detect_changes "$CHANGE_LOG")
                smart_rebuild "$changes"
                > "$CHANGE_LOG"
            else
                log "ℹ️  No changes to rebuild"
            fi
            ;;
    esac
}

# Execute main function
main "$@"