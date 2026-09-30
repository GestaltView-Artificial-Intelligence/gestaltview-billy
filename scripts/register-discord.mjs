const applicationId = process.env.DISCORD_APPLICATION_ID;
const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!applicationId || !token || !guildId) {
  throw new Error('Set DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN, and DISCORD_GUILD_ID.');
}

const commands = [
  {
    name: 'insight',
    description: 'Talk with GestaltView Insight-Bot',
    options: [
      {
        type: 1,
        name: 'ask',
        description: 'Ask Insight-Bot a question',
        options: [
          { type: 3, name: 'message', description: 'Your question', required: true, max_length: 4000 },
          { type: 5, name: 'public', description: 'Request a public reply (server policy must also allow it)' },
        ],
      },
      {
        type: 1,
        name: 'explain',
        description: 'Ask Insight-Bot to explain a topic',
        options: [{ type: 3, name: 'topic', description: 'The topic to explain', required: true, max_length: 4000 }],
      },
      { type: 1, name: 'help', description: 'Show available Insight-Bot commands' },
    ],
  },
];

const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`, {
  method: 'PUT',
  headers: { authorization: `Bot ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify(commands),
});
if (!response.ok) throw new Error(`Discord command registration failed (${response.status}): ${await response.text()}`);
console.log('Registered /insight commands for the configured test guild.');
