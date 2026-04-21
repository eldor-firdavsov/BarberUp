import { Outlet, NavLink } from 'react-router-dom';
import { Search, Calendar, Settings, Bell } from "lucide-react";

const tabs = [
    { id: "explore", label: "EXPLORE", icon: Search, path: "/client/dashboard" },
    { id: "bookings", label: "BOOKINGS", icon: Calendar, path: "/client/bookings" },
    { id: "settings", label: "SETTINGS", icon: Settings, path: "/client/settings" },
];

function ClientLayout() {

    return (
        <div className="w-full min-h-screen flex flex-col justify-between bg-white">

            {/* HEADER */}
            <header className="w-full flex items-center justify-between px-6 py-4 bg-gray-100">
                <div className="flex items-center gap-3">
                    <img
                        src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
                        alt="avatar"
                        className="w-10 h-10 rounded-full"
                    />
                    <h1 className="text-2xl font-bold text-indigo-700">
                        NavbatGo
                    </h1>
                </div>

                <div className="flex items-center gap-5 text-indigo-700">
                    <Search size={22} />
                    <Bell size={22} />
                </div>
            </header>

            {/* MAIN CONTENT */}
            <main className="flex-1">
                <Outlet />
            </main>

            {/* FOOTER NAV */}
            <footer className="w-full bg-gray-100 p-4 flex justify-around items-center rounded-t-xl">
                {tabs.map((tab) => {
                    const Icon = tab.icon;

                    return (
                        <NavLink
                            key={tab.id}
                            to={tab.path}
                            className={({ isActive }) =>
                                `flex flex-col items-center gap-1 px-6 py-3 rounded-xl transition-all duration-200
                                ${isActive
                                    ? "bg-blue-100 text-blue-600"
                                    : "text-gray-500"}`
                            }
                        >
                            <Icon size={22} />
                            <span className="text-xs font-semibold tracking-wider">
                                {tab.label}
                            </span>
                        </NavLink>
                    );
                })}
            </footer>
        </div>
    );
}

export default ClientLayout;