import { useEffect, useMemo, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, Clock, Scissors, DollarSign, Check, Info, User, CalendarDays } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { supabase } from '../../api/supabase.js';
import { updateBookingStatus, normalizeBooking } from '../../api/bookingApi.js';
import { formatTo24h } from '../../utils/time.js';
import { t, getStatusLabel } from '../../utils/i18n.js';
import './ScheduleCalendar.css';

/* ── Constants ────────────────────────────────────────────────────────────── */
const HOUR_START = 7;   // 7 AM
const HOUR_END = 22;    // 10 PM
const HOUR_HEIGHT = 60; // px per hour row
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/* ── Date helpers (local only) ────────────────────────────────────────────── */
function getMonday(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0=Sun
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d;
}

function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}

function toYMD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

function getWeekDays(monday) {
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

function formatWeekLabel(monday) {
    const sunday = addDays(monday, 6);
    const mDay = monday.getDate();
    const mMonth = MONTH_NAMES[monday.getMonth()];
    const sDay = sunday.getDate();
    const sMonth = MONTH_NAMES[sunday.getMonth()];
    
    if (monday.getMonth() === sunday.getMonth()) {
        return `${mDay} – ${sDay} ${mMonth}`;
    }
    return `${mDay} ${mMonth} – ${sDay} ${sMonth}`;
}

function formatHourLabel(h) {
    if (h === 0) return '12am';
    if (h < 12) return `${h}am`;
    if (h === 12) return '12pm';
    return `${h - 12}pm`;
}

function parseBookingHour(hoursStr) {
    const normalized = formatTo24h(hoursStr);
    if (!normalized) return null;
    const [h, m] = normalized.split(':').map(Number);
    return h + m / 60;
}

/* ── Derive duration from barber services JSONB ──────────────────────────── */
function getServiceDuration(booking, barberServices) {
    const services = barberServices ?? [];
    const serviceName = (booking.service_name || '').toLowerCase().trim();

    if (serviceName && services.length > 0) {
        const match = services.find(s =>
            (s.name || '').toLowerCase().trim() === serviceName
        );
        if (match && match.duration && Number(match.duration) > 0) {
            return Number(match.duration);
        }
    }
    return 60; // default 60 minutes
}

/* ── Status color map ────────────────────────────────────────────────────── */
function getStatusClass(status) {
    const s = (status || 'pending').toLowerCase();
    if (s === 'active' || s === 'accepted') return 'active';
    if (s === 'completed' || s === 'bajarildi') return 'completed';
    if (s === 'cancelled') return 'cancelled';
    if (s === 'rejected') return 'rejected';
    return 'pending';
}

function Appointments() {
    const { user } = useAuth();
    const barberId = user?.id; // Logged-in barber ID
    const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

    // Week navigation
    const [weekMonday, setWeekMonday] = useState(() => getMonday(today));
    const weekDays = useMemo(() => getWeekDays(weekMonday), [weekMonday]);
    const weekStart = useMemo(() => toYMD(weekMonday), [weekMonday]);
    const weekEnd = useMemo(() => toYMD(addDays(weekMonday, 6)), [weekMonday]);

    // Data state
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [barberServices, setBarberServices] = useState([]);

    // Modal state
    const [modalBooking, setModalBooking] = useState(null);
    const [pendingUpdateId, setPendingUpdateId] = useState(null);

    // Clock
    const [now, setNow] = useState(new Date());

    /* ── Load logged-in barber's services list ────────────────────────────── */
    useEffect(() => {
        if (!barberId) return;
        (async () => {
            const { data } = await supabase
                .from('barbers')
                .select('services')
                .eq('id', barberId)
                .single();
            if (data && data.services) {
                const parsed = Array.isArray(data.services) ? data.services : [];
                setBarberServices(parsed);
            }
        })();
    }, [barberId]);

    /* ── Fetch bookings for the week ──────────────────────────────────────── */
    const fetchWeekBookings = useCallback(async () => {
        if (!barberId) return;
        await Promise.resolve();
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from('bookings')
                .select('*, barbers(*), clients(*)')
                .eq('barber_id', barberId)
                .gte('booking_date', weekStart)
                .lte('booking_date', weekEnd);

            if (error) {
                console.error('[SCHEDULE] Fetch error:', error);
                setBookings([]);
            } else {
                setBookings((data || []).map(normalizeBooking));
            }
        } catch (err) {
            console.error('[SCHEDULE] Fetch exception:', err);
            setBookings([]);
        }

        setLoading(false);
    }, [barberId, weekStart, weekEnd]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchWeekBookings();
        }, 0);
        return () => clearTimeout(timer);
    }, [fetchWeekBookings]);

    /* ── Supabase Realtime ────────────────────────────────────────────────── */
    useEffect(() => {
        if (!barberId) return;

        const channel = supabase
            .channel('bookings-schedule')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'bookings',
                filter: `barber_id=eq.${barberId}`
            }, () => {
                fetchWeekBookings();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [barberId, fetchWeekBookings]);

    /* ── Update clock every minute ────────────────────────────────────────── */
    useEffect(() => {
        const iv = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(iv);
    }, []);

    /* ── Week navigation ──────────────────────────────────────────────────── */
    const goToday = () => setWeekMonday(getMonday(today));
    const goPrev = () => setWeekMonday(prev => addDays(prev, -7));
    const goNext = () => setWeekMonday(prev => addDays(prev, 7));

    /* ── Booking actions ──────────────────────────────────────────────────── */
    const handleStatusChange = async (id, newStatus) => {
        setPendingUpdateId(id);
        const { error } = await updateBookingStatus(id, { status: newStatus });
        if (!error) {
            setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
            if (modalBooking?.id === id) {
                setModalBooking(prev => prev ? { ...prev, status: newStatus } : null);
            }
        }
        setPendingUpdateId(null);
    };

    /* ── Group bookings by date string ────────────────────────────────────── */
    const bookingsByDate = useMemo(() => {
        const map = {};
        weekDays.forEach(d => { map[toYMD(d)] = []; });
        bookings.forEach(b => {
            const dateStr = b.booking_date;
            if (dateStr && map[dateStr]) {
                map[dateStr].push(b);
            }
        });
        return map;
    }, [bookings, weekDays]);

    /* ── Build hour rows array ────────────────────────────────────────────── */
    const hours = useMemo(
        () => Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i),
        []
    );

    /* ── "Now" line position ──────────────────────────────────────────────── */
    const nowHourDecimal = now.getHours() + now.getMinutes() / 60;
    const nowInRange = nowHourDecimal >= HOUR_START && nowHourDecimal < HOUR_END;
    const nowTopPx = (nowHourDecimal - HOUR_START) * HOUR_HEIGHT;
    const todayDayIndex = weekDays.findIndex(d => isSameDay(d, today));

    return (
        <div className="schedule-page">

            {/* ── Top Header ── */}
            <div className="schedule-header">
                <div className="schedule-header__left">
                    <button className="schedule-btn-icon" onClick={goPrev} aria-label="Previous week">
                        <ChevronLeft size={16} />
                    </button>
                    <span className="schedule-week-range">{formatWeekLabel(weekMonday)}</span>
                    <button className="schedule-btn-icon" onClick={goNext} aria-label="Next week">
                        <ChevronRight size={16} />
                    </button>
                </div>

                <div className="schedule-header__right">
                    <button className="schedule-btn-today" onClick={goToday}>
                        Today
                    </button>
                </div>
            </div>

            {/* ── Day Headers ── */}
            <div className="schedule-day-headers">
                <div className="schedule-day-headers__spacer" />
                {weekDays.map((day, i) => {
                    const isToday = isSameDay(day, today);
                    return (
                        <div
                            key={i}
                            className={`schedule-day-header ${isToday ? 'schedule-day-header--today' : ''}`}
                        >
                            <span className="schedule-day-header__letter">{DAY_LETTERS[i]}</span>
                            <span className="schedule-day-header__date">{day.getDate()}</span>
                        </div>
                    );
                })}
            </div>

            {/* ── Calendar Grid ── */}
            <div className="schedule-grid-wrapper">
                {loading ? (
                    /* Loading Skeleton */
                    <div className="schedule-skeleton">
                        {hours.map(h => (
                            <div key={h} className="schedule-time-row" style={{ display: 'contents' }}>
                                <div className="schedule-skeleton__time">
                                    <div className="schedule-skeleton__time-bar" />
                                </div>
                                {weekDays.map((_, di) => (
                                    <div key={di} className="schedule-skeleton__cell">
                                        {(h + di) % 4 === 0 && (
                                            <div
                                                className="schedule-skeleton__block"
                                                style={{ top: 4, height: ((h + di) % 3 + 1) * 20 }}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="schedule-grid" style={{ position: 'relative' }}>
                        {/* Time rows + cells */}
                        {hours.map(h => (
                            <div key={h} className="schedule-time-row" style={{ display: 'contents' }}>
                                <div className="schedule-time-label">
                                    <span>{formatHourLabel(h)}</span>
                                </div>
                                {weekDays.map((day, di) => {
                                    const isToday = isSameDay(day, today);
                                    return (
                                        <div
                                            key={di}
                                            className={`schedule-cell ${isToday ? 'schedule-cell--today' : ''}`}
                                        />
                                    );
                                })}
                            </div>
                        ))}

                        {/* Appointment blocks */}
                        {weekDays.map((day, dayIdx) => {
                            const dateStr = toYMD(day);
                            const dayBookings = bookingsByDate[dateStr] || [];

                            return dayBookings.map(booking => {
                                const hourDecimal = parseBookingHour(booking.booking_hours);
                                if (hourDecimal === null) return null;
                                if (hourDecimal < HOUR_START || hourDecimal >= HOUR_END) return null;

                                const duration = getServiceDuration(booking, barberServices);
                                const topPx = (hourDecimal - HOUR_START) * HOUR_HEIGHT;
                                const heightPx = (duration / 60) * HOUR_HEIGHT;
                                const statusCls = getStatusClass(booking.status);

                                const client = booking.clientData || booking.clients;
                                const clientName = client?.name || client?.fullname || t('common.client');

                                const leftCalc = `calc(48px + ${dayIdx} * (100% - 48px) / 7 + 2px)`;
                                const widthCalc = `calc((100% - 48px) / 7 - 4px)`;

                                return (
                                    <button
                                        key={booking.id}
                                        className={`schedule-block schedule-block--${statusCls}`}
                                        style={{
                                            top: topPx,
                                            height: Math.max(heightPx, 24),
                                            left: leftCalc,
                                            width: widthCalc,
                                        }}
                                        onClick={() => setModalBooking(booking)}
                                    >
                                        <span className="schedule-block__name">{clientName}</span>
                                        {heightPx >= 36 && (
                                            <span className="schedule-block__service">
                                                {booking.service_name || t('barber.dashboard.haircut')}
                                            </span>
                                        )}
                                    </button>
                                );
                            });
                        })}

                        {/* "Now" line */}
                        {nowInRange && todayDayIndex >= 0 && (
                            <div
                                className="schedule-now-line"
                                style={{
                                    top: nowTopPx,
                                    left: `calc(48px + ${todayDayIndex} * (100% - 48px) / 7)`,
                                    width: `calc((100% - 48px) / 7)`,
                                }}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* ── Bottom Sheet Modal ── */}
            {modalBooking && (
                <AppointmentModal
                    booking={modalBooking}
                    barberServices={barberServices}
                    pendingUpdateId={pendingUpdateId}
                    onStatusChange={handleStatusChange}
                    onClose={() => setModalBooking(null)}
                />
            )}
        </div>
    );
}

function AppointmentModal({ booking, barberServices, pendingUpdateId, onStatusChange, onClose }) {
    const client = booking.clientData || booking.clients;
    const clientName = client?.name || client?.fullname || t('common.client');
    const serviceName = booking.service_name || t('barber.dashboard.haircut');
    const duration = getServiceDuration(booking, barberServices);
    const status = (booking.status || 'pending').toLowerCase();
    const statusCls = getStatusClass(status);
    const statusLabel = getStatusLabel(status);
    const timeStr = formatTo24h(booking.booking_hours) || booking.booking_hours || '—';
    const isPending = status === 'pending';
    const isUpdating = pendingUpdateId === booking.id;

    const dateLabel = useMemo(() => {
        if (!booking.booking_date) return '—';
        try {
            const [y, m, d] = booking.booking_date.split('-').map(Number);
            const date = new Date(y, m - 1, d);
            return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        } catch {
            return booking.booking_date;
        }
    }, [booking.booking_date]);

    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    return (
        <div className="schedule-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="schedule-modal" onClick={(e) => e.stopPropagation()}>
                <div className="schedule-modal__handle" />

                <div className="schedule-modal__header">
                    <h2 className="schedule-modal__title">{clientName}</h2>
                    <button className="schedule-modal__close" onClick={onClose}>
                        <X size={16} />
                    </button>
                </div>

                <div className="schedule-modal__body">
                    <div className="schedule-modal__field">
                        <div className="schedule-modal__field-icon">
                            <Scissors size={16} />
                        </div>
                        <div className="schedule-modal__field-content">
                            <div className="schedule-modal__field-label">Service</div>
                            <div className="schedule-modal__field-value">
                                {serviceName} · {duration} min
                            </div>
                        </div>
                    </div>

                    <div className="schedule-modal__field">
                        <div className="schedule-modal__field-icon">
                            <CalendarDays size={16} />
                        </div>
                        <div className="schedule-modal__field-content">
                            <div className="schedule-modal__field-label">Date</div>
                            <div className="schedule-modal__field-value">{dateLabel}</div>
                        </div>
                    </div>

                    <div className="schedule-modal__field">
                        <div className="schedule-modal__field-icon">
                            <Clock size={16} />
                        </div>
                        <div className="schedule-modal__field-content">
                            <div className="schedule-modal__field-label">Time</div>
                            <div className="schedule-modal__field-value">{timeStr}</div>
                        </div>
                    </div>

                    {booking.service_price && (
                        <div className="schedule-modal__field">
                            <div className="schedule-modal__field-icon">
                                <DollarSign size={16} />
                            </div>
                            <div className="schedule-modal__field-content">
                                <div className="schedule-modal__field-label">Price</div>
                                <div className="schedule-modal__field-value">
                                    {Number(booking.service_price).toLocaleString()} {t('common.uzs')}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="schedule-modal__field">
                        <div className="schedule-modal__field-icon">
                            <Info size={16} />
                        </div>
                        <div className="schedule-modal__field-content">
                            <div className="schedule-modal__field-label">Status</div>
                            <div style={{ marginTop: 4 }}>
                                <span className={`schedule-status-badge schedule-status-badge--${statusCls}`}>
                                    {statusLabel}
                                </span>
                            </div>
                        </div>
                    </div>

                    {(client?.phone || client?.email) && (
                        <div className="schedule-modal__field">
                            <div className="schedule-modal__field-icon">
                                <User size={16} />
                            </div>
                            <div className="schedule-modal__field-content">
                                <div className="schedule-modal__field-label">Client</div>
                                <div className="schedule-modal__field-value">
                                    {client.phone || client.email}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {isPending && (
                    <div className="schedule-modal__actions">
                        <button
                            className="schedule-modal__btn schedule-modal__btn--accept"
                            disabled={isUpdating}
                            onClick={() => onStatusChange(booking.id, 'accepted')}
                        >
                            {isUpdating ? (
                                <div style={{
                                    width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                                    borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite'
                                }} />
                            ) : (
                                <><Check size={14} /> Accept</>
                            )}
                        </button>
                        <button
                            className="schedule-modal__btn schedule-modal__btn--reject"
                            disabled={isUpdating}
                            onClick={() => onStatusChange(booking.id, 'rejected')}
                        >
                            {isUpdating ? (
                                <div style={{
                                    width: 14, height: 14, border: '2px solid rgba(0,0,0,0.1)',
                                    borderTopColor: '#111', borderRadius: '50%', animation: 'spin 1s linear infinite'
                                }} />
                            ) : (
                                <><X size={14} /> Reject</>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Appointments;
