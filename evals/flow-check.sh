#!/bin/bash
PASS=0
FAIL=0

check() {
  if eval "$2" &>/dev/null; then
    echo "  PASS — $1"
    PASS=$((PASS + 1))
  else
    echo "  FAIL — $1"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "StablePay Flow Evals"
echo "===================="

echo ""
echo "State machine"
check "Balance gates ContactPicker"    "grep -q 'ContactPicker' app/*/index.tsx"
check "Apple Pay not in ConfirmSheet"  "! grep -q 'handleFundTap\|APPLE_PAY' components/ui/ConfirmSendSheet.tsx"

echo ""
echo "Activity feed"
check "Fund events written"            "grep -rq 'addActivity' app/*/index.tsx"
check "Send events written"            "grep -q 'addActivity' app/*/index.tsx"
check "Activity reads on focus"        "grep -q 'getActivity' app/*/history.tsx"

echo ""
echo "Contacts"
check "contacts.ts exists"             "[ -f utils/contacts.ts ]"
check "Address validation present"     "grep -q 'validateAddress' utils/contacts.ts"

echo ""
echo "Send flow"
check "ConfirmSendSheet exists"        "[ -f components/ui/ConfirmSendSheet.tsx ]"
check "sendUserOperation in index"     "grep -q 'sendUserOperation' app/*/index.tsx"
check "USDC contract address"          "grep -q '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' app/*/index.tsx"

echo ""
echo "Fund sheet UX"
check "FundSheet exists"                "[ -f components/ui/FundSheet.tsx ]"
check "FundSheet has presets"           "grep -q 'selectedPreset' components/ui/FundSheet.tsx"
check "FundSheet has custom input"      "grep -q 'customAmount' components/ui/FundSheet.tsx"
check "FundSheet used in index"         "grep -q 'FundSheet' app/*/index.tsx"

echo ""
echo "Balance refresh"
check "AppState foreground refresh"    "grep -rq 'AppState' app/"
check "Focus refresh present"          "grep -q 'useFocusEffect' app/*/index.tsx"
check "Push triggers refresh"          "grep -rq 'balance_update' app/*/index.tsx"

echo ""
echo "Webhook system"
check "Onchain webhook route"          "grep -q '/webhooks/onchain' server/src/app.ts"
check "Onchain signature verified"     "grep -q 'ONCHAIN_WEBHOOK_SECRET' server/src/app.ts"
check "Push token stores address"      "grep -q 'push_token_by_address' server/src/app.ts"
check "getPushTokenForAddress exists"  "grep -q 'getPushTokenForAddress' server/src/app.ts"
check "ONCHAIN_WEBHOOK_SECRET ref"     "grep -q 'ONCHAIN_WEBHOOK_SECRET' server/src/app.ts"

echo ""
echo "===================="
echo "  $PASS passed, $FAIL failed"
echo ""
[ $FAIL -eq 0 ] && exit 0 || exit 1
