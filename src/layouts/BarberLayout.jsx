import { Outlet, NavLink } from 'react-router-dom';
import { Home, Calendar, Users, Settings, Bell, Check, X, Phone, Clock } from "lucide-react";
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getBookings, updateBookingStatus } from '../api/bookingApi.js';
import { getClients } from '../api/clientApi.js';

const tabs = [
    { id: "home", label: "HOME", icon: Home, path: "/barber/dashboard" },
    { id: "schedule", label: "SCHEDULE", icon: Calendar, path: "/barber/appointments" },
    { id: "clients", label: "CLIENTS", icon: Users, path: "/barber/clients" },
    { id: "settings", label: "SETTINGS", icon: Settings, path: "/barber/settings" },
];

function BarberLayout() {
    const { user } = useAuth();
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [pendingBookings, setPendingBookings] = useState([]);
    const [clientsById, setClientsById] = useState({});
    const [pendingUpdateId, setPendingUpdateId] = useState(null);
    const notificationRef = useRef(null);

    useEffect(() => {
        let mounted = true;
        async function fetchNotifications() {
            try {
                const [{ data: bookingList }, { data: clients }] = await Promise.all([
                    getBookings(),
                    getClients(),
                ]);

                if (!mounted) return;

                // Filter pending bookings for current barber
                const pending = (bookingList ?? []).filter(booking =>
                    booking.barber === user?.id && booking.status === 'pending'
                );

                setPendingBookings(pending);
                setClientsById(Object.fromEntries((clients ?? []).map(client => [client.id, client])));

                console.log('[NOTIFICATIONS] Pending bookings:', pending.length);
            } catch (error) {
                console.error('[NOTIFICATIONS] Error fetching:', error);
            }
        }

        fetchNotifications();

        // Refresh notifications every 10 seconds
        const interval = setInterval(fetchNotifications, 10000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [user?.id]);

    const handleAcceptBooking = async (bookingId) => {
        console.log('[NOTIFICATIONS] Accepting booking:', bookingId);
        setPendingUpdateId(bookingId);
        try {
            const { error } = await updateBookingStatus(bookingId, { status: 'accepted' });
            if (error) {
                console.error('[NOTIFICATIONS] Failed to accept booking:', error);
                setPendingUpdateId(null);
                return;
            }
            // Update local state after successful API call
            setPendingBookings(prev => prev.filter(b => b.id !== bookingId));
            console.log('[NOTIFICATIONS] Booking accepted successfully');
        } catch (error) {
            console.error('[NOTIFICATIONS] Error accepting booking:', error);
        } finally {
            setPendingUpdateId(null);
        }
    };

    const handleRejectBooking = async (bookingId) => {
        console.log('[NOTIFICATIONS] Rejecting booking:', bookingId);
        setPendingUpdateId(bookingId);
        try {
            const { error } = await updateBookingStatus(bookingId, { status: 'rejected' });
            if (error) {
                console.error('[NOTIFICATIONS] Failed to reject booking:', error);
                setPendingUpdateId(null);
                return;
            }
            // Update local state after successful API call
            setPendingBookings(prev => prev.filter(b => b.id !== bookingId));
            console.log('[NOTIFICATIONS] Booking rejected successfully');
        } catch (error) {
            console.error('[NOTIFICATIONS] Error rejecting booking:', error);
        } finally {
            setPendingUpdateId(null);
        }
    };

    const notificationCount = pendingBookings.length;

    // Close notifications when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setNotificationsOpen(false);
            }
        }

        if (notificationsOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [notificationsOpen]);

    return (
        <div className="w-full min-h-screen flex flex-col justify-between bg-[#f5f5f7]">

            {/* HEADER */}
            <header className="w-full fixed top-0 z-10 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-black/5">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-black flex items-center justify-center">
                        <img
                            src="/Scissor.png"
                            alt="logo"
                            className="w-5 h-5 object-contain invert"
                            onError={e => e.target.style.display = 'none'}
                        />
                    </div>
                    <h1 className="text-lg font-bold text-[#111] tracking-[-0.03em]">
                        NavbatGo
                    </h1>
                </div>

                <div className="relative" ref={notificationRef}>
                    <button
                        onClick={() => setNotificationsOpen(!notificationsOpen)}
                        className="relative w-10 h-10 bg-[#f8f8f8] border border-black/5 rounded-2xl flex items-center justify-center hover:bg-[#f0f0f0] transition-all duration-200"
                    >
                        <Bell size={18} className="text-[#111]" />
                        {notificationCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-black text-white text-[10px] font-bold rounded-full w-4.5 h-4.5 min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                {notificationCount}
                            </span>
                        )}
                    </button>

                    {/* Notification Dropdown */}
                    {notificationsOpen && (
                        <div className="absolute right-0 mt-3 w-96 bg-white rounded-[28px] border border-black/5 shadow-[0_20px_60px_rgba(0,0,0,0.1)] z-50 max-h-[480px] overflow-y-auto">
                            <div className="p-6 border-b border-black/5 sticky top-0 bg-white rounded-t-[28px]">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-[18px] font-bold text-[#111] tracking-[-0.02em]">New Bookings</h3>
                                        <p className="text-sm text-[#666] font-medium mt-0.5">
                                            {notificationCount} pending booking{notificationCount !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setNotificationsOpen(false)}
                                        className="w-8 h-8 bg-[#f8f8f8] border border-black/5 rounded-full flex items-center justify-center hover:bg-[#f0f0f0] transition-all"
                                    >
                                        <X size={14} className="text-[#111]" />
                                    </button>
                                </div>
                            </div>

                            {pendingBookings.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                                    <div className="w-14 h-14 bg-[#f8f8f8] rounded-3xl flex items-center justify-center mb-4 border border-black/5">
                                        <Bell size={24} className="text-[#999]" />
                                    </div>
                                    <p className="font-bold text-[#111] text-sm">No pending bookings</p>
                                    <p className="text-xs text-[#666] mt-1 font-medium">All caught up! No pending requests.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-black/5">
                                    {pendingBookings.map((booking) => {
                                        const client = clientsById[booking.client] || booking.clientData;
                                        return (
                                            <div key={booking.id} className="p-5 hover:bg-[#fafafa] transition-colors">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-10 h-10 rounded-2xl bg-[#f8f8f8] border border-black/5 flex items-center justify-center shrink-0">
                                                        <span className="text-[#111] font-bold text-sm">
                                                            {(client?.name || client?.fullname || 'C').charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-[#111] text-sm truncate">
                                                            {client?.name || client?.fullname || 'Client'}
                                                        </h4>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <div className="flex items-center gap-1 text-xs text-[#666] font-medium">
                                                                <Clock size={12} />
                                                                <span>{booking.booking_hours}</span>
                                                            </div>
                                                            <span className="text-[10px] bg-[#f8f8f8] border border-black/5 text-[#666] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Pending</span>
                                                        </div>
                                                        {client?.phone && (
                                                            <div className="flex items-center gap-1 text-xs text-[#666] font-medium mt-1">
                                                                <Phone size={12} />
                                                                <span>{client.phone}</span>
                                                            </div>
                                                        )}

                                                        <div className="flex gap-2 mt-3">
                                                            <button
                                                                onClick={() => handleAcceptBooking(booking.id)}
                                                                className="flex-1 h-9 bg-black text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#111] transition-all disabled:opacity-50"
                                                                disabled={pendingUpdateId === booking.id}
                                                            >
                                                                {pendingUpdateId === booking.id ? (
                                                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                                ) : (
                                                                    <><Check size={12} />Accept</>
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => handleRejectBooking(booking.id)}
                                                                className="flex-1 h-9 bg-[#f8f8f8] border border-black/5 text-[#111] rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#f0f0f0] transition-all disabled:opacity-50"
                                                                disabled={pendingUpdateId === booking.id}
                                                            >
                                                                {pendingUpdateId === booking.id ? (
                                                                    <div className="w-3 h-3 border-2 border-black/10 border-t-[#111] rounded-full animate-spin" />
                                                                ) : (
                                                                    <><X size={12} />Reject</>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* MAIN CONTENT */}
            <main className="flex-1 pt-[72px] pb-[80px]">
                <Outlet />
            </main>

            {/* FOOTER NAV */}
            <footer className="w-full fixed bottom-0 bg-white/80 backdrop-blur-md border-t border-black/5 px-4 py-3 flex justify-around items-center">
                {tabs.map((tab) => {
                    const Icon = tab.icon;

                    return (
                        <NavLink
                            key={tab.id}
                            to={tab.path}
                            className={({ isActive }) =>
                                `flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all duration-200
                                ${isActive
                                    ? "bg-black text-white"
                                    : "text-[#888] hover:text-[#111]"}`
                            }
                        >
                            <Icon size={20} />
                            <span className="text-[9px] font-bold tracking-[0.08em]">
                                {tab.label}
                            </span>
                        </NavLink>
                    );
                })}
            </footer>
        </div>
    );
}

export default BarberLayout;