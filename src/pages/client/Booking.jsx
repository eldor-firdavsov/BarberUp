// Telegram notifications are handled by the DB trigger — no client-side calls needed.
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, X, AlertCircle, RefreshCw, ChevronRight, MapPin, Sparkles, ShoppingBag } from 'lucide-react';
import { useClient } from '../../context/ClientContext.jsx';
import { getBookings, updateBookingStatus } from '../../api/bookingApi.js';
import { getBarbers } from '../../api/barberApi.js';
import { supabase } from '../../api/supabase.js';
import { compareTimes, formatTo24h } from '../../utils/time.js';
import { getBookingDateStr, compareDateStr, formatBookingDate } from '../../utils/dates.js';
import { isAcceptedStatus, isPendingStatus, formatBookingErrorMessage } from '../../utils/bookingStatus.js';
import { t, getStatusLabel } from '../../utils/i18n.js';

const TABS = [
    { key: 'active', label: 'Faol bronlar' },
    { key: 'history', label: 'Tarix' },
];

const statusStyles = {
    pending: {
        bg: 'bg-amber-50/70 border-amber-100',
        text: 'text-amber-700',
        dot: 'bg-amber-500',
        label: 'Kutilmoqda',
    },
    accepted: {
        bg: 'bg-emerald-50/70 border-emerald-100',
        text: 'text-emerald-700',
        dot: 'bg-emerald-500',
        label: 'Tasdiqlangan',
    },
    in_progress: {
        bg: 'bg-blue-50/70 border-blue-100',
        text: 'text-blue-700',
        dot: 'bg-blue-500',
        label: 'Jarayonda',
    },
    completed: {
        bg: 'bg-gray-50 border-gray-100',
        text: 'text-gray-600',
        dot: 'bg-gray-400',
        label: 'Tugagan',
    },
    cancelled: {
        bg: 'bg-red-50/50 border-red-100',
        text: 'text-red-500',
        dot: 'bg-red-400',
        label: 'Bekor qilingan',
    },
    rejected: {
        bg: 'bg-red-50/50 border-red-100',
        text: 'text-red-500',
        dot: 'bg-red-400',
        label: 'Rad etilgan',
    },
};

function Booking() {
    const { clientPhone } = useClient();
    const navigate = useNavigate();
    const [bookings, setBookings] = useState([]);
    const [barbersById, setBarbersById] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [cancelModal, setCancelModal] = useState({ open: false, bookingId: null });
    const [successMessage, setSuccessMessage] = useState('');
    const [activeTab, setActiveTab] = useState('active');

    const loadBookings = useCallback(async () => {
        setLoading(true);
        setError('');
        const [{ data: bookingList, error: bookingError }, { data: barberList }] = await Promise.all([
            getBookings(),
            getBarbers(),
        ]);

        if (bookingError) {
            setError(bookingError);
            setBookings([]);
            setLoading(false);
            return;
        }

        const byId = {};
        for (const barber of barberList ?? []) {
            if (barber?.id) byId[String(barber.id)] = barber;
            if (barber?._id) byId[String(barber._id)] = barber;
        }
        const ownBookings = (bookingList ?? []).filter((booking) => booking.guest_phone === clientPhone);
        setBarbersById(byId);
        setBookings(ownBookings);
        setLoading(false);
    }, [clientPhone]);

    useEffect(() => {
        loadBookings();
    }, [loadBookings]);

    // Supabase Realtime update hook
    useEffect(() => {
        if (!clientPhone) return;

        const channel = supabase
            .channel(`client-bookings-realtime-${clientPhone.replace(/\+/g, '')}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'bookings' },
                (payload) => {
                    const row = payload.new || payload.old;
                    if (row?.guest_phone === clientPhone || row?.client_id) {
                        loadBookings();
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [clientPhone, loadBookings]);

    const sortedBookings = useMemo(
        () => [...bookings].sort((a, b) => {
            const dateCmp = compareDateStr(getBookingDateStr(b), getBookingDateStr(a));
            if (dateCmp !== 0) return dateCmp;
            return compareTimes(a.booking_hours, b.booking_hours);
        }),
        [bookings]
    );

    const activeBookings = useMemo(() =>
        sortedBookings.filter(b => {
            const s = b.status?.toLowerCase();
            return s === 'pending' || s === 'accepted' || s === 'in_progress';
        }),
        [sortedBookings]
    );

    const historyBookings = useMemo(() =>
        sortedBookings.filter(b => {
            const s = b.status?.toLowerCase();
            return s === 'completed' || s === 'cancelled' || s === 'rejected';
        }),
        [sortedBookings]
    );

    const currentBookings = activeTab === 'active' ? activeBookings : historyBookings;

    const handleCancelBooking = (bookingId, e) => {
        e.stopPropagation(); // Prevent card navigation
        setCancelModal({ open: true, bookingId });
    };

    const confirmCancelBooking = async () => {
        const { bookingId } = cancelModal;
        setCancelModal({ open: false, bookingId: null });
        const { data, error: updateError } = await updateBookingStatus(
            bookingId,
            { status: 'cancelled', cancelled_by: 'client' }
        );
        if (updateError) {
            setError(formatBookingErrorMessage(updateError, t));
        } else if (data) {
            setBookings(prev => prev.map(b => b.id === bookingId ? data : b));
            setSuccessMessage(t('client.bookings.cancelSuccess'));
            setTimeout(() => setSuccessMessage(''), 3000);
        }
    };

    const handleRebook = (booking, e) => {
        e.stopPropagation(); // Prevent card navigation
        const barber = barbersById[booking.barber];
        if (!barber) return;

        navigate(`/client/barber/${encodeURIComponent(barber.id)}`, {
            state: {
                rebookFrom: booking.booking_hours,
                rebookDate: getBookingDateStr(booking) ?? undefined,
                previousBooking: booking
            }
        });
    };

    return (
        <div className="px-4 py-6 sm:px-6 sm:py-10 space-y-6 page-animate max-w-lg md:max-w-5xl mx-auto pb-24 safe-bottom">
            {/* Page Title & Count Info */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-[#111] tracking-tight">{t('client.bookings.title')}</h1>
                    <p className="text-xs sm:text-sm text-[#666] font-semibold mt-1">
                        {bookings.length > 0 ? `${bookings.length} ta umumiy uchrashuvlaringiz` : t('client.bookings.subtitle')}
                    </p>
                </div>
            </div>

            {/* Dynamic Alerts */}
            {error && (
                <div className="rounded-2xl border border-red-100 bg-red-50 p-4 flex items-center gap-2.5 text-xs font-bold text-red-600">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {successMessage && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 flex items-center gap-2.5 text-xs font-bold text-emerald-700 animate-slideDown">
                    <Sparkles size={16} className="shrink-0 text-emerald-500" />
                    <span>{successMessage}</span>
                </div>
            )}

            {/* Tab Switches */}
            <div className="flex bg-[#f2f2f5] p-1.5 rounded-2xl border border-black/5 shadow-sm">
                {TABS.map(tab => {
                    const count = tab.key === 'active' ? activeBookings.length : historyBookings.length;
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 py-3 text-xs font-black rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] min-h-[44px] ${
                                isActive ? 'bg-white shadow-sm text-[#111]' : 'text-[#666] hover:bg-black/5'
                            }`}
                        >
                            {tab.label}
                            {count > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black min-w-[18px] text-center ${
                                    isActive ? 'bg-[#2563eb] text-white' : 'bg-black/5 text-[#888]'
                                }`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Loading Grid */}
            {loading && (
                <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-6">
                    {[1, 2].map(i => (
                        <div key={i} className="bg-white border border-black/5 rounded-[28px] p-6 h-36 flex flex-col justify-between">
                            <div className="flex gap-4">
                                <div className="w-12 h-12 bg-black/5 rounded-2xl animate-pulse" />
                                <div className="space-y-2 flex-1">
                                    <div className="h-4 bg-black/5 rounded w-2/3 animate-pulse" />
                                    <div className="h-3 bg-black/5 rounded w-1/3 animate-pulse" />
                                </div>
                            </div>
                            <div className="h-8 bg-black/5 rounded-xl animate-pulse" />
                        </div>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && currentBookings.length === 0 && (
                <div className="bg-white border border-black/5 rounded-[32px] p-10 py-16 text-center flex flex-col items-center justify-center shadow-[0_10px_40px_rgba(0,0,0,0.03)]">
                    <div className="w-16 h-16 bg-[#f5f5f7] border border-black/5 rounded-[22px] flex items-center justify-center mb-5">
                        <ShoppingBag className="text-gray-300" size={26} />
                    </div>
                    <h3 className="font-bold text-[#111] text-base">{activeTab === 'active' ? 'Faol bronlaringiz yo\'q' : 'Tarix bo\'sh'}</h3>
                    <p className="text-[#666] text-xs mt-1.5 max-w-xs leading-relaxed font-semibold">
                        {activeTab === 'active'
                            ? 'Sartaroshxonaga navbat olish uchun o\'zingizga yoqqan sartaroshni tanlab buyurtma bering.'
                            : 'O\'tgan uchrashuvlar va bekor qilingan bronlar tarixi shu yerda ko\'rinadi.'
                        }
                    </p>
                    {activeTab === 'active' && (
                        <button
                            onClick={() => navigate('/client/dashboard')}
                            className="mt-6 h-12 px-6 bg-[#2563eb] text-white font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-[#1d4ed8] transition-all shadow-[0_8px_20px_rgba(55,138,221,0.2)]"
                        >
                            Sartaroshlarni ko'rish
                        </button>
                    )}
                </div>
            )}

            {/* Booking Cards Grid */}
            {!loading && !error && currentBookings.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentBookings.map((booking) => {
                        const barber = barbersById[booking.barber];
                        const statusKey = booking.status?.toLowerCase() || 'pending';
                        const style = statusStyles[statusKey] ?? statusStyles.pending;
                        const isCancellable = isPendingStatus(booking.status) || isAcceptedStatus(booking.status);
                        const canRebook = statusKey === 'completed' || statusKey === 'cancelled' || statusKey === 'rejected';

                        return (
                            <div
                                key={booking.id}
                                onClick={() => navigate(`/client/booking-status/${booking.id}`)}
                                className="group relative bg-white border border-black/5 rounded-[28px] p-5 shadow-[0_10px_35px_rgba(0,0,0,0.04)] hover:shadow-[0_15px_45px_rgba(0,0,0,0.07)] hover:border-black/10 transition-all duration-300 cursor-pointer flex flex-col justify-between gap-4"
                            >
                                <div className="flex justify-between items-start gap-3">
                                    {/* Barber Profile image / avatar */}
                                    <div className="flex gap-4 min-w-0 flex-1">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2563eb]/15 to-[#1d4ed8]/10 flex items-center justify-center border border-[#2563eb]/10 shrink-0 font-extrabold text-lg text-[#2563eb]">
                                            {(barber?.office_name || barber?.fullname || 'B').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-extrabold text-[#111] text-sm tracking-tight truncate group-hover:text-[#2563eb] transition-colors">
                                                {barber?.office_name || t('common.barbershop')}
                                            </h3>
                                            <p className="text-xs text-[#666] font-semibold mt-0.5 truncate">{barber?.fullname}</p>
                                            {booking.service_name && (
                                                <p className="text-[11px] text-[#888] font-bold mt-1 uppercase tracking-wider">
                                                    {booking.service_name}
                                                    {booking.service_price && ` · ${Number(booking.service_price).toLocaleString()} UZS`}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 border rounded-full shrink-0 flex items-center gap-1.5 ${style.bg} ${style.text}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                                        {style.label}
                                    </span>
                                </div>

                                {/* Date and Time Section */}
                                <div className="bg-[#f8f8fa] rounded-2xl p-3 flex justify-between items-center text-xs font-bold text-[#111]">
                                    <div className="flex items-center gap-2 text-[#666]">
                                        <Calendar size={14} className="text-[#888]" />
                                        <span>{formatBookingDate(getBookingDateStr(booking) ?? new Date().toISOString().slice(0, 10), { style: 'medium' })}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[#111]">
                                        <Clock size={14} className="text-[#888]" />
                                        <span className="text-sm">{formatTo24h(booking.booking_hours)}</span>
                                    </div>
                                </div>

                                {/* Address if provided and confirmed */}
                                {statusKey === 'accepted' && barber?.address && (
                                    <div className="text-[11px] text-[#888] font-semibold flex items-center gap-1">
                                        <MapPin size={11} className="text-[#2563eb]" />
                                        <span className="truncate">{barber.address}</span>
                                    </div>
                                )}

                                {/* Action bar */}
                                <div className="border-t border-black/5 pt-3.5 flex justify-between items-center">
                                    <span className="text-[11px] text-[#2563eb] font-bold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                        Holatni kuzatish <ChevronRight size={12} />
                                    </span>

                                    <div className="flex gap-2">
                                        {isCancellable && (
                                            <button
                                                onClick={(e) => handleCancelBooking(booking.id, e)}
                                                className="h-9 px-3 text-xs bg-red-50 text-red-500 font-bold border border-red-100 rounded-xl hover:bg-red-100 active:scale-95 transition-all"
                                            >
                                                Bekor qilish
                                            </button>
                                        )}
                                        {canRebook && (
                                            <button
                                                onClick={(e) => handleRebook(booking, e)}
                                                className="h-9 px-3 text-xs bg-white text-[#111] border border-black/5 font-bold rounded-xl hover:bg-[#f8f8f8] active:scale-95 transition-all flex items-center gap-1"
                                            >
                                                <RefreshCw size={11} /> Qayta bron
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Cancel Confirmation Modal */}
            {cancelModal.open && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0" onClick={() => setCancelModal({ open: false, bookingId: null })}>
                    <div className="bg-white rounded-t-[32px] sm:rounded-[32px] border border-black/5 shadow-[0_20px_60px_rgba(0,0,0,0.15)] max-w-md w-full p-7 animate-slideUp" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-4 mb-5">
                            <div className="w-12 h-12 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center">
                                <AlertCircle className="text-red-500" size={22} />
                            </div>
                            <h3 className="text-[18px] font-extrabold text-[#111] tracking-tight">{t('client.bookings.cancelTitle')}</h3>
                        </div>
                        <p className="text-sm text-[#666] font-semibold mb-7 leading-relaxed">
                            {t('client.bookings.cancelConfirm')}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setCancelModal({ open: false, bookingId: null })}
                                className="flex-1 h-12 border border-black/5 rounded-2xl text-[#111] font-bold text-xs uppercase tracking-wider active:bg-[#f8f8f8] bg-white transition-all shadow-[0_4px_20px_rgba(0,0,0,0.04)] min-h-[48px]"
                            >
                                {t('client.bookings.keepBooking')}
                            </button>
                            <button
                                onClick={confirmCancelBooking}
                                className="flex-1 h-12 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold text-xs uppercase tracking-wider active:scale-95 transition-all shadow-[0_8px_20px_rgba(239,68,68,0.25)] min-h-[48px]"
                            >
                                {t('client.bookings.cancelBooking')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Booking;
