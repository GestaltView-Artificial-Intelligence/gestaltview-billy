import { Hono } from 'hono';
import type { Form, UiResponse } from '@devvit/web/shared';
import { context, reddit } from '@devvit/web/server';
import { createPost } from '../core/post';
import { askBilly, checkDailyLimit, getBillyConfig, isConfigured } from '../core/billy';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  try {
    const post = await createPost();

    return c.json<UiResponse>(
      {
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create post',
      },
      400
    );
  }
});

/**
 * Moderator tool — "Ask Billy: summarize thread".
 *
 * Runs from a post's mod menu. Billy reads the post and its top comments and
 * returns a private 30-second brief: what the thread is about, the key
 * viewpoints, open questions, tone, and anything a moderator should look at.
 * Draft-only, like everything Billy does for mods: the summary opens in a
 * form the moderator can copy from. Nothing is posted, stickied, or acted on.
 */

const MAX_COMMENTS = 40;
const MAX_COMMENT_SNIPPET = 300;

menu.post('/summarize-thread', async (c) => {
  try {
    const postId = context.postId;
    if (!postId) {
      return c.json<UiResponse>({ showToast: 'Open this tool from a post.' }, 200);
    }

    const config = await getBillyConfig();
    if (config.emergencyDisabled) {
      return c.json<UiResponse>({ showToast: 'Insight-Bot is paused for this community.' }, 200);
    }
    if (!isConfigured(config)) {
      return c.json<UiResponse>({ showToast: 'The GestaltView connection is not configured.' }, 200);
    }

    const moderatorId = context.userId ?? 'anonymous';
    if (!(await checkDailyLimit(moderatorId, config.dailyRequestLimit))) {
      return c.json<UiResponse>({ showToast: 'The daily request limit has been reached.' }, 200);
    }

    const post = await reddit.getPostById(postId);
    const comments = await reddit.getComments({ postId, sort: 'top', limit: MAX_COMMENTS }).all();
    const digest = comments
      .slice(0, MAX_COMMENTS)
      .map((cm) => `u/${cm.authorName} (${cm.score}): ${cm.body.slice(0, MAX_COMMENT_SNIPPET)}`)
      .join('\n\n')
      .slice(0, 6000);

    const result = await askBilly(config, {
      text:
        `You are helping a Reddit moderator get up to speed. Summarize this thread from r/${context.subredditName ?? 'unknown'} so they grasp it in 30 seconds.\n\n` +
        `Post: "${post.title}"\n${(post.body ?? '').slice(0, 1000)}\n\n` +
        `Top comments:\n${digest || '(no comments yet)'}\n\n` +
        `Cover: 1) what the thread is about (2-3 sentences), 2) the key viewpoints, ` +
        `3) open questions, 4) the tone of the discussion, 5) anything a moderator should look at ` +
        `(possible rule concerns, heated exchanges). Keep it tight — this is a brief, not an essay.`,
      actorId: moderatorId,
      actorName: (await reddit.getCurrentUsername()) ?? undefined,
      conversationId: postId,
      clientRequestId: `mod-summary:${postId}:${Date.now()}`,
      visibility: 'private',
      trigger: 'custom_post',
      responsePublic: false,
    });

    if (!result.ok) {
      return c.json<UiResponse>({ showToast: result.message }, 200);
    }

    const form: Form = {
      title: 'Billy’s thread summary',
      description: 'A private read of this thread for moderators. Copy what you need — nothing is posted.',
      fields: [
        {
          type: 'paragraph',
          name: 'summary',
          label: 'Summary',
          defaultValue: result.response.text.slice(0, 4000),
          disabled: true,
        },
      ],
      acceptLabel: 'Done',
    };

    return c.json<UiResponse>({ showForm: { name: 'thread-summary', form } }, 200);
  } catch (error) {
    console.error(
      'summarize-thread failed',
      error instanceof Error ? error.message : 'unknown error'
    );
    return c.json<UiResponse>({ showToast: 'Could not summarize this thread.' }, 200);
  }
});
