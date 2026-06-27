// Telegram notifications are now handled exclusively by the DB trigger
// (handle_booking_status_change) — no client-side calls needed.
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Clock, Check, X, Coffee, AlertCircle, Calendar, Bell, UserPlus, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { getBookingsForBarber, updateBookingStatus, bookingMatchesBarber } from '../../api/bookingApi.js';
import { supabase } from '../../api/supabase.js';
import { compareTimes, formatTo24h } from '../../utils/time.js';
import { toDateStr, getBookingDateStr, bookingMatchesDate } from '../../utils/dates.js';
import { t } from '../../utils/i18n.js';
import ClientProfileModal from '../../components/ClientProfileModal.jsx';
import SkeletonLoader from '../../components/SkeletonLoader.jsx';
import { ListRow, Button, Card, SegmentedControl, EmptyState } from '../../components/ui/index.js';
import WalkInBookingSheet from '../../components/WalkInBookingSheet.jsx';
import { computeBookingStats } from '../../utils/bookingAnalytics.js';
import PageContainer from '../../components/layout/PageContainer.jsx';

function Dashboard() {
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState('pending');

    /* ── Swipe gesture for tab switching ──────────────────────────────────── */
    const BARBER_TAB_ORDER = ['pending', 'confirmed'];
    const barberTouchRef = useRef({ startX: 0, startY: 0 });

    const onBarberSwipeStart = useCallback((e) => {
        barberTouchRef.current.startX = e.touches[0].clientX;
        barberTouchRef.current.startY = e.touches[0].clientY;
    }, []);

    const onBarberSwipeEnd = useCallback((e) => {
        const deltaX = barberTouchRef.current.startX - e.changedTouches[0].clientX;
        const deltaY = barberTouchRef.current.startY - e.changedTouches[0].clientY;

        if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
            setActiveTab(prev => {
                const i = BARBER_TAB_ORDER.indexOf(prev);
                if (deltaX > 0 && i < BARBER_TAB_ORDER.length - 1) return BARBER_TAB_ORDER[i + 1];
                if (deltaX < 0 && i > 0) return BARBER_TAB_ORDER[i - 1];
                return prev;
            });
        }
    }, []);

    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [profileClient, setProfileClient] = useState(null);
    const [walkInOpen, setWalkInOpen] = useState(false);

    /* ── Toast notification state ─────────────────────────────────────────── */
    const [toast, setToast] = useState(null);
    const toastTimer = useRef(null);
    const prevPendingCount = useRef(0);

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
        const barberId = user?.id ?? user?._id;
        if (!barberId) { setLoading(false); return; }

        const { data: bookingList, error: bookingError } = await getBookingsForBarber(barberId);

        if (bookingError) {
            setError(bookingError);
            setLoading(false);
            return;
        }

        setBookings(bookingList ?? []);
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
                if (payload.new?.status === 'accepted' && payload.old?.status === 'pending') {
                    setActiveTab('confirmed');
                }
                loadDashboard();
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [loadDashboard, user?.id]);

    const handleStatusUpdate = useCallback(async (bookingId, newStatus) => {
        // Save current state for rollback
        const originalBookings = [...bookings];

        // 1. Optimistic update
        setBookings(prev =>
            prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b)
        );

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
                // Revert on failure
                setBookings(originalBookings);
                showToast(updateError, 'error');
            }
        } catch (err) {
            // Revert on failure
            setBookings(originalBookings);
            showToast('Xatolik yuz berdi', 'error');
        }
    }, [showToast, bookings]);

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

    return (
        <PageContainer
            hasHeader={true}
            hasBottomNav={true}
            extraBottom={16}
            className="max-w-2xl mx-auto space-y-5 page-animate"
        >

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
            <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('barber.dashboard.title')}</h1>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{t('barber.dashboard.subtitle')}</p>
            </div>

            <Card className="p-4 bg-[var(--brand-primary-light)] border-[var(--brand-primary)]/10">
                <p className="text-xs text-[var(--brand-primary-dark)] font-medium">{t('barber.dashboard.scheduleHint')}</p>
                {user?.working_hours && (
                    <p className="text-sm font-bold text-[var(--text-primary)] mt-1 flex items-center gap-1.5">
                        <Clock size={14} className="text-[var(--brand-primary)]" />
                        {user.working_hours}
                    </p>
                )}
            </Card>

            {/* Today's Stats */}
            {!loading && bookings.length > 0 && (() => {
                const stats = computeBookingStats(bookings);
                return (
                    <div className="grid grid-cols-3 gap-3">
                        <Card className="p-3 text-center">
                            <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">{t('barber.stats.todayRevenue')}</p>
                            <p className="text-base font-bold text-[var(--text-primary)]">
                                {stats.todayStats.revenue.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-[var(--text-secondary)]">{t('common.uzs')}</p>
                        </Card>
                        <Card className="p-3 text-center">
                            <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">{t('barber.stats.completed')}</p>
                            <p className="text-base font-bold text-[var(--text-primary)]">{stats.todayStats.completed}</p>
                            <p className="text-[10px] text-[var(--text-secondary)]">{t('common.today')}</p>
                        </Card>
                        <Card className="p-3 text-center">
                            <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">{t('barber.stats.completionRate')}</p>
                            <p className="text-base font-bold text-[var(--text-primary)]">{stats.completionRate}%</p>
                            <p className="text-[10px] text-[var(--text-secondary)]">{t('common.all')}</p>
                        </Card>
                    </div>
                );
            })()}

            {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-2xl p-4 text-sm font-semibold">
                    <AlertCircle size={18} /><span>{error}</span>
                </div>
            )}

            <SegmentedControl
                value={activeTab}
                onChange={setActiveTab}
                options={[
                    { value: 'pending', label: t('barber.dashboard.needsAction'), badge: pendingRequests.length },
                    { value: 'confirmed', label: t('barber.dashboard.confirmedToday'), badge: acceptedRequests.length },
                ]}
            />

            <div
                className="space-y-3"
                onTouchStart={onBarberSwipeStart}
                onTouchEnd={onBarberSwipeEnd}
            >
                {(activeTab === 'pending' ? pendingRequests : acceptedRequests).length === 0 && !loading && (
                    <EmptyState
                        icon={activeTab === 'pending' ? Coffee : Calendar}
                        title={t('barber.layout.allCaughtUp')}
                        description={t('barber.dashboard.emptyRefresh')}
                    />
                )}

                {loading ? (
                    <SkeletonLoader count={3} type="list" />
                ) : (
                    (activeTab === 'pending' ? pendingRequests : acceptedRequests).map((booking) => {
                        const clientName = booking.guest_name || booking.clientData?.name || booking.clientData?.fullname || t('barber.dashboard.newClient');
                        const isPending = activeTab === 'pending';
                        return (
                            <ListRow
                                key={booking.id}
                                time={formatTo24h(booking.booking_hours)}
                                title={clientName}
                                subtitle={booking.service_name || t('barber.dashboard.haircut')}
                                actions={
                                    isPending ? (
                                        <>
                                            <Button size="sm" onClick={() => handleStatusUpdate(booking.id, 'accepted')}>
                                                <Check size={14} className="mr-1" /> {t('common.accept')}
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => handleStatusUpdate(booking.id, 'rejected')}>
                                                <X size={14} />
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button size="sm" onClick={() => handleStatusUpdate(booking.id, 'completed')}>
                                                {t('barber.dashboard.finish')}
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => handleStatusUpdate(booking.id, 'cancelled')}>
                                                <X size={14} />
                                            </Button>
                                        </>
                                    )
                                }
                            />
                        );
                    })
                )}
            </div>

            <ClientProfileModal client={profileClient} isOpen={!!profileClient} onClose={() => setProfileClient(null)} />

            {/* Walk-In FAB */}
            <button
                onClick={() => setWalkInOpen(true)}
                className="fixed right-4 z-40 flex items-center gap-2 bg-[var(--text-primary)] text-white px-4 py-3 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.2)] text-sm font-bold active:scale-95 transition-all"
                style={{
                    bottom: 'calc(56px + env(safe-area-inset-bottom, 0px) + 16px)',
                }}
            >
                <UserPlus size={16} />
                <span>{t('booking.walkIn')}</span>
            </button>

            <WalkInBookingSheet
                barber={user}
                isOpen={walkInOpen}
                onClose={() => setWalkInOpen(false)}
                onSuccess={(newBooking) => {
                    setBookings(prev => [newBooking, ...prev]);
                    showToast(t('booking.walkInSuccess'), 'success');
                }}
            />
        </PageContainer>
    );
}

export default Dashboard;
