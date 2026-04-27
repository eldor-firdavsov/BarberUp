import { Outlet, NavLink } from 'react-router-dom';
import { Home, Calendar, Users, Settings, Bell } from "lucide-react";

const tabs = [
    { id: "home", label: "HOME", icon: Home, path: "/barber/dashboard" },
    { id: "schedule", label: "SCHEDULE", icon: Calendar, path: "/barber/appointments" },
    { id: "clients", label: "CLIENTS", icon: Users, path: "/barber/clients" },
    { id: "settings", label: "SETTINGS", icon: Settings, path: "/barber/settings" },
];

function BarberLayout() {

    return (
        <div className="w-full min-h-screen flex flex-col justify-between bg-white">

            {/* HEADER */}
            <header className="w-full fixed  top-0 z-10  flex items-center justify-between px-6 py-4 bg-gray-100">
                <div className="flex items-center gap-4">
                    <img
                        src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
                        alt="avatar"
                        className="w-14 h-14 rounded-full"
                    />
                    <h1 className="text-3xl font-bold text-indigo-700">
                        NavbatGo
                    </h1>
                </div>

                <div className="text-indigo-700">
                    <Bell size={28} />
                </div>
            </header>

            {/* MAIN CONTENT */}
            <main className="flex-1 py-15">
                <Outlet />
            </main>

            {/* FOOTER NAV */}
            <footer className="w-full fixed bottom-0 bg-gray-100 p-4 flex justify-around items-center rounded-t-2xl">
                {tabs.map((tab) => {
                    const Icon = tab.icon;

                    return (
                        <NavLink
                            key={tab.id}
                            to={tab.path}
                            className={({ isActive }) =>
                                `flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200
                                ${isActive
                                    ? "bg-blue-100 text-blue-600"
                                    : "text-gray-400"}`
                            }
                        >
                            <Icon size={22} />
                            <span className="text-[10px] font-semibold tracking-wider">
                                {tab.label}
                            </span>
                        </NavLink>
                    );
                })}
            </footer>
        </div>
    );
}

export default BarberLayout;