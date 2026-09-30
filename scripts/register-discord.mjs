import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const applicationDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..'
);

export const commands = [
  {
    name: 'insight',
    description: 'Meet Billy through GestaltView Insight-Bot',
    type: 1,
    options: [
      {
        type: 1,
        name: 'ask',
        description: 'Bring Billy a question or thought',
        options: [
          {
            type: 3,
            name: 'message',
            description: 'What you want to bring',
            required: true,
            max_length: 4000,
          },
          {
            type: 5,
            name: 'public',
            description:
              'Request a public reply (operator policy still applies)',
          },
        ],
      },
      {
        type: 1,
        name: 'explain',
        description: 'Ask Billy to explain a topic',
        options: [
          {
            type: 3,
            name: 'topic',
            description: 'The topic to explain',
            required: true,
            max_length: 4000,
          },
          {
            type: 5,
            name: 'public',
            description:
              'Request a public reply (operator policy still applies)',
          },
        ],
      },
      { type: 1, name: 'help', description: 'Learn how Insight-Bot works' },
    ],
  },
];

export function findEnvironmentFile(startDirectory = applicationDirectory) {
  let directory = resolve(startDirectory);

  while (true) {
    const candidate = resolve(directory, '.env');
    if (existsSync(candidate)) return candidate;

    const parentDirectory = dirname(directory);
    if (parentDirectory === directory) return undefined;
    directory = parentDirectory;
  }
}

export function loadEnvironment(file = findEnvironmentFile()) {
  if (!file) return false;
  process.loadEnvFile(file);
  return true;
}

export function getRegistrationConfig(environment = process.env) {
  const applicationId = environment.DISCORD_APPLICATION_ID?.trim();
  const guildId = environment.DISCORD_GUILD_ID?.trim();
  const botToken = environment.DISCORD_BOT_TOKEN?.trim();

  if (!applicationId || !botToken) {
    throw new Error(
      'DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN are required'
    );
  }

  return { applicationId, botToken, guildId };
}

export async function registerDiscordCommands({
  environment = process.env,
  fetchImpl = fetch,
} = {}) {
  const { applicationId, botToken, guildId } =
    getRegistrationConfig(environment);
  const scope = guildId ? `guilds/${guildId}/commands` : 'commands';
  const response = await fetchImpl(
    `https://discord.com/api/v10/applications/${applicationId}/${scope}`,
    {
      method: 'PUT',
      headers: {
        authorization: `Bot ${botToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(commands),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Discord registration failed: ${response.status} ${await response.text()}`
    );
  }

  return guildId
    ? `Registered Insight-Bot commands in test guild ${guildId}.`
    : 'Registered Insight-Bot commands globally.';
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  loadEnvironment();
  console.log(await registerDiscordCommands());
}
