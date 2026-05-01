import { useEffect, useMemo, useState } from 'react';
import { Search, Calendar as CalendarIcon, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { getBookings } from '../../api/bookingApi.js';
import { getClients } from '../../api/clientApi.js';
import { compareTimes, formatTo24h } from '../../utils/time.js';

function Clients() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('upcoming');
    const [upcomingClients, setUpcomingClients] = useState([]);
    const [historyClients, setHistoryClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            setError('');
            const [{ data: bookingList, error: bookingError }, { data: clients }] = await Promise.all([
                getBookings(),
                getClients(),
            ]);
            if (!mounted) return;
            if (bookingError) {
                setError(bookingError);
                setLoading(false);
                return;
            }
            const clientsById = Object.fromEntries((clients ?? []).map((client) => [client.id, client]));
            const own = (bookingList ?? []).filter((booking) => booking.barber === user?.id);
            const formatted = own.map((booking) => ({
                id: booking.id,
                name: clientsById[booking.client]?.name || 'Client',
                image: "https://i.pravatar.cc/150?u=client-list",
                date: 'Today',
                time: booking.booking_hours || '--:--',
                services: 'Session',
                status: (booking.status || 'pending').toLowerCase(),
            }));

            setUpcomingClients(formatted.filter((item) => ['pending', 'accepted'].includes(item.status)));
            setHistoryClients(formatted.filter((item) => ['rejected', 'cancelled', 'completed'].includes(item.status)));
            setLoading(false);
        }
        load();
        return () => {
            mounted = false;
        };
    }, [user?.id]);

    const currentList = useMemo(
        () => (activeTab === 'upcoming' ? upcomingClients : historyClients).slice().sort((a, b) => compareTimes(a.time, b.time)),
        [activeTab, upcomingClients, historyClients]
    );

    return (
        <div className="px-6 py-4 space-y-6 page-animate h-full pb-24">

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-[var(--primary)]">Clients</h1>
                <p className="text-[var(--text-light)] text-sm mt-1">Manage your schedule and history</p>
            </div>

            {/* Search (Optional UI element for completeness) */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-light)]" size={20} />
                <input
                    type="text"
                    placeholder="Search clients..."
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-[var(--primary)] transition-colors"
                />
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-gray-100 rounded-xl">
                <button
                    onClick={() => setActiveTab('upcoming')}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'upcoming' ? 'bg-white shadow-sm text-[var(--primary)]' : 'text-gray-500'}`}
                >
                    Upcoming
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-[var(--primary)]' : 'text-gray-500'}`}
                >
                    History
                </button>
            </div>

            {/* List */}
            <div className="space-y-4">
                {loading && <p className="text-[var(--text-muted)] font-medium">Loading clients...</p>}
                {error && <p className="text-red-500 font-medium">{error}</p>}
                {!loading && !error && currentList.map(client => (
                    <div key={client.id} className="bg-white p-4 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-[var(--border-color)] flex items-center gap-4">
                        <img src={client.image} alt={client.name} className="w-12 h-12 rounded-full" />
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-[var(--text-main)] truncate">{client.name}</h3>
                            <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-light)]">
                                <CalendarIcon size={12} />
                                <span>{client.date} • {formatTo24h(client.time) || '--:--'}</span>
                            </div>
                        </div>

                        {/* Status/Action area based on tab */}
                        {activeTab === 'upcoming' ? (
                            <div className="text-right">
                                <p className="text-xs font-semibold text-[var(--primary)] bg-indigo-50 px-2 py-1 rounded-md inline-block">
                                    {client.services}
                                </p>
                            </div>
                        ) : (
                            <div>
                                {client.status === 'completed' ? (
                                    <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-md">
                                        <CheckCircle2 size={14} />
                                        <span className="text-xs font-bold uppercase tracking-wider">Done</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 text-red-500 bg-red-50 px-2 py-1 rounded-md">
                                        <XCircle size={14} />
                                        <span className="text-xs font-bold uppercase tracking-wider">Cancelled</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {!loading && !error && currentList.length === 0 && (
                    <div className="text-center py-10">
                        <div className="inline-block p-4 rounded-full bg-gray-50 mb-3">
                            <Clock size={32} className="text-gray-300" />
                        </div>
                        <p className="text-[var(--text-muted)] font-medium">No clients found</p>
                    </div>
                )}
            </div>

        </div>
    );
}

export default Clients;
