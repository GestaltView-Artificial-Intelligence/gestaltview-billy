# Deployment runbook

## Required configuration

Keep secrets in Devvit/Vercel settings, never in source.

Canonical runtime: `https://gestaltview-v3-psi.vercel.app`

| Setting | Surface | Secret |
|---|---|---|
| `runtimeToken` | Devvit global setting | yes |
| `runtimeApiUrl` | Devvit subreddit setting | no |
| `GESTALTVIEW_RUNTIME_TOKEN` | Vercel | yes |
| `INSIGHT_BOT_RUNTIME_URL` | Vercel | no |
| `DISCORD_PUBLIC_KEY` | Vercel | no |
| `DISCORD_APPLICATION_ID` | registration | no |
| `DISCORD_GUILD_ID` | test registration | no |
| `DISCORD_BOT_TOKEN` | registration only | yes |

## Reddit acceptance

- Install only in the moderator-owned test subreddit.
- Confirm an unconfigured or disabled installation is visibly blocked.
- Confirm daily limits and idempotent cached retries.
- Confirm public output is disabled by default.
- Confirm runtime failure renders a degraded message.
- Confirm no request text or secret is written to logs.

Rollback: enable `emergencyDisabled`, then uninstall or upload the prior Devvit
version. Rotate `runtimeToken` if authorization may have leaked.

## Discord acceptance

- Confirm Discord accepts the endpoint PING challenge.
- Confirm a modified body or invalid signature returns HTTP 401.
- Exercise `/insight ask`, `/insight explain`, and `/insight help`.
- Confirm replies are ephemeral by default.
- Confirm a public request remains ephemeral while the public policy flag is off.
- Confirm runtime timeout/failure yields an explicit ephemeral degraded response.
- Repeat the same interaction ID and confirm the runtime request ID is stable.
- Register globally only after the test-guild checks pass.

Rollback: set `INSIGHT_BOT_DISABLED=true`, redeploy, delete registered commands if
needed, and rotate the bot token/runtime token if either may have leaked.

## Identity and privacy boundary

Insight-Bot is Billy speaking through public integrations. The channel adapters
send only the current public command/post input. They set `allowMemoryUse=false`
and cannot claim private continuity, capture, or artifact creation. Any future
account linking or durable continuity requires a separate consented design.

## Hybrid runtime boundary

The Reddit adapter uses `/api/actions/health` only for a low-cost readiness
signal and sends conversation requests to `/api/insight-bot/respond`. The
response route owns Billy’s public embodiment and may return consent-gated
capture/artifact proposals. User approval is sent through the Devvit server to
the protected `/api/insight-bot/execute` route. Generic `/api/actions/*`
mutation routes are not exposed directly to the Reddit browser.

An action proposal is not a persistence receipt. The UI says explicitly that
nothing has been stored or published until a protected execution bridge returns
a durable receipt. This avoids treating the generic anonymous bucket-drop
fallback as successful Reddit persistence.

The execution bridge verifies the proposal against the Devvit Redis response
cache, derives a deterministic receipt ID, and writes an approved action event
to `insight_bot_runtime_events`. A retry returns the same receipt. This requires
migration `20260729000000_insight_bot_runtime_bridge.sql` and server-side
Supabase service-role configuration on the Vercel deployment.
