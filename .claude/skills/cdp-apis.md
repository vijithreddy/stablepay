# CDP API Ground Rules

## Verified endpoints (from /utils in this repo)
Only use API calls that already exist in /utils/createOnrampTransaction.ts
and /utils/fetchOnrampConfig.ts. Do not invent new endpoints.

## Apple Pay flow (from /hooks/useOnramp.ts)
1. getOnrampConfig() → fetch supported assets/networks
2. createOnrampTransaction() → get session token from backend
3. Native payment sheet → user authorizes
4. Backend submits to Coinbase, webhook fires

## USDC on Base
- Asset symbol for API: "USDC" (not "USD Coin")
- Network name for API: "base" (not "Base Mainnet")
- getAssetSymbolFromName() and getNetworkNameFromDisplayName() handle conversion
- Hardcode these values — do not surface selectors in StablePay UI

## Limits (do not hardcode UI around these — they come from API)
- $5 minimum, $500/week Apple Pay
- Phone verification required, cached 60 days in AsyncStorage