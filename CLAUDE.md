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