# Vercel Deployment Pattern

## Express → Vercel adapter
- app.listen() must be wrapped in if (process.env.NODE_ENV !== 'production')
- app must be exported as default: export default app
- vercel.json routes all traffic to src/app.ts

## Storage
- @vercel/kv replaces all in-memory Maps
- kv.set(key, value, { ex: ttlSeconds }) for TTL
- kv.get(key) returns null if missing, handle gracefully
- Push token storage key pattern: push_token:{userId}

## Environment variables
- Set via: vercel env add VAR_NAME production
- CDP_API_KEY_SECRET contains newlines — use vercel env add and paste directly
- Never commit secrets to vercel.json

## Deployment
- cd server && vercel --prod
- Each deploy gets a unique URL — update EXPO_PUBLIC_BASE_URL in .env after