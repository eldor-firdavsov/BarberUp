/**
 * telegramWebApp.js
 * Utilities for interacting with the Telegram WebApp SDK inside the Mini App.
 * Provides phone number from Telegram context and user identity.
 */

import { supabase } from '../api/supabase.js';

/**
 * Returns the Telegram WebApp object if running inside Telegram, else null.
 */
export function getTelegramWebApp() {
    return window?.Telegram?.WebApp ?? null;
}

/**
 * Returns true if the app is running inside Telegram Mini App context.
 */
export function isInsideTelegram() {
    return !!getTelegramWebApp()?.initData;
}

/**
 * Returns the Telegram user object from initDataUnsafe.
 * { id, first_name, last_name, username, language_code }
 */
export function getTelegramUser() {
    return getTelegramWebApp()?.initDataUnsafe?.user ?? null;
}

/**
 * Expands the Mini App to full screen.
 */
export function expandApp() {
    getTelegramWebApp()?.expand();
}

/**
 * Closes the Mini App.
 */
export function closeApp() {
    getTelegramWebApp()?.close();
}

/**
 * Sets the back button visibility and handler.
 */
export function setBackButton(show, onClick) {
    const wb = getTelegramWebApp();
    if (!wb) return;
    if (show) {
        wb.BackButton.show();
        wb.BackButton.onClick(onClick);
    } else {
        wb.BackButton.hide();
    }
}

/**
 * Fetches the registered phone for this Telegram user from Supabase.
 * Checks telegram_users table first, falls back to telegram_links.
 * Returns { phone, role, onboarding_step } or null.
 */
export async function getTelegramRegisteredPhone() {
    const tgUser = getTelegramUser();
    if (!tgUser?.id) return null;

    // Primary: check telegram_users table
    const { data, error } = await supabase
        .from('telegram_users')
        .select('phone, role, onboarding_step')
        .eq('telegram_id', tgUser.id)
        .maybeSingle();

    if (!error && data?.phone) return data;

    // Fallback: check telegram_links table (backward compat)
    const { data: linkData } = await supabase
        .from('telegram_links')
        .select('phone')
        .or(`telegram_user_id.eq.${String(tgUser.id)},chat_id.eq.${String(tgUser.id)}`)
        .maybeSingle();

    if (linkData?.phone) {
        return { phone: linkData.phone, role: null, onboarding_step: null };
    }

    return null;
}
