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
        <div className="w-full min-h-screen flex flex-col justify-between bg-white">

            {/* HEADER */}
            <header className="w-full fixed  top-0 z-10  flex items-center justify-between px-6 py-4 bg-gray-100">
                <div className="flex items-center gap-4">
                    <img
                        src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
                        alt="avatar"
                        className="w-14 h-14 rounded-full"
                    />
                    <h1 className="text-3xl font-bold text-indigo-700">
                        NavbatGo
                    </h1>
                </div>

                <div className="relative" ref={notificationRef}>
                    <button
                        onClick={() => setNotificationsOpen(!notificationsOpen)}
                        className="relative text-indigo-700 hover:text-indigo-800 transition-colors"
                    >
                        <Bell size={28} />
                        {notificationCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                {notificationCount}
                            </span>
                        )}
                    </button>

                    {/* Notification Dropdown */}
                    {notificationsOpen && (
                        <div className="absolute z-90 right-0 mt-3 w-96 card-base shadow-2xl z-50 max-h-96 overflow-y-auto animate-in slide-in-from-top-2 fade-in-0 duration-200">
                            <div className="p-6 border-b border-gray-100">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-h2">New Bookings</h3>
                                        <p className="text-body text-muted">
                                            {notificationCount} pending booking{notificationCount !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setNotificationsOpen(false)}
                                        className="btn-ghost btn-sm p-2"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>

                            {pendingBookings.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon">
                                        <Bell size={32} className="text-gray-400" />
                                    </div>
                                    <h3 className="empty-state-title">No pending bookings</h3>
                                    <p className="empty-state-description">
                                        All caught up! You don't have any pending bookings right now.
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 ">
                                    {pendingBookings.map((booking) => {
                                        const client = clientsById[booking.client] || booking.clientData;
                                        return (
                                            <div key={booking.id} className="p-6 hover:bg-gray-50 transition-colors">
                                                <div className="flex items-start gap-4">
                                                    <div className="relative">
                                                        <img
                                                            src="https://i.pravatar.cc/150?u=client"
                                                            alt={client?.name || client?.fullname || 'Client'}
                                                            className="w-12 h-12 rounded-full shadow-md"
                                                        />
                                                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-orange-400 rounded-full border-2 border-white"></div>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-body font-semibold truncate mb-2">
                                                            {client?.name || client?.fullname || 'Client'}
                                                        </h4>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-2 text-small text-muted">
                                                                <Clock size={14} />
                                                                <span>{booking.booking_hours}</span>
                                                                <span className="status-badge warning">Pending</span>
                                                            </div>
                                                            {client?.phone && (
                                                                <div className="flex items-center gap-2 text-small text-muted">
                                                                    <Phone size={14} />
                                                                    <span>{client.phone}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex gap-3 mt-4">
                                                            <button
                                                                onClick={() => handleAcceptBooking(booking.id)}
                                                                className="btn-primary btn-sm flex items-center justify-center gap-2 hover:scale-105 transition-transform"
                                                                disabled={pendingUpdateId === booking.id}
                                                            >
                                                                {pendingUpdateId === booking.id ? (
                                                                    <>
                                                                        <div className="spinner"></div>
                                                                        Accepting...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Check size={14} />
                                                                        Accept
                                                                    </>
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => handleRejectBooking(booking.id)}
                                                                className="btn-secondary btn-sm flex items-center justify-center gap-2 hover:scale-105 transition-transform"
                                                                disabled={pendingUpdateId === booking.id}
                                                            >
                                                                {pendingUpdateId === booking.id ? (
                                                                    <>
                                                                        <div className="spinner"></div>
                                                                        Rejecting...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <X size={14} />
                                                                        Reject
                                                                    </>
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
            <main className="flex-1 py-20">
                <Outlet />
            </main>

            {/* FOOTER NAV */}
            <footer className="w-full fixed bottom-0 bg-gray-100 p-4 flex justify-around items-center rounded-t-2xl">
                {tabs.map((tab) => {
                    const Icon = tab.icon;

                    return (
                        <NavLink
                            key={tab.id}
                            to={tab.path}
                            className={({ isActive }) =>
                                `flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200
                                ${isActive
                                    ? "bg-blue-100 text-blue-600"
                                    : "text-gray-400"}`
                            }
                        >
                            <Icon size={22} />
                            <span className="text-[10px] font-semibold tracking-wider">
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