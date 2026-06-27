import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import RoleSelection from '../pages/auth/RoleSelection.jsx';
import Register from '../pages/auth/Register.jsx';
import Login from '../pages/auth/Login.jsx';
import BarberOnboarding from '../pages/auth/BarberOnboarding.jsx';
import TelegramEntry from '../pages/auth/TelegramEntry.jsx';

import ClientLayout from '../layouts/ClientLayout.jsx';
import BarberLayout from '../layouts/BarberLayout.jsx';

import ProtectedRoute from '../components/ProtectedRoute.jsx';
import PublicRoute from '../components/PublicRoute.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import { t } from '../utils/i18n.js';

const GuestBooking = lazy(() => import('../pages/client/GuestBooking.jsx'));
const TrackBooking = lazy(() => import('../pages/client/TrackBooking.jsx'));

const ClientDashboard = lazy(() => import('../pages/client/Dashboard.jsx'));
const ClientSettings = lazy(() => import('../pages/client/Settings.jsx'));
const ClientBooking = lazy(() => import('../pages/client/Booking.jsx'));
const BarbershopDetails = lazy(() => import('../pages/client/BarbershopDetails.jsx'));
const BookingStatus = lazy(() => import('../pages/client/BookingStatus.jsx'));
const ClientEntry = lazy(() => import('../pages/client/ClientEntry.jsx'));
const ChangePhone = lazy(() => import('../pages/client/ChangePhone.jsx'));
const BarberChangePhone = lazy(() => import('../pages/barber/ChangePhone.jsx'));

const BarberDashboard = lazy(() => import('../pages/barber/Dashboard.jsx'));
const BarberAppointments = lazy(() => import('../pages/barber/Appointments.jsx'));
const BarberClients = lazy(() => import('../pages/barber/Clients.jsx'));
const BarberSettings = lazy(() => import('../pages/barber/Settings.jsx'));

const PageLoader = () => (
    <div className="min-h-screen bg-[#f5f5f7] flex justify-center items-center">
        <div className="flex flex-col items-center">
            <div className="w-10 h-10 border-2 border-black/10 border-t-[#378ADD] rounded-full animate-spin mb-3" />
            <p className="text-xs font-bold text-[#666] uppercase tracking-wider">{t('common.pleaseWait')}</p>
        </div>
    </div>
);

function AppRouter() {
    const isLoggedIn = (() => {
        try {
            const u = JSON.parse(localStorage.getItem('user') || 'null');
            return u && u.id && u.role;
        } catch { return false; }
    })();

    // If the Mini App is opened from within Telegram, go to TelegramEntry
    const isInTelegram = !!window.Telegram?.WebApp?.initDataUnsafe?.user;

    return (
        <ErrorBoundary>
            <BrowserRouter>
                <Suspense fallback={<PageLoader />}>
                    <Routes>
                        {/* Root redirect:
                            - Logged-in users go straight to their dashboard.
                            - Telegram Mini App opens go to /tg (TelegramEntry).
                            - Everyone else goes to /role-select. */}
                        <Route path="/" element={
                            isLoggedIn
                                ? <Navigate to={`/${JSON.parse(localStorage.getItem('user')).role}/dashboard`} replace />
                                : isInTelegram
                                    ? <Navigate to="/tg" replace />
                                    : <Navigate to="/start" replace />
                        } />

                        {/* Public routes */}
                        <Route path="/role-select" element={<RoleSelection />} />
                        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
                        <Route path="/start" element={<PublicRoute><ClientEntry /></PublicRoute>} />
                        <Route path="/onboarding/barber" element={<PublicRoute><BarberOnboarding /></PublicRoute>} />

                        {/* Telegram Mini App entry */}
                        <Route path="/tg" element={<TelegramEntry />} />

                        <Route path="/guest-book/:id" element={<GuestBooking />} />
                        <Route path="/track/:id" element={<TrackBooking />} />

                        <Route path="/client/barber/:id" element={
                            <ProtectedRoute requiredRole="client">
                                <BarbershopDetails />
                            </ProtectedRoute>
                        } />

                        <Route path="/client/booking-status/:id" element={
                            <ProtectedRoute requiredRole="client">
                                <BookingStatus />
                            </ProtectedRoute>
                        } />

                        <Route path="/client" element={
                            <ProtectedRoute requiredRole="client">
                                <ClientLayout />
                            </ProtectedRoute>
                        }>
                            <Route path="dashboard" element={<ClientDashboard />} />
                            <Route path="bookings" element={<ClientBooking />} />
                            <Route path="settings" element={<ClientSettings />} />
                            <Route path="change-phone" element={<ChangePhone />} />
                        </Route>

                        {/* Barber authenticated routes */}
                        <Route path="/barber" element={
                            <ProtectedRoute requiredRole="barber">
                                <BarberLayout />
                            </ProtectedRoute>
                        }>
                            <Route path="dashboard" element={<BarberDashboard />} />
                            <Route path="appointments" element={<BarberAppointments />} />
                            <Route path="clients" element={<BarberClients />} />
                            <Route path="settings" element={<BarberSettings />} />
                            <Route path="change-phone" element={<BarberChangePhone />} />
                        </Route>

                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Suspense>
            </BrowserRouter>
        </ErrorBoundary>
    );
}

export default AppRouter;
