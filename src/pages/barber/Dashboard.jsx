import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ChevronRight, Check, X, Coffee, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { bookingMatchesBarber, getBookings, updateBookingStatus } from '../../api/bookingApi.js';
import { getClients } from '../../api/clientApi.js';
import { compareTimes, formatTo24h, isWithinWorkingHours, getCurrentTime } from '../../utils/time.js';

const WORK_STATUS_KEY = 'navbatgo_work_status';

function toDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getBookingDateStr(booking) {
    const raw = booking.booking_date ?? booking.date ?? booking.createdAt ?? booking.created_at ?? null;
    if (!raw) return null;
    try { return toDateStr(new Date(raw)); } catch { return null; }
}

const SimpleAvatar = ({ name, size = "w-12 h-12" }) => (
    <div className={`${size} rounded-2xl bg-[#f8f8f8] flex items-center justify-center border border-black/5 shrink-0`}>
        <span className="text-[#111] font-bold text-sm">
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

        const filteredBookings = (bookingList ?? []).filter((booking) => {
            return bookingMatchesBarber(booking.barber, user?.id) || bookingMatchesBarber(booking.barber, user?._id);
        });

        setBookings(filteredBookings);
        setClientsById(Object.fromEntries((clients ?? []).map((client) => [client.id, client])));
        setLoading(false);
    }, [user?.id]);

    useEffect(() => {
        loadDashboard();
        const refreshInterval = setInterval(loadDashboard, 15000);
        return () => clearInterval(refreshInterval);
    }, [loadDashboard]);

    const handleStatusUpdate = useCallback(async (bookingId, newStatus) => {
        try {
            const { error } = await updateBookingStatus(bookingId, { status: newStatus });
            if (!error) {
                setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
            }
        } catch (err) {
            console.error("Status update failed", err);
        }
    }, []);

    useEffect(() => {
        if (bookings.length === 0) return;
        const now = getCurrentTime();
        const overdue = bookings.filter(b => {
            const status = b.status?.toLowerCase();
            const isActive = ['accepted'].includes(status);

            const bDate = getBookingDateStr(b);
            const todayStr = toDateStr(new Date());
            const isToday = bDate === todayStr || !bDate;

            const bookingTime = formatTo24h(b.booking_hours);
            return isActive && isToday && bookingTime && bookingTime < now;
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

    const activeSession = useMemo(() => {
        const todayStr = toDateStr(new Date());
        const session = bookings.find(b => {
            if (b.status !== 'in_progress') return false;
            const bDate = getBookingDateStr(b);
            return bDate === todayStr || !bDate;
        });
        if (!session) return null;
        const client = session.clientData || clientsById[session.client];
        return { ...session, clientName: client?.name || client?.fullname || 'Mijoz' };
    }, [bookings, clientsById]);

    const upcomingBookings = useMemo(() => {
        const todayStr = toDateStr(new Date());
        return bookings
            .filter(b => {
                const bDate = getBookingDateStr(b);
                const isToday = bDate === todayStr || !bDate;
                return isToday && ['accepted'].includes(b.status?.toLowerCase());
            })
            .sort((a, b) => compareTimes(a.booking_hours, b.booking_hours));
    }, [bookings]);

    const pendingRequests = useMemo(() =>
        bookings
            .filter(b => b.status?.toLowerCase() === 'pending')
            .sort((a, b) => compareTimes(a.booking_hours, b.booking_hours)),
        [bookings]
    );

    const nextClient = upcomingBookings[0];
    const laterClients = upcomingBookings.slice(1, 4);

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
        const interval = setInterval(checkAutoStart, 30000);
        return () => clearInterval(interval);
    }, [nextClient, handleStatusUpdate]);

    return (
        <div className="min-h-screen bg-[#f5f5f7] px-4 py-8 sm:px-6 sm:py-12 space-y-8 page-animate h-full pb-24 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-[28px] font-bold text-[#111] tracking-[-0.03em] leading-tight">Dashboard</h1>
                    <p className="text-sm text-[#666] font-medium mt-1">Bugungi navbatlar nazorati</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] uppercase text-[#888] font-bold tracking-[0.12em]">Holat</p>
                    <button
                        onClick={handleToggleWork}
                        className={`mt-2 px-4 py-2 border rounded-full text-xs font-bold transition-all duration-200 ${isWorking ? 'bg-[#f8f8f8] border-black/5 text-[#111] shadow-sm' : 'bg-red-50 border-red-100 text-red-500'}`}
                    >
                        {isWorking ? "● ISHLAYAPMAN" : "● TANAFFUS"}
                    </button>
                </div>
            </div>

            {/* PENDING REQUESTS */}
            {pendingRequests.length > 0 && (
                <section>
                    <h2 className="text-[10px] font-bold uppercase text-[#888] mb-4 tracking-[0.12em] flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#378ADD] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#378ADD]"></span>
                        </span>
                        Yangi So'rovlar
                    </h2>
                    <div className="space-y-3">
                        {pendingRequests.map(request => (
                            <div key={request.id} className="bg-white border border-black/5 rounded-[28px] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.06)] flex items-center gap-4 hover:shadow-[0_15px_50px_rgba(0,0,0,0.08)] transition-all duration-200">
                                <SimpleAvatar name={request.clientData?.name || "Y"} />
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-[#111] truncate">{request.clientData?.name || 'Yangi Mijoz'}</h3>
                                    <p className="text-xs text-[#666] font-semibold mt-0.5">{request.service_name || 'Soch turmagi'}</p>
                                    <p className="font-bold text-xs text-[#111] mt-1 flex flex-wrap gap-x-2 gap-y-0.5 items-center">
                                        <span>{formatTo24h(request.booking_hours)}</span>
                                        {(() => {
                                            const bDate = getBookingDateStr(request);
                                            const todayStr = toDateStr(new Date());
                                            if (bDate && bDate !== todayStr) {
                                                const d = new Date(bDate);
                                                return <span className="text-[9px] text-[#888] font-bold uppercase tracking-wider">{d.toLocaleDateString('uz-UZ', { weekday: 'short', month: 'short', day: 'numeric' })}</span>;
                                            }
                                            return <span className="text-[9px] text-[#888] font-bold uppercase tracking-wider">Bugun</span>;
                                        })()}
                                    </p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <button
                                        onClick={() => handleStatusUpdate(request.id, 'accepted')}
                                        className="w-10 h-10 bg-[#378ADD] text-white rounded-2xl flex items-center justify-center hover:bg-[#185FA5] active:scale-95 transition-all shadow-[0_4px_15px_rgba(55,138,221,0.25)]"
                                    >
                                        <Check size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleStatusUpdate(request.id, 'rejected')}
                                        className="w-10 h-10 bg-[#f8f8f8] border border-black/5 text-[#888] rounded-2xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-100 active:scale-95 transition-all"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* CURRENT SESSION CARD */}
            <section>
                <h2 className="text-[10px] font-bold uppercase text-[#888] mb-4 tracking-[0.12em]">Hozirgi Jarayon</h2>
                {activeSession ? (
                    <div className="bg-white border border-black/5 rounded-[28px] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)] flex items-center gap-4 hover:shadow-[0_15px_50px_rgba(0,0,0,0.08)] transition-all duration-200">
                        <SimpleAvatar name={activeSession.clientName} size="w-14 h-14" />
                        <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-[#111] truncate">{activeSession.clientName}</h3>
                            <p className="text-sm text-[#666] font-medium mt-0.5">{activeSession.service_name || 'Soch turmagi'}</p>
                            <div className="flex items-center gap-1.5 mt-1.5 text-[#888] font-semibold">
                                <Clock size={13} />
                                <span className="text-xs">{formatTo24h(activeSession.booking_hours)} da boshlangan</span>
                            </div>
                        </div>
                        <button
                            onClick={() => handleStatusUpdate(activeSession.id, 'completed')}
                            className="bg-[#378ADD] text-white h-12 px-5 rounded-2xl font-semibold text-xs hover:bg-[#185FA5] active:scale-95 transition-all shadow-[0_4px_15px_rgba(55,138,221,0.25)] flex items-center gap-1 shrink-0"
                        >
                            <Check size={14} />
                            <span>TUGATISH</span>
                        </button>
                    </div>
                ) : (
                    <div className="bg-[#f8f8f8] border border-dashed border-black/10 rounded-[28px] p-8 text-center">
                        <Coffee className="mx-auto text-[#aaa] mb-3" size={28} />
                        <p className="text-[#666] font-medium text-sm">Hozircha hech kim yo'q.</p>
                        <p className="text-xs text-[#888] font-medium mt-0.5">Navbatdagi mijozni boshlang.</p>
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
                        <h2 className="text-[10px] font-bold uppercase text-[#888] mb-4 tracking-[0.12em]">Navbatdagi Mijoz</h2>
                        <div className={`bg-white border rounded-[28px] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.06)] flex items-center gap-4 ${isOverdue ? 'border-red-100 bg-red-50/20' : 'border-black/5'}`}>
                            <SimpleAvatar name={nextClient.clientData?.name || "C"} />
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-[#111] truncate">{nextClient.clientData?.name || 'Mijoz'}</h3>
                                <p className="text-xs text-[#666] font-semibold mt-0.5">{nextClient.service_name || 'Soch turmagi'}</p>
                                <p className={`font-bold text-xs mt-1.5 flex items-center gap-2 ${isOverdue ? 'text-red-500' : 'text-[#111]'}`}>
                                    <span>{formatTo24h(nextClient.booking_hours)}</span>
                                    {isOverdue && <span className="text-[9px] bg-red-50 text-red-500 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-red-100">Kechikdi</span>}
                                </p>
                            </div>
                            {isOverdue ? (
                                <button
                                    onClick={() => handleStatusUpdate(nextClient.id, 'cancelled')}
                                    className="h-10 px-4 bg-red-50 border border-red-100 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all duration-200 font-bold text-xs flex items-center gap-1.5 shrink-0"
                                >
                                    <Trash2 size={13} />
                                    <span>BEKOR</span>
                                </button>
                            ) : (
                                <div className="text-[10px] bg-[#f8f8f8] border border-black/5 text-[#888] font-bold px-3 py-1.5 rounded-xl uppercase tracking-wider shrink-0">
                                    Kutilmoqda
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
                        <h2 className="text-[10px] font-bold uppercase text-[#888] tracking-[0.12em]">Keyingi Navbatlar</h2>
                        <button onClick={() => navigate('/barber/appointments')} className="text-[#111] text-xs font-bold flex items-center gap-1">
                            Hammasi <ChevronRight size={14} />
                        </button>
                    </div>
                    <div className="space-y-3">
                        {laterClients.map((booking) => {
                            const bTime = formatTo24h(booking.booking_hours);
                            const now = getCurrentTime();
                            const isOverdue = bTime && bTime < now;
                            return (
                                <div key={booking.id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 ${isOverdue ? 'bg-red-50/20 border-red-100 shadow-sm' : 'bg-white border-black/5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]'}`}>
                                    <SimpleAvatar name={booking.clientData?.name || "C"} size="w-10 h-10" />
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold text-[#111] truncate">{booking.clientData?.name || 'Mijoz'}</h4>
                                        <p className="text-[11px] text-[#666] font-semibold mt-0.5">{booking.service_name || 'Soch turmagi'}</p>
                                        <p className={`text-xs font-bold mt-1 ${isOverdue ? 'text-red-400' : 'text-[#666]'}`}>
                                            {bTime}{isOverdue && ' • Kechikdi'}
                                        </p>
                                    </div>
                                    {isOverdue && (
                                        <button
                                            onClick={() => handleStatusUpdate(booking.id, 'cancelled')}
                                            className="p-2.5 bg-red-50 text-red-500 border border-red-100 rounded-xl hover:bg-red-500 hover:text-white transition-all duration-200 shrink-0"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                    {!isOverdue && (
                                        <div className="text-xs font-bold text-[#111] bg-[#f8f8f8] border border-black/5 px-2.5 py-1.5 rounded-xl">
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
