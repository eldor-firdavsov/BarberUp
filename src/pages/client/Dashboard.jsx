import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

function Client() {
    const { getBarbers } = useAuth();
    const [barbers, setBarbers] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        if (getBarbers) {
            setBarbers(getBarbers());
        } else {
            try {
                const users = JSON.parse(localStorage.getItem("users") || "[]");
                setBarbers(users.filter(u => u.role === "barber"));
            } catch (error) {
                setBarbers([]);
            }
        }
    }, [getBarbers]);

    const getBarberStatus = (barber) => {
        if (barber.isWorkingNow === false) return "Currently Offline";
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();

        if (barber.lunchStart && barber.lunchEnd) {
            const [lStartH, lStartM] = barber.lunchStart.split(':').map(Number);
            const [lEndH, lEndM] = barber.lunchEnd.split(':').map(Number);
            const lStartMins = lStartH * 60 + lStartM;
            const lEndMins = lEndH * 60 + lEndM;

            if (currentMins >= lStartMins && currentMins < lEndMins) {
                return "On Break";
            }
        }
        return "Available";
    };

    return (
        <section className="page-animate max-w-md mx-auto px-6 py-8 flex flex-col">
            <header className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-2">
                    <img src="./Female_icon.png" alt="icon" className="w-8 h-8" />
                    <p className="text-[#1D0065] text-[24px] font-bold">NavbatGo</p>
                </div>
                <div className="flex gap-3 items-center">
                    <img src="./search.png" alt="" className="w-5 h-5" />
                    <img src="./bell.png" alt="" className="w-4 h-5" />
                </div>
            </header>

            <h1 className="text-4xl font-bold text-[#1D0065] leading-tight mb-4">
                <span className="text-black">Elevate your <br /></span>Grooming.
            </h1>
            <p className="text-base text-[var(--text-muted)] leading-relaxed font-normal mb-8">
                Discover the finest ateliers in the city. <br />Hand-picked masters of the craft, ready <br />for your next transformation.
            </p>

            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar mb-8">
                <button className="btn-secondary whitespace-nowrap !bg-[var(--primary)] !text-white text-sm">All Masters</button>
                <button className="btn-secondary whitespace-nowrap text-sm">Top Rated</button>
                <button className="btn-secondary whitespace-nowrap text-sm">Closest</button>
            </div>

            {barbers.length > 0 ? (
                <div className="space-y-8 pb-10">
                    {barbers.map((barber, index) => (
                        <div
                            key={index}
                            onClick={() => navigate(`/client/barbershop/${encodeURIComponent(barber.email)}`)}
                            className="flex flex-col border border-gray-100 rounded-[1.5rem] overflow-hidden shadow-sm bg-white pb-5 transition-transform hover:-translate-y-1 cursor-pointer"
                        >
                            <img
                                src={barber.shopImage || "Background.png"}
                                alt="Shop"
                                className="w-full h-56 object-cover"
                                onError={(e) => { e.currentTarget.src = "Background.png"; }}
                            />
                            <div className="px-5 pt-5">
                                <div className="flex justify-between items-start mb-1">
                                    <h1 className="text-2xl font-bold text-black">{barber.shopName || "Modern Atelier"}</h1>
                                    {(() => {
                                        const status = getBarberStatus(barber);
                                        let badgeColor = "bg-green-100 text-green-700";
                                        if (status === "Currently Offline") badgeColor = "bg-gray-100 text-gray-600";
                                        if (status === "On Break") badgeColor = "bg-orange-100 text-orange-600";
                                        return <span className={`px-2 py-1 text-xs font-bold rounded-md ${badgeColor}`}>{status}</span>;
                                    })()}
                                </div>
                                <div className="flex gap-4 items-center mb-6">
                                    <p className="text-sm text-[var(--text-muted)] font-semibold">{barber.name}</p>
                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                    <p className="text-sm text-[var(--text-muted)]">{barber.workingHours}</p>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xs font-semibold text-[var(--primary)] opacity-80 mb-1">Next Available</h2>
                                        <p className="text-sm font-bold text-[#312E81]">Today at 14:30</p>
                                    </div>
                                    <button
                                        className="btn-primary !w-auto px-6 !h-12 !text-sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/client/barbershop/${encodeURIComponent(barber.email)}`);
                                        }}
                                    >Book session</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="py-10 text-center">
                    <p className="text-base text-[var(--text-muted)] font-semibold">No barbers available</p>
                </div>
            )}
        </section>
    );
}

export default Client;
