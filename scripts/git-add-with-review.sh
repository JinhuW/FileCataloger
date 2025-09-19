#!/usr/bin/env bash

# Git add with automatic code review
# This script wraps git add to run code review before staging files

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to show usage
show_usage() {
    echo "Usage: $0 [options] [<pathspec>...]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  --skip-review       Skip code review"
    echo "  --force-review      Force review even for cached files"
    echo "  -A, --all           Add all modified files"
    echo "  -p, --patch         Interactive patch mode"
    echo "  -u, --update        Update tracked files"
    echo ""
    echo "Environment variables:"
    echo "  SKIP_REVIEW=1       Skip code review globally"
    echo ""
    echo "Examples:"
    echo "  $0 src/main/index.ts"
    echo "  $0 --skip-review ."
    echo "  SKIP_REVIEW=1 $0 --all"
}

# Parse arguments
SKIP_REVIEW=${SKIP_REVIEW:-0}
FORCE_REVIEW=0
GIT_ADD_ARGS=""
FILES_TO_ADD=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        --skip-review)
            SKIP_REVIEW=1
            shift
            ;;
        --force-review)
            FORCE_REVIEW=1
            shift
            ;;
        -A|--all|-p|--patch|-u|--update)
            GIT_ADD_ARGS="$GIT_ADD_ARGS $1"
            shift
            ;;
        -*)
            # Pass through other git add options
            GIT_ADD_ARGS="$GIT_ADD_ARGS $1"
            shift
            ;;
        *)
            # File or directory path
            FILES_TO_ADD="$FILES_TO_ADD $1"
            shift
            ;;
    esac
done

# If force review is set, clear cache
if [ "$FORCE_REVIEW" = "1" ]; then
    echo -e "${YELLOW}🔄 Clearing review cache...${NC}"
    rm -rf .claude/review-cache/*
fi

# Run pre-stage hook if review is not skipped
if [ "$SKIP_REVIEW" != "1" ]; then
    # Export environment for the hook
    export SKIP_REVIEW=$SKIP_REVIEW

    # Run the pre-stage hook
    if [ -x .husky/pre-stage ]; then
        echo -e "${CYAN}🤖 Running pre-stage code review...${NC}"
        if ! .husky/pre-stage $FILES_TO_ADD; then
            echo -e "${RED}❌ Code review failed. Files not staged.${NC}"
            echo ""
            echo "To skip review and stage anyway, use:"
            echo "  $0 --skip-review $GIT_ADD_ARGS $FILES_TO_ADD"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️  Pre-stage hook not found or not executable${NC}"
    fi
fi

# Run actual git add command
echo -e "${BLUE}📦 Staging files...${NC}"
git add $GIT_ADD_ARGS $FILES_TO_ADD

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Files staged successfully!${NC}"

    # Show what was staged
    STAGED_COUNT=$(git diff --cached --name-only | wc -l | tr -d ' ')
    if [ "$STAGED_COUNT" -gt 0 ]; then
        echo ""
        echo -e "${CYAN}📋 Staged files ($STAGED_COUNT):${NC}"
        git diff --cached --name-only | head -20 | while read -r file; do
            echo "   • $file"
        done
        if [ "$STAGED_COUNT" -gt 20 ]; then
            echo "   ... and $((STAGED_COUNT - 20)) more"
        fi
    fi
else
    echo -e "${RED}❌ Failed to stage files${NC}"
    exit 1
fi