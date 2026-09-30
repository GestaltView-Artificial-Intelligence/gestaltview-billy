## GestaltView Insight-Bot

- [Devvit](https://developers.reddit.com/): A way to build and deploy immersive games on Reddit
- [Vite](https://vite.dev/): For compiling the webView
- [React](https://react.dev/): For UI
- [Hono](https://hono.dev/): For backend logic
- [Tailwind](https://tailwindcss.com/): For styles
- [TypeScript](https://www.typescriptlang.org/): For type safety

## Insight-Bot integration

This scaffold has two channel adapters that call the same GestaltView runtime:

```text
Reddit custom post → Devvit server → signed request → GestaltView
Discord slash command → Vercel HTTPS interaction → signed request → GestaltView
```

Discord's public HTTPS interactions endpoint is `https://<your-vercel-host>/api/discord/interactions`.
The runtime owns response generation and policy. The adapters send only the
current message, set input retention and handoff to false, and default to private
responses. A public Discord reply requires both the user's `public` option and
`DISCORD_PUBLIC_REPLIES_ENABLED=true`.

### Configure the Reddit/Devvit adapter

Set the Devvit global `runtimeSigningSecret` to the secret shared with the
GestaltView runtime. The `runtimeApiUrl` default is
`https://gestaltview-three.vercel.app/api`; override it only for another
operator-approved environment.
The app supports a per-subreddit emergency disable and daily request limit.

### Configure the Discord adapter

Deploy this repository to Vercel and set these server-side environment values:

- `DISCORD_PUBLIC_KEY` — Discord application's public key.
- `INSIGHT_BOT_RUNTIME_URL` — GestaltView API base URL (default:
  `https://gestaltview-three.vercel.app/api`).
- `INSIGHT_BOT_SIGNING_SECRET` — same adapter signing secret configured with the runtime.
- `DISCORD_PUBLIC_REPLIES_ENABLED` — `false` by default.
- `INSIGHT_BOT_DISABLED` — `false` unless pausing the adapter.

Set Discord's interactions endpoint URL to the deployed `/api/discord/interactions`
route. Register commands in a test guild with `DISCORD_APPLICATION_ID`,
`DISCORD_BOT_TOKEN`, and `DISCORD_GUILD_ID` set in the shell, then run
`npm run discord:register:guild`. The token is used only by the registration
script and should not be saved in the repository.

See [docs/INTEGRATION.md](docs/INTEGRATION.md) for the request contract and
deployment boundary. The current runtime must support `POST
/api/insight-bot/respond` and verify the timestamp/body HMAC. Configure its URL
and signing secret through operator-owned settings.

## Getting Started

> Use Node 24 or newer, matching `package.json`.

1. Run `npm create devvit@latest --template=react`
2. Go through the installation wizard. You will need to create a Reddit account and connect it to Reddit developers
3. Copy the command on the success page into your terminal

## Commands

- `npm run dev`: Starts a development server where you can develop your application live on Reddit.
- `npm run build`: Builds your client and server projects
- `npm run deploy`: Uploads a new version of your app
- `npm run launch`: Publishes your app for review
- `npm run login`: Logs your CLI into Reddit
- `npm run type-check`: Type checks, lints, and prettifies your app
