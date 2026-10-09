# Insight-Bot v3.0 README

### *This README is structured specifically to meet the Reddit App Review guidelines, ensuring it is accessible to non-developers while comprehensively detailing the app's architecture and safety protocols.*

## App Overview Summary

Insight-Bot v3.0 is an advanced collaborative AI partner designed to bring "Billy"—our canonical GestaltView runtime personality—directly into Reddit and Discord communities. Built for community members and moderators, this app elevates engagement by answering questions, providing unique insights, and facilitating interactive experiences.

## Critical Operational Notes:

 * Approved LLM Usage: Insight-Bot v3.0 processes queries and generates responses using Google Gemini, an explicitly approved Large Language Model for the Reddit Developer Platform.
 
 * No Automated Posting: Any action taken on behalf of a user—such as submitting a post or a comment—requires an explicit, manual confirmation (e.g., clicking a button). Users are explicitly shown how their username will appear before confirming, ensuring they are never misled or surprised.
 
 * Data Minimization: The app operates strictly on the data necessary for its stated functionality; we never request login credentials, passwords, or personal information. Furthermore, we never use Reddit data to train, fine-tune, or modify our underlying AI models.
 
 * Strict Deletion Adherence: The app automatically listens for PostDelete and CommentDelete events to purge associated content from our systems. Any user data stored in Redis/KVstore or our external services is set to automatically expire and delete within 30 days.
 
### How to Interact (Reddit App Review walkthrough):

**What this app does, in 30 seconds:** it puts a chat window with Billy — the GestaltView AI collaborator — directly inside a Reddit post. A moderator creates the post; anyone who opens it can ask Billy questions and get thoughtful replies. That is the entire app: one chat UI, no background behavior, no auto-posting.

1. A moderator installs the app and picks the subreddit menu item **"Create a new post"**.
2. This creates a post titled **"GestaltView Insight-Bot"** showing a welcome screen ("Talk to Billy") with a **"Chat with Billy"** button.
3. Tapping the button opens the full chat: a message thread, starter questions, and a text input.
4. The user types a question and sends it. The app forwards it — signed (HMAC), rate-limited (20/day per user, configurable), private by default — to the GestaltView runtime, and Billy's reply appears in the thread.
5. Inputs are not retained by this adapter. Replies are visible only to the asker. A per-message receipt ID is shown for traceability.

 * **Discord Guilds**: Users trigger Billy using slash commands, which send a signed request to the GestaltView runtime via Vercel HTTPS interactions. By default, Discord replies are private (ephemeral). A public Discord reply requires the user to explicitly select the public option alongside the server administrator setting `DISCORD_PUBLIC_REPLIES_ENABLED=true`

**For reviewers:** please evaluate this app from a playtest build (`npm run dev`). It is not published; the previous submission was sent up before the UX was ready, which is what this revision fixes.
 
### Configuration and Deployment

*Insight-Bot v3.0 utilizes two channel adapters that route public-context-only requests to the canonical GestaltView runtime.
Reddit / Devvit Adapter Setup*

 * Log into the Reddit developer CLI using the command npm run login.
 * Start your local playtest server using npm run dev.
 * Set your global runtime secret using: npx devvit settings set runtimeToken.
 * Open the app’s installation settings in your test subreddit to configure the runtime URL, retention mode, emergency disable switches, and daily request limits.
 * Upload a private test version of the app using npm run deploy. Once playtesting is complete, publish your app for official Reddit App Review using npm run launch.
 
### Discord Adapter Setup
 * Deploy the Discord adapter repository to Vercel (e.g., under the NonsensicalAndroids team environment for the gestaltview-v3.1 project).
 * Configure the following server-side environment variables in your deployment:
   * `DISCORD_PUBLIC_KEY`: Your Discord application's public key.
   * `INSIGHT_BOT_RUNTIME_URL`: The GestaltView API base URL.
   * `INSIGHT_BOT_SIGNING_SECRET`: The shared adapter signing secret.
   * `DISCORD_PUBLIC_REPLIES_ENABLED`: Set to false by default.
   * `INSIGHT_BOT_DISABLED`: Set to false unless pausing the adapter.
 * Set your Discord Interactions Endpoint URL to `https://gestaltview-three.vercel.app/api/discord/interactions`
 * Register your slash commands using `npm run discord:register:guild` for a test guild. Once accepted, remove the guild ID and run `npm run discord:register:global`
 
### Content & Safety Guardrails

*Insight-Bot v3.0 complies entirely with Reddit's public content, safety, and IP policies.*

 * **Moderator Tools**: For communities utilizing the bot for moderation or community governance, configuration instructions are provided directly within the app description to ensure safe and responsible deployment.
 * **Content Restrictions**: The bot does not facilitate dangerous activities, illegal content, or mature content without appropriate age-gating labels. We strictly prohibit integration with restricted industries such as gambling, financial products, or cryptocurrency.
 * **No External Upselling**: Insight-Bot does not link out to external platforms to promote "demo" versions, nor do we ask users to create profiles outside of Reddit to use the core functionality.
 * **Reddit IP**: The app relies on its own unique branding and does not utilize Reddit trademarks, such as SNOO, without explicit written permission.
 
### *Privacy Policy & Terms of Service*

Because Insight-Bot utilizes an approved LLM (Google Gemini) and HTTP Fetch functionality to connect with the GestaltView runtime, it operates under dedicated legal policies. These documents guarantee that we never sell, license, or commercialize redditor data.
 * https://gestaltview-three.vercel.app/terms
 * https://gestaltview-three.vercel.app/privacy

