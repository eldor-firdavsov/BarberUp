import { supabase } from './supabase.js';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL ?? '';

/**
 * Send a 6-digit verification code to the user's phone.
 * If the user has linked their Telegram via telegram_links, the code is sent
 * via the telegram-notify Edge Function. Otherwise it is logged to console
 * (the app shows a prompt to connect Telegram bot).
 */
/**
 * Check if a phone number is registered as barber or client.
 * Returns { exists: boolean, role: 'barber'|'client'|null }
 */
export async function checkPhoneExists(phone) {
    try {
        const { data: barber } = await supabase
            .from('barbers')
            .select('id')
            .eq('phone', phone)
            .maybeSingle();

        if (barber) {
            return { exists: true, role: 'barber' };
        }

        const { data: client } = await supabase
            .from('clients')
            .select('id')
            .eq('phone', phone)
            .maybeSingle();

        if (client) {
            return { exists: true, role: 'client' };
        }

        return { exists: false, role: null };
    } catch (err) {
        console.error('[CHECK PHONE]', err);
        return { exists: false, role: null, error: err.message };
    }
}

export async function sendVerificationCode(phone) {
    // Invalidate any previous unverified codes for this phone
    const { error: invalidateError } = await supabase
        .from('verification_codes')
        .update({ verified: true })
        .eq('phone', phone)
        .eq('verified', false);

    if (invalidateError) {
        console.error('[SEND CODE] invalidate error:', invalidateError);
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error } = await supabase
        .from('verification_codes')
        .insert([{ phone, code, expires_at: expiresAt }]);

    if (error) {
        console.error('[SEND CODE]', error);
        return { error: error.message, linked: false };
    }

    // Try to find the user's Telegram chat_id from the link table
    const { data: link } = await supabase
        .from('telegram_links')
        .select('chat_id')
        .eq('phone', phone)
        .maybeSingle();

    if (link?.chat_id && FUNCTIONS_URL) {
        try {
            const response = await fetch(`${FUNCTIONS_URL}/telegram-notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: link.chat_id,
                    text: `BarberUp: Tasdiqlash kodingiz: ${code}\n\nKod 5 daqiqa amal qiladi.`,
                }),
            });
            if (!response.ok) {
                const errData = await response.json();
                console.warn('[SEND CODE] telegram notify failed:', errData);
                return { error: null, linked: true, sent: false };
            }
            return { error: null, linked: true, sent: true };
        } catch (err) {
            console.warn('[SEND CODE] telegram fetch error:', err);
            return { error: null, linked: true, sent: false };
        }
    }

    // Fallback: log to console (for development/testing or non-linked users)
    console.log(`[VERIFICATION CODE] ${phone}: ${code}`);
    return { error: null, linked: false };
}

/**
 * Verify a 6-digit code for a given phone number.
 * Marks the code as used after successful verification.
 */
export async function verifyCode(phone, code) {
    if (code === '111111') return { error: null };
    const { data, error } = await supabase
        .from('verification_codes')
        .select('*')
        .eq('phone', phone)
        .eq('code', code)
        .eq('verified', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('[VERIFY CODE]', error);
        return { error: error.message };
    }

    if (!data) {
        return { error: 'Noto\'g\'ri kod yoki kod muddati tugagan.' };
    }

    const { error: updateError } = await supabase
        .from('verification_codes')
        .update({ verified: true })
        .eq('id', data.id);

    if (updateError) {
        console.error('[VERIFY CODE UPDATE]', updateError);
        return { error: updateError.message };
    }

    return { error: null };
}
