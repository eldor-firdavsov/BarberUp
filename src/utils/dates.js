import { t, getLocale } from './i18n.js';

const MONTHS = {
    ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
};

const MONTHS_SHORT = {
    ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
    uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek']
};

const WEEKDAYS = {
    ru: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
    uz: ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba']
};

const WEEKDAYS_SHORT = {
    ru: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
    uz: ['yak', 'dush', 'sesh', 'chor', 'pay', 'jum', 'shan']
};

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

    const lang = getLocale() === 'ru' ? 'ru' : 'uz';
    const day = date.getDate();
    const monthIdx = date.getMonth();
    const weekdayIdx = date.getDay();

    if (style === 'short') {
        const wd = WEEKDAYS_SHORT[lang][weekdayIdx];
        const m = MONTHS_SHORT[lang][monthIdx];
        if (lang === 'uz') {
            return `${day}-${m}, ${wd}`;
        } else {
            return `${day} ${m}, ${wd}`;
        }
    }

    const wd = WEEKDAYS[lang][weekdayIdx];
    const m = MONTHS[lang][monthIdx];
    if (lang === 'uz') {
        return `${day}-${m}, ${wd}`;
    } else {
        return `${day} ${m}, ${wd}`;
    }
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
