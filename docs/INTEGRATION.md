# Insight-Bot channel integration

## Request flow

```text
Reddit custom post ──> Devvit API ─┐
                                  ├── signed request ──> GestaltView runtime
Discord slash command ──> Vercel ─┘
```

The channel adapters authenticate their platform event, normalize the request,
sign the exact JSON body, and render the runtime result. Model choice, policy,
and response generation stay in the runtime. These adapters send no durable
memory context and set `retain_input` and `allow_gestaltview_handoff` to false.

## Shared request

Both adapters send `schema_version: insight_bot_request.v2`, a stable
`request_id`, channel and installation identifiers, actor and conversation
identifiers, original text, visibility, consent, and posting policy. Discord's
request ID is derived from the Discord interaction ID; Reddit's is derived from
the post, authenticated user, and client request ID. The runtime response must
match that request ID and include the v2 schema version, status, text, reply
mode, receipt ID, and retryable flag. Unknown or malformed responses are not
published.

## Runtime authentication

Each request includes:

- `x-insight-bot-adapter`: `reddit` or `discord`;
- `x-insight-bot-timestamp`: current Unix seconds;
- `x-insight-bot-signature`: `<timestamp>.<lowercase hex HMAC-SHA256>`, where
  the HMAC covers `<timestamp>.<exact request body>` using the shared adapter
  signing secret.

The runtime must reject stale timestamps and invalid signatures. It should treat
repeated request IDs idempotently. The same secret belongs in Devvit's secret
setting and Vercel's `INSIGHT_BOT_SIGNING_SECRET`; it must never enter browser
code or repository files.

## Discord boundary

Deploy `api/discord/interactions.ts` as a Vercel Node function and configure its
URL in the Discord application. It verifies Discord's Ed25519 signature before
parsing interaction data, answers PING, and supports `/insight ask`, `/insight
explain`, and `/insight help`. Replies are ephemeral unless the request asks for
public output, the server flag enables it, and the runtime response permits it.
No Gateway intents are needed. Register commands to a test guild before global
registration.

## Operational limits

- Reddit's per-user daily cap and emergency disable are installation settings.
- Discord can be paused with `INSIGHT_BOT_DISABLED=true`.
- Adapter timeouts and invalid runtime responses are reported as degraded
  responses; neither adapter claims a successful handoff or publication.
- The current scope has no Supabase receipt persistence or capture/artifact
  approval UI. A runtime receipt is displayed when returned, but the adapter
  does not claim that it independently persisted one.

Before deployment, confirm the runtime supports this v2 schema and HMAC convention
at `<API base>/insight-bot/respond`. The current API base is
`https://gestaltview-three.vercel.app/api`. The runtime credentials remain
operator-managed deployment configuration; code in this scaffold cannot
establish that remote contract by itself.
