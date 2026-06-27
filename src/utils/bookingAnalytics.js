/**
 * bookingAnalytics.js
 * Pure utility functions to compute barber business stats from booking data.
 * No side effects. Fully testable.
 */

/**
 * Compute a full stats object from a bookings array.
 * All revenue calculations use booking.service_price.
 */
export function computeBookingStats(bookings) {
    if (!Array.isArray(bookings) || bookings.length === 0) {
        return emptyStats();
    }

    const completed = bookings.filter(b => b.status === 'completed');
    const cancelled = bookings.filter(b => b.status === 'cancelled');
    const rejected  = bookings.filter(b => b.status === 'rejected');
    const resolved  = completed.length + cancelled.length + rejected.length;

    const totalRevenue = completed.reduce(
        (sum, b) => sum + (Number(b.service_price) || 0), 0
    );

    // Busiest hour
    const hourCounts = {};
    bookings.forEach(b => {
        const h = b.booking_hours;
        if (h) hourCounts[h] = (hourCounts[h] || 0) + 1;
    });
    const busiestHour = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Busiest day of week
    const DAY_NAMES = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
    const dayCounts = {};
    bookings.forEach(b => {
        if (b.booking_date) {
            try {
                const day = DAY_NAMES[new Date(b.booking_date + 'T12:00:00').getDay()];
                dayCounts[day] = (dayCounts[day] || 0) + 1;
            } catch { /* skip */ }
        }
    });
    const busiestDay = Object.entries(dayCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Unique clients + repeat rate
    const phones = bookings.map(b => b.guest_phone).filter(Boolean);
    const uniquePhones = new Set(phones);
    const phoneFreq = {};
    phones.forEach(p => { phoneFreq[p] = (phoneFreq[p] || 0) + 1; });
    const repeatClients = Object.values(phoneFreq).filter(c => c > 1).length;
    const repeatClientRate = uniquePhones.size > 0
        ? Math.round((repeatClients / uniquePhones.size) * 100)
        : 0;

    // Date-scoped stats helper
    function statsForRange(start, end) {
        const inRange = bookings.filter(b => {
            if (!b.booking_date) return false;
            return b.booking_date >= toYMD(start) && b.booking_date <= toYMD(end);
        });
        return {
            completed: inRange.filter(b => b.status === 'completed').length,
            pending:   inRange.filter(b => b.status === 'pending').length,
            accepted:  inRange.filter(b => b.status === 'accepted').length,
            revenue:   inRange
                .filter(b => b.status === 'completed')
                .reduce((s, b) => s + (Number(b.service_price) || 0), 0),
        };
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek  = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
        totalBookings:      bookings.length,
        completedBookings:  completed.length,
        cancelledBookings:  cancelled.length,
        rejectedBookings:   rejected.length,
        completionRate:     resolved > 0 ? Math.round((completed.length / resolved) * 100) : 0,
        totalRevenue,
        busiestHour,
        busiestDay,
        uniqueClients:      uniquePhones.size,
        repeatClientRate,
        todayStats:  statsForRange(startOfToday, now),
        weekStats:   statsForRange(startOfWeek,  now),
        monthStats:  statsForRange(startOfMonth, now),
    };
}

function emptyStats() {
    const zero = { completed: 0, pending: 0, accepted: 0, revenue: 0 };
    return {
        totalBookings: 0, completedBookings: 0, cancelledBookings: 0, rejectedBookings: 0,
        completionRate: 0, totalRevenue: 0, busiestHour: null, busiestDay: null,
        uniqueClients: 0, repeatClientRate: 0,
        todayStats: zero, weekStats: zero, monthStats: zero,
    };
}

function toYMD(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
