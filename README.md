# StablePay

Instant USDC payments on Base. A Nacha Smarter Faster Payments conference demo.

**Narrative**: "Venmo with stablecoins — instant P2P USDC payments on Base."

## What it does

1. **Fund** — Add USDC to your wallet via Apple Pay (gasless on Base)
2. **Send** — Send USDC to any contact instantly (gasless via Paymaster)
3. **Track** — See all activity in a unified feed

## Tech Stack

- **Frontend**: React Native + Expo 54 + TypeScript
- **Backend**: Node.js/Express (deployed on Vercel)
- **Wallets**: CDP Embedded Wallets (Smart Account / ERC-4337)
- **Payments**: Apple Pay via Coinbase Onramp V2 API
- **Transfers**: Gasless ERC-20 transfers via Coinbase Paymaster
- **Notifications**: Push via APNs / Expo Push Service
- **Chain**: Base Mainnet only

## Architecture

```
StablePay App (React Native)
├── Apple Pay → Hidden WebView → Coinbase Onramp API
├── Send USDC → sendUserOperation → Base (gasless)
├── Balance → /balances/evm endpoint
└── Push Notifications → APNs / Expo

Express Backend (Vercel)
├── /server/api → JWT proxy to Coinbase CDP API
├── /balances/evm → Token balances with USD prices
├── /webhooks/onramp → Onramp completion notifications
├── /webhooks/onchain → USDC transfer notifications
└── /push-tokens → Device token storage
```



## Quick Start

### Prerequisites

- Node.js v20+
- iOS device (not simulator — Apple Pay requires real device)
- [Coinbase CDP account](https://portal.cdp.coinbase.com/)
- Apple Developer account (for device builds)

### 1. Install

```bash
git clone https://github.com/vijithreddy/stablepay.git
cd stablepay
npm install
cd server && npm install && cd ..
```

### 2. Environment Setup

```bash
cp .env.example .env
cp server/.env.example server/.env
```

**Root `.env`**:
```
EXPO_PUBLIC_CDP_PROJECT_ID=your_project_id
EXPO_PUBLIC_BASE_URL=http://YOUR_LOCAL_IP:3000
EXPO_PUBLIC_USE_EXPO_CRYPTO=false
```

**Server `.env`**:
```
CDP_API_KEY_ID=your_api_key_id
CDP_API_KEY_SECRET=your_private_key
WEBHOOK_SECRET=your_webhook_secret
ONCHAIN_WEBHOOK_SECRET=your_onchain_webhook_secret
```

> **IMPORTANT**: `EXPO_PUBLIC_USE_EXPO_CRYPTO` must be `false` for device builds. Setting it to `true` breaks wallet creation with `crypto.subtle is not available`.

### 3. Get Your Local IP

```bash
ipconfig getifaddr en0
```

Update `EXPO_PUBLIC_BASE_URL` in `.env` with `http://YOUR_IP:3000`.

### 4. Start

```bash
# Terminal 1 — Backend
cd server && npm run dev

# Terminal 2 — App (device build)
npx expo prebuild --clean
npx expo run:ios --device
```

### 5. Demo Flow

1. Open app → sign in with email
2. Verify phone (required for Apple Pay)
3. Tap "Add USDC via Apple Pay" → select amount → Face ID
4. USDC lands in wallet → balance updates
5. Select a contact → enter amount → "Send to Bob"
6. Confirm → USDC sent gaslessly on Base
7. Check Activity tab → see fund + send events

## Key Design Decisions

- **USDC only** — no asset selector, no ETH/SOL
- **Base only** — no network selector
- **Apple Pay only** — no Coinbase Widget, no Google Pay
- **Production mode only** — no sandbox toggle
- **Gasless** — all USDC transfers on Base use Coinbase Paymaster
- **Smart Account** — balances stored in ERC-4337 Smart Account, not EOA
- **Phone verification** — collected on first Apple Pay attempt via CDP `useLinkSms`, cached 60 days

## Project Structure

```
app/
├── (tabs)/
│   ├── index.tsx      # Pay screen (fund + send)
│   ├── history.tsx    # Activity feed
│   └── profile.tsx    # Wallet + sign out
├── auth/login.tsx     # Email login
├── email-verify.tsx   # Email entry
├── email-code.tsx     # Email OTP
├── phone-verify.tsx   # Phone entry
└── phone-code.tsx     # Phone OTP

components/
├── onramp/
│   ├── OnrampForm.tsx              # Hidden form (state management)
│   ├── APIGuestCheckoutWidget.tsx   # Hidden WebView (Apple Pay)
│   └── PhoneVerificationSheet.tsx   # Phone verification bottom sheet
└── ui/
    ├── ContactPicker.tsx    # Contact list with selection
    ├── AddContactSheet.tsx  # Add new contact modal
    ├── ConfirmSendSheet.tsx # Send confirmation modal
    ├── FundSheet.tsx        # Fund amount picker modal
    ├── AnimatedPressable.tsx # Reanimated press button
    ├── PaperButton.tsx      # Themed button variants
    ├── Wordmark.tsx         # StablePay logo
    └── CoinbaseAlerts.tsx   # Alert modal

hooks/
└── useOnramp.ts    # Apple Pay flow orchestration

utils/
├── contacts.ts          # Contact CRUD (AsyncStorage)
├── activity.ts          # Activity feed (AsyncStorage)
├── phoneVerification.ts # Phone cache (60-day TTL)
├── sharedState.ts       # Global state (wallet, network)
└── supportEmail.ts      # Support email utility

server/src/
├── app.ts                    # Express routes
├── validateToken.ts          # CDP token validation
└── verifyWebhookSignature.ts # Webhook HMAC verification

constants/
├── PaperTheme.ts    # Design system (colors, typography, spacing)
├── BASE_URL.ts      # Backend URL from env
└── TestAccounts.ts  # TestFlight mock data
```

## Design System

The app uses a warm editorial theme ("Paper"):

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#F5F2EC` | Screen backgrounds |
| `surface` | `#FFFFFF` | Cards, inputs |
| `navy` | `#1A1A2E` | Primary text |
| `orange` | `#FF6B35` | CTAs, selected states |
| `sand` | `#8B7355` | Secondary text, labels |
| `success` | `#2D7A4F` | Incoming amounts |
| `border` | `#E2DDD4` | Dividers, input borders |

Tab bar uses `expo-blur` for frosted glass effect. All buttons use `react-native-reanimated` spring animations with `expo-haptics` feedback.

## Webhooks

| Endpoint | Source | Purpose |
|----------|--------|---------|
| `/webhooks/onramp` | Coinbase Onramp | Push notification on Apple Pay completion |
| `/webhooks/onchain` | CDP Onchain Data | Push notification on USDC transfers |

Both verify signatures via `X-Hook0-Signature` HMAC-SHA256.

## Evals

```bash
# Code quality + branding + security
bash evals/smoke-test.sh

# Flow logic + contacts + webhooks
bash evals/flow-check.sh
```

## Before the Demo

1. Replace placeholder contact addresses in `utils/contacts.ts` with real Base wallet addresses
2. Ensure `EXPO_PUBLIC_USE_EXPO_CRYPTO=false` in `.env`
3. Run `npx expo prebuild --clean && npx expo run:ios --device`
4. Test full flow: fund → send → check activity

## License

Apache License 2.0 — see [LICENSE](LICENSE).
