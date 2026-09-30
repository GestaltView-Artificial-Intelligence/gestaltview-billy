export const INSIGHT_BOT_REQUEST_VERSION = "insight_bot_request.v2" as const;
export const INSIGHT_BOT_RESPONSE_VERSION = "insight_bot_response.v2" as const;

export type InsightBotChannel = "reddit" | "discord";
export type InsightBotVisibility = "public" | "private" | "ephemeral";
export type InsightBotStatus = "completed" | "queued" | "degraded" | "blocked";
export type InsightBotTrigger = "slash_command" | "custom_post";

export type InsightBotRequest = {
  schema_version: typeof INSIGHT_BOT_REQUEST_VERSION;
  request_id: string;
  channel: InsightBotChannel;
  installation_id: string;
  workspace_id?: string;
  actor: { platform_user_id: string; display_name?: string };
  conversation: { platform_conversation_id: string; visibility: InsightBotVisibility };
  input: { text: string };
  consent: {
    response_public: boolean;
    retain_input: boolean;
    allow_gestaltview_handoff: boolean;
  };
  policy: { trigger: InsightBotTrigger; allow_external_post: boolean };
};

export type InsightBotResponse = {
  schema_version: typeof INSIGHT_BOT_RESPONSE_VERSION;
  request_id: string;
  status: InsightBotStatus;
  text: string;
  reply_mode: InsightBotVisibility;
  receipt_id: string;
  retryable: boolean;
};

function isStatus(value: unknown): value is InsightBotStatus {
  return value === "completed" || value === "queued" || value === "degraded" || value === "blocked";
}

function isVisibility(value: unknown): value is InsightBotVisibility {
  return value === "public" || value === "private" || value === "ephemeral";
}

export function parseInsightBotResponse(value: unknown): InsightBotResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GestaltView returned an invalid response");
  }
  const data = Object.fromEntries(Object.entries(value));
  if (
    data.schema_version !== INSIGHT_BOT_RESPONSE_VERSION ||
    typeof data.request_id !== "string" ||
    !isStatus(data.status) ||
    typeof data.text !== "string" ||
    !isVisibility(data.reply_mode) ||
    typeof data.receipt_id !== "string" ||
    typeof data.retryable !== "boolean"
  ) {
    throw new Error("GestaltView returned an invalid response");
  }
  return {
    schema_version: INSIGHT_BOT_RESPONSE_VERSION,
    request_id: data.request_id,
    status: data.status,
    text: data.text,
    reply_mode: data.reply_mode,
    receipt_id: data.receipt_id,
    retryable: data.retryable,
  };
}
