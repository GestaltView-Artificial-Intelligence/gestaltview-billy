# gestaltview-billy (Insight-Bot)

**What it is:** a Devvit app that gives Billy — the GestaltView AI collaborator — a working environment inside a subreddit. Three surfaces: a chat window inside a Reddit post, a comment summon (write `!billy` in any comment and Billy reads the thread and replies once), and moderator tools (a per-post "summarize thread" brief). Billy's reasoning runs on the GestaltView runtime; the Devvit app is where Billy operates on Reddit: reading threads, answering when called, drafting mod briefs.

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
- **Moderator-created posts** — the chat post is created from the subreddit menu ("Create a new post").
- **Comment summon** — write `!billy` (or mention u/insight-bot) in any comment; Billy reads the surrounding thread and replies once as a child comment. Billy never speaks unprompted: no summon token, no reply. At-most-once replies are guaranteed by a per-comment record, and summons live in their own rate-limit bucket. Toggleable per subreddit (`summonEnabled`).
- **Ask Billy: summarize thread** — a moderator menu item on any post. Billy reads the post and its top comments and opens a private 30-second brief (what the thread is about, key viewpoints, open questions, tone, anything a mod should look at). Draft-only: nothing is posted, stickied, or acted on — the moderator copies what they need.

## Reviewer walkthrough (playtest)

1. `npm run login` — authenticate the Devvit CLI.
2. `npx devvit settings set runtimeSigningSecret` — set the adapter signing secret (must match the runtime's `INSIGHT_BOT_SIGNING_SECRET`; paste cleanly, no trailing whitespace).
3. `npm run dev` — starts playtest; the CLI prints the playtest post URL.
4. Open the URL, click **Chat with Billy**, send a question.
5. Billy's reply appears in the thread, private to you, with a receipt ID.
6. **Comment summon:** in the playtest subreddit, leave a comment containing `!billy` and a question. Billy reads the thread and replies once as a child comment. A second comment without the token gets no reply.
7. **Mod tool:** as a moderator, open any post's mod menu → **Ask Billy: summarize thread**. A private brief opens in a form — nothing is posted.

## How it works

Each chat message goes to the app's server (`POST /api/insight/respond`), which validates it, checks the rate limit and emergency switch, then forwards it to the GestaltView runtime as a signed `insight_bot_request.v2` payload: HMAC-SHA256 over `<unix-seconds>.<exact request body>`, with the timestamp, adapter name (`reddit`), and signature in headers. The runtime verifies the signature and a five-minute timestamp window, routes the message through Billy's model router, and returns an `insight_bot_response.v2` reply. The adapter keeps no copy of the input.

## Safety and privacy

- The app never acts unprompted. The only Reddit writes are the moderator-initiated chat post and replies to explicit `!billy` summons — one reply per summoned comment, never more.
- Chat replies are private to the asker; summon replies are public by design (they answer a public question in-thread).
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
