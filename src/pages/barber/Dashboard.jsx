import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ChevronRight, CheckCircle, Coffee, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { bookingMatchesBarber, getBookings, updateBookingStatus } from '../../api/bookingApi.js'; // updateBookingStatus qo'shildi
import { getClients } from '../../api/clientApi.js';
import { compareTimes, formatTo24h, isWithinWorkingHours, getCurrentTime } from '../../utils/time.js';

const WORK_STATUS_KEY = 'navbatgo_work_status';

// Oddiy avatar komponenti
const SimpleAvatar = ({ name, size = "w-12 h-12" }) => (
    <div className={`${size} rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm`}>
        <span className="text-primary font-bold text-lg">
            {name?.charAt(0).toUpperCase() || 'C'}
        </span>
    </div>
);

function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [isWorking, setIsWorking] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(WORK_STATUS_KEY));
            if (saved && typeof saved.isWorking === 'boolean') return saved.isWorking;
        } catch { localStorage.removeItem(WORK_STATUS_KEY); }
        const wh = user?.working_hours || user?.workingHours || '';
        return isWithinWorkingHours(wh);
    });

    const [bookings, setBookings] = useState([]);
    const [clientsById, setClientsById] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadDashboard = useCallback(async () => {
        setLoading(true);
        const [{ data: bookingList, error: bookingError }, { data: clients }] = await Promise.all([
            getBookings(),
            getClients(),
        ]);

        if (bookingError) {
            setError(bookingError);
            setLoading(false);
            return;
        }

        const filteredBookings = (bookingList ?? []).filter((booking) =>
            bookingMatchesBarber(booking.barber, user?.id) ||
            bookingMatchesBarber(booking.barber, user?._id)
        );

        setBookings(filteredBookings);
        setClientsById(Object.fromEntries((clients ?? []).map((client) => [client.id, client])));
        setLoading(false);
    }, [user?.id]);

    useEffect(() => {
        loadDashboard();
        const refreshInterval = setInterval(loadDashboard, 15000);
        return () => clearInterval(refreshInterval);
    }, [loadDashboard]);

    // Statusni o'zgartirish funksiyasi (Asosiy mantiq)
    const handleStatusUpdate = useCallback(async (bookingId, newStatus) => {
        try {
            const { error } = await updateBookingStatus(bookingId, { status: newStatus });
            if (!error) {
                // Lokal holatni yangilash (darhol ko'rinishi uchun)
                setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
            }
        } catch (err) {
            console.error("Status update failed", err);
        }
    }, []);

    // Auto-cancel any pending/accepted bookings whose time has already passed
    useEffect(() => {
        if (bookings.length === 0) return;
        const now = getCurrentTime();
        const overdue = bookings.filter(b => {
            const status = b.status?.toLowerCase();
            const isActive = ['pending', 'accepted'].includes(status);
            const bookingTime = formatTo24h(b.booking_hours);
            return isActive && bookingTime && bookingTime < now;
        });
        overdue.forEach(b => handleStatusUpdate(b.id, 'cancelled'));
    }, [bookings, handleStatusUpdate]);

    const handleToggleWork = useCallback(() => {
        setIsWorking(prev => {
            const next = !prev;
            localStorage.setItem(WORK_STATUS_KEY, JSON.stringify({ isWorking: next, updatedAt: new Date().toISOString() }));
            return next;
        });
    }, []);

    // 1. Current Session (Hozirgi mijoz - status: 'in_progress')
    const activeSession = useMemo(() => {
        const session = bookings.find(b => b.status === 'in_progress');
        if (!session) return null;
        const client = session.clientData || clientsById[session.client];
        return { ...session, clientName: client?.name || client?.fullname || 'Mijoz' };
    }, [bookings, clientsById]);

    // 2. Upcoming Bookings (Navbatdagilar - status: 'pending' yoki 'accepted')
    const upcomingBookings = useMemo(() =>
        bookings
            .filter(b => ['pending', 'accepted'].includes(b.status?.toLowerCase()))
            .sort((a, b) => compareTimes(a.booking_hours, b.booking_hours)),
        [bookings]
    );

    const nextClient = upcomingBookings[0];
    const laterClients = upcomingBookings.slice(1, 4);

    // Auto-start nextClient when their time comes
    useEffect(() => {
        if (!nextClient) return;

        const checkAutoStart = async () => {
            const nextTime = formatTo24h(nextClient.booking_hours);
            const currentTime = getCurrentTime();

            if (nextTime && nextTime <= currentTime) {
                if (nextClient.status !== 'in_progress') {
                    await handleStatusUpdate(nextClient.id, 'in_progress');
                }
            }
        };

        checkAutoStart();
        const interval = setInterval(checkAutoStart, 30000); // Check every 30 seconds
        return () => clearInterval(interval);
    }, [nextClient, handleStatusUpdate]);

    return (
        <div className="px-6 py-4 space-y-8 page-animate h-full pb-24 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-gray-500 font-medium">Bugungi navbatlar nazorati</p>
                </div>
                <div className="text-right">
                    <p className="text-xs uppercase text-gray-400 font-bold tracking-widest">Holat</p>
                    <button
                        onClick={handleToggleWork}
                        className={`mt-1 px-3 py-1 rounded-full text-xs font-bold transition-all ${isWorking ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}
                    >
                        {isWorking ? "● ISHLAYAPMAN" : "● TANAFFUS"}
                    </button>
                </div>
            </div>

            {/* CURRENT SESSION CARD */}
            <section>
                <h2 className="text-xs font-bold uppercase text-gray-400 mb-4 tracking-widest">Hozirgi Jarayon</h2>
                {activeSession ? (
                    <div className="bg-primary rounded-3xl p-6 text-white shadow-xl shadow-primary/20 relative overflow-hidden">
                        <div className="flex items-center gap-4 relative z-10">
                            <SimpleAvatar name={activeSession.clientName} size="w-16 h-16 bg-white/20" />
                            <div className="flex-1">
                                <h3 className="text-xl font-bold">{activeSession.clientName}</h3>
                                <div className="flex items-center gap-2 mt-1 opacity-90">
                                    <Clock size={14} />
                                    <span className="text-sm font-medium">{formatTo24h(activeSession.booking_hours)} da boshlangan</span>
                                </div>
                            </div>
                            <button
                                onClick={() => handleStatusUpdate(activeSession.id, 'completed')}
                                className="bg-white text-primary p-3 rounded-2xl font-bold hover:bg-gray-100 active:scale-95 transition-all shadow-lg flex flex-col items-center gap-1"
                            >
                                <CheckCircle size={20} />
                                <span className="text-[10px]">TUGATISH</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-8 text-center">
                        <Coffee className="mx-auto text-gray-300 mb-2" size={32} />
                        <p className="text-gray-500 font-medium text-sm">Hozircha hech kim yo'q. <br />Navbatdagi mijozni boshlang.</p>
                    </div>
                )}
            </section>

            {/* NEXT CLIENT CARD */}
            {nextClient && (() => {
                const nextTime = formatTo24h(nextClient.booking_hours);
                const now = getCurrentTime();
                const isOverdue = nextTime && nextTime < now;
                return (
                    <section>
                        <h2 className="text-xs font-bold uppercase text-gray-400 mb-4 tracking-widest">Navbatdagi Mijoz</h2>
                        <div className={`bg-white border rounded-3xl p-5 shadow-sm flex items-center gap-4 ${isOverdue ? 'border-red-100 bg-red-50/30' : 'border-gray-100'}`}>
                            <SimpleAvatar name={nextClient.clientData?.name || "C"} />
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-800">{nextClient.clientData?.name || 'Mijoz'}</h3>
                                <p className={`font-bold text-sm ${isOverdue ? 'text-red-400' : 'text-primary'}`}>
                                    {formatTo24h(nextClient.booking_hours)}
                                    {isOverdue && <span className="ml-2 text-[10px] uppercase tracking-wider">• Kechikdi</span>}
                                </p>
                            </div>
                            {isOverdue ? (
                                <button
                                    onClick={() => handleStatusUpdate(nextClient.id, 'cancelled')}
                                    className="flex flex-col items-center gap-1 p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 active:scale-95 transition-all"
                                >
                                    <XCircle size={20} />
                                    <span className="text-[10px] font-black uppercase">Bekor</span>
                                </button>
                            ) : (
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        Kutilmoqda...
                                    </span>
                                </div>
                            )}
                        </div>
                    </section>
                );
            })()}

            {/* LATER TODAY LIST */}
            {laterClients.length > 0 && (
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs font-bold uppercase text-gray-400 tracking-widest">Keyingi Navbatlar</h2>
                        <button onClick={() => navigate('/barber/appointments')} className="text-primary text-xs font-bold flex items-center gap-1">
                            Hammasi <ChevronRight size={14} />
                        </button>
                    </div>
                    <div className="space-y-3">
                        {laterClients.map((booking) => {
                            const bTime = formatTo24h(booking.booking_hours);
                            const now = getCurrentTime();
                            const isOverdue = bTime && bTime < now;
                            return (
                                <div key={booking.id} className={`flex items-center gap-4 p-3 rounded-2xl border transition-all ${isOverdue ? 'bg-red-50/40 border-red-100' : 'bg-white/50 border-gray-50'}`}>
                                    <SimpleAvatar name={booking.clientData?.name || "C"} size="w-10 h-10" />
                                    <div className="flex-1">
                                        <h4 className="text-sm font-bold text-gray-700">{booking.clientData?.name || 'Mijoz'}</h4>
                                        <p className={`text-xs font-bold ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
                                            {bTime}{isOverdue && ' • Kechikdi'}
                                        </p>
                                    </div>
                                    {isOverdue && (
                                        <button
                                            onClick={() => handleStatusUpdate(booking.id, 'cancelled')}
                                            className="p-2 bg-red-50 text-red-400 rounded-xl hover:bg-red-100 active:scale-95 transition-all"
                                        >
                                            <XCircle size={16} />
                                        </button>
                                    )}
                                    {!isOverdue && (
                                        <div className="text-sm font-bold text-gray-400">
                                            {bTime}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
    );
}

export default Dashboard;




