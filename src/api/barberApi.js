import { supabase } from './supabase.js';
import { formatTo24h } from '../utils/time.js';

export function normalizeBarber(raw) {
    if (!raw) return null;
    const workingHoursRaw = raw.working_hours ?? raw.workingHours ?? '';
    const [startRaw, endRaw] = String(workingHoursRaw).split('-').map((v) => v.trim());
    const start = formatTo24h(startRaw);
    const end = formatTo24h(endRaw);

    let officeImgUrl = '';
    let servicesList = [];

    const rawOfficeImg = raw.office_img ?? raw.shopImage ?? '';
    if (rawOfficeImg && (rawOfficeImg.trim().startsWith('{') || rawOfficeImg.trim().startsWith('['))) {
        try {
            const parsed = JSON.parse(rawOfficeImg);
            if (parsed && typeof parsed === 'object') {
                officeImgUrl = parsed.url || '';
                servicesList = parsed.services || [];
            } else {
                officeImgUrl = rawOfficeImg;
            }
        } catch (e) {
            officeImgUrl = rawOfficeImg;
        }
    } else {
        officeImgUrl = rawOfficeImg;
    }

    return {
        ...raw,
        id: raw.id ?? null,
        role: 'barber',
        name: raw.fullname || raw.name || 'Unknown',
        shopName: raw.office_name || raw.shopName || 'Unnamed Shop',
        workingHours: start && end ? `${start} - ${end}` : 'N/A',
        avgPrice: raw.average_price ?? raw.avgPrice ?? 0,
        profile_img: raw.profile_img ?? raw.profileImage ?? '',
        office_img: officeImgUrl,
        shopImage: officeImgUrl,
        email: raw.email ?? '',
        phone: raw.phone ?? '',
        services: servicesList.length > 0 ? servicesList : (raw.services ?? []),
    };
}

export async function createBarber(data) {
    const payload = {
        fullname: data.name ?? data.fullname ?? '',
        email: data.email ?? '',
        phone: data.phone ?? '',
        office_name: data.shopName ?? data.office_name ?? '',
        working_hours: (() => {
            const hours = String(data.workingHours ?? data.working_hours ?? '');
            const [startRaw, endRaw] = hours.split('-').map((v) => v.trim());
            const start = formatTo24h(startRaw);
            const end = formatTo24h(endRaw);
            return start && end ? `${start} - ${end}` : '';
        })(),
        average_price: data.avgPrice ?? data.average_price ?? '',
        profile_img: data.profile_img ?? '',
        office_img: (() => {
            const url = data.office_img ?? data.officeImage ?? '';
            const services = data.services ?? [];
            if (services.length > 0) {
                return JSON.stringify({ url, services });
            }
            return url;
        })()
    };

    try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
        });

        if (authError) return { data: null, error: authError.message };
        if (!authData.user) return { data: null, error: 'Failed to create user.' };

        const { data: barberData, error: insertError } = await supabase
            .from('barbers')
            .insert([{ id: authData.user.id, ...payload }])
            .select()
            .single();

        if (insertError) {
            console.error('[CREATE BARBER] insert error', insertError);
            return { data: null, error: 'Failed to save barber profile.' };
        }

        const barber = normalizeBarber(barberData);
        return { data: barber, error: null };
    } catch (error) {
        return { data: null, error: 'Failed to create barber account.' };
    }
}

export async function getBarbers() {
    try {
        const { data, error } = await supabase.from('barbers').select('*');
        if (error) return { data: null, error: error.message };
        return { data: (data || []).map(normalizeBarber), error: null };
    } catch (error) {
        return { data: null, error: 'Failed to load barbers.' };
    }
}

export async function loginBarber(email, password) {
    console.log('[LOGIN BARBER] request start ->', { email });
    try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError) return { data: null, error: authError.message };

        const { data: barberData, error: profileError } = await supabase
            .from('barbers')
            .select('*')
            .eq('id', authData.user.id)
            .single();

        if (profileError || !barberData) {
            return { data: null, error: 'Barber profile not found.' };
        }

        const user = normalizeBarber(barberData);
        return { data: { token: authData.session.access_token, user }, error: null };
    } catch (error) {
        return { data: null, error: 'Something went wrong.' };
    }
}
