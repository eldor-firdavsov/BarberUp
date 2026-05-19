import axios from 'axios';

const API_BASE_URL = 'https://barber-shop-xh34.onrender.com/api/v1';

export const httpClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 7000,
    headers: {
        'Content-Type': 'application/json',
    },
});

httpClient.interceptors.request.use(
    (config) => {
        const method = (config.method || 'GET').toUpperCase();
        // Attach token from localStorage if present
        const token = localStorage.getItem('token');
        if (token) {
            config.headers = config.headers ?? {};
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        console.log(`[API] ${method} ${config.url} -> payload`, config.data ?? null);
        return config;
    },
    (error) => {
        console.error('[API ERROR] Request setup failed ->', error?.message || error);
        return Promise.reject(error);
    }
);

httpClient.interceptors.response.use(
    (response) => {
        console.log('[API] RESPONSE ->', response.data);
        return response;
    },
    (error) => {
        // Auto-logout on expired/invalid token
        if (error?.response?.status === 401) {
            console.warn('[API] 401 Unauthorized — clearing session and redirecting to /login');
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            localStorage.removeItem('onboarding_data');
            window.location.href = '/login';
            return Promise.reject(error);
        }
        const message =
            error?.response?.data?.message ||
            error?.response?.data?.error ||
            error?.message ||
            'Unexpected API error';
        console.error('[API ERROR] ->', message, error?.response?.data ?? '');
        return Promise.reject(error);
    }
);

export function getApiError(error, fallback = 'Something went wrong. Please try again.') {
    if (error?.code === 'ECONNABORTED') {
        return 'Request timed out. Please try again.';
    }
    if (!error?.response) {
        return 'Network error. Please check your connection and try again.';
    }
    return (
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        fallback
    );
}
