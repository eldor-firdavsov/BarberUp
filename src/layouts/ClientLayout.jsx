import { Outlet, NavLink } from 'react-router-dom';
import { Search, Calendar, Settings } from "lucide-react";
import { t } from '../utils/i18n.js';
import AppHeader from '../components/layout/AppHeader.jsx';

const tabs = [
    { id: "explore", labelKey: "layout.client.explore", icon: Search, path: "/client/dashboard" },
    { id: "bookings", labelKey: "layout.client.bookings", icon: Calendar, path: "/client/bookings" },
    { id: "settings", labelKey: "layout.client.settings", icon: Settings, path: "/client/settings" },
];

function ClientLayout() {
    return (
        <div className="w-full min-h-screen flex bg-[var(--bg-base)]">
            <aside className="hidden md:flex flex-col w-56 h-screen fixed left-0 top-0 border-r border-[var(--border-subtle)] bg-[var(--bg-card)] py-6 px-3 z-20">
                <div className="flex items-center gap-2.5 mb-8 px-2">
                    <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--brand-primary)] flex items-center justify-center">
                        <img src="/Scissor.png" alt={t('common.logo')} className="w-4 h-4 object-contain invert" onError={e => e.target.style.display = 'none'} />
                    </div>
                    <h1 className="text-lg font-bold text-[var(--text-primary)]">{t('brand.name')}</h1>
                </div>
                <nav className="flex flex-col gap-1">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <NavLink
                                key={tab.id}
                                to={tab.path}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-3 py-3 rounded-[var(--radius-md)] font-semibold text-sm transition-colors
                                    ${isActive ? 'bg-[var(--brand-primary-light)] text-[var(--brand-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`
                                }
                            >
                                <Icon size={18} />
                                <span>{t(tab.labelKey)}</span>
                            </NavLink>
                        );
                    })}
                </nav>
            </aside>

            <div className="flex-1 flex flex-col min-w-0 md:pl-56">
                <div className="md:hidden">
                    <AppHeader
                        title={t('brand.name')}
                        left={
                            <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--brand-primary)] flex items-center justify-center">
                                <img src="/Scissor.png" alt="" className="w-4 h-4 invert" onError={e => e.target.style.display = 'none'} />
                            </div>
                        }
                    />
                </div>

                <main className="flex-grow md:pt-0 md:pb-0 min-h-screen">
                    <Outlet />
                </main>

                <footer className="bottom-nav md:hidden">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <NavLink key={tab.id} to={tab.path} className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                                <Icon size={22} />
                                <span>{t(tab.labelKey)}</span>
                            </NavLink>
                        );
                    })}
                </footer>
            </div>
        </div>
    );
}

export default ClientLayout;
