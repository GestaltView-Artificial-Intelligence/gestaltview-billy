import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
  DecrementResponse,
  IncrementResponse,
  InitResponse,
} from '../../shared/api';
import { askBilly, checkDailyLimit, getBillyConfig, isConfigured } from '../core/billy';

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

  const config = await getBillyConfig();
  if (config.emergencyDisabled) {
    return c.json({ status: 'blocked', message: 'Insight-Bot is paused for this community.' }, 503);
  }
  if (!isConfigured(config)) {
    return c.json({ status: 'blocked', message: 'The GestaltView connection is not configured.' }, 503);
  }

  const postId = context.postId;
  const userId = context.userId ?? 'anonymous';
  if (!(await checkDailyLimit(userId, config.dailyRequestLimit))) {
    return c.json({ status: 'blocked', message: 'The daily request limit has been reached.' }, 429);
  }

  const result = await askBilly(config, {
    text,
    actorId: userId,
    actorName: (await reddit.getCurrentUsername()) ?? undefined,
    conversationId: postId ?? 'post',
    clientRequestId: typeof data.requestId === 'string' ? data.requestId : '',
    visibility: 'private',
    trigger: 'custom_post',
    responsePublic: false,
  });
  if (!result.ok) {
    return c.json({ status: result.kind, message: result.message }, 503);
  }
  return c.json(result.response);
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
