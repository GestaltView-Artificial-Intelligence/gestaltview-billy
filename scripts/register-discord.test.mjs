import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  commands,
  findEnvironmentFile,
  getRegistrationConfig,
  registerDiscordCommands,
} from './register-discord.mjs';

const credentials = {
  DISCORD_APPLICATION_ID: 'application-id',
  DISCORD_BOT_TOKEN: 'bot-token',
};

test('finds an .env file from the app directory or a parent directory', () => {
  const directory = mkdtempSync(join(tmpdir(), 'insight-bot-env-'));
  const appDirectory = join(directory, 'app', 'scripts');
  const environmentFile = join(directory, '.env');

  try {
    writeFileSync(environmentFile, 'DISCORD_APPLICATION_ID=from-file\n');
    assert.equal(findEnvironmentFile(appDirectory), environmentFile);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('registers the complete command contract in a test guild', async () => {
  let request;
  const message = await registerDiscordCommands({
    environment: { ...credentials, DISCORD_GUILD_ID: 'guild-id' },
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response('[]', { status: 200 });
    },
  });

  assert.equal(
    message,
    'Registered Insight-Bot commands in test guild guild-id.'
  );
  assert.equal(
    request.url,
    'https://discord.com/api/v10/applications/application-id/guilds/guild-id/commands'
  );
  assert.equal(request.init.method, 'PUT');
  assert.deepEqual(request.init.headers, {
    authorization: 'Bot bot-token',
    'content-type': 'application/json',
  });
  assert.deepEqual(JSON.parse(request.init.body), commands);
});

test('registers globally when no guild is configured', async () => {
  let requestUrl;
  const message = await registerDiscordCommands({
    environment: credentials,
    fetchImpl: async (url) => {
      requestUrl = url;
      return new Response('[]', { status: 200 });
    },
  });

  assert.equal(message, 'Registered Insight-Bot commands globally.');
  assert.equal(
    requestUrl,
    'https://discord.com/api/v10/applications/application-id/commands'
  );
});

test('reports Discord errors and rejects incomplete credentials', async () => {
  await assert.rejects(
    registerDiscordCommands({
      environment: credentials,
      fetchImpl: async () => new Response('invalid token', { status: 401 }),
    }),
    /Discord registration failed: 401 invalid token/
  );
  assert.throws(
    () => getRegistrationConfig({}),
    /DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN are required/
  );
});
