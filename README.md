# gestaltview-billy (Insight-Bot)

**What it is:** a Devvit app that puts a chat window with Billy — the GestaltView AI collaborator — inside a Reddit post. A moderator creates the post; anyone who opens it can ask Billy questions and get thoughtful replies. That is the entire app: one chat UI, no auto-posting, no background behavior.

## For Reddit App Reviewers — please read first

**This app cannot answer questions until its HTTP domain exception is approved.** When a user sends a chat message, the app's server signs the request and POSTs it to the GestaltView runtime at `https://gestaltview-three.vercel.app/api/insight-bot/respond`, which generates Billy's reply and returns it. The domain is declared in `devvit.json` (`permissions.http.domains`), but Devvit blocks all outbound HTTP until the exception is approved in the Developer Portal under this app's Developer Settings.

Until approval, the app installs and renders normally, but every chat attempt returns its designed degraded state ("GestaltView is temporarily unavailable"). That is the platform allowlist working as intended — not an app defect. **Please approve `gestaltview-three.vercel.app` so the app can be reviewed end to end.**

## Function list

- **Chat with Billy** — a message thread inside a Reddit custom post; the user types a question, Billy replies.
- **Starter questions** — suggested prompts so first-time users know what to ask.
- **Private by default** — replies are visible only to the person who asked.
- **Receipt IDs** — every reply carries a per-message receipt ID for traceability.
- **Typing indicator and retry** — clear loading, degraded, and blocked states with retry.
- **Daily per-user request limit** — default 20/day per user, adjustable per subreddit.
- **Emergency disable** — a per-subreddit switch that pauses the app instantly.
- **Moderator-created posts** — the chat post is created from the subreddit menu ("Create a new post"); the app never posts or comments on its own.

## Reviewer walkthrough (playtest)

1. `npm run login` — authenticate the Devvit CLI.
2. `npx devvit settings set runtimeSigningSecret` — set the adapter signing secret (must match the runtime's `INSIGHT_BOT_SIGNING_SECRET`; paste cleanly, no trailing whitespace).
3. `npm run dev` — starts playtest; the CLI prints the playtest post URL.
4. Open the URL, click **Chat with Billy**, send a question.
5. Billy's reply appears in the thread, private to you, with a receipt ID.

## How it works

Each chat message goes to the app's server (`POST /api/insight/respond`), which validates it, checks the rate limit and emergency switch, then forwards it to the GestaltView runtime as a signed `insight_bot_request.v2` payload: HMAC-SHA256 over `<unix-seconds>.<exact request body>`, with the timestamp, adapter name (`reddit`), and signature in headers. The runtime verifies the signature and a five-minute timestamp window, routes the message through Billy's model router, and returns an `insight_bot_response.v2` reply. The adapter keeps no copy of the input.

## Safety and privacy

- Nothing is ever posted or commented on behalf of a user — the only Reddit write is the moderator-initiated chat post.
- Replies are private to the asker; nothing is public by default.
- Inputs are not retained by the adapter; the runtime contract enforces `retain_input: false`.
- Per-user daily rate limits prevent abuse.
- No Reddit data is used to train or fine-tune models.
- Privacy policy: https://gestaltview-three.vercel.app/privacy · Terms: https://gestaltview-three.vercel.app/terms

## Developer setup

- `npm run login` — Devvit CLI login
- `npm run dev` — playtest (`devvit playtest`)
- `npm run deploy` — typecheck, lint, `devvit upload`
- `npm run launch` — deploy + `devvit publish`
- `npx devvit settings set runtimeSigningSecret` — adapter signing secret (global)
- Per-subreddit install settings: `runtimeApiUrl` (default `https://gestaltview-three.vercel.app/api`), `dailyRequestLimit`, `emergencyDisabled`

License: BSD-3-Clause (see LICENSE).
