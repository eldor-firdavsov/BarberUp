import { httpClient } from './httpClient.js';
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
        return { data: null, error: mapLoginError(error, 'Failed to load barbers.') };
    }
}

/**
 * Maps HTTP error codes to human-readable login messages.
 */
function mapLoginError(error) {
    if (error?.code === 'ECONNABORTED') return 'Request timeout. Please try again.';
    if (!error?.response) return 'Cannot connect to server. Check your connection.';
    const status = error.response.status;
    if (status === 401) return 'Invalid email or password.';
    if (status === 403) return 'Account access denied.';
    if (status === 404) return 'Account not found.';
    if (status >= 500) return 'Server error. Please try again.';
    return error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Something went wrong.';
}

/**
 * POST /barber/login
 * Returns { data: { token, user }, error }
 */
export async function loginBarber(email, password) {
    console.log('[LOGIN BARBER] request start ->', { email });
    try {
        const response = await httpClient.post('/barber/login', { email, password });
        console.log('[LOGIN BARBER] response success ->', response.data);

        const raw = response?.data?.data ?? response?.data ?? {};
        const token = raw.token ?? response?.data?.token ?? null;
        const userData = raw.barber ?? raw.user ?? raw;
        const user = normalizeBarber(userData);

        console.log('[LOGIN BARBER] token stored ->', !!token, '| user ->', user?.email);
        return { data: { token, user }, error: null };
    } catch (error) {
        const msg = mapLoginError(error);
        console.error('[LOGIN BARBER] error ->', msg, error?.response?.data ?? '');
        return { data: null, error: msg };
    }
}
