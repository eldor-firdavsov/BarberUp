import { getApiError, httpClient } from './httpClient.js';
import { formatTo24h } from '../utils/time.js';

function normalizeId(value) {
    if (!value) return null;
    if (typeof value === 'string') return value;
    return value._id ?? value.id ?? null;
}

export function normalizeBooking(raw) {
    if (!raw) return null;
    const normalizedHours = formatTo24h(raw.booking_hours) ?? '00:00';
    return {
        ...raw,
        id: raw._id ?? raw.id ?? null,
        barber: normalizeId(raw.barber),
        client: normalizeId(raw.client),
        booking_hours: normalizedHours,
        status: raw.status ?? 'pending',
    };
}

export async function createBooking(payload) {
    const safePayload = {
        ...payload,
        booking_hours: formatTo24h(payload?.booking_hours) ?? payload?.booking_hours,
    };
    try {
        const response = await httpClient.post('/booking', safePayload);
        return { data: normalizeBooking(response?.data?.data ?? response?.data), error: null };
    } catch (error) {
        return { data: null, error: getApiError(error, 'Failed to create booking.') };
    }
}

export async function getBookings() {
    try {
        const response = await httpClient.get('/booking');
        const rawList = Array.isArray(response?.data) ? response.data : (response?.data?.data ?? []);
        return { data: rawList.map(normalizeBooking), error: null };
    } catch (error) {
        return { data: null, error: getApiError(error, 'Failed to fetch bookings.') };
    }
}

export async function updateBookingStatus(id, payload) {
    try {
        const response = await httpClient.patch(`/booking/${id}`, payload);
        return { data: normalizeBooking(response?.data?.data ?? response?.data), error: null };
    } catch (error) {
        return { data: null, error: getApiError(error, 'Failed to update booking.') };
    }
}
