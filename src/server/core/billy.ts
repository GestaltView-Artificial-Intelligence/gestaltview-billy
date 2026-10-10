import { createHash, createHmac } from 'node:crypto';
import { context, redis, settings } from '@devvit/web/server';
import {
  INSIGHT_BOT_REQUEST_VERSION,
  parseInsightBotResponse,
  type InsightBotResponse,
  type InsightBotTrigger,
  type InsightBotVisibility,
  type InsightBotRequest,
} from '../../shared/insight-bot';

/**
 * Shared bridge between the Devvit app (Billy's hands in Reddit) and the
 * GestaltView runtime (Billy's mind). Every surface — the chat window, the
 * comment summon, the moderator tools — funnels through askBilly so the
 * signing, consent, and policy envelopes stay identical everywhere.
 */

export type BillyConfig = {
  runtimeApiUrl: string;
  runtimeSigningSecret: string;
  emergencyDisabled: boolean;
  dailyRequestLimit: number;
  summonEnabled: boolean;
};

export async function getBillyConfig(): Promise<BillyConfig> {
  const config = await settings.getAll<{
    runtimeApiUrl?: string;
    runtimeSigningSecret?: string;
    emergencyDisabled?: boolean;
    dailyRequestLimit?: number;
    summonEnabled?: boolean;
  }>();
  return {
    runtimeApiUrl: config.runtimeApiUrl ?? '',
    runtimeSigningSecret: config.runtimeSigningSecret ?? '',
    emergencyDisabled: config.emergencyDisabled ?? false,
    dailyRequestLimit: config.dailyRequestLimit ?? 20,
    summonEnabled: config.summonEnabled ?? true,
  };
}

export function isConfigured(config: BillyConfig): boolean {
  return Boolean(config.runtimeApiUrl && config.runtimeSigningSecret);
}

/** Increments the caller's daily usage. Returns whether they are still within quota. */
export async function checkDailyLimit(bucketUserId: string, limit: number): Promise<boolean> {
  const date = new Date().toISOString().slice(0, 10);
  const key = `insight:limit:${context.subredditName ?? 'unknown'}:${date}:${bucketUserId}`;
  const used = await redis.incrBy(key, 1);
  if (used === 1) await redis.expire(key, 172800);
  return used <= Math.max(1, limit);
}

export type AskBillyInput = {
  text: string;
  actorId: string;
  actorName?: string;
  conversationId: string;
  clientRequestId: string;
  visibility: InsightBotVisibility;
  trigger: InsightBotTrigger;
  responsePublic: boolean;
};

export type AskBillyResult =
  | { ok: true; response: InsightBotResponse }
  | { ok: false; kind: 'blocked' | 'degraded'; message: string };

export async function askBilly(config: BillyConfig, input: AskBillyInput): Promise<AskBillyResult> {
  if (config.emergencyDisabled) {
    return { ok: false, kind: 'blocked', message: 'Insight-Bot is paused for this community.' };
  }
  if (!isConfigured(config)) {
    return { ok: false, kind: 'blocked', message: 'The GestaltView connection is not configured.' };
  }

  const requestId = createHash('sha256')
    .update(`reddit:${input.conversationId}:${input.actorId}:${input.clientRequestId}`)
    .digest('hex');

  const request: InsightBotRequest = {
    schema_version: INSIGHT_BOT_REQUEST_VERSION,
    request_id: requestId,
    channel: 'reddit',
    installation_id: context.subredditName ?? 'unknown',
    actor: { platform_user_id: input.actorId, display_name: input.actorName },
    conversation: { platform_conversation_id: input.conversationId, visibility: input.visibility },
    input: { text: input.text },
    consent: {
      response_public: input.responsePublic,
      retain_input: false,
      allow_gestaltview_handoff: false,
    },
    policy: { trigger: input.trigger, allow_external_post: false },
  };

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const serialized = JSON.stringify(request);
  const signature = createHmac('sha256', config.runtimeSigningSecret)
    .update(`${timestamp}.${serialized}`)
    .digest('hex');

  try {
    const response = await fetch(`${config.runtimeApiUrl.replace(/\/+$/, '')}/insight-bot/respond`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-insight-bot-adapter': 'reddit',
        'x-insight-bot-timestamp': timestamp,
        'x-insight-bot-signature': `${timestamp}.${signature}`,
      },
      body: serialized,
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return { ok: false, kind: 'degraded', message: 'GestaltView is temporarily unavailable.' };
    }
    const result = parseInsightBotResponse(await response.json());
    if (result.request_id !== requestId) throw new Error('Response request ID mismatch');
    return { ok: true, response: result };
  } catch (error) {
    console.error(
      'Insight-Bot runtime request failed',
      error instanceof Error ? error.message : 'unknown error'
    );
    return { ok: false, kind: 'degraded', message: 'Insight-Bot could not reach GestaltView. Please retry.' };
  }
}
