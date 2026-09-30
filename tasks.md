# Insight-Bot runtime integration

Completed in this checkout:

- Added `POST /api/insight-bot/respond` for the Reddit and Discord adapters.
- The endpoint verifies the v2 exact-body HMAC, adapter identity, and a five-minute timestamp window before routing the message through Billy's model router.
- Added the integration and deployment contract to `docs/INTEGRATION.md`.

Operator deployment steps remain:

- Set `INSIGHT_BOT_SIGNING_SECRET` on GestaltView's Vercel project to the same secret configured in Devvit and the companion bot's Vercel project. This variable is not present in `.codex/.env.codex`; create/manage it as a deployment secret rather than committing it.
- Deploy GestaltView, then configure the companion bot's Discord/Devvit runtime URL as `https://gestaltview-three.vercel.app/api`.

The route calls Billy's model router directly and avoids the general Billy chat route, which writes durable memory. Its response cache is process-local; durable idempotency across serverless instances/restarts still needs persistent receipt storage.
