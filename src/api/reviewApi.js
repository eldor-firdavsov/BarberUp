import { supabase } from './supabase.js';

/**
 * Submit a review for a completed booking.
 * Works for both authenticated clients (client_id) and guests (guest_phone).
 */
export async function submitReview({ barber_id, booking_id, rating, comment, client_id, guest_phone }) {
    if (!barber_id) return { data: null, error: 'barber_id is required.' };
    if (!rating || rating < 1 || rating > 5) return { data: null, error: 'Rating must be 1–5.' };

    const { data, error } = await supabase
        .from('reviews')
        .insert([{
            barber_id,
            booking_id:  booking_id ?? null,
            rating,
            comment:     comment?.trim() || null,
            client_id:   client_id ?? null,
            guest_phone: guest_phone ?? null,
        }])
        .select()
        .single();

    if (error) {
        console.error('[REVIEW POST]', error);
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

/**
 * Fetch the latest reviews for a barber (newest first).
 * @param {string} barberId
 * @param {number} limit - Max number of reviews to return (default 10)
 */
export async function getBarberReviews(barberId, limit = 10) {
    const { data, error } = await supabase
        .from('reviews')
        .select('*, clients(fullname, profile_img)')
        .eq('barber_id', barberId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('[REVIEWS GET]', error);
        return { data: null, error: error.message };
    }

    return { data: data ?? [], error: null };
}
