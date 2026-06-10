import translations from '../data.json';

let currentLocale = 'uz';

export function setLocale(locale) {
    if (locale === 'uz' || locale === 'ru') {
        currentLocale = locale;
    }
}

export function getLocale() {
    return currentLocale;
}

/**
 * Get localized string by dot path, e.g. t('auth.login.title')
 * Supports {{param}} interpolation.
 */
export function t(key, params = {}) {
    const parts = key.split('.');
    let node = translations[currentLocale];
    for (const part of parts) {
        node = node?.[part];
    }
    if (node && (Array.isArray(node) || typeof node === 'object')) return node;
    if (typeof node !== 'string') return key;
    return node.replace(/\{\{(\w+)\}\}/g, (_, name) =>
        params[name] !== undefined && params[name] !== null ? String(params[name]) : ''
    );
}

import { fromDbStatus, getDisplayStatus } from './bookingStatus.js';

export function getStatusLabel(status) {
    const key = fromDbStatus(status)?.toLowerCase?.() ?? 'pending';
    const label = t(`status.${key}`);
    return label !== `status.${key}` ? label : status;
}

export function getBookingStatusLabel(booking, now = new Date()) {
    const key = getDisplayStatus(booking, now);
    const label = t(`status.${key}`);
    return label !== `status.${key}` ? label : key;
}

export default translations;
