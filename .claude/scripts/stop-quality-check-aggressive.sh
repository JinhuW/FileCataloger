#!/bin/bash

# Post-interrupt quality check script with aggressive Claude Code prompting
# This version is designed to strongly prompt Claude Code to fix issues automatically

# Don't use 'set -e' as we want to continue even if checks fail
# We'll handle errors gracefully in each check

# Configuration
PROJECT_DIR="/Users/jinhu/Development/File_Cataloger_Project/FileCataloger"
LOG_FILE="/tmp/fc_quality_check.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Navigate to project directory
if ! cd "$PROJECT_DIR" 2>/dev/null; then
    echo -e "${RED}❌ Failed to navigate to project directory${NC}" >&2
    echo "Directory: $PROJECT_DIR" >&2
    exit 0  # Exit gracefully even on error
fi

# Verify we're in the correct directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Not in FileCataloger project directory${NC}" >&2
    echo "Current directory: $(pwd)" >&2
    exit 0  # Exit gracefully even on error
fi

# Clear previous log
> "$LOG_FILE"

echo ""
echo "🔍 Running post-interrupt quality checks..."
echo "══════════════════════════════════════════════════════"

# Initialize counters and arrays
TOTAL_CHECKS=0
PASSED_CHECKS=0
CRITICAL_ERRORS=0
WARNINGS=0
CLAUDE_ACTIONS=()

# Function to run a check
run_check() {
    local name=$1
    local command=$2
    local emoji=$3
    local is_critical=$4
    local fix_command=$5
    local fix_description=$6

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

    printf "${emoji} %-15s ... " "$name"

    # Run the command and capture output (allow failures)
    if OUTPUT=$(eval "$command" 2>&1); then
        echo -e "${GREEN}✅ Passed${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        echo "[PASSED] $name" >> "$LOG_FILE"
    else
        if [ "$is_critical" = "true" ]; then
            echo -e "${RED}❌ Failed${NC}"
            CRITICAL_ERRORS=$((CRITICAL_ERRORS + 1))
            echo "[CRITICAL ERROR] $name" >> "$LOG_FILE"

            # Add to Claude actions
            if [ -n "$fix_command" ]; then
                CLAUDE_ACTIONS+=("${emoji} ${RED}CRITICAL:${NC} $fix_description")
                CLAUDE_ACTIONS+=("   ${CYAN}COMMAND:${NC} $fix_command")
                CLAUDE_ACTIONS+=("")
            fi
        else
            echo -e "${YELLOW}⚠️  Warning${NC}"
            WARNINGS=$((WARNINGS + 1))
            echo "[WARNING] $name" >> "$LOG_FILE"

            # Add to Claude actions
            if [ -n "$fix_command" ]; then
                CLAUDE_ACTIONS+=("${emoji} ${YELLOW}WARNING:${NC} $fix_description")
                CLAUDE_ACTIONS+=("   ${CYAN}COMMAND:${NC} $fix_command")
                CLAUDE_ACTIONS+=("")
            fi
        fi

        # Show first few lines of error
        ERROR_PREVIEW=$(echo "$OUTPUT" | head -n 2 | sed 's/^/       /')
        if [ -n "$ERROR_PREVIEW" ]; then
            echo -e "${RED}$ERROR_PREVIEW${NC}"
        fi

        # Log full output
        echo "$OUTPUT" >> "$LOG_FILE"
        echo "---" >> "$LOG_FILE"
    fi
}

# Run quality checks with fix commands
run_check "TypeScript" \
    "yarn typecheck" \
    "📘" \
    "true" \
    "yarn typecheck" \
    "TypeScript errors detected - review and fix type errors"

run_check "ESLint" \
    "yarn lint" \
    "🔧" \
    "true" \
    "yarn lint --fix && yarn lint" \
    "ESLint violations found - auto-fix what's possible, then fix remaining issues"

run_check "Prettier" \
    "yarn format:check" \
    "🎨" \
    "false" \
    "yarn format" \
    "Code formatting issues - auto-format all files"

# Check for console.log usage (specific to this project's CODE.md)
echo -n "🚫 console.log    ... "
CONSOLE_LOG_FILES=$(grep -r "console\.log" src --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | cut -d: -f1 | sort -u | head -5)
if [ -z "$CONSOLE_LOG_FILES" ]; then
    echo -e "${GREEN}✅ Passed${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${RED}❌ Found${NC}"
    CRITICAL_ERRORS=$((CRITICAL_ERRORS + 1))
    echo "   Files with console.log:"
    echo "$CONSOLE_LOG_FILES" | head -3 | sed 's/^/       /'

    CLAUDE_ACTIONS+=("🚫 ${RED}CRITICAL:${NC} Remove all console.log statements - use Logger module instead (CODE.md requirement)")
    CLAUDE_ACTIONS+=("   ${CYAN}FILES:${NC} $(echo $CONSOLE_LOG_FILES | tr '\n' ' ')")
    CLAUDE_ACTIONS+=("")
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

echo "══════════════════════════════════════════════════════"

# Summary report
echo ""
echo "📊 Summary:"
echo "   Total checks: $TOTAL_CHECKS"
echo -e "   Passed: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "   Warnings: ${YELLOW}$WARNINGS${NC}"
echo -e "   Critical errors: ${RED}$CRITICAL_ERRORS${NC}"

# Generate Claude Code prompt if issues found
if [ $CRITICAL_ERRORS -gt 0 ] || [ $WARNINGS -gt 0 ]; then
    echo ""
    echo "══════════════════════════════════════════════════════"
    echo -e "${MAGENTA}🤖 CLAUDE CODE: IMMEDIATE ACTION REQUIRED${NC}"
    echo "══════════════════════════════════════════════════════"
    echo ""
    echo -e "${CYAN}The post-interrupt quality check found issues that need to be fixed.${NC}"
    echo -e "${CYAN}Please execute the following commands IN ORDER:${NC}"
    echo ""

    # Display all collected actions
    for action in "${CLAUDE_ACTIONS[@]}"; do
        echo -e "$action"
    done

    echo "══════════════════════════════════════════════════════"
    echo -e "${MAGENTA}IMPORTANT: Fix all CRITICAL issues before continuing.${NC}"
    echo -e "${MAGENTA}After running the commands above, re-run quality checks with:${NC}"
    echo -e "${CYAN}yarn quality:check${NC}"
    echo "══════════════════════════════════════════════════════"

    # Also create a quick-fix script
    FIX_SCRIPT="/tmp/fc_quick_fix.sh"
    echo "#!/bin/bash" > "$FIX_SCRIPT"
    echo "cd $PROJECT_DIR" >> "$FIX_SCRIPT"
    echo "echo '🔧 Running auto-fixes...'" >> "$FIX_SCRIPT"
    echo "yarn lint --fix || true" >> "$FIX_SCRIPT"
    echo "yarn format || true" >> "$FIX_SCRIPT"
    echo "echo '✅ Auto-fixes complete. Now checking remaining issues...'" >> "$FIX_SCRIPT"
    echo "yarn typecheck" >> "$FIX_SCRIPT"
    echo "yarn lint" >> "$FIX_SCRIPT"
    chmod +x "$FIX_SCRIPT"

    echo ""
    echo -e "${GREEN}💡 TIP: A quick-fix script has been created at:${NC}"
    echo -e "${CYAN}$FIX_SCRIPT${NC}"
    echo -e "${GREEN}Claude Code, you can run this script to fix most issues automatically.${NC}"
else
    echo ""
    echo -e "${GREEN}✨ All quality checks passed! Great job maintaining code quality.${NC}"
fi

echo ""

# Always exit with success (0) since this is a non-blocking hook
# The purpose is to report issues, not to fail the hook
exit 0