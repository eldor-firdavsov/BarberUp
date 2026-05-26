import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, ChevronLeft } from 'lucide-react';
import { getBookings } from '../../api/bookingApi.js';
import { getBarbers } from '../../api/barberApi.js';
import { formatTo24h } from '../../utils/time.js';
import { getBookingDateStr, formatBookingDate } from '../../utils/dates.js';
import { t } from '../../utils/i18n.js';

function BookingStatus() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [booking, setBooking] = useState(null);
    const [barber, setBarber] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let mounted = true;

        const fetchStatus = async () => {
            try {
                const [{ data: bookings }, { data: barbers }] = await Promise.all([
                    getBookings(),
                    getBarbers()
                ]);

                if (!mounted) return;

                if (bookings) {
                    const currentBooking = bookings.find(b => b.id === id || b._id === id);
                    if (currentBooking) {
                        setBooking(currentBooking);

                        if (barbers) {
                            const currentBarber = barbers.find(b =>
                                b.id === currentBooking.barber ||
                                b._id === currentBooking.barber
                            );
                            if (currentBarber) {
                                setBarber(currentBarber);
                            }
                        }
                    } else {
                        setError(t('client.bookingStatus.notFoundError'));
                    }
                }
            } catch (err) {
                console.error("Failed to fetch booking status", err);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchStatus();

        // Poll every 5 seconds if still pending
        const interval = setInterval(() => {
            if (mounted && booking?.status === 'pending') {
                fetchStatus();
            }
        }, 5000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [id, booking?.status]);

    if (loading && !booking) {
        return (
            <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center p-6">
                <div className="w-12 h-12 border-2 border-black/10 border-t-[#378ADD] rounded-full animate-spin mb-4"></div>
                <p className="text-[#666] font-medium text-sm">{t('client.bookingStatus.loading')}</p>
            </div>
        );
    }

    if (error || !booking) {
        return (
            <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-white border border-black/5 rounded-[28px] flex items-center justify-center mb-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
                    <XCircle className="text-[#999]" size={32} />
                </div>
                <h2 className="text-[22px] font-bold text-[#111] tracking-[-0.02em] mb-2">{t('client.bookingStatus.notFoundTitle')}</h2>
                <p className="text-[#666] font-medium text-sm mb-8">{t('client.bookingStatus.notFoundDesc')}</p>
                <button
                    onClick={() => navigate('/client/dashboard')}
                    className="h-14 px-8 rounded-2xl bg-[#378ADD] hover:bg-[#185FA5] text-white font-semibold text-[15px] transition-all duration-200 shadow-[0_10px_25px_rgba(55,138,221,0.25)]"
                >
                    {t('client.bookingStatus.backHome')}
                </button>
            </div>
        );
    }

    const status = booking.status?.toLowerCase();
    const time = formatTo24h(booking.booking_hours);

    const barberName = barber?.office_name || barber?.shopName || t('common.theBarber');
    const statusMeta = {
        pending: {
            icon: <Clock className="text-[#888]" size={40} />,
            title: t('client.bookingStatus.pendingTitle'),
            subtitle: t('client.bookingStatus.pendingSubtitle', { barber: barberName }),
            iconBg: 'bg-[#f8f8f8]',
            pulse: true,
        },
        accepted: {
            icon: <CheckCircle className="text-[#111]" size={40} />,
            title: t('client.bookingStatus.acceptedTitle'),
            subtitle: t('client.bookingStatus.acceptedSubtitle', { barber: barberName }),
            iconBg: 'bg-white',
            pulse: false,
        },
        rejected: {
            icon: <XCircle className="text-[#888]" size={40} />,
            title: t('client.bookingStatus.rejectedTitle'),
            subtitle: t('client.bookingStatus.rejectedSubtitle', { barber: barberName }),
            iconBg: 'bg-[#f8f8f8]',
            pulse: false,
        },
        cancelled: {
            icon: <XCircle className="text-[#888]" size={40} />,
            title: t('client.bookingStatus.cancelledTitle'),
            subtitle: t('client.bookingStatus.cancelledSubtitle'),
            iconBg: 'bg-[#f8f8f8]',
            pulse: false,
        },
    };

    const meta = statusMeta[status] ?? statusMeta.pending;

    return (
        <div className="min-h-screen bg-[#f5f5f7] flex flex-col px-4 py-8 sm:px-6 page-animate max-w-md md:max-w-2xl mx-auto">
            <button
                onClick={() => navigate('/client/dashboard')}
                className="self-start mb-8 flex items-center gap-2 text-[#666] font-semibold text-sm hover:text-[#111] transition-colors"
            >
                <ChevronLeft size={18} />
                {t('common.home')}
            </button>

            <div className="flex-1 flex flex-col items-center justify-center text-center -mt-8 space-y-8">

                {/* Status Icon */}
                <div className="relative">
                    {meta.pulse && (
                        <div className="absolute inset-0 bg-[#f0f0f0] rounded-[28px] animate-ping opacity-50"></div>
                    )}
                    <div className={`relative w-24 h-24 ${meta.iconBg} border border-black/5 rounded-[28px] flex items-center justify-center shadow-[0_10px_40px_rgba(0,0,0,0.06)]`}>
                        {meta.icon}
                    </div>
                </div>

                {/* Title & Description */}
                <div>
                    <h1 className="text-[28px] font-bold text-[#111] tracking-[-0.03em] leading-tight mb-3">{meta.title}</h1>
                    <p className="text-sm text-[#666] font-medium px-4 leading-relaxed">{meta.subtitle}</p>
                </div>

                {/* Booking Details Card */}
                <div className="w-full bg-white rounded-[28px] p-6 border border-black/5 shadow-[0_10px_40px_rgba(0,0,0,0.06)] text-left">
                    <p className="text-[10px] font-bold text-[#888] uppercase tracking-[0.12em] mb-5">{t('client.bookingStatus.detailsTitle')}</p>

                    <div className="flex items-center gap-4 mb-5 pb-5 border-b border-black/5">
                        <div className="w-12 h-12 bg-[#f8f8f8] border border-black/5 rounded-2xl flex items-center justify-center">
                            <span className="text-[#111] font-bold text-lg">
                                {(barber?.fullname || barber?.name || 'B').charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div>
                            <h3 className="font-bold text-[#111]">{barber?.office_name || barber?.shopName || t('common.barbershop')}</h3>
                            <p className="text-sm text-[#666] font-medium">{barber?.fullname || barber?.name || t('common.barber')}</p>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-5 pb-5 border-b border-black/5">
                        <div>
                            <p className="text-[10px] text-[#888] font-semibold uppercase tracking-[0.1em] mb-1">{t('client.bookingStatus.service')}</p>
                            <p className="font-bold text-[#111]">{booking.service_name || t('common.defaultHaircut')}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-[#888] font-semibold uppercase tracking-[0.1em] mb-1">{t('client.bookingStatus.price')}</p>
                            <p className="font-bold text-[#111]">{booking.service_price ? `${Number(booking.service_price).toLocaleString()} ${t('common.uzs')}` : t('common.dash')}</p>
                        </div>
                    </div>

                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-[10px] text-[#888] font-semibold uppercase tracking-[0.1em] mb-1">{t('common.time')}</p>
                            <p className="font-bold text-[#111] text-lg">{time}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-[#888] font-semibold uppercase tracking-[0.1em] mb-1">{t('common.date')}</p>
                            <p className="font-bold text-[#111] text-lg">
                                {formatBookingDate(getBookingDateStr(booking) ?? new Date().toISOString().slice(0, 10))}
                            </p>
                        </div>
                    </div>
                </div>

                {status !== 'pending' && (
                    <button
                        onClick={() => navigate('/client/dashboard')}
                        className="w-full h-14 rounded-2xl bg-[#378ADD] hover:bg-[#185FA5] text-white font-semibold text-[15px] transition-all duration-200 shadow-[0_10px_25px_rgba(55,138,221,0.25)]"
                    >
                        {t('client.bookingStatus.backHome')}
                    </button>
                )}
            </div>
        </div>
    );
}

export default BookingStatus;
