import { config } from "../config.js";

// Heartbeat + alerts to Telegram, so during the unattended live week we know
// within minutes if the agent stalls, errors, or trips a guardrail. Sending is a
// no-op unless TELEGRAM_BOT_TOKEN + chat id are configured — and a failed alert
// must NEVER crash the trade loop.

export type AlertLevel = "info" | "warn" | "error";

/** Pure: format an alert line. */
export function formatAlert(level: AlertLevel, msg: string, ts: string): string {
  const icon = level === "error" ? "🔴" : level === "warn" ? "🟠" : "🟢";
  return `${icon} [PLIMSOLL ${ts}] ${msg}`;
}

export async function alert(level: AlertLevel, msg: string): Promise<void> {
  const { botToken, chatId } = config.telegram;
  if (!botToken || !chatId) return; // monitoring not configured — no-op
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: formatAlert(level, msg, new Date().toISOString()) }),
    });
  } catch {
    // swallow — alerting must never break trading
  }
}
