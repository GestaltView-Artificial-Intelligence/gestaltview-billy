import { createHash, createHmac, createPublicKey, verify } from 'node:crypto';
import {
  INSIGHT_BOT_REQUEST_VERSION,
  parseInsightBotResponse,
  type InsightBotRequest,
} from '../../src/shared/insight-bot.js';

const EPHEMERAL = 1 << 6;
const BRAND = '**GESTALTVIEW // INSIGHT-BOT**\n';
type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};
}

function verifyDiscord(body: string, timestamp: string, signature: string, key: string): boolean {
  try {
    if (!/^\d{10,}$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
    const rawKey = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(key, 'hex')]);
    return verify(null, Buffer.from(timestamp + body), createPublicKey({ key: rawKey, format: 'der', type: 'spki' }), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

function findOption(options: unknown, name: string): unknown {
  if (!Array.isArray(options)) return undefined;
  for (const candidate of options) {
    const option = record(candidate);
    if (option.name === name) return option.value;
    const nested = findOption(option.options, name);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

function reply(content: string, flags = EPHEMERAL): Response {
  return Response.json({ type: 4, data: { flags, content: `${BRAND}${content}`.slice(0, 2000) } });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const body = await request.text();
  const timestamp = request.headers.get('x-signature-timestamp') ?? '';
  const signature = request.headers.get('x-signature-ed25519') ?? '';
  const publicKey = process.env.DISCORD_PUBLIC_KEY?.trim() ?? '';
  if (!publicKey || !verifyDiscord(body, timestamp, signature, publicKey)) {
    return Response.json({ error: 'Invalid request signature' }, { status: 401 });
  }

  let interaction: JsonRecord;
  try {
    interaction = record(JSON.parse(body));
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (interaction.type === 1) return Response.json({ type: 1 });
  if (interaction.type !== 2 || typeof interaction.id !== 'string') {
    return Response.json({ error: 'Unsupported interaction' }, { status: 400 });
  }
  if (process.env.INSIGHT_BOT_DISABLED === 'true') return reply('Insight-Bot is temporarily paused.');

  const command = record(interaction.data);
  if (command.name !== 'insight') return reply('Use `/insight help` to see available commands.');
  const options = Array.isArray(command.options) ? command.options : [];
  const subcommand = record(options[0]);
  const name = subcommand.name;
  if (name === 'help') return reply('Use `/insight ask message:<text>` to ask Insight-Bot, or `/insight explain topic:<topic>` for an explanation. Responses are private by default.');
  if (name !== 'ask' && name !== 'explain') return reply('Choose `/insight ask`, `/insight explain`, or `/insight help`.');
  const input = findOption(subcommand.options, name === 'ask' ? 'message' : 'topic');
  const text = typeof input === 'string' ? input.trim() : '';
  if (!text || text.length > 4000) return reply('Your message must contain between 1 and 4000 characters.');

  const runtimeUrl = process.env.INSIGHT_BOT_RUNTIME_URL?.trim();
  const signingSecret = process.env.INSIGHT_BOT_SIGNING_SECRET?.trim();
  if (!runtimeUrl || !signingSecret) return reply('The GestaltView connection has not been configured.');
  const requestedPublic = findOption(subcommand.options, 'public') === true;
  const allowPublic = process.env.DISCORD_PUBLIC_REPLIES_ENABLED === 'true' && requestedPublic;
  const member = record(interaction.member);
  const user = Object.keys(record(member.user)).length ? record(member.user) : record(interaction.user);
  const requestId = createHash('sha256').update(`discord:${interaction.id}`).digest('hex');
  const visibility = allowPublic ? 'public' : 'ephemeral';
  const runtimeRequest: InsightBotRequest = {
    schema_version: INSIGHT_BOT_REQUEST_VERSION,
    request_id: requestId,
    channel: 'discord',
    installation_id: typeof interaction.guild_id === 'string' ? interaction.guild_id : 'direct-message',
    actor: {
      platform_user_id: typeof user.id === 'string' ? user.id : 'unknown',
      display_name: typeof user.global_name === 'string' ? user.global_name : typeof user.username === 'string' ? user.username : undefined,
    },
    conversation: {
      platform_conversation_id: typeof interaction.channel_id === 'string' ? interaction.channel_id : 'unknown',
      visibility,
    },
    input: { text },
    consent: { response_public: allowPublic, retain_input: false, allow_gestaltview_handoff: false },
    policy: { trigger: 'slash_command', allow_external_post: allowPublic },
  };
  const serialized = JSON.stringify(runtimeRequest);
  const signedAt = Math.floor(Date.now() / 1000).toString();
  const runtimeSignature = createHmac('sha256', signingSecret).update(`${signedAt}.${serialized}`).digest('hex');
  try {
    const runtimeResponse = await fetch(`${runtimeUrl.replace(/\/+$/, '')}/insight-bot/respond`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-insight-bot-adapter': 'discord',
        'x-insight-bot-timestamp': signedAt,
        'x-insight-bot-signature': `${signedAt}.${runtimeSignature}`,
      },
      body: serialized,
      signal: AbortSignal.timeout(2500),
    });
    if (!runtimeResponse.ok) return reply('GestaltView is temporarily unavailable. Please retry in a moment.');
    const result = parseInsightBotResponse(await runtimeResponse.json());
    if (result.request_id !== requestId) throw new Error('Runtime response request ID mismatch');
    const flags = allowPublic && result.reply_mode === 'public' ? 0 : EPHEMERAL;
    return reply(result.text || 'No response was returned.', flags);
  } catch (error) {
    console.error('Discord runtime request failed', error instanceof Error ? error.message : 'unknown error');
    return reply('Insight-Bot could not reach GestaltView. Please retry.');
  }
}
