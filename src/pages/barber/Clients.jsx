import { useMemo, useState, useEffect, useCallback } from 'react';
import { Search, Calendar, Filter, X, Users, Clock, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { bookingMatchesBarber, getBookings } from '../../api/bookingApi.js';
import { getClients } from '../../api/clientApi.js';
import { supabase } from '../../api/supabase.js';
import { toDateStr, getBookingDateStr, formatBookingDate } from '../../utils/dates.js';
import { t } from '../../utils/i18n.js';
import ClientProfileModal from '../../components/ClientProfileModal.jsx';

function Clients() {
    const { user } = useAuth();
    const [bookings, setBookings] = useState([]);
    const [clientsById, setClientsById] = useState({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [serviceFilter, setServiceFilter] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [profileClient, setProfileClient] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        const [{ data: bookingList }, { data: clients }] = await Promise.all([
            getBookings(),
            getClients(),
        ]);

        const filtered = (bookingList ?? []).filter(b =>
            bookingMatchesBarber(b.barber, user?.id) || bookingMatchesBarber(b.barber, user?._id)
        );

        setBookings(filtered);
        setClientsById(Object.fromEntries((clients ?? []).map(c => [c.id, c])));
        setLoading(false);
    }, [user?.id]);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        if (!user?.id) return;
        const channel = supabase
            .channel(`barber-clients-${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `barber_id=eq.${user.id}` }, loadData)
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [loadData, user?.id]);

    const uniqueServices = useMemo(() => {
        const services = new Set();
        bookings.forEach(b => { if (b.service_name) services.add(b.service_name); });
        return [...services].sort();
    }, [bookings]);

    const clientStats = useMemo(() => {
        let filtered = bookings;

        if (search.trim()) {
            const q = search.toLowerCase();
            filtered = filtered.filter(b => {
                const name = b.guest_name || clientsById[b.client]?.name || clientsById[b.client]?.fullname || '';
                return name.toLowerCase().includes(q);
            });
        }

        if (dateFrom) filtered = filtered.filter(b => (getBookingDateStr(b) || '') >= dateFrom);
        if (dateTo) filtered = filtered.filter(b => (getBookingDateStr(b) || '') <= dateTo);
        if (serviceFilter) filtered = filtered.filter(b => b.service_name === serviceFilter);

        const map = new Map();
        filtered.forEach(b => {
            const clientId = b.client || `guest_${b.guest_phone || b.id}`;
            if (!map.has(clientId)) {
                const existing = b.client ? clientsById[b.client] : null;
                map.set(clientId, {
                    id: clientId,
                    name: b.guest_name || existing?.name || existing?.fullname || t('common.client'),
                    phone: b.guest_phone || existing?.phone || '',
                    email: existing?.email || '',
                    createdAt: existing?.createdAt || null,
                    visitCount: 0,
                    lastVisit: null,
                    bookings: [],
                });
            }
            const entry = map.get(clientId);
            entry.visitCount++;
            const bDate = getBookingDateStr(b);
            if (bDate && (!entry.lastVisit || bDate > entry.lastVisit)) entry.lastVisit = bDate;
            entry.bookings.push(b);
        });

        return [...map.values()].sort((a, b) => (b.lastVisit || '').localeCompare(a.lastVisit || ''));
    }, [bookings, clientsById, search, dateFrom, dateTo, serviceFilter]);

    const clearFilters = () => {
        setSearch('');
        setDateFrom('');
        setDateTo('');
        setServiceFilter('');
    };

    const hasActiveFilters = search || dateFrom || dateTo || serviceFilter;

    return (
        <div className="min-h-screen bg-[#f5f5f7] px-4 py-8 sm:px-6 sm:py-12 space-y-8 page-animate h-full pb-24 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-[28px] font-bold text-[#111] tracking-[-0.03em] leading-tight">{t('barber.clients.title')}</h1>
                    <p className="text-sm text-[#666] font-medium mt-1">{t('barber.clients.subtitle')}</p>
                </div>
            </div>

            <div className="bg-white border border-black/5 rounded-[28px] p-4 sm:p-5 shadow-[0_10px_40px_rgba(0,0,0,0.04)] space-y-4">
                <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#888]" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={t('barber.clients.searchPlaceholder')}
                            className="w-full bg-[#f8f8f8] border border-black/5 rounded-2xl pl-10 pr-4 py-3 sm:py-2.5 text-sm font-medium text-[#111] focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30 min-h-[44px]"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`w-12 sm:w-11 h-12 sm:h-11 rounded-2xl flex items-center justify-center border transition-all active:scale-[0.93] ${
                            showFilters || hasActiveFilters
                                ? 'bg-[#378ADD] text-white border-[#378ADD]'
                                : 'bg-[#f8f8f8] text-[#666] border-black/5 hover:bg-[#f0f0f0]'
                        }`}
                    >
                        <Filter size={20} />
                    </button>
                </div>

                {showFilters && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-black/5">
                        <div>
                            <label className="text-[10px] font-bold text-[#888] uppercase tracking-[0.12em] mb-1.5 block">{t('common.date')} {t('common.from')}</label>
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                                className="w-full bg-[#f8f8f8] border border-black/5 rounded-xl px-4 py-3 sm:py-2.5 text-sm font-medium text-[#111] focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30 min-h-[44px]" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-[#888] uppercase tracking-[0.12em] mb-1.5 block">{t('common.date')} {t('common.to')}</label>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                                className="w-full bg-[#f8f8f8] border border-black/5 rounded-xl px-4 py-3 sm:py-2.5 text-sm font-medium text-[#111] focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30 min-h-[44px]" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-[#888] uppercase tracking-[0.12em] mb-1.5 block">{t('common.service')}</label>
                            <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}
                                className="w-full bg-[#f8f8f8] border border-black/5 rounded-xl px-4 py-3 sm:py-2.5 text-sm font-medium text-[#111] focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30 appearance-none min-h-[44px]">
                                <option value="">{t('common.all')}</option>
                                {uniqueServices.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="bg-white border border-black/5 rounded-[28px] p-12 text-center">
                    <div className="w-8 h-8 border-2 border-black/10 border-t-[#378ADD] rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm font-medium text-[#666]">{t('common.loading')}</p>
                </div>
            ) : clientStats.length === 0 ? (
                <div className="bg-white border border-black/5 rounded-[28px] p-12 text-center">
                    <Users size={32} className="text-[#ccc] mx-auto mb-3" />
                    <p className="font-bold text-[#111] text-sm">{t('barber.clients.notFound')}</p>
                    <p className="text-xs text-[#666] font-medium mt-1">{t('barber.clients.tryOtherName')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center justify-between px-2">
                        <p className="text-[10px] font-bold text-[#888] uppercase tracking-[0.12em] flex items-center gap-2">
                            <Users size={14} />
                            {t('barber.clients.results')}
                            <span className="bg-[#f8f8f8] text-[#666] text-[10px] px-2 py-0.5 rounded-full font-bold">{clientStats.length}</span>
                        </p>
                        {hasActiveFilters && (
                            <button onClick={clearFilters} className="text-xs font-bold text-[#378ADD] hover:text-[#185FA5] active:scale-[0.95] transition-all flex items-center gap-1.5 px-3 py-2 min-h-[36px]">
                                <X size={14} />{t('common.clear')}
                            </button>
                        )}
                    </div>

                    {clientStats.map(client => (
                        <button
                            key={client.id}
                            onClick={() => setProfileClient(client)}
                            className="bg-white border border-black/5 rounded-[28px] p-4 sm:p-5 shadow-[0_10px_40px_rgba(0,0,0,0.04)] flex items-center gap-3 sm:gap-4 active:scale-[0.99] transition-all text-left min-h-[72px]"
                        >
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#f8f8f8] flex items-center justify-center border border-black/5 shrink-0">
                                <span className="text-[#111] font-bold text-base sm:text-lg">
                                    {(client.name || '?').charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-[#111] truncate text-sm sm:text-base">{client.name}</h3>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                    {client.phone && (
                                        <span className="text-xs text-[#666] font-medium flex items-center gap-1">
                                            <User size={11} />{client.phone}
                                        </span>
                                    )}
                                    <span className="text-xs text-[#666] font-medium flex items-center gap-1">
                                        <Calendar size={11} />{client.visitCount} {t('common.visits')}
                                    </span>
                                </div>
                                {client.lastVisit && (
                                    <p className="text-[10px] text-[#888] font-medium mt-1.5 flex items-center gap-1">
                                        <Clock size={10} />
                                        {t('common.lastVisit')}: {formatBookingDate(client.lastVisit, { style: 'long' })}
                                    </p>
                                )}
                            </div>
                            <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl bg-[#f8f8f8] border border-black/5 flex items-center justify-center shrink-0">
                                <ChevronRightIcon size={18} className="text-[#888]" />
                            </div>
                        </button>
                    ))}
                </div>
            )}

            <ClientProfileModal client={profileClient} isOpen={!!profileClient} onClose={() => setProfileClient(null)} />
        </div>
    );
}

function ChevronRightIcon({ size, className }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <polyline points="9 18 15 12 9 6" />
        </svg>
    );
}

export default Clients;
