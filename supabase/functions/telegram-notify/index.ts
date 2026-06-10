// Supabase Edge Function: telegram-notify
//
// Sends a Telegram message to one of three targets:
//   1. Explicit chat_id passed in the body
//   2. A "barber" target — looked up in `barbers` by phone or id, sending
//      to that barber's `telegram_chat_id` (if set + notifications on).
//   3. A "client" target — looked up in `telegram_links` by phone number,
//      falling back to `clients`/`guests` (guests don't have telegram).
//
// All notification types use this single function so callers don't have to
// worry about which channel a user has linked.
//
// Also supports:
//   • `reply_markup.inline_keyboard` — show Accept/Reject buttons under
//     the message so the barber can act on the booking WITHOUT opening
//     the app. Tapping a button POSTs to `telegram-webhook` which calls
//     back into our DB trigger, which deletes this original message and
//     sends the next status update (accepted/rejected).
//   • `delete_message: { chat_id, message_id }` — removes a previously
//     sent message so the user's chat stays clean. Used by the trigger
//     when a booking changes state (e.g. removing the "Yangi navbat!"
//     alert once the barber accepts).
//
// Required secret:  TELEGRAM_BOT_TOKEN
// Optional:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (auto-provided by
//            Supabase when deployed via the CLI)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface NotifyPayload {
  // Direct (legacy) — caller already knows the chat_id
  chat_id?: string;
  text?: string;
  message?: string;
  parse_mode?: string;

  // Resolved by target+id/phone
  target?: "barber" | "client" | "guest";
  phone?: string;
  barber_id?: string;

// Inline keyboard under the message (e.g. Accept/Reject for the barber)
  reply_markup?: Record<string, unknown>;

  // Booking id (used to persist the (chat_id, message_id) so future
  // status changes can delete the original alert).
  booking_id?: string;

  // Delete a previously-sent message in-place (used by the DB trigger to
  // clean up the original "Yangi navbat!" alert after the barber acts).
  delete_message?: { chat_id: string; message_id: number | string };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as NotifyPayload;
    console.log("[TELEGRAM NOTIFY] Incoming payload:", JSON.stringify({
      target: body.target, phone: body.phone, barber_id: body.barber_id,
      chat_id: body.chat_id, booking_id: body.booking_id,
      has_text: !!(body.text || body.message),
      has_delete: !!body.delete_message,
    }));
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      console.error("[TELEGRAM NOTIFY] TELEGRAM_BOT_TOKEN not configured");
      return json({ error: "TELEGRAM_BOT_TOKEN is not configured on the server" }, 500);
    }

    // ── 1. Handle message deletion ──
    if (body.delete_message) {
      let { chat_id, message_id } = body.delete_message;
      const overrideChatId = Deno.env.get("OVERRIDE_TELEGRAM_CHAT_ID");
      const overridePhone = Deno.env.get("OVERRIDE_TELEGRAM_PHONE");

      if (overrideChatId) {
        chat_id = overrideChatId;
      } else if (overridePhone) {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
        const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
          const resolved = await lookupChatIdByPhone(supabase, overridePhone);
          if (resolved) chat_id = resolved;
        }
      }

      const url = `https://api.telegram.org/bot${botToken}/deleteMessage`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, message_id: Number(message_id) }),
      });
      const result = await resp.json();
      if (!result.ok && result.description !== "Bad Request: message to delete not found") {
        console.warn("[TELEGRAM NOTIFY] deleteMessage failed:", result);
      } else {
        console.log(`[TELEGRAM NOTIFY] deleted chat_id=${chat_id} message_id=${message_id}`);
      }
      return json({ success: true, deleted: true, result });
    }

    // ── 2. Normal "send message" path ──
    const text = body.text || body.message;
    if (!text) {
      return json({ error: "text or message is required" }, 400);
    }
    const parseMode = body.parse_mode || "HTML";

    // Resolve chat_id with override support
    let chatId: string | null = null;
    const overrideChatId = Deno.env.get("OVERRIDE_TELEGRAM_CHAT_ID");
    const overridePhone = Deno.env.get("OVERRIDE_TELEGRAM_PHONE");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseClient = (SUPABASE_URL && SUPABASE_SERVICE_KEY) ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) : null;

    if (overrideChatId) {
      chatId = overrideChatId;
      console.log(`[TELEGRAM NOTIFY] OVERRIDE: Redirecting message to overrideChatId="${chatId}"`);
    } else if (overridePhone && supabaseClient) {
      chatId = await lookupChatIdByPhone(supabaseClient, overridePhone);
      if (chatId) {
        console.log(`[TELEGRAM NOTIFY] OVERRIDE: Redirecting message to overridePhone="${overridePhone}" chat_id="${chatId}"`);
      }
    }

    if (!chatId) {
      chatId = body.chat_id || null;
    }

    if (!chatId) {
      if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error("[TELEGRAM NOTIFY] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
        return json({ error: "Server is missing Supabase service credentials" }, 500);
      }
      const supabase = supabaseClient || createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      if (body.target === "barber") {
        if (body.barber_id) {
          const { data } = await supabase
            .from("barbers")
            .select("telegram_chat_id, telegram_notifications, phone")
            .eq("id", body.barber_id)
            .maybeSingle();
          console.log("[TELEGRAM NOTIFY] barber lookup by id:", JSON.stringify(data));
          if (data?.telegram_chat_id && data.telegram_notifications !== false) {
            chatId = data.telegram_chat_id;
          } else if (data?.phone) {
            chatId = await lookupChatIdByPhone(supabase, data.phone);
          }
        } else if (body.phone) {
          const { data } = await supabase
            .from("barbers")
            .select("telegram_chat_id, telegram_notifications")
            .eq("phone", body.phone)
            .maybeSingle();
          console.log("[TELEGRAM NOTIFY] barber lookup by phone:", JSON.stringify(data));
          if (data?.telegram_chat_id && data.telegram_notifications !== false) {
            chatId = data.telegram_chat_id;
          } else {
            chatId = await lookupChatIdByPhone(supabase, body.phone);
          }
        }
      }

      if (!chatId && (body.target === "client" || body.target === "guest") && body.phone) {
        chatId = await lookupChatIdByPhone(supabase, body.phone);
      }

      if (!chatId && body.phone) {
        chatId = await lookupChatIdByPhone(supabase, body.phone);
      }
    }

    if (!chatId) {
      console.log("[TELEGRAM NOTIFY] no chat_id resolved for target=" + body.target + " phone=" + body.phone + "; skipping send");
      return json({ success: true, skipped: true, reason: "no_chat_id" });
    }

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
        ...(body.reply_markup ? { reply_markup: body.reply_markup } : {}),
      }),
    });

    const result = await response.json();
    if (!result.ok) {
      console.error("[TELEGRAM NOTIFY] Telegram API error:", result);
      return json({ error: result.description || "Telegram API error" }, response.status);
    }

    const sentMessageId = result.result?.message_id;
    console.log(`[TELEGRAM NOTIFY] sent to chat_id=${chatId} message_id=${sentMessageId}`);

    // Message tracking omitted — telegram_messages column not present in schema.

    return json({ success: true, messageId: sentMessageId });
  } catch (err) {
    console.error("[TELEGRAM NOTIFY] exception:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

async function lookupChatIdByPhone(
  supabase: ReturnType<typeof createClient>,
  phone: string,
): Promise<string | null> {
  // Normalize phone: ensure +998XXXXXXXXX format
  let normalized = phone.replace(/\D/g, "");
  if (normalized.length === 9) normalized = "998" + normalized;
  if (!normalized.startsWith("+")) normalized = "+" + normalized;

  console.log(`[TELEGRAM NOTIFY] lookupChatIdByPhone: input="${phone}" normalized="${normalized}"`);

  // Try exact match first
  const { data } = await supabase
    .from("telegram_links")
    .select("chat_id")
    .eq("phone", normalized)
    .maybeSingle();

  if (data?.chat_id) {
    console.log(`[TELEGRAM NOTIFY] Found chat_id=${data.chat_id} for phone=${normalized}`);
    return String(data.chat_id);
  }

  // Try original format as fallback
  if (normalized !== phone) {
    const { data: fallback } = await supabase
      .from("telegram_links")
      .select("chat_id")
      .eq("phone", phone)
      .maybeSingle();
    if (fallback?.chat_id) {
      console.log(`[TELEGRAM NOTIFY] Found chat_id=${fallback.chat_id} for original phone=${phone}`);
      return String(fallback.chat_id);
    }
  }

  console.log(`[TELEGRAM NOTIFY] No telegram_links entry for phone=${normalized}`);
  return null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
