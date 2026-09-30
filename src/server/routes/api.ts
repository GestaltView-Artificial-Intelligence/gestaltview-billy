import { Hono } from 'hono';
import { context, redis, reddit, settings } from '@devvit/web/server';
import type {
  DecrementResponse,
  IncrementResponse,
  InitResponse,
} from '../../shared/api';
import {
  INSIGHT_BOT_REQUEST_VERSION,
  parseInsightBotResponse,
  type InsightBotRequest,
} from '../../shared/insight-bot';
import { createHash, createHmac } from 'node:crypto';

type ErrorResponse = {
  status: 'error';
  message: string;
};

export const api = new Hono();

api.post('/insight/respond', async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ status: 'blocked', message: 'Invalid request.' }, 400);
  }
  const data = Object.fromEntries(Object.entries(body));
  const text = typeof data.text === 'string' ? data.text.trim() : '';
  if (!text || text.length > 4000) {
    return c.json({ status: 'blocked', message: 'Enter 1–4000 characters.' }, 400);
  }

  const config = await settings.getAll<{
    runtimeApiUrl?: string;
    runtimeSigningSecret?: string;
    emergencyDisabled?: boolean;
    dailyRequestLimit?: number;
  }>();
  if (config.emergencyDisabled) {
    return c.json({ status: 'blocked', message: 'Insight-Bot is paused for this community.' }, 503);
  }
  if (!config.runtimeApiUrl || !config.runtimeSigningSecret) {
    return c.json({ status: 'blocked', message: 'The GestaltView connection is not configured.' }, 503);
  }

  const postId = context.postId;
  const userId = context.userId ?? 'anonymous';
  const date = new Date().toISOString().slice(0, 10);
  const limitKey = `insight:limit:${context.subredditName ?? 'unknown'}:${date}:${userId}`;
  const used = await redis.incrBy(limitKey, 1);
  if (used === 1) await redis.expire(limitKey, 172800);
  if (used > Math.max(1, config.dailyRequestLimit ?? 20)) {
    return c.json({ status: 'blocked', message: 'The daily request limit has been reached.' }, 429);
  }
  const requestId = createHash('sha256')
    .update(`reddit:${postId ?? 'post'}:${userId}:${typeof data.requestId === 'string' ? data.requestId : ''}`)
    .digest('hex');
  const visibility = 'private';
  const request: InsightBotRequest = {
    schema_version: INSIGHT_BOT_REQUEST_VERSION,
    request_id: requestId,
    channel: 'reddit',
    installation_id: context.subredditName ?? 'unknown',
    actor: { platform_user_id: userId, display_name: await reddit.getCurrentUsername() ?? undefined },
    conversation: { platform_conversation_id: postId ?? 'unknown', visibility },
    input: { text },
    consent: { response_public: false, retain_input: false, allow_gestaltview_handoff: false },
    policy: { trigger: 'custom_post', allow_external_post: false },
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
    if (!response.ok) return c.json({ status: 'degraded', message: 'GestaltView is temporarily unavailable.' }, 503);
    const result = parseInsightBotResponse(await response.json());
    if (result.request_id !== requestId) throw new Error('Response request ID mismatch');
    return c.json(result);
  } catch (error) {
    console.error('Insight-Bot runtime request failed', error instanceof Error ? error.message : 'unknown error');
    return c.json({ status: 'degraded', message: 'Insight-Bot could not reach GestaltView. Please retry.' }, 503);
  }
});

api.get('/init', async (c) => {
  const { postId } = context;

  if (!postId) {
    console.error('API Init Error: postId not found in devvit context');
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required but missing from context',
      },
      400
    );
  }

  try {
    const [count, username] = await Promise.all([
      redis.get('count'),
      reddit.getCurrentUsername(),
    ]);

    return c.json<InitResponse>({
      type: 'init',
      postId: postId,
      count: count ? parseInt(count) : 0,
      username: username ?? 'anonymous',
    });
  } catch (error) {
    console.error(`API Init Error for post ${postId}:`, error);
    let errorMessage = 'Unknown error during initialization';
    if (error instanceof Error) {
      errorMessage = `Initialization failed: ${error.message}`;
    }
    return c.json<ErrorResponse>(
      { status: 'error', message: errorMessage },
      400
    );
  }
});

api.post('/increment', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required',
      },
      400
    );
  }

  const count = await redis.incrBy('count', 1);
  return c.json<IncrementResponse>({
    count,
    postId,
    type: 'increment',
  });
});

api.post('/decrement', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required',
      },
      400
    );
  }

  const count = await redis.incrBy('count', -1);
  return c.json<DecrementResponse>({
    count,
    postId,
    type: 'decrement',
  });
});
