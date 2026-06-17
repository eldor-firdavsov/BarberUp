import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Search, Calendar, Settings } from "lucide-react";
import { t } from '../utils/i18n.js';

const tabs = [
    { id: "explore", labelKey: "layout.client.explore", icon: Search, path: "/client/dashboard" },
    { id: "bookings", labelKey: "layout.client.bookings", icon: Calendar, path: "/client/bookings" },
    { id: "settings", labelKey: "layout.client.settings", icon: Settings, path: "/client/settings" },
];

function ClientLayout() {
    const location = useLocation();
    
    // Find active index for the liquid glass pill
    const activeIndex = tabs.findIndex(tab => location.pathname.startsWith(tab.path));
    const safeActiveIndex = activeIndex >= 0 ? activeIndex : 0;

    return (
        <div className="w-full min-h-screen flex bg-[#f5f5f7]">
            {/* Desktop Sidebar Navigation */}
            <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 border-r border-black/5 bg-white py-8 px-4 z-20 justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-10 px-2">
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

                    <nav className="flex flex-col gap-2">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;

                            return (
                                <NavLink
                                    key={tab.id}
                                    to={tab.path}
                                    aria-label={t(tab.labelKey)}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3.5 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all duration-200 active:scale-95
                                        ${isActive
                                            ? "bg-[#185FA5] text-white shadow-md shadow-[#185FA5]/15"
                                            : "text-[#666] hover:bg-[#f8f8f8] hover:text-[#111] hover:scale-[1.02]"}`
                                    }
                                >
                                    <Icon size={18} aria-hidden="true" />
                                    <span>{t(tab.labelKey)}</span>
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

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0 pl-0 md:pl-64">
                {/* Mobile Header */}
                <header className="w-full fixed top-0 z-10 flex items-center justify-between px-5 py-3 bg-white/80 backdrop-blur-md border-b border-black/5 md:hidden safe-top">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-[#378ADD] flex items-center justify-center">
                            <img
                                src="/Scissor.png"
                                alt={t('common.logo')}
                                className="w-5 h-5 object-contain invert"
                                onError={e => e.target.style.display = 'none'}
                            />
                        </div>
                        <h1 className="text-lg font-bold text-[#111] tracking-[-0.03em]">
                            {t('brand.name')}
                        </h1>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-grow pt-[64px] md:pt-0 pb-[120px] md:pb-0 min-h-screen">
                    <Outlet />
                </main>

                {/* Mobile Footer Tab Bar */}
                <footer className="bottom-nav md:hidden">
                    <div className="relative flex w-full h-full items-center">
                        {/* Sliding pill */}
                        <div 
                            className="absolute inset-y-[6px] w-1/3 pointer-events-none transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                            style={{ transform: `translateX(${safeActiveIndex * 100}%)` }}
                        >
                            <div className="w-full h-full bg-[#2563eb] rounded-[20px] shadow-[0_8px_20px_rgba(37,99,235,0.3)]" />
                        </div>

                        {tabs.map((tab) => {
                            const Icon = tab.icon;

                            return (
                                <NavLink
                                    key={tab.id}
                                    to={tab.path}
                                    aria-label={t(tab.labelKey)}
                                    className={({ isActive }) =>
                                        `bottom-nav-item ${isActive ? "active" : ""}`
                                    }
                                >
                                    <Icon aria-hidden="true" />
                                    <span>{t(tab.labelKey)}</span>
                                </NavLink>
                            );
                        })}
                    </div>
                </footer>
            </div>
        </div>
    );
}

export default ClientLayout;

