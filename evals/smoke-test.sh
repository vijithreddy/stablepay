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
echo "StablePay Evals"
echo "==============="

echo ""
echo "Code quality"
check "TypeScript clean"     "npx tsc --noEmit"
check "No lint errors"       "npm run lint 2>&1 | grep -q '0 errors'"

echo ""
echo "Security"
check "No API secret in app" "! grep -r 'CDP_API_KEY_SECRET' app/ components/ hooks/ utils/ 2>/dev/null"
check "No API secret in app" "! grep -r 'cdp_api_key_secret' app/ components/ hooks/ utils/ 2>/dev/null"

echo ""
echo "USDC lock"
check "USDC in OnrampForm"   "grep -q '\"USDC\"' components/onramp/OnrampForm.tsx"
check "Base in sharedState"  "grep -q 'Base' utils/sharedState.ts"
check "No asset selector UI" "! grep -rq 'assetSelector\|AssetSelect\|networkSelect\|NetworkSelect' app/"

echo ""
echo "Branding"
check "No Onramp V2 Demo"   "! grep -rq 'Onramp V2 Demo' app/ components/ --include='*.tsx'"
check "No Buy Crypto label"  "! grep -rq 'Buy Crypto' app/ components/ --include='*.tsx'"
check "App name is StablePay" "grep -q 'StablePay' app.config.ts"

echo ""
echo "Phone verification"
check "Phone storage utility" "grep -q 'stablepay_verified_phone' utils/phoneVerification.ts"
check "Phone sheet component"  "[ -f components/onramp/PhoneVerificationSheet.tsx ]"
check "CDP native hooks"       "grep -q 'useLinkSms\|useVerifySmsOTP' components/onramp/PhoneVerificationSheet.tsx"
check "No custom OTP routes"   "! grep -q 'send-otp\|verify-otp\|otpStore' server/src/app.ts"

echo ""
echo "Quotes & theme"
check "No quotes on every tap" "grep -rq 'Bypassing quotes API\|Quotes API removed' hooks/ app/"
check "Paper theme on auth"    "grep -rq 'Paper.colors\|PaperTheme' app/auth/ app/email-verify.tsx app/email-code.tsx"

echo ""
echo "Native feel"
check "Safe area context used"  "! grep -r \"from 'react-native'\" app/ --include='*.tsx' 2>/dev/null | grep -q SafeAreaView"
check "Profile nav wired"       "grep -rq '/(tabs)/profile' app/"
check "Status bar dark"         "grep -q 'style=\"dark\"' app/_layout.tsx"

echo ""
echo "Address book & activity"
check "Contacts utility"       "[ -f utils/contacts.ts ]"
check "Activity utility"       "[ -f utils/activity.ts ]"
check "AddContactSheet"        "[ -f components/ui/AddContactSheet.tsx ]"
check "ContactPicker"          "[ -f components/ui/ContactPicker.tsx ]"
check "ConfirmSendSheet"       "[ -f components/ui/ConfirmSendSheet.tsx ]"

echo ""
echo "Animations & native feel"
check "GestureHandlerRootView"  "grep -q 'GestureHandlerRootView' app/_layout.tsx"
check "Haptics on actions"      "grep -rq 'Haptics\.' app/ components/ --include='*.tsx'"
check "BlurView on tab bar"     "grep -rq 'BlurView' app/"

echo ""
echo "Server"
check "server/.env exists"   "[ -f server/.env ]"
check "CDP key configured"   "grep -q 'CDP_API_KEY_ID' server/.env"

echo ""
echo "==============="
echo "  $PASS passed, $FAIL failed"
echo ""
[ $FAIL -eq 0 ] && exit 0 || exit 1
