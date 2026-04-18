import { BrowserRouter, Routes, Route } from 'react-router-dom';

import RoleSelection from '../pages/barber/RoleSelection.jsx';
import ClientLogin from '../pages/auth/ClientLogin.jsx';
import BarberLogin from '../pages/auth/BarberLogin.jsx';

import ClientLayout from '../layouts/ClientLayout.jsx';
import ClientDashboard from '../pages/client/Dashboard.jsx';
import BarbershopDetails from '../pages/client/BarbershopDetails.jsx';
import ClientBooking from '../pages/client/Booking.jsx';
import ClientSettings from '../pages/client/Settings.jsx';

import BarberLayout from '../layouts/BarberLayout.jsx';
import BarberDashboard from '../pages/barber/Dashboard.jsx';
import BarberClients from '../pages/barber/Clients.jsx';
import BarberAppointments from '../pages/barber/Appointments.jsx';
import BarberSettings from '../pages/barber/Settings.jsx';

function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<RoleSelection />} />

                <Route path="/auth/client" element={<ClientLogin />} />
                <Route path="/auth/barber" element={<BarberLogin />} />

                <Route path="/client" element={<ClientLayout />}>
                    <Route path="dashboard" element={<ClientDashboard />} />
                    <Route path="barbershop/:id" element={<BarbershopDetails />} />
                    <Route path="booking/:id" element={<ClientBooking />} />
                    <Route path="settings" element={<ClientSettings />} />
                </Route>

                <Route path="/barber" element={<BarberLayout />}>
                    <Route path="dashboard" element={<BarberDashboard />} />
                    <Route path="clients" element={<BarberClients />} />
                    <Route path="appointments" element={<BarberAppointments />} />
                    <Route path="settings" element={<BarberSettings />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default AppRouter;
