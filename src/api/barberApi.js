import { supabase } from './supabase.js';
import { formatTo24h } from '../utils/time.js';

/**
 * Normalise a raw Supabase `barbers` row into the V2 app model.
 * Keeps backwards-compatible fields so existing components don't break.
 */
export function normalizeBarber(raw) {
    if (!raw) return null;

    const workingHoursRaw = raw.working_hours ?? raw.workingHours ?? '';
    const [startRaw, endRaw] = String(workingHoursRaw).split('-').map((v) => v.trim());
    const start = formatTo24h(startRaw);
    const end   = formatTo24h(endRaw);

    const photos = [raw.photo_1, raw.photo_2, raw.photo_3].filter(Boolean);

    let legacyOfficeImg = '';
    const rawOfficeImg = raw.office_img ?? raw.shopImage ?? '';
    if (photos.length === 0 && rawOfficeImg) {
        if (rawOfficeImg.trim().startsWith('{') || rawOfficeImg.trim().startsWith('[')) {
            try {
                const parsed = JSON.parse(rawOfficeImg);
                legacyOfficeImg = parsed?.url ?? rawOfficeImg;
            } catch {
                legacyOfficeImg = rawOfficeImg;
            }
        } else {
            legacyOfficeImg = rawOfficeImg;
        }
        if (legacyOfficeImg) photos.push(legacyOfficeImg);
    }

    let servicesList = raw.services ?? [];
    if (servicesList.length === 0 && rawOfficeImg) {
        try {
            const parsed = JSON.parse(rawOfficeImg);
            if (parsed?.services?.length > 0) servicesList = parsed.services;
        } catch {
            // ignore parse error
        }
    }

    return {
        ...raw,
        id:   raw.id ?? null,
        role: 'barber',
        name:     raw.fullname || raw.name || 'Unknown',
        shopName: raw.office_name || raw.shopName || 'Unnamed Shop',
        workingHours: start && end ? `${start} - ${end}` : (workingHoursRaw || 'N/A'),
        avgPrice: raw.average_price ?? raw.avgPrice ?? 0,
        profile_img: raw.profile_img ?? raw.profileImage ?? '',
        photos,
        office_img: raw.photo_1 || legacyOfficeImg || '',
        email: raw.email ?? '',
        phone: raw.phone ?? '',
        services: servicesList,
        status: raw.status ?? 'available',
        lunchBreak: raw.lunch_break ?? '',
        lunch_break: raw.lunch_break ?? '',
        telegramChatId: raw.telegram_chat_id ?? null,
        telegramNotifications: raw.telegram_notifications ?? false,
        rating: Number(raw.rating ?? 0),
        reviewCount: Number(raw.review_count ?? 0),
        address: raw.address ?? '',
        location: raw.location ?? null,
    };
}

/**
 * Create a new barber — inserts profile row directly (no Supabase Auth).
 */
export async function createBarber(data) {
    const workingHoursRaw = String(data.workingHours ?? data.working_hours ?? '');
    const [startRaw, endRaw] = workingHoursRaw.split('-').map((v) => v.trim());
    const start = formatTo24h(startRaw);
    const end   = formatTo24h(endRaw);

    const email = data.email || `${(data.phone || '').replace(/\D/g, '')}@navbatgo.uz`;

    const services = data.services ?? [];
    const avgPrice = data.avgPrice ?? data.average_price;
    const calculatedAvg = !avgPrice && services.length > 0
        ? Math.round(services.reduce((sum, s) => sum + Number(s.price), 0) / services.length)
        : avgPrice ?? '';

    const payload = {
        fullname:      data.name ?? data.fullname ?? '',
        email:         email,
        phone:         data.phone ?? '',
        office_name:   data.shopName ?? data.office_name ?? '',
        working_hours: start && end ? `${start} - ${end}` : '',
        average_price: String(calculatedAvg),
        profile_img:   data.profile_img ?? '',
        photo_1:       data.photo_1 ?? data.office_img ?? data.officeImage ?? '',
        photo_2:       data.photo_2 ?? '',
        photo_3:       data.photo_3 ?? '',
        services,
    };

    try {
        const { data: barberData, error: insertError } = await supabase
            .from('barbers')
            .insert([payload])
            .select()
            .single();

        if (insertError) {
            console.error('[CREATE BARBER] insert error', insertError);
            return { data: null, error: insertError.message };
        }

        return { data: normalizeBarber(barberData), error: null };
    } catch {
        return { data: null, error: 'Failed to create barber account.' };
    }
}

/** Fetch all barbers (unordered). Used by authenticated barber for self-lookup. */
export async function getBarbers() {
    try {
        const { data, error } = await supabase.from('barbers').select('*');
        if (error) return { data: null, error: error.message };
        return { data: (data || []).map(normalizeBarber), error: null };
    } catch {
        return { data: null, error: 'Failed to load barbers.' };
    }
}

/**
 * Fetch all barbers sorted for the client discovery feed.
 * Order: boosted first (boost_until DESC), then by rating DESC.
 */
export async function getBarbersSorted() {
    try {
        const { data, error } = await supabase
            .from('barbers')
            .select('*')
            .order('rating', { ascending: false });

        if (error) return { data: null, error: error.message };
        return { data: (data || []).map(normalizeBarber), error: null };
    } catch {
        return { data: null, error: 'Failed to load barbers.' };
    }
}

/** Lookup a barber by phone number (no Supabase Auth). */
export async function loginBarber(phone) {
    try {
        const { data: barberData, error: profileError } = await supabase
            .from('barbers')
            .select('*')
            .eq('phone', phone)
            .single();

        if (profileError || !barberData) {
            return { data: null, error: 'Barber not found.' };
        }

        const user = normalizeBarber(barberData);
        return { data: { user }, error: null };
    } catch {
        return { data: null, error: 'Something went wrong.' };
    }
}

/**
 * Update the barber's real-time availability status.
 * @param {string} barberId
 * @param {'available'|'working-busy'|'lunch'|'closed'} status
 */
export async function updateBarberStatus(barberId, status) {
    try {
        const { data, error } = await supabase
            .from('barbers')
            .update({ status })
            .eq('id', barberId)
            .select()
            .single();

        if (error) {
            console.error('[BARBER STATUS UPDATE] error:', error);
            return { data: null, error: error.message };
        }

        return { data: normalizeBarber(data), error: null };
    } catch {
        return { data: null, error: 'Failed to update barber status.' };
    }
}
