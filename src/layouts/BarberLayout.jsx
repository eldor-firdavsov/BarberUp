import { Outlet, NavLink } from 'react-router-dom';
import { Home, Settings, Bell, Check, X, Phone, Clock, Calendar, Users } from "lucide-react";
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getBookings, updateBookingStatus } from '../api/bookingApi.js';
import { getClients } from '../api/clientApi.js';
import { supabase } from '../api/supabase.js';
import { t } from '../utils/i18n.js';
import { formatTo24h } from '../utils/time.js';
import { getBookingDateStr, formatBookingDate } from '../utils/dates.js';
import ClientProfileModal from '../components/ClientProfileModal.jsx';
import AppHeader from '../components/layout/AppHeader.jsx';

function BarberLayout() {
    const { user } = useAuth();
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [pendingBookings, setPendingBookings] = useState([]);
    const [clientsById, setClientsById] = useState({});
    const [pendingUpdateId, setPendingUpdateId] = useState(null);
    const [profileClient, setProfileClient] = useState(null);

    const tabs = [
        { id: "home", labelKey: "layout.barber.home", icon: Home, path: "/barber/dashboard" },
        { id: "appointments", labelKey: "layout.barber.appointments", icon: Calendar, path: "/barber/appointments" },
        { id: "clients", labelKey: "layout.barber.clients", icon: Users, path: "/barber/clients" },
        { id: "settings", labelKey: "layout.barber.settings", icon: Settings, path: "/barber/settings" },
    ];

    const fetchNotifications = useCallback(async () => {
        try {
            const [{ data: bookingList }, { data: clients }] = await Promise.all([
                getBookings(),
                getClients(),
            ]);

            // Filter pending bookings for current barber
            const pending = (bookingList ?? []).filter(booking =>
                (booking.barber === user?.id || booking.barber_id === user?.id) && booking.status === 'pending'
            );

            setPendingBookings(pending);
            setClientsById(Object.fromEntries((clients ?? []).map(client => [client.id, client])));
        } catch (error) {
            console.error('[NOTIFICATIONS] Error fetching:', error);
        }
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id) return;

        fetchNotifications();

        // Realtime notifications via Supabase channel subscription
        const channel = supabase
            .channel(`barber-layout-notifications-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'bookings',
                    filter: `barber_id=eq.${user.id}`
                },
                () => {
                    fetchNotifications();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchNotifications, user?.id]);

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

    // Close notifications when clicking outside using robust class selector
    useEffect(() => {
        function handleClickOutside(event) {
            if (!event.target.closest('.notification-container')) {
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

    const renderNotificationDropdown = (alignRight = true) => (
        <div className={`absolute ${alignRight ? 'right-0' : 'left-0 md:right-0 md:left-auto'} mt-3 w-80 md:w-96 bg-white rounded-[28px] border border-black/5 shadow-[0_20px_60px_rgba(0,0,0,0.1)] z-50 max-h-[480px] overflow-y-auto`}>
            <div className="p-6 border-b border-black/5 sticky top-0 bg-white rounded-t-[28px]">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-[18px] font-bold text-[#111] tracking-[-0.02em]">{t('layout.barber.newBookings')}</h3>
                        <p className="text-sm text-[#666] font-medium mt-0.5">
                            {t('layout.barber.pendingCount', { count: notificationCount })}
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
                    <p className="font-bold text-[#111] text-sm">{t('layout.barber.noPending')}</p>
                    <p className="text-xs text-[#666] mt-1 font-medium">{t('layout.barber.allCaughtUp')}</p>
                </div>
            ) : (
                <div className="divide-y divide-black/5">
                    {pendingBookings.map((booking) => {
                        const client = clientsById[booking.client] || booking.clientData;
                        const clientName = booking.guest_name || client?.name || client?.fullname || t('common.client');
                        const phone = booking.guest_phone || client?.phone;
                        return (
                            <div key={booking.id} className="p-5 hover:bg-[#fafafa] transition-colors">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-2xl bg-[#f8f8f8] border border-black/5 flex items-center justify-center shrink-0">
                                        <span className="text-[#111] font-bold text-sm">
                                            {clientName.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const c = clientsById[booking.client] || booking.clientData;
                                                if (c) {
                                                    setProfileClient({ id: c.id, name: c.name || c.fullname, phone: c.phone, email: c.email, createdAt: c.createdAt });
                                                } else if (booking.guest_name) {
                                                    setProfileClient({ id: `guest_${booking.id}`, name: booking.guest_name, phone: booking.guest_phone || '' });
                                                }
                                            }}
                                            className="font-bold text-[#111] text-sm truncate hover:text-[#378ADD] transition-colors text-left"
                                        >
                                            {clientName}
                                        </button>
                                        <div className="flex items-center gap-3 mt-1">
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#666] font-medium">
                                                <div className="flex items-center gap-1">
                                                    <Clock size={12} />
                                                    <span>{formatTo24h(booking.booking_hours)}</span>
                                                </div>
                                                {getBookingDateStr(booking) && (
                                                    <span className="text-[#378ADD] font-bold">
                                                        {formatBookingDate(getBookingDateStr(booking), { style: 'short' })}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-[var(--text-secondary)] font-semibold">
                                                {booking.service_name}
                                            </span>
                                        </div>
                                        {phone && (
                                            <div className="flex items-center gap-1 text-xs text-[#666] font-medium mt-1">
                                                <Phone size={12} />
                                                <span>{phone}</span>
                                            </div>
                                        )}

                                        <div className="flex gap-2 mt-3">
                                            <button
                                                onClick={() => handleAcceptBooking(booking.id)}
                                                className="flex-1 h-9 bg-[#378ADD] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#185FA5] transition-all disabled:opacity-50"
                                                disabled={pendingUpdateId === booking.id}
                                            >
                                                {pendingUpdateId === booking.id ? (
                                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                ) : (
                                                    <><Check size={12} />{t('common.accept')}</>
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
                                                    <><X size={12} />{t('common.reject')}</>
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
    );

    return (
        <><div className="w-full min-h-screen flex bg-[var(--bg-base)]">
            {/* Desktop Sidebar Navigation */}
            <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 border-r border-black/5 bg-white py-8 px-4 z-20 justify-between">
                <div>
                    <div className="flex items-center justify-between mb-10 px-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#378ADD] flex items-center justify-center shadow-lg shadow-[#378ADD]/20">
                                <img
                                    src="/Scissor.png"
                                    alt={t('common.logo')}
                                    className="w-5 h-5 object-contain invert"
                                    onError={e => e.target.style.display = 'none'}
                                />
                            </div>
                            <h1 className="text-xl font-bold text-[#111] tracking-[-0.03em]">
                                {t('brand.name')}
                            </h1>
                        </div>

                        {/* Sidebar Notification Icon for Desktop/Laptop */}
                        <div className="relative notification-container">
                            <button
                                onClick={() => setNotificationsOpen(!notificationsOpen)}
                                className="relative w-10 h-10 bg-[#f8f8f8] border border-black/5 rounded-2xl flex items-center justify-center hover:bg-[#f0f0f0] transition-all duration-200"
                            >
                                <Bell size={18} className="text-[#111]" />
                                {notificationCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-[#378ADD] text-white text-[10px] font-bold rounded-full w-[18px] h-[18px] flex items-center justify-center px-1">
                                        {notificationCount}
                                    </span>
                                )}
                            </button>
                            {notificationsOpen && renderNotificationDropdown(false)}
                        </div>
                    </div>

                    <nav className="flex flex-col gap-2">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <NavLink
                                    key={tab.id}
                                    to={tab.path}
                                    className={({ isActive }) =>
                                        `flex items-center justify-between px-4 py-3.5 rounded-2xl font-bold text-sm transition-all duration-200
                                        ${isActive
                                            ? "bg-[#185FA5] text-white shadow-md shadow-[#185FA5]/15"
                                            : "text-[#666] hover:bg-[#f8f8f8] hover:text-[#111]"}`
                                    }
                                >
                                    <div className="flex items-center gap-3.5">
                                        <Icon size={18} />
                                        <span>{t(tab.labelKey)}</span>
                                    </div>
                                </NavLink>
                            );
                        })}
                    </nav>
                </div>

                <div className="px-4 py-3 border-t border-black/5">
                    <p className="text-[10px] font-bold text-[#888] uppercase tracking-[0.15em] leading-none mb-1">
                        {t('brand.name')}
                    </p>
                    <p className="text-[9px] text-[#bbb] font-medium">
                        © {new Date().getFullYear()} All rights reserved
                    </p>
                </div>
            </aside>

            {/* Main Wrapper */}
            <div className="flex-1 flex flex-col min-w-0 pl-0 md:pl-64">
                {/* Mobile Header */}
                <div className="md:hidden">
                    <AppHeader
                        title={t('brand.name')}
                        left={
                            <div className="w-9 h-9 rounded-2xl bg-[#378ADD] flex items-center justify-center">
                                <img
                                    src="/Scissor.png"
                                    alt={t('common.logo')}
                                    className="w-5 h-5 object-contain invert"
                                    onError={e => e.target.style.display = 'none'}
                                />
                            </div>
                        }
                        right={
                            <div className="relative notification-container">
                                <button
                                    onClick={() => setNotificationsOpen(!notificationsOpen)}
                                    className="relative w-10 h-10 bg-[#f8f8f8] border border-black/5 rounded-2xl flex items-center justify-center active:bg-[#f0f0f0] transition-all duration-200"
                                >
                                    <Bell size={18} className="text-[#111]" />
                                    {notificationCount > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-[#378ADD] text-white text-[10px] font-bold rounded-full w-[18px] h-[18px] flex items-center justify-center px-1">
                                            {notificationCount}
                                        </span>
                                    )}
                                </button>
                                {notificationsOpen && renderNotificationDropdown(false)}
                            </div>
                        }
                    />
                </div>

                {/* Main content */}
                <main className="flex-grow pt-0 pb-0 md:pt-8 md:px-8 min-h-screen">
                    <Outlet />
                </main>

                {/* Mobile bottom tabs navigation */}
                <footer className="bottom-nav md:hidden">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <NavLink
                                    key={tab.id}
                                    to={tab.path}
                                    className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`}
                                >
                                    <Icon size={24} />
                                    <span>{t(tab.labelKey)}</span>
                                </NavLink>
                            );
                        })}
                </footer>
            </div>
        </div>

        <ClientProfileModal client={profileClient} isOpen={!!profileClient} onClose={() => setProfileClient(null)} />
        </>
    );
}

export default BarberLayout;