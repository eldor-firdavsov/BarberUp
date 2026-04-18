import { Outlet, NavLink } from 'react-router-dom';

function ClientLayout() {
    return (
        <div>
            <header>Client Panel</header>
            <main>
                <Outlet />
            </main>
            <footer>
                <NavLink to="/client/dashboard">
                    {({ isActive }) => (isActive ? 'Dashboard (active)' : 'Dashboard')}
                </NavLink>
                {' | '}
                <NavLink to="/client/settings">
                    {({ isActive }) => (isActive ? 'Settings (active)' : 'Settings')}
                </NavLink>
            </footer>
        </div>
    );
}

export default ClientLayout;
