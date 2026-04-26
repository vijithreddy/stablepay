#!/bin/bash
set -e
PASS=0
FAIL=0

check() {
  if eval "$2" &>/dev/null; then
    echo "  PASS — $1"
    ((PASS++))
  else
    echo "  FAIL — $1"
    ((FAIL++))
  fi
}

echo ""
echo "StablePay Evals"
echo "==============="

echo ""
echo "Code quality"
check "TypeScript clean"     "npx tsc --noEmit"
check "No lint errors"       "npm run lint"

echo ""
echo "Security"
check "No API secret in app" "! grep -r 'CDP_API_KEY_SECRET' app/ components/ hooks/ utils/ 2>/dev/null"
check "No API secret in app" "! grep -r 'cdp_api_key_secret' app/ components/ hooks/ utils/ 2>/dev/null"

echo ""
echo "USDC lock"
check "USDC hardcoded"        "grep -q '\"USDC\"' utils/createOnrampTransaction.ts"
check "Base hardcoded"        "grep -q '\"base\"' utils/createOnrampTransaction.ts"
check "No asset selector UI"  "! grep -rq 'assetSelector\|AssetSelect\|networkSelect\|NetworkSelect' app/"

echo ""
echo "Server"
check "server/.env exists"   "[ -f server/.env ]"
check "CDP key configured"   "grep -q 'CDP_API_KEY_ID' server/.env"

echo ""
echo "==============="
echo "  $PASS passed, $FAIL failed"
echo ""
[ $FAIL -eq 0 ] && exit 0 || exit 1