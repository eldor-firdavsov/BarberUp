import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Play, UserCircle, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { bookingMatchesBarber, getBookings } from '../../api/bookingApi.js';
import { getClients } from '../../api/clientApi.js';
import { compareTimes, formatTo24h, computeFinalWorkStatus } from '../../utils/time.js';

const WORK_STATUS_KEY = 'navbatgo_work_status';

function restoreManualStatus() {
    try {
        const saved = JSON.parse(localStorage.getItem(WORK_STATUS_KEY));
        if (saved && typeof saved.isWorking === 'boolean') {
            console.log('[WORK STATUS RESTORE] Found saved state:', saved);
            return saved.isWorking;
        }
    } catch (e) {
        console.error('[WORK STATUS RESTORE] Invalid JSON in localStorage', e);
        localStorage.removeItem(WORK_STATUS_KEY);
    }
    console.log('[WORK STATUS RESTORE] No saved state found — defaulting to OFF');
    return false;
}

function persistManualStatus(isWorking) {
    const payload = { isWorking, updatedAt: new Date().toISOString() };
    localStorage.setItem(WORK_STATUS_KEY, JSON.stringify(payload));
    console.log('[WORK STATUS TOGGLE] Saved:', payload);
}

function Dashboard() {
    const { user, updateSessionUser } = useAuth();
    const navigate = useNavigate();

    const [manualStatus, setManualStatus] = useState(() => restoreManualStatus());
    const [bookings, setBookings] = useState([]);
    const [clientsById, setClientsById] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const workingHours = user?.workingHours || '';
    const lunchStart = user?.lunchStart || '';
    const lunchEnd = user?.lunchEnd || '';

    const isWorking = useMemo(() => {
        return computeFinalWorkStatus(manualStatus, workingHours, lunchStart, lunchEnd);
    }, [manualStatus, workingHours, lunchStart, lunchEnd]);

    // Re-evaluate status every 30 seconds for time-based checks
    const [, setTick] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setTick((t) => t + 1), 30000);
        return () => clearInterval(interval);
    }, []);

    const handleToggle = useCallback(() => {
        const next = !manualStatus;
        setManualStatus(next);
        persistManualStatus(next);
        updateSessionUser({ isWorkingNow: next });
    }, [manualStatus, updateSessionUser]);

    useEffect(() => {
        let mounted = true;
        async function loadDashboard() {
            console.log('[DASHBOARD] Loading dashboard data...');
            setLoading(true);
            setError('');
            const [{ data: bookingList, error: bookingError }, { data: clients }] = await Promise.all([
                getBookings(),
                getClients(),
            ]);
            if (!mounted) return;
            if (bookingError) {
                setError(bookingError);
                setBookings([]);
                setLoading(false);
                return;
            }
            const filteredBookings = (bookingList ?? []).filter((booking) => bookingMatchesBarber(booking.barber, user?.id));
            console.log('[DASHBOARD] Filtered bookings for barber:', filteredBookings.length);
            setBookings(filteredBookings);
            setClientsById(Object.fromEntries((clients ?? []).map((client) => [client.id, client])));
            setLoading(false);
        }
        loadDashboard();
        
        // Set up periodic refresh for real-time updates
        const refreshInterval = setInterval(loadDashboard, 10000); // Refresh every 10 seconds
        
        return () => {
            mounted = false;
            clearInterval(refreshInterval);
        };
    }, [user?.id]);

    const upcomingBookings = useMemo(
        () => bookings
            .filter((booking) => ['pending', 'accepted'].includes((booking.status || '').toLowerCase()))
            .sort((a, b) => compareTimes(a.booking_hours, b.booking_hours)),
        [bookings]
    );

    const currentClient = useMemo(() => {
        const first = upcomingBookings[0];
        if (!first) return null;
        // Use clientData from booking if available, otherwise fallback to clientsById
        const client = first.clientData || clientsById[first.client];
        console.log('[DASHBOARD] currentClient booking=', first, 'client=', client);
        return {
            id: first.id,
            name: client?.name || client?.fullname || 'Client',
            image: "https://i.pravatar.cc/150?u=active-client",
            time: formatTo24h(first.booking_hours) || '--:--',
        };
    }, [upcomingBookings, clientsById]);

    const nextClient = useMemo(() => {
        const second = upcomingBookings[1];
        if (!second) return null;
        const client = second.clientData || clientsById[second.client];
        return {
            id: second.id,
            name: client?.name || client?.fullname || 'Client',
            image: "https://i.pravatar.cc/150?u=next-client",
            time: formatTo24h(second.booking_hours) || '--:--',
        };
    }, [upcomingBookings, clientsById]);

    const upcomingClients = useMemo(
        () => upcomingBookings.slice(2).map((booking) => {
            const client = booking.clientData || clientsById[booking.client];
            return {
                id: booking.id,
                name: client?.name || client?.fullname || 'Client',
                image: "https://i.pravatar.cc/150?u=later-client",
                time: formatTo24h(booking.booking_hours) || '--:--',
            };
        }),
        [upcomingBookings, clientsById]
    );

    return (
        <div className="px-6 py-4 space-y-8 page-animate h-full pb-24">

            {/* Header */}
            <div>
                <h1 className="text-h1">Dashboard</h1>
                <p className="text-body text-muted">Manage your active sessions</p>
                {loading && <div className="skeleton-text small mt-2"></div>}
                {error && (
                    <div className="error-container mt-4">
                        <div className="error-container-header">
                            <svg className="error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="error-title">Dashboard Error</span>
                        </div>
                        <p className="error-message">{error}</p>
                    </div>
                )}
            </div>

            {/* WORK STATUS */}
            <div className="card-base">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-h2 mb-2">Work Status</h2>
                        <p className="text-body text-muted">
                            {isWorking ? "You are available for bookings" : "You are currently unavailable"}
                        </p>
                    </div>
                    <button
                        onClick={handleToggle}
                        className={`w-16 h-9 rounded-full flex items-center p-1 transition-all duration-300 hover:scale-105 ${isWorking ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                        <div className={`bg-white w-7 h-7 rounded-full shadow-lg transform transition-transform duration-300 ${isWorking ? 'translate-x-7' : 'translate-x-0'}`}></div>
                    </button>
                </div>

                {(lunchStart || lunchEnd) && (
                <div className="pt-6 border-t border-[var(--border-color)]">
                    <div className="flex items-center gap-2 mb-3">
                        <Clock size={16} className="text-muted" />
                        <p className="text-label">Lunch Break (Auto-unavailable)</p>
                    </div>
                    <p className="text-body text-muted">
                        {lunchStart && lunchEnd ? `${lunchStart} — ${lunchEnd}` : 'Partially configured'}
                    </p>
                </div>
                )}
            </div>

            {/* CURRENT CLIENT */}
            <div>
                <h2 className="text-label uppercase tracking-wider mb-4">Current Session</h2>
                {currentClient ? (
                    <div className="card-base bg-gradient-to-r from-[var(--primary)] to-purple-600 text-white relative overflow-hidden hover:transform hover:-translate-y-1 transition-all">
                        <div className="absolute -right-4 -top-4 opacity-10">
                            <Clock size={120} />
                        </div>
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="relative">
                                <img src={currentClient.image} alt={currentClient.name} className="w-16 h-16 rounded-full border-3 border-white/20 shadow-lg" />
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-h2 text-white mb-2">{currentClient.name}</h3>
                                <div className="flex items-center gap-2">
                                    <span className="status-badge success">In Progress</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-small text-white/60 mb-1">Session Time</p>
                                <p className="text-h3 text-white">{currentClient.time}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <UserCircle size={40} className="text-gray-400" />
                        </div>
                        <h3 className="empty-state-title">No active client</h3>
                        <p className="empty-state-description">
                            You don't have any active sessions right now
                        </p>
                    </div>
                )}
            </div>

            {/* NEXT CLIENT */}
            {nextClient && (
                <div>
                    <h2 className="text-label uppercase tracking-wider mb-4">Up Next</h2>
                    <div className="card-base hover:transform hover:-translate-y-1 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <img src={nextClient.image} alt={nextClient.name} className="w-14 h-14 rounded-full shadow-md" />
                                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-orange-400 rounded-full border-2 border-white"></div>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-h2 mb-1">{nextClient.name}</h3>
                                <p className="text-body text-primary font-medium">{nextClient.time}</p>
                            </div>
                            <button
                                onClick={() => navigate('/barber/appointments')}
                                className="btn-primary btn-sm flex items-center gap-2 hover:scale-105 transition-transform"
                            >
                                <Play size={16} fill="currentColor" />
                                Start Session
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* UPCOMING PREVIEW */}
            {upcomingClients.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-label uppercase tracking-wider">Later Today</h2>
                        <button
                            onClick={() => navigate('/barber/clients')}
                            className="btn-ghost btn-sm flex items-center gap-1 text-primary hover:scale-105 transition-transform"
                        >
                            See All <ChevronRight size={16} />
                        </button>
                    </div>
                    <div className="card-base overflow-hidden">
                        {upcomingClients.map((client, index) => (
                            <div key={client.id} className={`flex items-center gap-4 p-4 transition-colors hover:bg-gray-50 ${index !== upcomingClients.length - 1 ? 'border-b border-gray-100' : ''}`}>
                                <img src={client.image} alt={client.name} className="w-12 h-12 rounded-full shadow-sm" />
                                <div className="flex-1">
                                    <h3 className="text-body font-semibold">{client.name}</h3>
                                </div>
                                <div className="text-body text-muted font-medium">
                                    {client.time}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Dashboard;
