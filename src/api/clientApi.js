import { httpClient } from './httpClient.js';

function normalizeClient(raw) {
    if (!raw) return null;
    return {
        id: raw._id ?? raw.id ?? null,
        role: 'client',
        name: raw.fullname || raw.name || 'Unknown',
        email: raw.email ?? '',
        phone: raw.phone ?? '',
        ...raw,
    };
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

export async function createClient(payload) {
    try {
        const response = await httpClient.post('/client', payload);
        const client = normalizeClient(response?.data?.data ?? response?.data);
        return { data: client, error: null };
    } catch (error) {
        return { data: null, error: mapLoginError(error) };
    }
}

export async function getClients() {
    try {
        const response = await httpClient.get('/client');
        const rawList = Array.isArray(response?.data) ? response.data : (response?.data?.data ?? []);
        return { data: rawList.map(normalizeClient), error: null };
    } catch (error) {
        return { data: null, error: mapLoginError(error) };
    }
}

/**
 * POST /client/login
 * Returns { data: { token, user }, error }
 */
export async function loginClient(email, password) {
    console.log('[LOGIN CLIENT] request start ->', { email });
    try {
        const response = await httpClient.post('/client/login', { email, password });
        console.log('[LOGIN CLIENT] response success ->', response.data);

        const raw = response?.data?.data ?? response?.data ?? {};
        const token = raw.token ?? response?.data?.token ?? null;
        const userData = raw.client ?? raw.user ?? raw;
        const user = normalizeClient(userData);

        console.log('[LOGIN CLIENT] token stored ->', !!token, '| user ->', user?.email);
        return { data: { token, user }, error: null };
    } catch (error) {
        const msg = mapLoginError(error);
        console.error('[LOGIN CLIENT] error ->', msg, error?.response?.data ?? '');
        return { data: null, error: msg };
    }
}
