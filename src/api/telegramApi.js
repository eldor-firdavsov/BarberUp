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

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL ?? '';

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
