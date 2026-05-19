import { useEffect, useMemo, useState, useCallback } from 'react';
import { Search, CheckCircle2, XCircle, User, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { bookingMatchesBarber, getBookings } from '../../api/bookingApi.js';
import { getClients } from '../../api/clientApi.js';
import { compareTimes } from '../../utils/time.js';

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

    return (
        <div className="px-6 py-6 space-y-6 max-w-2xl mx-auto pb-24">
            <header>
                <h1 className="text-2xl font-black text-gray-900">Mijozlar</h1>
                <p className="text-gray-500 text-sm">Baza va tashriflar tarixi</p>
            </header>

            {/* Qidiruv */}
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={18} />
                <input
                    type="text"
                    placeholder="Mijoz ismini yozing..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                />
            </div>

            {/* Tablar */}
            <div className="flex p-1.5 bg-gray-100 rounded-2xl">
                {['upcoming', 'history'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all uppercase tracking-wider ${activeTab === tab ? 'bg-white shadow-sm text-primary' : 'text-gray-500'
                            }`}
                    >
                        {tab === 'upcoming' ? 'Navbatdagilar' : 'Tarix'}
                    </button>
                ))}
            </div>

            {/* Ro'yxat */}
            <div className="space-y-3">
                {loading ? (
                    <div className="text-center py-10 text-gray-400">Yuklanmoqda...</div>
                ) : filteredList.length > 0 ? (
                    filteredList.map((b) => {
                        const client = b.clientData || clientsById[b.client];
                        const status = b.status?.toLowerCase();

                        return (
                            <div key={b.id} className="bg-white p-4 rounded-3xl border border-gray-50 shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
                                    <User size={24} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900 leading-none mb-1">{client?.name || 'Nomaʼlum'}</h3>
                                    <p className="text-[11px] text-gray-400 font-bold">{b.booking_hours} • Bugun</p>
                                </div>

                                {status === 'completed' ? (
                                    <div className="flex items-center gap-1 text-green-500 bg-green-50 px-2 py-1 rounded-lg">
                                        <CheckCircle2 size={14} />
                                        <span className="text-[10px] font-black uppercase">OK</span>
                                    </div>
                                ) : status === 'rejected' || status === 'cancelled' ? (
                                    <div className="flex items-center gap-1 text-red-400 bg-red-50 px-2 py-1 rounded-lg">
                                        <XCircle size={14} />
                                        <span className="text-[10px] font-black uppercase">X</span>
                                    </div>
                                ) : (
                                    <div className="text-primary font-black text-[10px] bg-primary/5 px-2 py-1 rounded-lg uppercase">
                                        Kutilmoqda
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-20">
                        <Clock className="mx-auto text-gray-200 mb-2" size={40} />
                        <p className="text-gray-400 font-medium">Hech narsa topilmadi</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Clients;