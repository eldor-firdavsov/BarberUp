import { useState, useEffect } from 'react';
import { X, Phone, Calendar, Clock, TrendingUp, User, AlertCircle } from 'lucide-react';
import { getBookings } from '../api/bookingApi.js';
import { t, getStatusLabel } from '../utils/i18n.js';
import { isTerminalStatus } from '../utils/bookingStatus.js';

function ClientProfileModal({ client, isOpen, onClose }) {
    const [stats, setStats] = useState({
        totalVisits: 0,
        cancellations: 0,
        lastBooking: null,
        completedBookings: 0,
        noShows: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && client?.id) {
            fetchClientStats();
        }
    }, [isOpen, client?.id]);

    const fetchClientStats = async () => {
        try {
            setLoading(true);
            const { data: bookings } = await getBookings();

            if (bookings) {
                const clientBookings = bookings.filter(b => b.client === client.id);
                const completedBookings = clientBookings.filter(b => b.status === 'completed');
                const cancelledBookings = clientBookings.filter(b => b.status === 'cancelled');
                const noShows = clientBookings.filter(b => b.status === 'rejected');

                // Sort by date to get last booking
                const sortedBookings = clientBookings.sort((a, b) =>
                    new Date(b.createdAt) - new Date(a.createdAt)
                );

                setStats({
                    totalVisits: clientBookings.length,
                    cancellations: cancelledBookings.length,
                    lastBooking: sortedBookings[0] || null,
                    completedBookings: completedBookings.length,
                    noShows: noShows.length
                });
            }
        } catch (error) {
            console.error('[CLIENT PROFILE] Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !client) return null;

    const showupRate = stats.totalVisits > 0
        ? Math.round((stats.completedBookings / stats.totalVisits) * 100)
        : 0;

    const reliabilityLabel = stats.totalVisits > 0
        ? stats.completedBookings >= stats.totalVisits * 0.8
            ? t('components.clientProfileModal.reliabilityExcellent')
            : stats.completedBookings >= stats.totalVisits * 0.6
                ? t('components.clientProfileModal.reliabilityGood')
                : t('components.clientProfileModal.reliabilityNeedsWork')
        : t('components.clientProfileModal.noBookingHistory');

    const lastBookingStatusStyle = {
        completed: { bg: 'bg-[#f8f8f8]', text: 'text-[#666]' },
        cancelled: { bg: 'bg-red-50', text: 'text-red-500' },
        rejected: { bg: 'bg-[#f8f8f8]', text: 'text-[#888]' },
        pending: { bg: 'bg-[#f8f8f8]', text: 'text-[#666]' },
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-0 sm:px-4 pb-0 sm:pb-4" onClick={onClose}>
            <div className="bg-white rounded-t-[32px] sm:rounded-[32px] border border-black/5 shadow-[0_20px_60px_rgba(0,0,0,0.15)] max-w-md w-full max-h-[90vh] overflow-y-auto animate-slideUp" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="relative p-6 border-b border-black/5">
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 w-10 sm:w-9 h-10 sm:h-9 bg-[#f8f8f8] border border-black/5 rounded-full flex items-center justify-center active:bg-[#f0f0f0] transition-all"
                    >
                        <X size={18} className="text-[#111]" />
                    </button>

                    <div className="flex items-center gap-4 pr-12">
                        <div className="w-16 h-16 rounded-[20px] bg-[#f8f8f8] border border-black/5 flex items-center justify-center">
                            {client.avatar
                                ? <img src={client.avatar} alt={client.name || client.fullname || t('common.client')} className="w-16 h-16 rounded-[20px] object-cover" />
                                : <span className="text-[#111] font-bold text-2xl">
                                    {(client.name || client.fullname || 'C').charAt(0).toUpperCase()}
                                </span>
                            }
                        </div>
                        <div>
                            <h2 className="text-[20px] font-bold text-[#111] tracking-[-0.02em]">
                                {client.name || client.fullname || t('common.client')}
                            </h2>
                            <p className="text-sm text-[#666] font-medium mt-0.5">
                                {t('components.clientProfileModal.clientSince', { date: client.createdAt ? new Date(client.createdAt).getFullYear() : t('common.dash') })}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">

                    {/* Basic Info */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 bg-[#f8f8f8] border border-black/5 rounded-2xl px-4 py-3">
                            <Phone size={15} className="text-[#888] shrink-0" />
                            <span className="text-sm font-medium text-[#555]">{client.phone || t('components.clientProfileModal.phonePlaceholder')}</span>
                        </div>
                        <div className="flex items-center gap-3 bg-[#f8f8f8] border border-black/5 rounded-2xl px-4 py-3">
                            <User size={15} className="text-[#888] shrink-0" />
                            <span className="text-sm font-medium text-[#555]">{client.email || t('components.clientProfileModal.emailPlaceholder')}</span>
                        </div>
                    </div>

                    {/* Stats */}
                    <div>
                        <p className="text-[10px] font-bold text-[#888] uppercase tracking-[0.12em] mb-3">{t('components.clientProfileModal.bookingHistory')}</p>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { icon: <Calendar size={14} />, label: t('components.clientProfileModal.totalVisits'), value: stats.totalVisits },
                                { icon: <TrendingUp size={14} />, label: t('components.clientProfileModal.completed'), value: stats.completedBookings },
                                { icon: <X size={14} />, label: t('components.clientProfileModal.cancellations'), value: stats.cancellations },
                                { icon: <AlertCircle size={14} />, label: t('components.clientProfileModal.noShows'), value: stats.noShows },
                            ].map(({ icon, label, value }) => (
                                <div key={label} className="bg-[#f8f8f8] border border-black/5 rounded-2xl p-4">
                                    <div className="flex items-center gap-2 text-[#888] mb-2">
                                        {icon}
                                        <span className="text-xs font-semibold text-[#888]">{label}</span>
                                    </div>
                                    <p className="text-2xl font-bold text-[#111]">
                                        {loading ? t('common.dash') : value}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Last Booking */}
                    {stats.lastBooking && (
                        <div>
                            <p className="text-[10px] font-bold text-[#888] uppercase tracking-[0.12em] mb-3">{t('components.clientProfileModal.lastBooking')}</p>
                            <div className="bg-[#f8f8f8] border border-black/5 rounded-2xl p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <div>
                                        <p className="text-[10px] text-[#888] font-semibold uppercase tracking-wider mb-1">{t('common.date')}</p>
                                        <p className="font-bold text-[#111] text-sm">
                                            {new Date(stats.lastBooking.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-[#888] font-semibold uppercase tracking-wider mb-1">{t('common.time')}</p>
                                        <p className="font-bold text-[#111] text-sm">
                                            {stats.lastBooking.booking_hours}
                                        </p>
                                    </div>
                                </div>
                                {(() => {
                                    const s = stats.lastBooking.status?.toLowerCase() || 'pending';
                                    const cfg = lastBookingStatusStyle[s] ?? lastBookingStatusStyle.pending;
                                    return (
                                        <span className={`text-[10px] font-bold px-3 py-1.5 rounded-xl uppercase tracking-wider border border-black/5 ${cfg.bg} ${cfg.text}`}>
                                            {getStatusLabel(s)}
                                        </span>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* Reliability Score */}
                    <div>
                        <p className="text-[10px] font-bold text-[#888] uppercase tracking-[0.12em] mb-3">{t('components.clientProfileModal.reliabilityScore')}</p>
                        <div className="bg-[#f8f8f8] border border-black/5 rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-medium text-[#666]">{t('components.clientProfileModal.showUpRate')}</span>
                                <span className="font-bold text-[#111]">{loading ? t('common.dash') : `${showupRate}%`}</span>
                            </div>
                            <div className="w-full bg-[#E6F1FB] rounded-full h-2 mb-2">
                                <div
                                    className="bg-[#378ADD] h-2 rounded-full transition-all duration-500"
                                    style={{ width: `${loading ? 0 : showupRate}%` }}
                                />
                            </div>
                            <p className="text-xs text-[#888] font-medium">{loading ? t('common.dash') : reliabilityLabel}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ClientProfileModal;
