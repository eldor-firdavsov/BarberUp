import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Play, UserCircle, ChevronRight, Power } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [isWorking, setIsWorking] = useState(false);
    const [lunchStart, setLunchStart] = useState("13:00");
    const [lunchEnd, setLunchEnd] = useState("14:00");

    const [currentClient, setCurrentClient] = useState({
        id: 1,
        name: "John Doe",
        image: "https://i.pravatar.cc/150?u=1",
        startTime: Date.now() - 480000 // 8 minutes ago
    });

    const [nextClient, setNextClient] = useState({
        id: 2,
        name: "Alice Smith",
        image: "https://i.pravatar.cc/150?u=2",
        time: "14:00"
    });

    const [upcomingClients, setUpcomingClients] = useState([
        { id: 3, name: "Bob Johnson", image: "https://i.pravatar.cc/150?u=3", time: "15:00" },
        { id: 4, name: "Emma Davis", image: "https://i.pravatar.cc/150?u=4", time: "16:00" },
        { id: 5, name: "Michael Brown", image: "https://i.pravatar.cc/150?u=5", time: "17:00" }
    ]);

    const [timer, setTimer] = useState("00:00");

    useEffect(() => {
        if (!currentClient) return;
        const interval = setInterval(() => {
            const diff = Math.floor((Date.now() - currentClient.startTime) / 1000);
            const mins = String(Math.floor(diff / 60)).padStart(2, '0');
            const secs = String(diff % 60).padStart(2, '0');
            setTimer(`${mins}:${secs}`);
        }, 1000);
        return () => clearInterval(interval);
    }, [currentClient]);

    const handleNextClient = () => {
        if (nextClient) {
            setCurrentClient({ ...nextClient, startTime: Date.now() });
            setNextClient(upcomingClients[0] || null);
            setUpcomingClients(upcomingClients.slice(1));
        } else {
            setCurrentClient(null);
        }
    };

    return (
        <div className="px-6 py-4 space-y-8 page-animate h-full pb-24">

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-[var(--primary)]">Dashboard</h1>
                <p className="text-[var(--text-light)] text-sm mt-1">Manage your active sessions</p>
            </div>

            {/* WORK STATUS */}
            <div className="bg-white p-5 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-[var(--border-color)]">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-bold text-[var(--text-main)]">Work Status</h2>
                        <p className="text-sm text-[var(--text-light)]">
                            {isWorking ? "You are available for bookings" : "You are currently unavailable"}
                        </p>
                    </div>
                    <button
                        onClick={() => setIsWorking(!isWorking)}
                        className={`w-14 h-8 rounded-full flex items-center p-1 transition-colors duration-300 ${isWorking ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                        <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ${isWorking ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </button>
                </div>

                <div className="pt-4 border-t border-[var(--border-color)]">
                    <p className="text-sm font-semibold text-[var(--text-muted)] mb-2">Lunch Break (Auto-unavailable)</p>
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <input
                                type="time"
                                value={lunchStart}
                                onChange={(e) => setLunchStart(e.target.value)}
                                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)]"
                            />
                        </div>
                        <span className="text-[var(--text-light)]">to</span>
                        <div className="flex-1">
                            <input
                                type="time"
                                value={lunchEnd}
                                onChange={(e) => setLunchEnd(e.target.value)}
                                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)]"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* CURRENT CLIENT */}
            <div>
                <h2 className="text-sm font-bold text-[var(--text-muted)] mb-3 mx-1 uppercase tracking-wider">Current Session</h2>
                {currentClient ? (
                    <div className="bg-[var(--primary)] text-white p-5 rounded-2xl shadow-lg relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 opacity-10">
                            <Clock size={100} />
                        </div>
                        <div className="flex items-center gap-4 relative z-10">
                            <img src={currentClient.image} alt={currentClient.name} className="w-16 h-16 rounded-full border-2 border-white/20" />
                            <div>
                                <h3 className="text-xl font-bold">{currentClient.name}</h3>
                                <div className="flex items-center gap-2 mt-1 text-white/80 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                                    <span>In Progress</span>
                                </div>
                            </div>
                            <div className="ml-auto text-right">
                                <div className="text-3xl font-bold tracking-widest">{timer}</div>
                                <span className="text-white/60 text-xs uppercase tracking-widest">Elapsed</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-gray-50 border border-dashed border-gray-300 p-6 rounded-2xl text-center">
                        <UserCircle size={40} className="mx-auto text-gray-300 mb-2" />
                        <h3 className="text-gray-500 font-medium">No active client</h3>
                    </div>
                )}
            </div>

            {/* NEXT CLIENT */}
            {nextClient && (
                <div>
                    <h2 className="text-sm font-bold text-[var(--text-muted)] mb-3 mx-1 uppercase tracking-wider">Up Next</h2>
                    <div className="bg-white p-5 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-[var(--border-color)]">
                        <div className="flex items-center gap-4">
                            <img src={nextClient.image} alt={nextClient.name} className="w-12 h-12 rounded-full" />
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-[var(--text-main)]">{nextClient.name}</h3>
                                <p className="text-[var(--primary)] font-medium text-sm">{nextClient.time}</p>
                            </div>
                            <button
                                onClick={handleNextClient}
                                className="bg-[var(--primary)] text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-transform active:scale-95"
                            >
                                <Play size={16} fill="currentColor" />
                                Start
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* UPCOMING PREVIEW */}
            {upcomingClients.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-3 mx-1">
                        <h2 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider">Later Today</h2>
                        <button
                            onClick={() => navigate('/barber/clients')}
                            className="text-[var(--primary)] text-sm font-semibold flex items-center"
                        >
                            See All <ChevronRight size={16} />
                        </button>
                    </div>
                    <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-[var(--border-color)] overflow-hidden">
                        {upcomingClients.map((client, index) => (
                            <div key={client.id} className={`flex items-center gap-4 p-4 ${index !== upcomingClients.length - 1 ? 'border-b border-gray-100' : ''}`}>
                                <img src={client.image} alt={client.name} className="w-10 h-10 rounded-full" />
                                <div className="flex-1">
                                    <h3 className="font-semibold text-[var(--text-main)]">{client.name}</h3>
                                </div>
                                <div className="text-[var(--text-light)] font-medium text-sm">
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
