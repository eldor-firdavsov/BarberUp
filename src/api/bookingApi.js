import { getApiError, httpClient } from './httpClient.js';
import { formatTo24h } from '../utils/time.js';

/** Same rules as time-layer ref matching: string id or populated { _id } */
export function normalizeBookingRefId(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'string') {
        const t = value.trim();
        return t || null;
    }
    if (typeof value === 'object') {
        const nested = value._id ?? value.id ?? value.$oid;
        if (nested != null && nested !== value) return normalizeBookingRefId(nested);
        if (typeof nested === 'string') return nested.trim() || null;
    }
    return String(value);
}

export function bookingMatchesBarber(bookingBarberField, barberId) {
    const a = normalizeBookingRefId(bookingBarberField);
    const b = normalizeBookingRefId(barberId);
    if (a == null || b == null) return false;
    return String(a) === String(b);
}

export function bookingMatchesClient(bookingClientField, clientId) {
    const a = normalizeBookingRefId(bookingClientField);
    const b = normalizeBookingRefId(clientId);
    if (a == null || b == null) return false;
    return String(a) === String(b);
}

function normalizeId(value) {
    return normalizeBookingRefId(value);
}

export function normalizeBooking(raw) {
    if (!raw) return null;
    const normalizedHours = formatTo24h(raw.booking_hours);
    if (!normalizedHours && raw.booking_hours != null) {
        console.warn('[BOOKING CHECK] Unparseable booking_hours, raw=', raw.booking_hours);
    }
    return {
        ...raw,
        id: raw._id ?? raw.id ?? null,
        barber: normalizeId(raw.barber),
        client: normalizeId(raw.client),
        booking_hours: normalizedHours ?? '',
        status: raw.status ?? 'pending',
    };
}

export async function createBooking(payload) {
    const safePayload = {
        ...payload,
        booking_hours: formatTo24h(payload?.booking_hours) ?? payload?.booking_hours,
    };
    console.log('[BOOKING POST]', safePayload);
    try {
        const response = await httpClient.post('/booking', safePayload);
        const data = normalizeBooking(response?.data?.data ?? response?.data);
        console.log('[BOOKING POST] ok', data);
        return { data, error: null };
    } catch (error) {
        console.error('[BOOKING POST] failed', getApiError(error));
        return { data: null, error: getApiError(error, 'Failed to create booking.') };
    }
}

export async function getBookings() {
    try {
        const response = await httpClient.get('/booking');
        const rawList = Array.isArray(response?.data) ? response.data : (response?.data?.data ?? []);
        const list = rawList.map(normalizeBooking);
        console.log('[BOOKING REFETCH] count=', list.length);
        return { data: list, error: null };
    } catch (error) {
        console.error('[BOOKING REFETCH] GET failed', getApiError(error));
        return { data: null, error: getApiError(error, 'Failed to fetch bookings.') };
    }
}

export async function updateBookingStatus(id, payload) {
    const safeId = normalizeBookingRefId(id);
    if (safeId == null || safeId === '') {
        console.error('[404 DEBUG] updateBookingStatus blocked: invalid id', id);
        return { data: null, error: 'Invalid booking id.' };
    }
    console.log('[BOOKING PATCH]', safeId, payload);
    try {
        const response = await httpClient.patch(`/booking/${safeId}`, payload);
        return { data: normalizeBooking(response?.data?.data ?? response?.data), error: null };
    } catch (error) {
        console.error('[404 DEBUG] PATCH /booking/:id failed', safeId, getApiError(error));
        return { data: null, error: getApiError(error, 'Failed to update booking.') };
    }
}
