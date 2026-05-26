import { useEffect, useMemo, useState, useCallback } from 'react';
import { Search, User, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { bookingMatchesBarber, getBookings } from '../../api/bookingApi.js';
import { getClients } from '../../api/clientApi.js';
import { compareTimes, formatTo24h } from '../../utils/time.js';
import { getBookingDateStr, compareDateStr, formatBookingDate } from '../../utils/dates.js';
import { t, getStatusLabel } from '../../utils/i18n.js';

const STATUS_CONFIG = {
    completed: { bg: 'bg-[#f8f8f8]', text: 'text-[#666]' },
    rejected: { bg: 'bg-red-50', text: 'text-red-400' },
    cancelled: { bg: 'bg-red-50', text: 'text-red-400' },
    pending: { bg: 'bg-[#f8f8f8]', text: 'text-[#666]' },
    accepted: { bg: 'bg-[#E6F1FB]', text: 'text-[#0C447C]' },
    in_progress: { bg: 'bg-[#E6F1FB]', text: 'text-[#0C447C]' },
};

function Clients() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('upcoming');
    const [bookings, setBookings] = useState([]);
    const [clientsById, setClientsById] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const loadData = useCallback(async () => {
        const [{ data: bookingList }, { data: clients }] = await Promise.all([
            getBookings(),
            getClients(),
        ]);

        const own = (bookingList ?? []).filter((b) =>
            bookingMatchesBarber(b.barber, user?.id) || bookingMatchesBarber(b.barber, user?._id)
        );

        setBookings(own);
        setClientsById(Object.fromEntries((clients ?? []).map((c) => [c.id, c])));
        setLoading(false);
    }, [user?.id, user?._id]);

    useEffect(() => { loadData(); }, [loadData]);

    const filteredList = useMemo(() => {
        return bookings.filter(b => {
            const status = b.status?.toLowerCase();
            const client = b.clientData || clientsById[b.client];
            const nameMatch = (client?.name || '').toLowerCase().includes(searchQuery.toLowerCase());

            if (activeTab === 'upcoming') {
                return nameMatch && ['pending', 'accepted', 'in_progress'].includes(status);
            } else {
                return nameMatch && ['completed', 'rejected', 'cancelled'].includes(status);
            }
        }).sort((a, b) => {
            const dateCmp = compareDateStr(getBookingDateStr(a), getBookingDateStr(b));
            if (dateCmp !== 0) return dateCmp;
            return compareTimes(a.booking_hours, b.booking_hours);
        });
    }, [bookings, activeTab, searchQuery, clientsById]);

    const upcomingCount = useMemo(() =>
        bookings.filter(b => ['pending', 'accepted', 'in_progress'].includes(b.status?.toLowerCase())).length,
        [bookings]
    );

    return (
        <div className="px-4 py-8 sm:px-6 space-y-6 page-animate max-w-2xl mx-auto pb-24">

            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-[28px] font-bold text-[#111] tracking-[-0.03em] leading-tight">{t('barber.clients.title')}</h1>
                    <p className="text-sm text-[#666] font-medium mt-1">{t('barber.clients.subtitle')}</p>
                </div>
                {upcomingCount > 0 && (
                    <div className="bg-white border border-black/5 rounded-2xl px-4 py-2 text-center shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                        <span className="block text-[10px] font-bold text-[#666] uppercase tracking-[0.12em] leading-none mb-1">{t('barber.clients.queue')}</span>
                        <span className="text-2xl font-bold text-[#111] leading-none">{upcomingCount}</span>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div>
                <p className="text-[10px] font-bold uppercase text-[#888] tracking-[0.12em] mb-3">{t('barber.clients.view')}</p>
                <div className="flex p-1.5 bg-[#f8f8f8] border border-black/5 rounded-2xl gap-1">
                    {[
                        { key: 'upcoming', label: t('barber.clients.upcomingTab') },
                        { key: 'history', label: t('barber.clients.historyTab') },
                    ].map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key)}
                            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${activeTab === key
                                    ? 'bg-[#185FA5] shadow-sm text-white border border-[#185FA5]'
                                    : 'text-[#888] hover:text-[#666]'
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#bbb]" size={16} />
                <input
                    type="text"
                    placeholder={t('barber.clients.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-black/5 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-[#111] placeholder:text-[#bbb] focus:outline-none focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition-all font-medium"
                />
            </div>

            {/* List */}
            <div>
                <p className="text-[10px] font-bold uppercase text-[#888] tracking-[0.12em] mb-3">
                    {activeTab === 'upcoming' ? t('barber.clients.upcomingTab') : t('barber.clients.historyTab')}
                    {filteredList.length > 0 && (
                        <span className="ml-2 font-bold text-[#111]">{filteredList.length}</span>
                    )}
                </p>

                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="skeleton rounded-3xl" style={{ height: '72px' }} />)}
                    </div>
                ) : filteredList.length > 0 ? (
                    <div className="space-y-3">
                        {filteredList.map((b) => {
                            const client = b.clientData || clientsById[b.client];
                            const status = b.status?.toLowerCase();
                            const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

                            return (
                                <div
                                    key={b.id}
                                    className="bg-white border border-black/5 rounded-[24px] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.04)] flex items-center gap-4 hover:shadow-[0_10px_40px_rgba(0,0,0,0.06)] transition-all duration-200"
                                >
                                    {/* Avatar */}
                                    <div className="w-11 h-11 rounded-2xl bg-[#f8f8f8] border border-black/5 flex items-center justify-center shrink-0">
                                        {client?.avatar
                                            ? <img src={client.avatar} className="w-11 h-11 rounded-2xl object-cover" alt="" />
                                            : <span className="text-[#111] font-bold text-sm">
                                                {client?.name?.charAt(0)?.toUpperCase() || <User size={16} className="text-[#888]" />}
                                            </span>
                                        }
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-[#111] text-sm leading-tight truncate">
                                            {client?.name || t('common.unknown')}
                                        </h3>
                                        <p className="text-[11px] text-[#666] font-medium mt-0.5">
                                            {formatTo24h(b.booking_hours) || '—'}
                                            {getBookingDateStr(b) && (
                                                <span className="text-[#378ADD] font-semibold"> · {formatBookingDate(getBookingDateStr(b), { style: 'short' })}</span>
                                            )}
                                        </p>
                                    </div>

                                    {/* Status badge */}
                                    <span className={`text-[10px] font-bold px-3 py-1.5 rounded-xl uppercase tracking-wider shrink-0 border border-black/5 ${cfg.bg} ${cfg.text}`}>
                                        {getStatusLabel(status)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 bg-white border border-black/5 rounded-3xl flex items-center justify-center mb-4 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                            <Users className="text-[#ccc]" size={28} />
                        </div>
                        <p className="font-bold text-[#111] text-sm">{t('barber.clients.notFound')}</p>
                        <p className="text-[#666] text-xs mt-1 font-medium">
                            {searchQuery ? t('barber.clients.tryOtherName') : t('barber.clients.sectionEmpty')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Clients;