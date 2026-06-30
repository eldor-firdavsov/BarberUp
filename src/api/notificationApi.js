/**
 * notificationApi.js
 * Full CRUD for the notifications table.
 * Notifications are created when new bookings arrive,
 * dismissed (is_read = true) manually or on action,
 * and auto-cleaned after 7 days via pg_cron.
 */

import { supabase } from './supabase.js';

/**
 * Fetch all unread notifications for a barber, newest first.
 * Limit to 50 to prevent infinite lists.
 */
export async function getUnreadNotifications(barberId) {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('barber_id', barberId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(50);

    return { data: data ?? [], error };
}

/**
 * Fetch all notifications for a barber (read + unread), for a history view.
 */
export async function getAllNotifications(barberId) {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('barber_id', barberId)
        .order('created_at', { ascending: false })
        .limit(100);

    return { data: data ?? [], error };
}

/**
 * Mark a single notification as read (dismissed).
 */
export async function dismissNotification(notificationId) {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
    return { error };
}

/**
 * Mark ALL notifications for a barber as read.
 */
export async function dismissAllNotifications(barberId) {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('barber_id', barberId)
        .eq('is_read', false);
    return { error };
}

/**
 * Create a notification (called after booking creation).
 */
export async function createNotification({ barberId, bookingId, type, title, body }) {
    const { data, error } = await supabase
        .from('notifications')
        .insert([{ barber_id: barberId, booking_id: bookingId, type, title, body }])
        .select()
        .single();
    return { data, error };
}

/**
 * Accept a booking directly from a notification.
 * Marks notification as actioned + updates booking status.
 */
export async function acceptFromNotification(notificationId, bookingId) {
    const [notifResult, bookingResult] = await Promise.all([
        supabase
            .from('notifications')
            .update({ is_read: true, action_taken: true })
            .eq('id', notificationId),
        supabase
            .from('bookings')
            .update({ status: 'accepted' })
            .eq('id', bookingId),
    ]);

    return { error: notifResult.error ?? bookingResult.error };
}

/**
 * Reject a booking directly from a notification.
 */
export async function rejectFromNotification(notificationId, bookingId) {
    const [notifResult, bookingResult] = await Promise.all([
        supabase
            .from('notifications')
            .update({ is_read: true, action_taken: true })
            .eq('id', notificationId),
        supabase
            .from('bookings')
            .update({ status: 'rejected' })
            .eq('id', bookingId),
    ]);

    return { error: notifResult.error ?? bookingResult.error };
}
