import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import RoleSelection from '../pages/auth/RoleSelection.jsx';
import Register from '../pages/auth/Register.jsx';
import Login from '../pages/auth/Login.jsx';
import ClientOnboarding from '../pages/auth/ClientOnboarding.jsx';
import BarberOnboarding from '../pages/auth/BarberOnboarding.jsx';

import ClientLayout from '../layouts/ClientLayout.jsx';
import ClientDashboard from '../pages/client/Dashboard.jsx';
import ClientSettings from '../pages/client/Settings.jsx';
import ClientBooking from '../pages/client/Booking.jsx';
import BarbershopDetails from '../pages/client/BarbershopDetails.jsx';
import BookingStatus from '../pages/client/BookingStatus.jsx';

import BarberLayout from '../layouts/BarberLayout.jsx';
import BarberDashboard from '../pages/barber/Dashboard.jsx';
import BarberClients from '../pages/barber/Clients.jsx';
import BarberAppointments from '../pages/barber/Appointments.jsx';
import BarberSettings from '../pages/barber/Settings.jsx';

import ProtectedRoute from '../components/ProtectedRoute.jsx';
import PublicRoute from '../components/PublicRoute.jsx';

function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<PublicRoute><RoleSelection /></PublicRoute>} />
                <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
                <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                <Route path="/onboarding/client" element={<PublicRoute><ClientOnboarding /></PublicRoute>} />
                <Route path="/onboarding/barber" element={<PublicRoute><BarberOnboarding /></PublicRoute>} />

                <Route
                    path="/barber/:id"
                    element={
                        <ProtectedRoute requiredRole="client">
                            <BarbershopDetails />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/client"
                    element={
                        <ProtectedRoute requiredRole="client">
                            <ClientLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route path="dashboard" element={<ClientDashboard />} />
                    <Route path="bookings" element={<ClientBooking />} />
                    <Route path="settings" element={<ClientSettings />} />
                    <Route path="booking-status/:id" element={<BookingStatus />} />
                </Route>

                <Route
                    path="/barber"
                    element={
                        <ProtectedRoute requiredRole="barber">
                            <BarberLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route path="dashboard" element={<BarberDashboard />} />
                    <Route path="clients" element={<BarberClients />} />
                    <Route path="appointments" element={<BarberAppointments />} />
                    <Route path="settings" element={<BarberSettings />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default AppRouter;
