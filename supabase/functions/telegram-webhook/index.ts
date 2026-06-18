// Supabase Edge Function: telegram-webhook
//
// Receives inbound updates from the @BarberUp_bot:
//   • /start command             — greet + ask for phone
//   • Shared contact             — link phone → chat_id + telegram_user_id
//   • Manual "+998XXXXXXXXX" text — link phone → chat_id + telegram_user_id
//   • Inline button callback     — Accept/Reject a pending booking
//                                  (callback_data format: "accept:<id>"
//                                  or "reject:<id>")
//
// Required secret:  TELEGRAM_BOT_TOKEN
// Optional:         SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (auto)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? SUPABASE_ANON_KEY;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

// Mini App URL — already registered in BotFather
const MINI_APP_URL = "https://barberup.uz/tg";

// Use the service-role key so we can update the bookings table and call
// the new set_booking_status RPC regardless of RLS.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

serve(async (req) => {
  try {
    if (!BOT_TOKEN) {
      console.error("[TELEGRAM WEBHOOK] TELEGRAM_BOT_TOKEN not configured");
      return new Response("Server error", { status: 500 });
    }

    if (req.method === "GET") {
      const webhookUrl = `https://brvlvempavfiqyjbomjz.supabase.co/functions/v1/telegram-webhook`;
      const setupRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
      const setupData = await setupRes.json();
      return new Response(JSON.stringify({
        message: "Webhook setup attempt complete",
        telegram_response: setupData,
        webhook_url: webhookUrl
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const update = await req.json();

    // ── Helper: post a message back to the user ─────────────────────────
    const sendTelegram = async (chatId: number | string, text: string, extra: Record<string, unknown> = {}) => {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, ...extra }),
      });
    };

    // ── Helper: acknowledge a callback_query so Telegram stops the
    //    "typing…" spinner and re-renders the buttons. ──────────────────
    const answerCallback = async (callbackQueryId: string, text?: string) => {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text ?? "",
          show_alert: false,
        }),
      });
    };

    // ── Helper: send "Open BarberUp" Mini App inline button ───────────
    const sendOpenAppButton = async (chatId: number | string) => {
      await sendTelegram(
        chatId,
        "🚀 *BarberUp ilovasini oching:*\n\nSartaroshxona qidirish va navbat band qilish uchun quyidagi tugmani bosing.",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              {
                text: "✂️ BarberUp'ni ochish",
                web_app: { url: MINI_APP_URL },
              },
            ]],
          },
        }
      );
    };

    // ── 1. Inline keyboard callback (Accept / Reject) ─────────────────
    if (update.callback_query) {
      const cq = update.callback_query;
      const cbData: string = cq.data || "";
      const chatId = cq.message?.chat?.id;
      const messageId = cq.message?.message_id;

      if (cbData.startsWith("accept:") || cbData.startsWith("reject:")) {
        const action = cbData.startsWith("accept:") ? "accepted" : "rejected";
        const bookingId = cbData.split(":")[1];

        const { data, error } = await supabase.rpc("set_booking_status", {
          p_booking_id: bookingId,
          p_new_status: action,
        });

        if (error) {
          console.error("[TELEGRAM WEBHOOK] set_booking_status error:", error);
          await answerCallback(cq.id, "❌ Xatolik yuz berdi");
          return new Response("ok");
        }

        const row = data?.[0] ?? data;
        const newStatus = row?.new_status ?? action;
        const clientName = row?.client_name ?? "";
        const service = row?.service ?? "";
        const bookingAt = row?.booking_at ?? "";

        await answerCallback(
          cq.id,
          newStatus === "accepted" ? "✅ Qabul qilindi" : "❌ Rad etildi",
        );

        if (chatId && messageId) {
          const updatedText = newStatus === "accepted"
            ? `✅ <b>Qabul qilindi</b>\n\n👤 ${clientName}\n✂️ ${service}\n🕐 ${bookingAt}\n\nMijozga xabar yuborildi.`
            : `❌ <b>Rad etildi</b>\n\n👤 ${clientName}\n✂️ ${service}\n🕐 ${bookingAt}\n\nMijozga xabar yuborildi.`;

          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: updatedText,
              parse_mode: "HTML",
            }),
          });
        }

        return new Response("ok");
      }

      await answerCallback(cq.id);
      return new Response("ok");
    }

    // ── 2. Plain text / contact / command updates ──────────────────────
    const chatId = update.message?.chat?.id;
    if (!chatId) return new Response("ok");

    // ── /start command ──────────────────────────────────────────────────
    if (update.message.text === "/start" || update.message.text?.startsWith("/start ")) {
      const telegramUserId = String(update.message.from?.id ?? chatId);

      // Check if this user has already linked their phone
      const { data: existingLink } = await supabase
        .from("telegram_links")
        .select("phone")
        .or(`chat_id.eq.${String(chatId)},telegram_user_id.eq.${telegramUserId}`)
        .maybeSingle();

      if (existingLink?.phone) {
        // ── Returning user ─────────────────────────────────────────────
        const firstName = update.message.from?.first_name ?? "Foydalanuvchi";
        await sendTelegram(
          chatId,
          `👋 *Qaytib keldingiz, ${firstName}!*\n\n` +
            `✅ Telefon raqamingiz (${existingLink.phone}) ulangan.\n\n` +
            `Sartaroshxona qidirish yoki navbatlaringizni ko'rish uchun ilovani oching:`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[
                {
                  text: "✂️ BarberUp'ni ochish",
                  web_app: { url: MINI_APP_URL },
                },
              ]],
            },
          }
        );
      } else {
        // ── First-time user ─────────────────────────────────────────────
        // Step 1: rich welcome card
        await sendTelegram(
          chatId,
          "✂️ *BarberUp'ga xush kelibsiz!*\n\n" +
            "Sartaroshxona qidirish va navbat band qilishning eng qulay yo'li.\n\n" +
            "🔹 Yaqin atrofdagi sartaroshxonalarni toping\n" +
            "🔹 Onlayn navbat band qiling — kutmasdan boring\n" +
            "🔹 Bron holati haqida darhol xabar oling\n\n" +
            "Boshlash uchun *telefon raqamingizni ulang* 👇",
          { parse_mode: "Markdown" }
        );

        // Step 2: contact-share keyboard
        await sendTelegram(
          chatId,
          "📱 Quyidagi tugmani bosib telefon raqamingizni yuboring:",
          {
            reply_markup: {
              keyboard: [[{ text: "📱 Telefon raqamni yuborish", request_contact: true }]],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          }
        );
      }

      return new Response("ok");
    }


    // ── Shared contact ──────────────────────────────────────────────────
    if (update.message?.contact) {
      const phone = update.message.contact.phone_number.startsWith("+")
        ? update.message.contact.phone_number
        : `+${update.message.contact.phone_number}`;

      // For a self-share: contact.user_id === message.from.id.
      // We store telegram_user_id so the Mini App can look up the phone
      // using window.Telegram.WebApp.initDataUnsafe.user.id.
      const telegramUserId = String(
        update.message.contact.user_id ?? update.message.from?.id ?? chatId
      );

      const { error: upsertError } = await supabase
        .from("telegram_links")
        .upsert(
          { phone, chat_id: String(chatId), telegram_user_id: telegramUserId },
          { onConflict: "phone" }
        );

      if (upsertError) {
        console.error("[TELEGRAM WEBHOOK] upsert error:", upsertError);
        await sendTelegram(chatId, "❌ Xatolik yuz berdi. Qayta urinib ko'ring.");
        return new Response("ok");
      }

      console.log(`[TELEGRAM WEBHOOK] linked phone=${phone} chat_id=${chatId} tg_user_id=${telegramUserId}`);

      // Remove contact-share keyboard, then send success message
      await sendTelegram(
        chatId,
        "✅ *Telefon raqamingiz tasdiqlandi!*\n\n" +
          "Endi sartaroshxona bronlari bo'yicha barcha xabarnomalar shu yerga keladi.",
        {
          parse_mode: "Markdown",
          reply_markup: { remove_keyboard: true },
        },
      );

      // Follow up with the Open App button
      await sendOpenAppButton(chatId);

      return new Response("ok");
    }

    // ── Manual phone entry (+998XXXXXXXXX) ──────────────────────────────
    const phoneRegex = /^\+998\d{9}$/;
    if (update.message?.text && phoneRegex.test(update.message.text.trim())) {
      const phone = update.message.text.trim();
      const telegramUserId = String(update.message.from?.id ?? chatId);

      const { error: upsertError } = await supabase
        .from("telegram_links")
        .upsert(
          { phone, chat_id: String(chatId), telegram_user_id: telegramUserId },
          { onConflict: "phone" }
        );

      if (upsertError) {
        console.error("[TELEGRAM WEBHOOK] upsert error:", upsertError);
        await sendTelegram(chatId, "❌ Xatolik yuz berdi. Qayta urinib ko'ring.");
        return new Response("ok");
      }

      console.log(`[TELEGRAM WEBHOOK] linked phone=${phone} chat_id=${chatId} tg_user_id=${telegramUserId}`);

      await sendTelegram(
        chatId,
        "✅ *Telefon raqamingiz tasdiqlandi!*\n\n" +
          "Endi sartaroshxona bronlari bo'yicha barcha xabarnomalar shu yerga keladi.",
        {
          parse_mode: "Markdown",
          reply_markup: { remove_keyboard: true },
        },
      );

      await sendOpenAppButton(chatId);

      return new Response("ok");
    }

    // ── Anything else: prompt the user to share their number ────────────
    await sendTelegram(
      chatId,
      "Iltimos, telefon raqamingizni +998XXXXXXXXX formatida yuboring " +
        "yoki quyidagi tugmani bosing.",
      {
        reply_markup: {
          keyboard: [[{ text: "📱 Telefon raqamni yuborish", request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      },
    );
    return new Response("ok");
  } catch (err) {
    console.error("[TELEGRAM WEBHOOK] exception:", err);
    return new Response("ok");
  }
});
