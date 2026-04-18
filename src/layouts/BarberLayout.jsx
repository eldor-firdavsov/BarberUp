import { Outlet, NavLink } from 'react-router-dom';

function BarberLayout() {
    return (
        <div>
            <header>Barber Panel</header>
            <main>
                <Outlet />
            </main>
            <footer>
                <NavLink to="/barber/dashboard">
                    {({ isActive }) => (isActive ? 'Dashboard (active)' : 'Dashboard')}
                </NavLink>
                {' | '}
                <NavLink to="/barber/clients">
                    {({ isActive }) => (isActive ? 'Clients (active)' : 'Clients')}
                </NavLink>
                {' | '}
                <NavLink to="/barber/appointments">
                    {({ isActive }) => (isActive ? 'Appointments (active)' : 'Appointments')}
                </NavLink>
                {' | '}
                <NavLink to="/barber/settings">
                    {({ isActive }) => (isActive ? 'Settings (active)' : 'Settings')}
                </NavLink>
            </footer>
        </div>
    );
}

export default BarberLayout;
