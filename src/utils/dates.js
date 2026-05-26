import { t, getLocale } from './i18n.js';

/** YYYY-MM-DD in local timezone */
export function toDateStr(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseDateStr(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return null;
    const date = new Date(y, m - 1, d);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

/** Normalize booking_date from API (DATE or timestamptz). */
export function getBookingDateStr(booking) {
    const raw = booking?.booking_date ?? booking?.date ?? null;
    if (!raw) return null;
    if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
        return raw.trim();
    }
    try {
        return toDateStr(new Date(raw));
    } catch {
        return null;
    }
}

export function compareDateStr(a, b) {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b);
}

export function addDaysToDateStr(dateStr, days) {
    const base = parseDateStr(dateStr);
    if (!base) return null;
    base.setDate(base.getDate() + days);
    return toDateStr(base);
}

export function dayOffsetFromToday(dateStr) {
    const target = parseDateStr(dateStr);
    if (!target) return null;
    const today = parseDateStr(toDateStr(new Date()));
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.round((target - today) / (24 * 60 * 60 * 1000));
}

/** True if booking belongs on the given calendar day (legacy rows without date count as today only). */
export function bookingMatchesDate(booking, dateStr) {
    const bookingDay = getBookingDateStr(booking);
    if (bookingDay) return bookingDay === dateStr;
    return dateStr === toDateStr(new Date());
}

export function formatBookingDate(dateStr, options = {}) {
    const { style = 'long' } = options;
    const offset = dayOffsetFromToday(dateStr);
    if (offset === 0) return t('common.today');
    if (offset === 1) return t('common.tomorrow');
    if (offset === -1) return t('common.yesterday');

    const date = parseDateStr(dateStr);
    if (!date) return dateStr ?? '';

    const locale = getLocale() === 'ru' ? 'ru-RU' : 'uz-UZ';
    if (style === 'short') {
        return date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Build selectable booking days: today + next (count - 1) days */
export function getBookingDayOptions(count = 7) {
    const todayStr = toDateStr(new Date());
    return Array.from({ length: count }, (_, i) => {
        const dateStr = addDaysToDateStr(todayStr, i);
        return {
            dateStr,
            offset: i,
            label: formatBookingDate(dateStr, { style: 'short' }),
            weekday: formatBookingDate(dateStr, { style: 'long' }),
        };
    });
}
