## StablePay — What we're building on top of this repo

This is a Nacha Smarter Faster Payments conference demo.
Narrative: "Venmo with stablecoins — instant P2P USDC payments on Base."
Audience: fintech engineers and product leaders.

### Changes from reference repo
- Asset locked to USDC only — no ETH/SOL selector shown
- Network locked to Base Mainnet only
- Payment method: Apple Pay only — Coinbase Widget removed
- Multi-network support hidden but not deleted (keep code, hide UI)
- App name: StablePay
- Demo flow: Alice loads USDC via Apple Pay → sends to Bob → Bob sees balance

### What Claude should NEVER change
- /server/src/app.ts JWT signing logic
- /hooks/useOnramp.ts internal API call structure
- Any webhook signature verification code
- The CDP SDK initialization in _layout.tsx

### What Claude CAN change freely
- UI copy, labels, placeholders
- Component visibility (hide selectors, don't delete)
- Color scheme and branding
- Tab names and icons
- Any .tsx file in /app/(tabs)/

## Backend hosting — Vercel

- Server deployed to Vercel (serverless, NOT long-running)
- Use @vercel/kv for any storage that must persist between requests
- No in-memory Maps for push tokens or session state
- app.listen() disabled in production via NODE_ENV check
- Webhook URL: https://your-deployment.vercel.app/webhooks/onramp

## Eval checklist — run after every session

Before marking any task done, verify:
1. npx tsc --noEmit passes with zero errors
2. npm run lint passes
3. npx expo start boots without red error screen
4. No asset/network selector visible in main UI
5. No CDP_API_KEY_SECRET anywhere in /app or /components

## Sandbox mode — REMOVED

Sandbox mode has been completely removed.
Do not re-add sandbox toggles, sandbox
address overrides, or sandbox partnerUserRef.
The app always runs in production mode.
Use real phone numbers and real CDP credentials.

## Crypto mode — CRITICAL

EXPO_PUBLIC_USE_EXPO_CRYPTO controls which crypto
implementation the CDP SDK uses.

Values:
  true  = expo-crypto
          Only works in Expo Go
          crypto.subtle NOT available
          Wallet creation FAILS
          DO NOT use for device builds

  false = react-native-quick-crypto
          Required for physical device
          Required for TestFlight
          Required for Apple Pay
          Wallet creation WORKS
          THIS IS THE CORRECT VALUE

Current setting must always be: false
Only change to true if specifically debugging
in Expo Go without wallet creation.

If you ever see this error:
  "crypto.subtle is not available"
  "Failed to create EVM account: ModuleResolutionError"
The fix is always: EXPO_PUBLIC_USE_EXPO_CRYPTO=false
followed by: npx expo run:ios --device

## StablePay UI Design Brief

### Aesthetic direction
Clean, premium fintech. Think Venmo meets stablecoin infrastructure.
NOT crypto-bro dark mode with neon gradients. Light, confident, trustworthy.
Audience is fintech engineers at Nacha — they will judge bad UI instantly.

### Color palette
- Primary: #0052FF (Coinbase blue — ownable, on-brand)
- Background: #FFFFFF
- Surface: #F8F9FA  
- Text primary: #0A0B0D
- Text secondary: #5B616E
- Success/confirmed: #00A868
- USDC accent: #2775CA
- Border: #E8ECF0

### Typography
- Use the system font stack — this is React Native, not web
- Weights: 400 regular, 600 semibold, 700 bold only
- Balance display: 48px bold
- Section labels: 11px semibold uppercase tracked

### Screen-by-screen spec

*
*Tab 1 — Pay (index.tsx)**
- Top: greeting "Good morning, [first name]"
- Large USDC balance: "$124.50 USDC" centered, 48px bold
- Below balance: small "on Base · gasless" label in secondary color
- Amount keypad: large number pad, amount updates in real time
- Recipient field: single text input "To: wallet address or name"
- CTA: full-width blue "Send with Apple Pay" button, 56px tall
- No tabs within this screen, no dropdowns, nothing else

**Tab 2 — Activity (history.tsx)**  
- Header: "Activity"
- List of transactions: each row shows
  - Left: avatar circle with first letter of sender/receiver
  - Center: "You → 0x1234...5678" + timestamp
  - Right: "+ $20.00 USDC" in green or "- $20.00 USDC" in primary
- Empty state: "No transactions yet. Send your first USDC."
- Each row taps to show tx hash + Base Explorer link

**Tab 3 — Profile (profile.tsx)**
- Avatar circle with user initial, large, centered
- Email address below
- Wallet address: truncated (0x1234...5678), tap to copy full
- "Base Network · Gasless transfers" badge
- Sign out button at bottom, text only, no border

### Tab bar
- 3 tabs only: Pay / Activity / Profile
- Icons: use Ionicons — send-outline / time-outline / person-outline
- Active: #0052FF, Inactive: #9BA3AE
- No labels needed — icons only, clean

### What NOT to do
- No dark backgrounds
- No gradient blobs or crypto aesthetic
- No "Powered by Coinbase" banners in the UI
- No loading spinners that look like blockchain spinners
- No wallet jargon in user-facing copy ("Smart Account", "EOA", "gas")
- Amount field does NOT show "USDC" in the input — show it as a label below

# Apple Pay flow
User taps button →
App calls backend → gets onramp URL →
URL loads in HIDDEN WebView →
JavaScript auto-clicks Apple Pay button inside WebView →
Native Apple Pay sheet appears →
User authenticates with Face ID →
Webhook fires → USDC lands in wallet