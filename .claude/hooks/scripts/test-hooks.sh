#!/bin/bash

# Test script for FileCataloger Auto-Rebuild Hook System
# This script verifies that all hook components work correctly

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

PROJECT_ROOT="/Users/jinhu/Development/File_Cataloger_Project/FileCataloger"
HOOK_DIR="${PROJECT_ROOT}/.claude/hooks"
SCRIPTS_DIR="${HOOK_DIR}/scripts"

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

echo -e "${CYAN}${BOLD}═══════════════════════════════════════${RESET}"
echo -e "${CYAN}${BOLD}FileCataloger Hook System Test Suite${RESET}"
echo -e "${CYAN}${BOLD}═══════════════════════════════════════${RESET}\n"

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"

    echo -n "Testing $test_name... "

    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASSED${RESET}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAILED${RESET}"
        ((TESTS_FAILED++))
    fi
}

# Test 1: Check if all required scripts exist
echo -e "${BLUE}1. Checking script files...${RESET}"
run_test "auto-rebuild.sh exists" "[ -f '${SCRIPTS_DIR}/auto-rebuild.sh' ]"
run_test "change-analyzer.js exists" "[ -f '${SCRIPTS_DIR}/change-analyzer.js' ]"
run_test "build-reporter.js exists" "[ -f '${SCRIPTS_DIR}/build-reporter.js' ]"
run_test "integrate-auto-rebuild.sh exists" "[ -f '${SCRIPTS_DIR}/integrate-auto-rebuild.sh' ]"

# Test 2: Check if scripts are executable
echo -e "\n${BLUE}2. Checking script permissions...${RESET}"
run_test "auto-rebuild.sh is executable" "[ -x '${SCRIPTS_DIR}/auto-rebuild.sh' ]"
run_test "integrate-auto-rebuild.sh is executable" "[ -x '${SCRIPTS_DIR}/integrate-auto-rebuild.sh' ]"

# Test 3: Check configuration files
echo -e "\n${BLUE}3. Checking configuration files...${RESET}"
run_test "post-code-completion.json exists" "[ -f '${HOOK_DIR}/post-code-completion.json' ]"
run_test "settings.local.json exists" "[ -f '${PROJECT_ROOT}/.claude/settings.local.json' ]"
run_test "hook config is valid JSON" "node -e 'JSON.parse(require(\"fs\").readFileSync(\"${HOOK_DIR}/post-code-completion.json\"))'"

# Test 4: Test change analyzer
echo -e "\n${BLUE}4. Testing change analyzer...${RESET}"
# Create test change log
TEST_CHANGE_LOG="/tmp/test_changes.log"
cat > "$TEST_CHANGE_LOG" << EOF
${PROJECT_ROOT}/src/main/index.ts
${PROJECT_ROOT}/src/renderer/App.tsx
${PROJECT_ROOT}/package.json
EOF

run_test "change analyzer runs" "node '${SCRIPTS_DIR}/change-analyzer.js' '$TEST_CHANGE_LOG' > /tmp/test_analysis.json"
run_test "analyzer output is valid JSON" "node -e 'JSON.parse(require(\"fs\").readFileSync(\"/tmp/test_analysis.json\"))'"
run_test "analyzer detects config changes" "grep -q '\"strategy\":\"full\"' /tmp/test_analysis.json"

# Clean up test files
rm -f "$TEST_CHANGE_LOG" /tmp/test_analysis.json

# Test 5: Test build reporter
echo -e "\n${BLUE}5. Testing build reporter...${RESET}"
# Create test analysis
cat > /tmp/test_analysis.json << EOF
{
  "strategy": "incremental",
  "fileCount": 3,
  "categories": ["source", "config"],
  "requiresRestart": false,
  "commands": [
    {"cmd": "echo 'test'", "description": "Test command", "critical": false}
  ]
}
EOF

run_test "build reporter runs" "node '${SCRIPTS_DIR}/build-reporter.js' analysis /tmp/test_analysis.json --dry-run"

# Clean up
rm -f /tmp/test_analysis.json

# Test 6: Test integration script
echo -e "\n${BLUE}6. Testing integration script...${RESET}"
run_test "integration script runs" "CLAUDE_HOOK_TRIGGER=test '${SCRIPTS_DIR}/integrate-auto-rebuild.sh'"

# Test 7: Check hook integration in settings
echo -e "\n${BLUE}7. Checking hook integration...${RESET}"
run_test "PostToolUse hook configured" "grep -q 'integrate-auto-rebuild.sh PostToolUse' '${PROJECT_ROOT}/.claude/settings.local.json'"
run_test "SessionEnd hook configured" "grep -q 'integrate-auto-rebuild.sh SessionEnd' '${PROJECT_ROOT}/.claude/settings.local.json'"
run_test "PreCompact hook configured" "grep -q 'integrate-auto-rebuild.sh BatchComplete' '${PROJECT_ROOT}/.claude/settings.local.json'"

# Test 8: Test file categorization
echo -e "\n${BLUE}8. Testing file categorization...${RESET}"
cat > /tmp/test_categorize.js << EOF
const { categorizeFile } = require('${SCRIPTS_DIR}/change-analyzer.js');
const tests = [
    { file: '${PROJECT_ROOT}/src/native/mouse-tracker/darwin/binding.gyp', expected: 'native' },
    { file: '${PROJECT_ROOT}/src/main/index.ts', expected: 'mainProcess' },
    { file: '${PROJECT_ROOT}/src/renderer/App.tsx', expected: 'renderer' },
    { file: '${PROJECT_ROOT}/package.json', expected: 'config' },
    { file: '${PROJECT_ROOT}/tailwind.config.js', expected: 'styles' },
    { file: '${PROJECT_ROOT}/src/main/test.spec.ts', expected: 'tests' },
    { file: '${PROJECT_ROOT}/README.md', expected: 'docs' }
];

let passed = 0;
tests.forEach(test => {
    const result = categorizeFile(test.file);
    if (result.category === test.expected) {
        passed++;
    } else {
        console.error(\`Failed: \${test.file} - expected \${test.expected}, got \${result.category}\`);
    }
});

process.exit(passed === tests.length ? 0 : 1);
EOF

run_test "file categorization" "node /tmp/test_categorize.js"
rm -f /tmp/test_categorize.js

# Test 9: Test environment variables
echo -e "\n${BLUE}9. Testing environment setup...${RESET}"
run_test "Node.js available" "which node"
run_test "Yarn available" "which yarn"
run_test "Project directory exists" "[ -d '$PROJECT_ROOT' ]"
run_test "package.json exists" "[ -f '${PROJECT_ROOT}/package.json' ]"

# Summary
echo -e "\n${CYAN}${BOLD}═══════════════════════════════════════${RESET}"
echo -e "${CYAN}${BOLD}Test Results Summary${RESET}"
echo -e "${CYAN}${BOLD}═══════════════════════════════════════${RESET}"
echo -e "${GREEN}Passed: $TESTS_PASSED${RESET}"
echo -e "${RED}Failed: $TESTS_FAILED${RESET}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}${BOLD}✅ All tests passed! Hook system is ready.${RESET}"
    exit 0
else
    echo -e "\n${RED}${BOLD}❌ Some tests failed. Please fix the issues above.${RESET}"
    exit 1
fi