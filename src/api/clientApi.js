import { getApiError, httpClient } from './httpClient.js';

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

export async function createClient(payload) {
    try {
        const response = await httpClient.post('/client', payload);
        const client = normalizeClient(response?.data?.data ?? response?.data);
        return { data: client, error: null };
    } catch (error) {
        return { data: null, error: getApiError(error, 'Failed to create client account.') };
    }
}

export async function getClients() {
    try {
        const response = await httpClient.get('/client');
        const rawList = Array.isArray(response?.data) ? response.data : (response?.data?.data ?? []);
        return { data: rawList.map(normalizeClient), error: null };
    } catch (error) {
        return { data: null, error: getApiError(error, 'Failed to load clients.') };
    }
}
