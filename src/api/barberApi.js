import { getApiError, httpClient } from './httpClient.js';
import { formatTo24h } from '../utils/time.js';

export function normalizeBarber(raw) {
    if (!raw) return null;
    const workingHoursRaw = raw.working_hours ?? raw.workingHours ?? '';
    const [startRaw, endRaw] = String(workingHoursRaw).split('-').map((v) => v.trim());
    const start = formatTo24h(startRaw);
    const end = formatTo24h(endRaw);
    return {
        id: raw._id ?? raw.id ?? null,
        role: 'barber',
        name: raw.fullname || raw.name || 'Unknown',
        shopName: raw.office_name || raw.shopName || 'Unnamed Shop',
        workingHours: start && end ? `${start} - ${end}` : 'N/A',
        avgPrice: raw.average_price ?? raw.avgPrice ?? 0,
        profileImage: raw.profile_img ?? raw.profileImage ?? '',
        shopImage: raw.office_img ?? raw.shopImage ?? '',
        email: raw.email ?? '',
        phone: raw.phone ?? '',
        ...raw,
    };
}

export async function createBarber(data) {
    const payload = {
        fullname: data.name ?? data.fullname ?? '',
        email: data.email ?? '',
        password: data.password ?? '',
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
    };

    try {
        const response = await httpClient.post('/barber', payload);
        const barber = normalizeBarber(response?.data?.data ?? response?.data);
        return { data: barber, error: null };
    } catch (error) {
        return { data: null, error: getApiError(error, 'Failed to create barber account.') };
    }
}

export async function getBarbers() {
    try {
        const response = await httpClient.get('/barber');
        const rawList = Array.isArray(response?.data) ? response.data : (response?.data?.data ?? []);
        return { data: rawList.map(normalizeBarber), error: null };
    } catch (error) {
        return { data: null, error: getApiError(error, 'Failed to load barbers.') };
    }
}
