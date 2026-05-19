import { useEffect, useMemo, useState, useCallback } from 'react';
import { Search, CheckCircle2, XCircle, User, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { bookingMatchesBarber, getBookings } from '../../api/bookingApi.js';
import { getClients } from '../../api/clientApi.js';
import { compareTimes } from '../../utils/time.js';

const STATUS_CONFIG = {
    completed:   { label: 'Tugadi',      class: 'bg-green-50 text-green-600' },
    rejected:    { label: 'Rad etildi',  class: 'bg-red-50 text-red-400'    },
    cancelled:   { label: 'Bekor',       class: 'bg-red-50 text-red-400'    },
    pending:     { label: 'Kutilmoqda',  class: 'bg-primary/5 text-primary'  },
    accepted:    { label: 'Tasdiqlandi', class: 'bg-blue-50 text-blue-600'  },
    in_progress: { label: 'Jarayonda',   class: 'bg-primary/10 text-primary' },
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
        }).sort((a, b) => compareTimes(a.booking_hours, b.booking_hours));
    }, [bookings, activeTab, searchQuery, clientsById]);

    const upcomingCount = useMemo(() =>
        bookings.filter(b => ['pending', 'accepted', 'in_progress'].includes(b.status?.toLowerCase())).length,
        [bookings]
    );

    return (
        <div className="px-6 py-4 space-y-6 page-animate max-w-2xl mx-auto pb-24">

            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Mijozlar</h1>
                    <p className="text-gray-500 font-medium text-sm mt-0.5">Baza va tashriflar tarixi</p>
                </div>
                {upcomingCount > 0 && (
                    <div className="bg-primary/10 rounded-2xl px-4 py-2 text-center">
                        <span className="block text-[10px] font-bold text-primary uppercase tracking-widest leading-none mb-1">Navbat</span>
                        <span className="text-2xl font-bold text-primary leading-none">{upcomingCount}</span>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div>
                <p className="text-xs font-bold uppercase text-gray-400 tracking-widest mb-3">Ko'rinish</p>
                <div className="flex p-1 bg-gray-100 rounded-2xl gap-1">
                    {[
                        { key: 'upcoming', label: 'Navbatdagilar' },
                        { key: 'history',  label: 'Tarix'         },
                    ].map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key)}
                            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                                activeTab === key
                                    ? 'bg-white shadow-sm text-primary'
                                    : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                <input
                    type="text"
                    placeholder="Mijoz ismini qidiring..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-gray-100 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 shadow-sm transition-all"
                />
            </div>

            {/* List */}
            <div>
                <p className="text-xs font-bold uppercase text-gray-400 tracking-widest mb-3">
                    {activeTab === 'upcoming' ? 'Navbatdagilar' : 'Tarix'}
                    {filteredList.length > 0 && (
                        <span className="ml-2 font-bold text-primary">{filteredList.length}</span>
                    )}
                </p>

                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-18 skeleton rounded-3xl" style={{ height: '72px' }} />)}
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
                                    className="bg-white border border-gray-100 rounded-3xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all"
                                >
                                    {/* Avatar */}
                                    <div className="w-11 h-11 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
                                        {client?.avatar
                                            ? <img src={client.avatar} className="w-11 h-11 rounded-2xl object-cover" alt="" />
                                            : <span className="text-primary font-bold text-sm">
                                                {client?.name?.charAt(0)?.toUpperCase() || <User size={18} />}
                                              </span>
                                        }
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">
                                            {client?.name || 'Nomaʼlum'}
                                        </h3>
                                        <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                                            {b.booking_hours || '—'}
                                        </p>
                                    </div>

                                    {/* Status badge */}
                                    <span className={`text-[10px] font-bold px-3 py-1.5 rounded-xl uppercase tracking-wider shrink-0 ${cfg.class}`}>
                                        {cfg.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mb-4 border border-gray-100">
                            <Users className="text-gray-300" size={28} />
                        </div>
                        <p className="font-bold text-gray-700 text-sm">Mijoz topilmadi</p>
                        <p className="text-gray-400 text-xs mt-1">
                            {searchQuery ? 'Boshqa nom bilan qidiring' : 'Bu bo\'limda hozircha hech narsa yo\'q'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Clients;