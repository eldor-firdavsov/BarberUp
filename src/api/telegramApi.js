/**
 * BarberUp V2 — Telegram notification bridge.
 *
 * Sends outbound messages via the `telegram-notify` Supabase Edge Function.
 *
 * The single edge function supports three delivery modes:
 *   1. chat_id — caller already knows the Telegram chat id
 *   2. target="barber" + barber_id/phone — looks up the barber's chat id
 *      and sends (respects the barber's per-barber telegram_notifications
 *      toggle).
 *   3. target="client" + phone — looks up the linked chat_id by phone in
 *      the telegram_links table.
 *
 * Environment variable required:
 *   VITE_SUPABASE_FUNCTIONS_URL=https://<project-ref>.supabase.co/functions/v1
 *
 * The user (client or barber) must:
 *   1. Start @BarberUp_bot in Telegram and tap "📱 Telefon raqamni yuborish"
 *      (or send their number in +998XXXXXXXXX format).
 *   2. The bot links their phone → chat_id in telegram_links.
 *   3. From that moment on, ALL notifications (booking created, accepted,
 *      rejected, cancelled) are delivered to the bot.
 */

import { supabase } from './supabase.js';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL ?? '';

/**
 * Mini App helper: look up the linked phone for a Telegram user.
 *
 * The telegram-webhook stores { phone, chat_id, telegram_user_id } in
 * telegram_links whenever a user shares their contact with the bot.
 * chat_id == telegram_user_id for direct messages (which is always the
 * case for bot interactions). We try both columns for maximum resilience.
 *
 * @param {string|number} telegramUserId — from window.Telegram.WebApp.initDataUnsafe.user.id
 * @returns {{ phone: string|null, error: string|null }}
 */
export async function getTelegramLinkByChatId(telegramUserId) {
    if (!telegramUserId) return { phone: null, role: null, onboarding_step: null, language: null, error: 'No Telegram user ID' };
    const id = String(telegramUserId);
    try {
        // Primary: check telegram_users table (new onboarding flow)
        const { data: tgUser, error: tgError } = await supabase
            .from('telegram_users')
            .select('phone, role, onboarding_step, language')
            .eq('telegram_id', id)
            .maybeSingle();

        if (!tgError && tgUser) {
            return {
                phone: tgUser.phone || null,
                role: tgUser.role || null,
                onboarding_step: tgUser.onboarding_step || null,
                language: tgUser.language || null,
                error: null
            };
        }

        // Fallback: try telegram_user_id column in telegram_links
        let { data, error } = await supabase
            .from('telegram_links')
            .select('phone')
            .eq('telegram_user_id', id)
            .maybeSingle();

        if (!error && data?.phone) return { phone: data.phone, role: null, onboarding_step: null, language: null, error: null };

        // Fallback: chat_id is the same value for DM-based bots
        ({ data, error } = await supabase
            .from('telegram_links')
            .select('phone')
            .eq('chat_id', id)
            .maybeSingle());

        if (error) return { phone: null, role: null, onboarding_step: null, language: null, error: error.message };
        return { phone: data?.phone ?? null, role: null, onboarding_step: null, language: null, error: null };
    } catch (err) {
        return { phone: null, role: null, onboarding_step: null, language: null, error: err.message };
    }
}

/**
 * Low-level: send any text to any resolved target.
 */
async function sendTelegramNotification(payload) {
    if (!FUNCTIONS_URL) {
        console.warn('[TELEGRAM] VITE_SUPABASE_FUNCTIONS_URL not set');
        return;
    }
    try {
        const res = await fetch(`${FUNCTIONS_URL}/telegram-notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            console.warn('[TELEGRAM] notify failed:', errData);
        }
    } catch (err) {
        console.warn('[TELEGRAM] notify fetch error:', err);
    }
}

function formatBookingTime(booking) {
    const date = booking.booking_date || '';
    const time = booking.booking_hours || '';
    return time ? `${date} — ${time}` : date;
}

function clientLabel(booking) {
    return (
        booking.guest_name ||
        booking.clientData?.name ||
        booking.clientData?.fullname ||
        'Mijoz'
    );
}

function clientPhone(booking) {
    return booking.guest_phone || booking.clientData?.phone || '';
}

/* ── Barber notifications ──────────────────────────────────────────────── */

/**
 * Notify the barber that a NEW booking is pending their approval.
 * Sends only if the barber has notifications on (or phone is linked).
 */
export async function notifyBarberNewBooking({ barber, booking, barberTelegramChatId }) {
    const clientName = clientLabel(booking);
    const clientPh = clientPhone(booking);

    const message =
        `📅 <b>Yangi navbat!</b>\n\n` +
        `👤 ${clientName}\n` +
        (clientPh ? `📞 ${clientPh}\n` : '') +
        `✂️ ${booking.service_name || 'Xizmat'}\n` +
        `🕐 ${formatBookingTime(booking)}\n\n` +
        `Qabul qilish uchun ilovani oching.`;

    if (barberTelegramChatId) {
        await sendTelegramNotification({ chat_id: barberTelegramChatId, text: message });
        return;
    }
    await sendTelegramNotification({
        target: 'barber',
        barber_id: barber?.id,
        phone: barber?.phone,
        text: message,
    });
}

/**
 * Notify the barber that the client cancelled.
 */
export async function notifyBarberBookingCancelled({ barber, booking, barberTelegramChatId }) {
    const clientName = clientLabel(booking);
    const clientPh = clientPhone(booking);

    const message =
        `❌ <b>Bron bekor qilindi</b>\n\n` +
        `👤 ${clientName}\n` +
        (clientPh ? `📞 ${clientPh}\n` : '') +
        `✂️ ${booking.service_name || 'Xizmat'}\n` +
        `🕐 ${formatBookingTime(booking)}`;

    if (barberTelegramChatId) {
        await sendTelegramNotification({ chat_id: barberTelegramChatId, text: message });
        return;
    }
    await sendTelegramNotification({
        target: 'barber',
        barber_id: barber?.id,
        phone: barber?.phone,
        text: message,
    });
}

/* ── Client notifications ──────────────────────────────────────────────── */

/**
 * Notify the client that their booking is awaiting barber confirmation.
 */
export async function notifyClientBookingPending({ phone, barber, booking }) {
    if (!phone) return;
    const message =
        `🕒 <b>Broningiz yuborildi!</b>\n\n` +
        `Sartaroshxona: <b>${barber?.office_name || barber?.fullname || '—'}</b>\n` +
        `✂️ ${booking.service_name || 'Xizmat'}\n` +
        `🕐 ${formatBookingTime(booking)}\n\n` +
        `Tasdiqlash javobini shu yerga va ilova ichida olasiz.`;

    await sendTelegramNotification({
        target: 'client',
        phone,
        text: message,
    });
}

/**
 * Notify the client that the barber has accepted their booking.
 */
export async function notifyClientBookingAccepted({ phone, barber, booking }) {
    if (!phone) return;
    const message =
        `✅ <b>Broningiz tasdiqlandi!</b>\n\n` +
        `Sartaroshxona: <b>${barber?.office_name || barber?.fullname || '—'}</b>\n` +
        `✂️ ${booking.service_name || 'Xizmat'}\n` +
        `🕐 ${formatBookingTime(booking)}\n\n` +
        `Ko'rishguncha!`;

    await sendTelegramNotification({
        target: 'client',
        phone,
        text: message,
    });
}

/**
 * Notify the client that the barber has rejected their booking.
 */
export async function notifyClientBookingRejected({ phone, barber, booking }) {
    if (!phone) return;
    const message =
        `❌ <b>Bron rad etildi</b>\n\n` +
        `Sartaroshxona: <b>${barber?.office_name || barber?.fullname || '—'}</b>\n` +
        `✂️ ${booking.service_name || 'Xizmat'}\n` +
        `🕐 ${formatBookingTime(booking)}\n\n` +
        `Boshqa vaqtni tanlab qayta urinib ko'ring.`;

    await sendTelegramNotification({
        target: 'client',
        phone,
        text: message,
    });
}

/**
 * Notify the client that their booking was cancelled by the barber.
 */
export async function notifyClientBookingCancelledByBarber({ phone, barber, booking }) {
    if (!phone) return;
    const message =
        `❌ <b>Bron bekor qilindi</b>\n\n` +
        `Sartaroshxona: <b>${barber?.office_name || barber?.fullname || '—'}</b>\n` +
        `✂️ ${booking.service_name || 'Xizmat'}\n` +
        `🕐 ${formatBookingTime(booking)}`;

    await sendTelegramNotification({
        target: 'client',
        phone,
        text: message,
    });
}

/**
 * Notify the client that the barber finished their service
 * (booking moved to status="completed").
 */
export async function notifyClientBookingCompleted({ phone, barber, booking }) {
    if (!phone) return;
    const message =
        `🎉 <b>Xizmat yakunlandi!</b>\n\n` +
        `Sartaroshxona: <b>${barber?.office_name || barber?.fullname || '—'}</b>\n` +
        `✂️ ${booking.service_name || 'Xizmat'}\n` +
        `🕐 ${formatBookingTime(booking)}\n\n` +
        `Yana kutamiz! Baho va izoh qoldirishni unutmang.`;

    await sendTelegramNotification({
        target: 'client',
        phone,
        text: message,
    });
}

/**
 * Notify the barber that the client cancelled (alias of
 * notifyBarberBookingCancelled for symmetry; same payload).
 */
export const notifyBarberBookingCompleted = notifyClientBookingCompleted;
// (re-export not strictly needed for the barber — barbers don't get
// "your client finished" notifications, but keeping a consistent API
// surface makes future expansion trivial.)
