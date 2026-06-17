// Telegram notifications are now handled exclusively by the DB trigger
// (handle_booking_status_change) — no client-side calls needed.
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Check, X, Coffee, AlertCircle, Calendar, Bell, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { bookingMatchesBarber, getBookings, updateBookingStatus } from '../../api/bookingApi.js';
import { getClients } from '../../api/clientApi.js';
import { updateBarberStatus } from '../../api/barberApi.js';
import { supabase } from '../../api/supabase.js';
import { compareTimes, formatTo24h } from '../../utils/time.js';
import { toDateStr, getBookingDateStr, bookingMatchesDate, formatBookingDate, compareDateStr } from '../../utils/dates.js';
import { t } from '../../utils/i18n.js';
import ClientProfileModal from '../../components/ClientProfileModal.jsx';
import SkeletonLoader from '../../components/SkeletonLoader.jsx';

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
    <div className={`${size} rounded-2xl bg-gradient-to-br from-[#2563eb]/15 to-[#1d4ed8]/10 flex items-center justify-center border border-[#2563eb]/10 shrink-0`}>
        <span className="text-[#2563eb] font-bold text-sm">
            {name?.charAt(0).toUpperCase() || 'C'}
        </span>
    </div>
);

/* ── Countdown chip — shows time until appointment ────────────────────────── */
function TimeUntilChip({ bookingHours, bookingDate, todayStr }) {
    const [label, setLabel] = useState('');

    useEffect(() => {
        const calc = () => {
            if (!bookingHours || bookingDate !== todayStr) return;
            const [h, m] = bookingHours.split(':').map(Number);
            const now = new Date();
            const appt = new Date();
            appt.setHours(h, m, 0, 0);
            const diff = appt - now;
            if (diff <= 0) { setLabel(''); return; }
            const mins = Math.floor(diff / 60000);
            if (mins < 60) setLabel(`${mins}m`);
            else setLabel(`${Math.floor(mins / 60)}h ${mins % 60}m`);
        };
        calc();
        const iv = setInterval(calc, 30000);
        return () => clearInterval(iv);
    }, [bookingHours, bookingDate, todayStr]);

    if (!label) return null;
    return (
        <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold px-2 py-0.5 rounded-full ml-1 flex items-center gap-1">
            <Zap size={9} className="shrink-0" />
            {label}
        </span>
    );
}

function Dashboard() {
    const { user, updateSessionUser } = useAuth();
    const navigate = useNavigate();

    /* ── Mobile tab: 'pending' | 'confirmed' ─────────────────────────────── */
    const [activeTab, setActiveTab] = useState('pending');

    /* ── Barber availability status ───────────────────────────────────────── */
    const [barberStatus, setBarberStatus] = useState(user?.status || 'available');
    const [statusUpdating, setStatusUpdating] = useState(false);

    const [bookings, setBookings] = useState([]);
    const [clientsById, setClientsById] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [profileClient, setProfileClient] = useState(null);
    const [newConfirmedIds, setNewConfirmedIds] = useState(new Set());

    /* ── Toast notification state ─────────────────────────────────────────── */
    const [toast, setToast] = useState(null);
    const toastTimer = useRef(null);
    const prevPendingCount = useRef(0);
    const prevAcceptedIds = useRef(new Set());

    const showToast = useCallback((message, type = 'success') => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ message, type });
        toastTimer.current = setTimeout(() => setToast(null), 3500);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 15000);
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

        const filteredBookings = (bookingList ?? []).filter((booking) =>
            bookingMatchesBarber(booking.barber, user?.id) || bookingMatchesBarber(booking.barber, user?._id)
        );

        setBookings(filteredBookings);
        setClientsById(Object.fromEntries((clients ?? []).map((client) => [client.id, client])));
        setLoading(false);
    }, [user?.id]);

    useEffect(() => {
        loadDashboard();

        if (!user?.id) return;

        const channel = supabase
            .channel(`barber-dashboard-${user.id}`)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'bookings',
                filter: `barber_id=eq.${user.id}`
            }, (payload) => {
                // Detect newly accepted booking for animation
                if (payload.new?.status === 'accepted' && payload.old?.status === 'pending') {
                    setNewConfirmedIds(prev => new Set([...prev, payload.new.id]));
                    setTimeout(() => {
                        setNewConfirmedIds(prev => {
                            const next = new Set(prev);
                            next.delete(payload.new.id);
                            return next;
                        });
                    }, 3000);
                    setActiveTab('confirmed');
                }
                loadDashboard();
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [loadDashboard, user?.id]);

    const handleBarberStatusChange = useCallback(async (newStatus) => {
        if (newStatus === barberStatus || statusUpdating) return;
        setBarberStatus(newStatus);
        setStatusUpdating(true);
        try {
            const { data, error } = await updateBarberStatus(user?.id, newStatus);
            if (!error && data) updateSessionUser({ ...user, status: newStatus });
        } catch (err) {
            console.error('[BARBER STATUS] exception:', err);
        }
        setStatusUpdating(false);
    }, [barberStatus, statusUpdating, user, updateSessionUser]);

    const handleStatusUpdate = useCallback(async (bookingId, newStatus) => {
        try {
            const payload = { status: newStatus };
            if (newStatus === 'cancelled') payload.cancelled_by = 'barber';
            const { data, error: updateError } = await updateBookingStatus(bookingId, payload);
            if (!updateError && data) {
                setBookings(prev => prev.map(b => b.id === bookingId ? data : b));
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
            showToast('Xatolik yuz berdi', 'error');
        }
    }, [showToast]);

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

    const pendingRequests = useMemo(() =>
        bookings
            .filter(b => b.status === 'pending' && bookingMatchesDate(b, todayStr) && !isBookingExpired(b))
            .sort((a, b) => compareTimes(a.booking_hours, b.booking_hours)),
        [bookings, todayStr, isBookingExpired]
    );

    const acceptedRequests = useMemo(() =>
        bookings
            .filter(b => bookingMatchesDate(b, todayStr) && b.status === 'accepted' && !isBookingExpired(b))
            .sort((a, b) => compareTimes(a.booking_hours, b.booking_hours)),
        [bookings, todayStr, isBookingExpired]
    );

    useEffect(() => {
        const currentPending = pendingRequests.length;
        if (currentPending > prevPendingCount.current && prevPendingCount.current >= 0 && !loading) {
            showToast('🔔 Yangi bron so\'rovi keldi!', 'success');
            if (navigator.vibrate) navigator.vibrate(200);
        }
        prevPendingCount.current = currentPending;
    }, [pendingRequests.length, loading, showToast]);

    /* ── Shared BookingCard for both columns ──────────────────────────────── */
    const BookingCard = useCallback(({ booking, isPending }) => {
        const clientName = booking.guest_name || booking.clientData?.name || booking.clientData?.fullname || t('barber.dashboard.newClient');
        const phone = booking.guest_phone || booking.clientData?.phone;
        const bookingDate = getBookingDateStr(booking) ?? todayStr;
        const isNew = newConfirmedIds.has(booking.id);

        return (
            <div
                key={booking.id}
                className={`relative bg-white rounded-[24px] p-5 flex flex-col gap-3.5 transition-all duration-300
                    ${isPending
                        ? 'border border-amber-100 shadow-[0_8px_30px_rgba(245,158,11,0.08)] hover:shadow-[0_12px_40px_rgba(245,158,11,0.12)]'
                        : 'border border-emerald-100 shadow-[0_8px_30px_rgba(16,185,129,0.06)] hover:shadow-[0_12px_40px_rgba(16,185,129,0.10)]'
                    }
                    ${isNew ? 'animate-pulse ring-2 ring-emerald-300' : ''}
                `}
            >
                {/* Left accent bar */}
                <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-full ${isPending ? 'bg-amber-400' : 'bg-emerald-500'}`} />

                <div className="flex items-center gap-3 pl-3">
                    <SimpleAvatar name={clientName} />
                    <div className="min-w-0 flex-1">
                        <button
                            onClick={() => {
                                const c = clientsById[booking.client] || booking.clientData;
                                if (c) setProfileClient({ id: c.id, name: c.name || c.fullname, phone: c.phone, email: c.email, createdAt: c.createdAt });
                                else if (booking.guest_name) setProfileClient({ id: `guest_${booking.id}`, name: booking.guest_name, phone: booking.guest_phone || '' });
                            }}
                            className="font-bold text-[#111] truncate hover:text-[#2563eb] transition-colors text-left text-sm"
                        >
                            {clientName}
                        </button>
                        <p className="text-xs text-[#666] font-semibold mt-0.5 truncate">{booking.service_name || t('barber.dashboard.haircut')}</p>
                        {phone && (
                            <a href={`tel:${phone}`} className="text-[10px] text-[#888] font-medium mt-0.5 hover:text-[#2563eb] transition-colors block truncate">
                                {phone}
                            </a>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between border-t border-black/5 pt-3 pl-3">
                    <div className="flex items-center gap-1.5 text-[#111] font-bold text-sm flex-wrap">
                        <Clock size={13} className="text-[#888]" />
                        <span>{formatTo24h(booking.booking_hours)}</span>
                        {!isPending && (
                            <TimeUntilChip bookingHours={booking.booking_hours} bookingDate={bookingDate} todayStr={todayStr} />
                        )}
                        {bookingDate !== todayStr && (
                            <span className="text-[10px] text-[#888] bg-[#f5f5f7] px-2 py-0.5 rounded-full font-bold ml-1">
                                {formatBookingDate(bookingDate, { style: 'short' })}
                            </span>
                        )}
                    </div>

                    <div className="flex gap-2">
                        {isPending ? (
                            <>
                                <button
                                    onClick={() => handleStatusUpdate(booking.id, 'accepted')}
                                    className="h-10 px-4 bg-[#2563eb] text-white rounded-xl flex items-center gap-1.5 hover:bg-[#1d4ed8] active:scale-[0.93] transition-all shadow-sm font-bold text-xs"
                                    title={t('common.accept')}
                                >
                                    <Check size={14} /> Qabul
                                </button>
                                <button
                                    onClick={() => handleStatusUpdate(booking.id, 'rejected')}
                                    className="w-10 h-10 bg-[#f8f8f8] border border-black/5 text-[#888] rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-100 active:scale-[0.93] transition-all"
                                    title={t('common.reject')}
                                >
                                    <X size={16} />
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => handleStatusUpdate(booking.id, 'completed')}
                                    className="h-10 px-4 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 active:scale-[0.97] transition-all font-bold text-xs flex items-center gap-1.5 shadow-sm"
                                >
                                    <Check size={14} /> Yakunlash
                                </button>
                                <button
                                    onClick={() => handleStatusUpdate(booking.id, 'cancelled')}
                                    className="w-10 h-10 bg-[#f8f8f8] border border-black/5 text-[#888] rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-100 active:scale-[0.93] transition-all"
                                    title={t('common.cancel')}
                                >
                                    <X size={14} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }, [clientsById, handleStatusUpdate, todayStr, newConfirmedIds]);

    return (
        <div className="min-h-screen bg-[#f5f5f7] px-4 py-6 sm:px-6 sm:py-12 space-y-6 page-animate h-full pb-28 max-w-7xl mx-auto">

            {/* ── Toast Notification ── */}
            {toast && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3.5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] font-semibold text-sm flex items-center gap-2.5 animate-slideDown max-w-[90vw] ${
                    toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-[#111] text-white'
                }`}>
                    <Bell size={16} className="shrink-0 opacity-80" />
                    <span>{toast.message}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-[28px] sm:text-[32px] font-bold text-[#111] tracking-[-0.03em] leading-tight">{t('barber.dashboard.title')}</h1>
                    <p className="text-sm text-[#666] font-medium mt-1">
                        {pendingRequests.length > 0
                            ? `${pendingRequests.length} ta kutilmoqda • ${acceptedRequests.length} ta tasdiqlangan`
                            : acceptedRequests.length > 0
                                ? `${acceptedRequests.length} ta tasdiqlangan bugun`
                                : t('barber.dashboard.subtitle')
                        }
                    </p>
                </div>
            </div>

            {/* ── Barber Availability Status Selector ── */}
            <section className="bg-white border border-black/5 rounded-[28px] p-5 sm:p-6 shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
                <p className="text-[10px] uppercase text-[#888] font-bold tracking-[0.12em] mb-3 flex items-center gap-2">
                    {t('barber.dashboard.myStatus')}
                    {statusUpdating && <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] animate-pulse" />}
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
                                    ${isActive ? `${s.active} shadow-sm ring-2 ${s.ring}` : `${s.inactive} hover:bg-[#f8f8f8]`}
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
                    <AlertCircle size={18} /><span>{error}</span>
                </div>
            )}

            {/* ── Mobile Tab Strip ── */}
            <div className="flex lg:hidden gap-2 bg-white border border-black/5 rounded-2xl p-1.5 shadow-sm">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                        activeTab === 'pending' ? 'bg-amber-400 text-white shadow-sm' : 'text-[#666] hover:bg-[#f8f8f8]'
                    }`}
                >
                    Kutilmoqda
                    {pendingRequests.length > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${activeTab === 'pending' ? 'bg-white/20' : 'bg-amber-100 text-amber-600'}`}>
                            {pendingRequests.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('confirmed')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                        activeTab === 'confirmed' ? 'bg-emerald-500 text-white shadow-sm' : 'text-[#666] hover:bg-[#f8f8f8]'
                    }`}
                >
                    Tasdiqlangan
                    {acceptedRequests.length > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${activeTab === 'confirmed' ? 'bg-white/20' : 'bg-emerald-100 text-emerald-600'}`}>
                            {acceptedRequests.length}
                        </span>
                    )}
                </button>
            </div>

            {/* ── Desktop: Two Column / Mobile: Single active tab ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">

                {/* Pending Column */}
                <div className={`space-y-4 ${activeTab === 'confirmed' ? 'hidden lg:block' : ''}`}>
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-xs font-bold uppercase tracking-[0.12em] flex items-center gap-2 text-amber-600">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                            Kutilayotgan so'rovlar
                            <span className="bg-amber-50 border border-amber-100 text-amber-600 text-[10px] px-2 py-0.5 rounded-full font-black">
                                {pendingRequests.length}
                            </span>
                        </h2>
                    </div>

                    <div className="space-y-3">
                        {loading ? (
                            <SkeletonLoader count={3} type="list" />
                        ) : pendingRequests.length === 0 ? (
                            <div className="bg-[#fffbf0] border border-dashed border-amber-200 rounded-[24px] p-8 text-center flex flex-col items-center justify-center min-h-[200px]">
                                <Coffee className="text-amber-300 mb-3" size={32} />
                                <p className="text-amber-700 font-semibold text-sm">{t('barber.layout.allCaughtUp')}</p>
                                <p className="text-amber-400 text-xs mt-1">Yangi so'rovlar bu yerda ko'rinadi</p>
                            </div>
                        ) : (
                            pendingRequests.map(r => <BookingCard key={r.id} booking={r} isPending={true} />)
                        )}
                    </div>
                </div>

                {/* Confirmed Column */}
                <div className={`space-y-4 ${activeTab === 'pending' ? 'hidden lg:block' : ''}`}>
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-xs font-bold uppercase tracking-[0.12em] flex items-center gap-2 text-emerald-600">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            Tasdiqlangan navbatlar
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black border ${
                                acceptedRequests.length > 0
                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                                    : 'bg-gray-50 border-gray-100 text-gray-400'
                            }`}>
                                {acceptedRequests.length}
                            </span>
                        </h2>
                    </div>

                    <div className="space-y-3">
                        {loading ? (
                            <SkeletonLoader count={3} type="list" />
                        ) : acceptedRequests.length === 0 ? (
                            <div className="bg-[#f0fdf4] border border-dashed border-emerald-200 rounded-[24px] p-8 text-center flex flex-col items-center justify-center min-h-[200px]">
                                <Calendar className="text-emerald-300 mb-3" size={32} />
                                <p className="text-emerald-700 font-semibold text-sm">Hali tasdiqlangan navbat yo'q</p>
                                <p className="text-emerald-400 text-xs mt-1">Qabul qilingan navbatlar bu yerda ko'rinadi</p>
                            </div>
                        ) : (
                            acceptedRequests.map(b => <BookingCard key={b.id} booking={b} isPending={false} />)
                        )}
                    </div>
                </div>

            </div>

            <ClientProfileModal client={profileClient} isOpen={!!profileClient} onClose={() => setProfileClient(null)} />
        </div>
    );
}

export default Dashboard;
