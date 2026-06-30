// Supabase Edge Function: telegram-webhook
//
// Full onboarding flow:
//   • /start          — check telegram_users; ask for phone if new, show Mini App if returning
//   • Shared contact  — save phone, mark onboarding complete, also upsert telegram_links for compat
//   • /changenumber   — trigger phone change flow
//   • Callback query  — Accept/Reject booking + mark notifications as actioned
//
// Required secrets:  TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Optional:          MINI_APP_URL

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MINI_APP_URL = Deno.env.get('MINI_APP_URL') ?? 'https://barberup.uz/tg';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Telegram API helper ──────────────────────────────────────────────────────

async function tg(method: string, body: object) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ─── Send message helpers ─────────────────────────────────────────────────────

async function sendText(chatId: number, text: string, extra: object = {}) {
  return tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
}

async function sendRequestContact(chatId: number) {
  return tg('sendMessage', {
    chat_id: chatId,
    text: '📱 <b>Telefon raqamingizni yuboring</b>\n\nIltimos, quyidagi tugmani bosing — BarberUp akkauntingiz shu raqamga bog\'lanadi.',
    parse_mode: 'HTML',
    reply_markup: {
      keyboard: [[{ text: '📲 Telefon raqamimni yuborish', request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

async function sendOpenMiniApp(chatId: number, firstName: string) {
  return tg('sendMessage', {
    chat_id: chatId,
    text: `✅ <b>Ro'yxatdan o'tdingiz, ${firstName}!</b>\n\nEndi profilingizni to'ldirish uchun ilovani oching 👇`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{
        text: '💈 BarberUp ilovasini ochish',
        web_app: { url: MINI_APP_URL },
      }]],
    },
  });
}

// ─── Phone number change flow ─────────────────────────────────────────────────

async function handlePhoneChangeRequest(chatId: number, telegramId: number) {
  // Mark user as awaiting new phone
  await supabase
    .from('telegram_users')
    .update({ onboarding_step: 'awaiting_phone_change' })
    .eq('telegram_id', telegramId);

  return tg('sendMessage', {
    chat_id: chatId,
    text: '📱 <b>Yangi telefon raqamingizni yuboring</b>\n\nQuyidagi tugmani bosing:',
    parse_mode: 'HTML',
    reply_markup: {
      keyboard: [[{ text: '📲 Yangi raqamimni yuborish', request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

// ─── Main webhook handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    if (!BOT_TOKEN) {
      console.error('[TELEGRAM WEBHOOK] TELEGRAM_BOT_TOKEN not configured');
      return new Response('Server error', { status: 500 });
    }

    // GET request: setup webhook
    if (req.method === 'GET') {
      const webhookUrl = `${SUPABASE_URL}/functions/v1/telegram-webhook`;
      const setupRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
      const setupData = await setupRes.json();
      return new Response(JSON.stringify({
        message: 'Webhook setup attempt complete',
        telegram_response: setupData,
        webhook_url: webhookUrl,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (req.method !== 'POST') return new Response('ok');

    let update: any;
    try {
      update = await req.json();
    } catch {
      return new Response('bad request', { status: 400 });
    }

    // ── Handle callback_query (inline button taps: Accept / Reject) ──────────────
    if (update.callback_query) {
      const cbq = update.callback_query;
      const [action, bookingId] = cbq.data?.split(':') ?? [];
      const telegramId = cbq.from.id;

      if ((action === 'accept' || action === 'reject') && bookingId) {
        const newStatus = action === 'accept' ? 'accepted' : 'rejected';

        // Try the RPC first (existing pattern), fallback to direct update
        let rpcError = null;
        try {
          const { error } = await supabase.rpc('set_booking_status', {
            p_booking_id: bookingId,
            p_new_status: newStatus,
          });
          rpcError = error;
        } catch {
          // RPC might not exist — direct update
          const { error } = await supabase
            .from('bookings')
            .update({ status: newStatus })
            .eq('id', bookingId);
          rpcError = error;
        }

        // Mark notification as actioned
        await supabase
          .from('notifications')
          .update({ is_read: true, action_taken: true })
          .eq('booking_id', bookingId)
          .eq('type', 'new_booking');

        // Edit the original Telegram message to remove the buttons
        const statusLabel = action === 'accept' ? '✅ Qabul qilindi' : '❌ Rad etildi';

        if (cbq.message?.chat?.id && cbq.message?.message_id) {
          await tg('editMessageReplyMarkup', {
            chat_id: cbq.message.chat.id,
            message_id: cbq.message.message_id,
            reply_markup: { inline_keyboard: [] },
          });
        }

        await tg('answerCallbackQuery', {
          callback_query_id: cbq.id,
          text: statusLabel,
          show_alert: false,
        });

        // Send a follow-up confirmation message
        if (!rpcError && cbq.message?.chat?.id) {
          await sendText(
            cbq.message.chat.id,
            `${statusLabel}: Bron yangilandi.`
          );
        }
      } else {
        await tg('answerCallbackQuery', {
          callback_query_id: cbq.id,
        });
      }

      return new Response('ok');
    }

    // ── Handle regular messages ──────────────────────────────────────────────────
    const msg = update.message;
    if (!msg) return new Response('ok');

    const chatId: number = msg.chat.id;
    const telegramId: number = msg.from.id;
    const firstName: string = msg.from.first_name ?? 'Foydalanuvchi';

    // Look up existing telegram_user record
    const { data: existingUser } = await supabase
      .from('telegram_users')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    // ── /start command ────────────────────────────────────────────────────────────
    if (msg.text === '/start' || msg.text?.startsWith('/start ')) {
      // Check for deep-link parameter
      const startParam = msg.text?.split(' ')[1] ?? '';

      if (startParam === 'changenumber' && existingUser) {
        await handlePhoneChangeRequest(chatId, telegramId);
        return new Response('ok');
      }

      if (existingUser?.onboarding_step === 'complete') {
        // Already registered — show welcome back + menu
        return Response.json(
          await tg('sendMessage', {
            chat_id: chatId,
            text: `👋 Salom, <b>${firstName}</b>!\n\nBarberUp ilovasini ochish uchun quyidagi tugmani bosing:`,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[{
                text: '💈 Ilovani ochish',
                web_app: { url: MINI_APP_URL },
              }]],
            },
          })
        );
      }

      // Also check telegram_links for backward compat
      const { data: existingLink } = await supabase
        .from('telegram_links')
        .select('phone')
        .or(`chat_id.eq.${String(chatId)},telegram_user_id.eq.${String(telegramId)}`)
        .maybeSingle();

      if (existingLink?.phone) {
        // Existing user from old system — migrate to telegram_users
        await supabase.from('telegram_users').upsert({
          telegram_id: telegramId,
          phone: existingLink.phone,
          first_name: firstName,
          username: msg.from.username ?? null,
          onboarding_step: 'complete',
        }, { onConflict: 'telegram_id' });

        await tg('sendMessage', {
          chat_id: chatId,
          text: `👋 *Qaytib keldingiz, ${firstName}!*\n\n✅ Telefon raqamingiz (${existingLink.phone}) ulangan.\n\nSartaroshxona qidirish yoki navbatlaringizni ko'rish uchun ilovani oching:`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{
              text: '✂️ BarberUp\'ni ochish',
              web_app: { url: MINI_APP_URL },
            }]],
          },
        });
        return new Response('ok');
      }

      // New user — start onboarding
      await supabase.from('telegram_users').upsert({
        telegram_id: telegramId,
        phone: '',
        first_name: firstName,
        username: msg.from.username ?? null,
        onboarding_step: 'awaiting_phone',
      }, { onConflict: 'telegram_id' });

      // Welcome message
      await sendText(
        chatId,
        '✂️ <b>BarberUp\'ga xush kelibsiz!</b>\n\n' +
          'Sartaroshxona qidirish va navbat band qilishning eng qulay yo\'li.\n\n' +
          '🔹 Yaqin atrofdagi sartaroshxonalarni toping\n' +
          '🔹 Onlayn navbat band qiling — kutmasdan boring\n' +
          '🔹 Bron holati haqida darhol xabar oling\n\n' +
          'Boshlash uchun <b>telefon raqamingizni ulang</b> 👇'
      );

      await sendRequestContact(chatId);
      return new Response('ok');
    }

    // ── /changenumber command ─────────────────────────────────────────────────────
    if (msg.text === '/changenumber' || msg.text === '🔄 Raqamni o\'zgartirish') {
      if (!existingUser) {
        await sendRequestContact(chatId);
        return new Response('ok');
      }
      await handlePhoneChangeRequest(chatId, telegramId);
      return new Response('ok');
    }

    // ── Contact message (phone number received) ───────────────────────────────────
    if (msg.contact) {
      const rawPhone = msg.contact.phone_number;
      const phone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`;
      const telegramUserId = String(msg.contact.user_id ?? msg.from?.id ?? chatId);

      const currentStep = existingUser?.onboarding_step;

      if (currentStep === 'awaiting_phone_change') {
        // ── Phone change flow ──────────────────────────────────────────────────
        const oldPhone = existingUser.phone;

        // Update telegram_users
        await supabase
          .from('telegram_users')
          .update({ phone, onboarding_step: 'complete', updated_at: new Date().toISOString() })
          .eq('telegram_id', telegramId);

        // Update telegram_links for backward compat
        await supabase
          .from('telegram_links')
          .upsert(
            { phone, chat_id: String(chatId), telegram_user_id: telegramUserId },
            { onConflict: 'phone' }
          );

        // If user is a barber, update barbers table
        if (existingUser.role === 'barber') {
          await supabase
            .from('barbers')
            .update({ phone })
            .eq('telegram_id', telegramId);
        }

        // Update all bookings with old phone
        if (oldPhone) {
          await supabase.rpc('update_guest_phone', {
            p_old_phone: oldPhone,
            p_new_phone: phone,
          }).catch(() => {
            // RPC might not exist yet — ignore
          });
        }

        await tg('sendMessage', {
          chat_id: chatId,
          text: `✅ <b>Raqam yangilandi!</b>\n\nYangi raqamingiz: <code>${phone}</code>\n\nBarcha bronlaringiz yangi raqamga o'tkazildi.`,
          parse_mode: 'HTML',
          reply_markup: { remove_keyboard: true },
        });

        return new Response('ok');
      }

      // ── Initial registration flow ──────────────────────────────────────────────
      await supabase.from('telegram_users').upsert({
        telegram_id: telegramId,
        phone,
        first_name: firstName,
        username: msg.from.username ?? null,
        onboarding_step: 'complete',
      }, { onConflict: 'telegram_id' });

      // Also upsert telegram_links for backward compat
      await supabase
        .from('telegram_links')
        .upsert(
          { phone, chat_id: String(chatId), telegram_user_id: telegramUserId },
          { onConflict: 'phone' }
        );

      console.log(`[TELEGRAM WEBHOOK] linked phone=${phone} chat_id=${chatId} tg_user_id=${telegramUserId}`);

      // Remove keyboard and send confirmation
      await tg('sendMessage', {
        chat_id: chatId,
        text: `✅ <b>Telefon raqamingiz saqlandi:</b> <code>${phone}</code>`,
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true },
      });

      await sendOpenMiniApp(chatId, firstName);
      return new Response('ok');
    }

    // ── Manual phone entry (+998XXXXXXXXX) ──────────────────────────────────────
    const phoneRegex = /^\+998\d{9}$/;
    if (msg.text && phoneRegex.test(msg.text.trim())) {
      const phone = msg.text.trim();
      const telegramUserId = String(msg.from?.id ?? chatId);

      await supabase.from('telegram_users').upsert({
        telegram_id: telegramId,
        phone,
        first_name: firstName,
        username: msg.from.username ?? null,
        onboarding_step: 'complete',
      }, { onConflict: 'telegram_id' });

      // Also upsert telegram_links for backward compat
      await supabase
        .from('telegram_links')
        .upsert(
          { phone, chat_id: String(chatId), telegram_user_id: telegramUserId },
          { onConflict: 'phone' }
        );

      console.log(`[TELEGRAM WEBHOOK] linked phone=${phone} chat_id=${chatId} tg_user_id=${telegramUserId}`);

      await tg('sendMessage', {
        chat_id: chatId,
        text: '✅ <b>Telefon raqamingiz tasdiqlandi!</b>\n\n' +
          'Endi sartaroshxona bronlari bo\'yicha barcha xabarnomalar shu yerga keladi.',
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true },
      });

      await sendOpenMiniApp(chatId, firstName);
      return new Response('ok');
    }

    // ── Unrecognized message — show help ──────────────────────────────────────────
    if (existingUser?.onboarding_step === 'complete') {
      await tg('sendMessage', {
        chat_id: chatId,
        text: '💈 <b>BarberUp</b>\n\n/changenumber — telefon raqamingizni o\'zgartirish',
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{
            text: '💈 Ilovani ochish',
            web_app: { url: MINI_APP_URL },
          }]],
        },
      });
    } else {
      await sendRequestContact(chatId);
    }

    return new Response('ok');
  } catch (err) {
    console.error('[TELEGRAM WEBHOOK] exception:', err);
    return new Response('ok');
  }
});
