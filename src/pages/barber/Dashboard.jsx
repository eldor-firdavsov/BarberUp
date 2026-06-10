// Telegram notifications are now handled exclusively by the DB trigger
// (handle_booking_status_change) — no client-side calls needed.
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Check, X, Coffee, AlertCircle, Calendar, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { bookingMatchesBarber, getBookings, updateBookingStatus } from '../../api/bookingApi.js';
import { getClients } from '../../api/clientApi.js';
import { updateBarberStatus } from '../../api/barberApi.js';
import { supabase } from '../../api/supabase.js';
import { compareTimes, formatTo24h } from '../../utils/time.js';
import { toDateStr, getBookingDateStr, bookingMatchesDate, formatBookingDate, compareDateStr } from '../../utils/dates.js';
import { t } from '../../utils/i18n.js';
import ClientProfileModal from '../../components/ClientProfileModal.jsx';

/* ── Barber availability statuses ─────────────────────────────────────────── */
const BARBER_STATUSES = [
    {
        key: 'available',
        labelKey: 'barber.dashboard.statusAvailable',
        dot: 'bg-green-500',
        ring: 'ring-green-200',
        active: 'bg-green-50 border-green-200 text-green-700',
        inactive: 'bg-white border-black/5 text-[#666]',
    },
    {
        key: 'working-busy',
        labelKey: 'barber.dashboard.statusBusy',
        dot: 'bg-orange-500',
        ring: 'ring-orange-200',
        active: 'bg-orange-50 border-orange-200 text-orange-700',
        inactive: 'bg-white border-black/5 text-[#666]',
    },
    {
        key: 'lunch',
        labelKey: 'barber.dashboard.statusLunch',
        dot: 'bg-yellow-400',
        ring: 'ring-yellow-200',
        active: 'bg-yellow-50 border-yellow-200 text-yellow-700',
        inactive: 'bg-white border-black/5 text-[#666]',
    },
    {
        key: 'closed',
        labelKey: 'barber.dashboard.statusClosed',
        dot: 'bg-gray-400',
        ring: 'ring-gray-200',
        active: 'bg-gray-100 border-gray-300 text-gray-700',
        inactive: 'bg-white border-black/5 text-[#666]',
    },
];

const SimpleAvatar = ({ name, size = "w-12 h-12" }) => (
    <div className={`${size} rounded-2xl bg-[#f8f8f8] flex items-center justify-center border border-black/5 shrink-0`}>
        <span className="text-[#111] font-bold text-sm">
            {name?.charAt(0).toUpperCase() || 'C'}
        </span>
    </div>
);

function Dashboard() {
    const { user, updateSessionUser } = useAuth();
    const navigate = useNavigate();

    /* ── Barber availability status ───────────────────────────────────────── */
    const [barberStatus, setBarberStatus] = useState(user?.status || 'available');
    const [statusUpdating, setStatusUpdating] = useState(false);

    const [bookings, setBookings] = useState([]);
    const [clientsById, setClientsById] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [profileClient, setProfileClient] = useState(null);

    /* ── Toast notification state ─────────────────────────────────────────── */
    const [toast, setToast] = useState(null); // { message, type: 'success'|'error' }
    const toastTimer = useRef(null);
    const prevPendingCount = useRef(0);

    const showToast = useCallback((message, type = 'success') => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ message, type });
        toastTimer.current = setTimeout(() => setToast(null), 3000);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 15000); // check time every 15s to be extremely responsive
        return () => clearInterval(timer);
    }, []);

    const loadDashboard = useCallback(async () => {
        setLoading(true);
        const [{ data: bookingList, error: bookingError }, { data: clients }] = await Promise.all([
            getBookings(),
            getClients(),
        ]);

        if (bookingError) {
            setError(bookingError);
            setLoading(false);
            return;
        }

        const filteredBookings = (bookingList ?? []).filter((booking) => {
            return bookingMatchesBarber(booking.barber, user?.id) || bookingMatchesBarber(booking.barber, user?._id);
        });

        setBookings(filteredBookings);
        setClientsById(Object.fromEntries((clients ?? []).map((client) => [client.id, client])));
        setLoading(false);
    }, [user?.id]);

    // ── Supabase Realtime channel subscription for instant updates ──
    useEffect(() => {
        loadDashboard();

        if (!user?.id) return;

        const channel = supabase
            .channel(`barber-dashboard-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'bookings',
                    filter: `barber_id=eq.${user.id}`
                },
                () => {
                    loadDashboard();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadDashboard, user?.id]);

    /* ── Handle barber availability status change ─────────────────────────── */
    const handleBarberStatusChange = useCallback(async (newStatus) => {
        if (newStatus === barberStatus || statusUpdating) return;
        setBarberStatus(newStatus);
        setStatusUpdating(true);
        try {
            const { data, error } = await updateBarberStatus(user?.id, newStatus);
            if (!error && data) {
                updateSessionUser({ ...user, status: newStatus });
            } else {
                console.error('[BARBER STATUS] update failed:', error);
            }
        } catch (err) {
            console.error('[BARBER STATUS] exception:', err);
        }
        setStatusUpdating(false);
    }, [barberStatus, statusUpdating, user, updateSessionUser]);

    /* ── Handle booking status update ─────────────────────────────────────── */
    // Telegram notifications are sent by the DB trigger automatically when
    // the booking status changes — no client-side calls needed.
    const handleStatusUpdate = useCallback(async (bookingId, newStatus) => {
        try {
            const payload = { status: newStatus };
            if (newStatus === 'cancelled') {
                payload.cancelled_by = 'barber';
            }
            const { data, error: updateError } = await updateBookingStatus(bookingId, payload);
            if (!updateError && data) {
                setBookings(prev => prev.map(b => b.id === bookingId ? data : b));

                // Specific toast for every possible status transition
                const toastMessages = {
                    accepted:  '✅ Navbat qabul qilindi — Mijozga Telegram xabari yuborildi',
                    rejected:  '❌ Navbat rad etildi — Mijozga Telegram xabari yuborildi',
                    cancelled: '🚫 Navbat bekor qilindi — Mijozga Telegram xabari yuborildi',
                    completed: '🎉 Xizmat yakunlandi — Mijoz reyting qoldirishga taklif qilindi',
                };
                showToast(toastMessages[newStatus] ?? `Status: ${newStatus}`, 'success');
            } else if (updateError) {
                showToast(updateError, 'error');
            }
        } catch (err) {
            console.error('Status update failed', err);
            showToast('Xatolik yuz berdi', 'error');
        }
    }, [showToast]);

    /* ── Derived V2 booking views ── */
    const todayStr = useMemo(() => toDateStr(currentTime), [currentTime]);

    const isBookingExpired = useCallback((booking) => {
        const bDate = getBookingDateStr(booking);
        if (!bDate) return true;

        if (bDate < todayStr) return true;
        if (bDate > todayStr) return false;

        if (!booking.booking_hours || !booking.booking_hours.includes(':')) return true;
        const [bHours, bMins] = booking.booking_hours.split(':').map(Number);
        const currentHours = currentTime.getHours();
        const currentMinutes = currentTime.getMinutes();

        return (currentHours > bHours) || (currentHours === bHours && currentMinutes >= bMins);
    }, [todayStr, currentTime]);

    // 1. Pending Column: Today's pending bookings that have NOT yet expired, ordered by time
    const pendingRequests = useMemo(() =>
        bookings
            .filter(b => b.status === 'pending' && bookingMatchesDate(b, todayStr) && !isBookingExpired(b))
            .sort((a, b) => compareTimes(a.booking_hours, b.booking_hours)),
        [bookings, todayStr, isBookingExpired]
    );

    // 2. Accepted Column: Today's accepted bookings that have NOT yet expired, ordered by time
    const acceptedRequests = useMemo(() =>
        bookings
            .filter(b => 
                bookingMatchesDate(b, todayStr) && b.status === 'accepted' && !isBookingExpired(b)
            )
            .sort((a, b) => compareTimes(a.booking_hours, b.booking_hours)),
        [bookings, todayStr, isBookingExpired]
    );

    /* ── Notify barber when a new pending booking arrives via realtime ───── */
    useEffect(() => {
        const currentPending = pendingRequests.length;
        if (currentPending > prevPendingCount.current && prevPendingCount.current >= 0 && !loading) {
            showToast('🔔 Yangi bron so\'rovi keldi!', 'success');
            // Try to vibrate on mobile for haptic feedback
            if (navigator.vibrate) navigator.vibrate(200);
        }
        prevPendingCount.current = currentPending;
    }, [pendingRequests.length, loading, showToast]);

    return (
        <div className="min-h-screen bg-[#f5f5f7] px-4 py-6 sm:px-6 sm:py-12 space-y-6 page-animate h-full pb-28 max-w-7xl mx-auto">

            {/* ── Toast Notification ── */}
            {toast && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3.5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] font-semibold text-sm flex items-center gap-2.5 animate-slideDown max-w-[90vw] ${
                    toast.type === 'error'
                        ? 'bg-red-600 text-white'
                        : 'bg-[#111] text-white'
                }`}>
                    <Bell size={16} className="shrink-0 opacity-80" />
                    <span>{toast.message}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-[28px] sm:text-[32px] font-bold text-[#111] tracking-[-0.03em] leading-tight">{t('barber.dashboard.title')}</h1>
                    <p className="text-sm text-[#666] font-medium mt-1">{t('barber.dashboard.subtitle')}</p>
                </div>
            </div>

            {/* ── Barber Availability Status Selector ── */}
            <section className="bg-white border border-black/5 rounded-[28px] p-5 sm:p-6 shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
                <p className="text-[10px] uppercase text-[#888] font-bold tracking-[0.12em] mb-3 flex items-center gap-2">
                    {t('barber.dashboard.myStatus')}
                    {statusUpdating && <span className="w-1.5 h-1.5 rounded-full bg-[#378ADD] animate-pulse" />}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {BARBER_STATUSES.map(s => {
                        const isActive = barberStatus === s.key;
                        return (
                            <button
                                key={s.key}
                                onClick={() => handleBarberStatusChange(s.key)}
                                disabled={statusUpdating}
                                className={`
                                    flex items-center gap-2.5 px-3 sm:px-4 py-4 sm:py-3.5 rounded-2xl border font-bold text-xs sm:text-sm
                                    transition-all duration-200 active:scale-[0.97] min-h-[48px]
                                    ${isActive
                                        ? `${s.active} shadow-sm ring-2 ${s.ring}`
                                        : `${s.inactive} hover:bg-[#f8f8f8]`
                                    }
                                    disabled:opacity-60 disabled:cursor-not-allowed
                                `}
                            >
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isActive ? s.dot : 'bg-[#ccc]'}`} />
                                {t(s.labelKey)}
                            </button>
                        );
                    })}
                </div>
            </section>

            {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-2xl p-4 text-sm font-semibold">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* ── V2 Two Column Queue ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* 1. Pending Column */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xs font-bold uppercase text-[#888] tracking-[0.12em] flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                            {t('status.pending')}
                            <span className="bg-yellow-50 text-yellow-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                {pendingRequests.length}
                            </span>
                        </h2>
                    </div>

                    <div className="space-y-3 min-h-[300px]">
                        {pendingRequests.length === 0 ? (
                            <div className="bg-[#f8f8f8] border border-dashed border-black/10 rounded-[28px] p-8 text-center flex flex-col items-center justify-center min-h-[200px] sm:min-h-[300px]">
                                <Coffee className="text-[#aaa] mb-4" size={36} />
                                <p className="text-[#666] font-semibold text-sm sm:text-base">{t('barber.layout.allCaughtUp')}</p>
                                <p className="text-[#aaa] text-xs mt-2">{t('barber.dashboard.emptyRefresh')}</p>
                            </div>
                        ) : (
                            pendingRequests.map(request => {
                                const clientName = request.guest_name || request.clientData?.name || request.clientData?.fullname || t('barber.dashboard.newClient');
                                const phone = request.guest_phone || request.clientData?.phone;
                                return (
                                    <div key={request.id} className="bg-white border border-black/5 rounded-[28px] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.04)] flex flex-col gap-4 hover:shadow-[0_15px_50px_rgba(0,0,0,0.06)] transition-all duration-200">
                                        <div className="flex items-center gap-3.5">
                                            <SimpleAvatar name={clientName} />
                                            <div className="min-w-0 flex-1">
                                                <button
                                                    onClick={() => {
                                                        const c = clientsById[request.client] || request.clientData;
                                                        if (c) {
                                                            setProfileClient({ id: c.id, name: c.name || c.fullname, phone: c.phone, email: c.email, createdAt: c.createdAt });
                                                        } else if (request.guest_name) {
                                                            setProfileClient({ id: `guest_${request.id}`, name: request.guest_name, phone: request.guest_phone || '' });
                                                        }
                                                    }}
                                                    className="font-bold text-[#111] truncate hover:text-[#378ADD] transition-colors text-left"
                                                >
                                                    {clientName}
                                                </button>
                                                <p className="text-xs text-[#666] font-semibold mt-0.5">{request.service_name || t('barber.dashboard.haircut')}</p>
                                                {phone && <p className="text-[10px] text-[#888] font-medium mt-0.5">{phone}</p>}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between border-t border-black/5 pt-3.5 mt-1">
                                            <div className="flex items-center gap-1.5 text-[#111] font-bold text-xs">
                                                <Clock size={14} className="text-[#888]" />
                                                <span>{formatTo24h(request.booking_hours)}</span>
                                                <span className="text-[10px] text-[#378ADD] font-bold uppercase tracking-wider bg-[#378ADD]/5 px-2 py-0.5 rounded-full ml-1">
                                                    {formatBookingDate(getBookingDateStr(request) ?? todayStr, { style: 'short' })}
                                                </span>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleStatusUpdate(request.id, 'accepted')}
                                                    className="w-10 sm:w-9 h-10 sm:h-9 bg-[#378ADD] text-white rounded-xl flex items-center justify-center hover:bg-[#185FA5] active:scale-[0.93] transition-all shadow-sm"
                                                    title={t('common.accept')}
                                                >
                                                    <Check size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleStatusUpdate(request.id, 'rejected')}
                                                    className="w-10 sm:w-9 h-10 sm:h-9 bg-[#f8f8f8] border border-black/5 text-[#888] rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-100 active:scale-[0.93] transition-all"
                                                    title={t('common.reject')}
                                                >
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* 2. Accepted Column */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xs font-bold uppercase text-[#888] tracking-[0.12em] flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#378ADD]" />
                            {t('status.accepted')}
                            <span className="bg-[#378ADD]/5 text-[#378ADD] text-[10px] px-2 py-0.5 rounded-full font-bold">
                                {acceptedRequests.length}
                            </span>
                        </h2>
                    </div>

                    <div className="space-y-3 min-h-[300px]">
                        {acceptedRequests.length === 0 ? (
                            <div className="bg-[#f8f8f8] border border-dashed border-black/10 rounded-[28px] p-8 text-center flex flex-col items-center justify-center min-h-[200px] sm:min-h-[300px]">
                                <Calendar className="text-[#aaa] mb-4" size={36} />
                                <p className="text-[#666] font-semibold text-sm sm:text-base">{t('barber.appointments.emptyTitle')}</p>
                                <p className="text-[#aaa] text-xs mt-2">{t('barber.dashboard.emptyRefresh')}</p>
                            </div>
                        ) : (
                            acceptedRequests.map(booking => {
                                const clientName = booking.guest_name || booking.clientData?.name || booking.clientData?.fullname || t('common.client');
                                const phone = booking.guest_phone || booking.clientData?.phone;
                                return (
                                    <div key={booking.id} className="bg-white border border-black/5 rounded-[28px] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.04)] flex flex-col gap-4 hover:shadow-[0_15px_50px_rgba(0,0,0,0.06)] transition-all duration-200">
                                        <div className="flex items-center gap-3.5">
                                            <SimpleAvatar name={clientName} />
                                            <div className="min-w-0 flex-1">
                                                <button
                                                    onClick={() => {
                                                        const c = clientsById[booking.client] || booking.clientData;
                                                        if (c) {
                                                            setProfileClient({ id: c.id, name: c.name || c.fullname, phone: c.phone, email: c.email, createdAt: c.createdAt });
                                                        } else if (booking.guest_name) {
                                                            setProfileClient({ id: `guest_${booking.id}`, name: booking.guest_name, phone: booking.guest_phone || '' });
                                                        }
                                                    }}
                                                    className="font-bold text-[#111] truncate hover:text-[#378ADD] transition-colors text-left"
                                                >
                                                    {clientName}
                                                </button>
                                                <p className="text-xs text-[#666] font-semibold mt-0.5">{booking.service_name || t('barber.dashboard.haircut')}</p>
                                                {phone && <p className="text-[10px] text-[#888] font-medium mt-0.5">{phone}</p>}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between border-t border-black/5 pt-3.5 mt-1">
                                            <div className="flex items-center gap-1.5 text-[#111] font-bold text-xs">
                                                <Clock size={14} className="text-[#888]" />
                                                <span>{formatTo24h(booking.booking_hours)}</span>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleStatusUpdate(booking.id, 'completed')}
                                                    className="h-10 sm:h-9 px-4 bg-[#378ADD] text-white rounded-xl hover:bg-[#185FA5] active:scale-[0.97] transition-all font-bold text-xs flex items-center gap-1.5 shadow-sm min-h-[44px]"
                                                >
                                                    <Check size={14} />
                                                    <span>{t('barber.dashboard.finish')}</span>
                                                </button>
                                                <button
                                                    onClick={() => handleStatusUpdate(booking.id, 'cancelled')}
                                                    className="w-10 sm:w-9 h-10 sm:h-9 bg-[#f8f8f8] border border-black/5 text-[#888] rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-100 active:scale-[0.93] transition-all"
                                                    title={t('common.cancel')}
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

            </div>

            <ClientProfileModal client={profileClient} isOpen={!!profileClient} onClose={() => setProfileClient(null)} />
        </div>
    );
}

export default Dashboard;
