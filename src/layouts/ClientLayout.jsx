import { Outlet, NavLink } from 'react-router-dom';
import { Search, Calendar, Settings } from "lucide-react";
import { t } from '../utils/i18n.js';

const tabs = [
    { id: "explore", labelKey: "layout.client.explore", icon: Search, path: "/client/dashboard" },
    { id: "bookings", labelKey: "layout.client.bookings", icon: Calendar, path: "/client/bookings" },
    { id: "settings", labelKey: "layout.client.settings", icon: Settings, path: "/client/settings" },
];

function ClientLayout() {

    return (
        <div className="w-full min-h-screen flex flex-col justify-between bg-[#f5f5f7]">

            <header className="w-full fixed top-0 z-10 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-black/5">
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

            <main className="flex-1 pt-[72px] pb-[80px]">
                <Outlet />
            </main>

            <footer className="w-full fixed bottom-0 bg-white/80 backdrop-blur-md border-t border-black/5 px-4 py-3 flex justify-around items-center">
                {tabs.map((tab) => {
                    const Icon = tab.icon;

                    return (
                        <NavLink
                            key={tab.id}
                            to={tab.path}
                            className={({ isActive }) =>
                                `flex flex-col items-center gap-1 px-6 py-2 rounded-2xl transition-all duration-200
                                ${isActive
                                    ? "bg-[#185FA5] text-white"
                                    : "text-[#888] hover:text-[#111]"}`
                            }
                        >
                            <Icon size={20} />
                            <span className="text-[9px] font-bold tracking-[0.08em]">
                                {t(tab.labelKey)}
                            </span>
                        </NavLink>
                    );
                })}
            </footer>
        </div>
    );
}

export default ClientLayout;
