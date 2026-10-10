import { Hono } from 'hono';
import type { OnAppInstallRequest, OnCommentCreateRequest, TriggerResponse, T1, T3 } from '@devvit/web/shared';
import { context, redis, reddit } from '@devvit/web/server';
import { createPost } from '../core/post';
import { askBilly, checkDailyLimit, getBillyConfig, isConfigured } from '../core/billy';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  try {
    const post = await createPost();
    const input = await c.req.json<OnAppInstallRequest>();

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `Post created in subreddit ${context.subredditName} with id ${post.id} (trigger: ${input.type})`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<TriggerResponse>(
      {
        status: 'error',
        message: 'Failed to create post',
      },
      400
    );
  }
});

/**
 * Comment summon — Billy operating in the conversation layer.
 *
 * A user writes `!billy` (or mentions u/insight-bot) in a comment; the app
 * reads the surrounding thread, asks the GestaltView runtime, and replies
 * once as a child comment. Billy never speaks unprompted: no summon token,
 * no reply. A per-comment redis key guarantees at-most-once replies even if
 * the trigger fires twice, and the summon lives in its own rate-limit bucket
 * so it never eats anyone's chat quota.
 */

const SUMMON_PATTERN = /(^|\s)(!billy|u\/insight-bot)(?![\w-])/i;
const OWN_REPLY_MARKER = 'Billy · summoned';
const MAX_ANCESTORS = 6;
const MAX_SNIPPET = 600;

const asT1 = (id: string): T1 => (id.startsWith('t1_') ? id : `t1_${id}`) as T1;
const asT3 = (id: string): T3 => (id.startsWith('t3_') ? id : `t3_${id}`) as T3;

triggers.post('/on-comment-summon', async (c) => {
  const input = await c.req.json<OnCommentCreateRequest>().catch(() => null);
  const ignored = (message: string) =>
    c.json<TriggerResponse>({ status: 'success', message: `summon ignored: ${message}` }, 200);

  try {
    const comment = input?.comment;
    if (!comment?.id || !comment.body) return ignored('no comment in payload');

    const config = await getBillyConfig();
    if (!config.summonEnabled) return ignored('summon disabled in settings');
    if (config.emergencyDisabled) return ignored('app paused');
    if (!isConfigured(config)) return ignored('runtime not configured');
    if (!SUMMON_PATTERN.test(comment.body)) return ignored('no summon token');
    if (comment.body.includes(OWN_REPLY_MARKER)) return ignored('own reply');

    const commentId = asT1(comment.id);
    const dedupeKey = `summon:replied:${commentId}`;
    if (await redis.get(dedupeKey)) return ignored('already replied');

    const summoner = comment.author || 'unknown';
    if (!(await checkDailyLimit(`summon:${summoner}`, config.dailyRequestLimit))) {
      console.log(`summon rate-limited for ${summoner}`);
      return ignored('summoner over daily limit');
    }

    // Walk up the thread so Billy answers with context, not in a vacuum.
    const chain: Array<{ author: string; body: string }> = [];
    let cursor: string | null = comment.parentId;
    for (let i = 0; i < MAX_ANCESTORS && cursor; i++) {
      if (!cursor.startsWith('t1_')) break;
      try {
        const parent = await reddit.getCommentById(asT1(cursor));
        chain.unshift({ author: parent.authorName, body: parent.body.slice(0, MAX_SNIPPET) });
        cursor = parent.parentId;
      } catch {
        break;
      }
    }

    let postTitle = '';
    try {
      postTitle = (await reddit.getPostById(asT3(comment.postId))).title;
    } catch {
      // Post may be unavailable; answer without it.
    }

    const question =
      comment.body.replace(SUMMON_PATTERN, ' ').trim().slice(0, 2000) ||
      'What do you see in this thread?';
    const transcript = chain
      .map((m) => `u/${m.author}: ${m.body}`)
      .join('\n\n')
      .slice(0, 4000);
    const subredditName = context.subredditName ?? 'unknown';

    const result = await askBilly(config, {
      text:
        `A Reddit user summoned you in r/${subredditName} with this question:\n\n${question}\n\n` +
        `Thread context${postTitle ? ` (post: "${postTitle.slice(0, 200)}")` : ''}:\n` +
        `${transcript || '(no parent comments visible)'}\n\n` +
        `Reply conversationally and concisely, in Reddit markdown. Stay grounded in the thread.`,
      actorId: `summon:${summoner}`,
      actorName: summoner,
      conversationId: comment.postId,
      clientRequestId: commentId,
      visibility: 'public',
      trigger: 'slash_command',
      responsePublic: true,
    });

    if (!result.ok) {
      console.error(`summon to runtime failed for ${commentId}: ${result.message}`);
      return c.json<TriggerResponse>({ status: 'error', message: result.message }, 500);
    }

    const replyText =
      `*${OWN_REPLY_MARKER} by u/${summoner}*\n\n${result.response.text}`.slice(0, 9500);
    await reddit.submitComment({ id: commentId, text: replyText, runAs: 'APP' });
    await redis.set(dedupeKey, '1');
    await redis.expire(dedupeKey, 604800);

    return c.json<TriggerResponse>(
      { status: 'success', message: `replied to ${commentId}` },
      200
    );
  } catch (error) {
    console.error(
      'on-comment-summon failed',
      error instanceof Error ? error.message : 'unknown error'
    );
    return c.json<TriggerResponse>({ status: 'error', message: 'summon failed' }, 500);
  }
});
