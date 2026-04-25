import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function BarbershopDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [barber, setBarber] = useState(null);
    const [slots, setSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);

    useEffect(() => {
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const found = users.find(u => u.email === decodeURIComponent(id) && u.role === 'barber');
        if (found) {
            setBarber(found);
            generateSlots(found);
        } else {
            setBarber('not_found');
        }
    }, [id]);

    const generateSlots = (barberData) => {
        if (barberData.isWorkingNow === false) {
            setSlots([]);
            return;
        }

        const hours = barberData.workingHours;
        if (!hours || !hours.includes('-')) return;
        const [startStr, endStr] = hours.split('-').map(s => s.trim());

        let startMatch = startStr.match(/^(\d{1,2}):(\d{2})$/);
        let endMatch = endStr.match(/^(\d{1,2}):(\d{2})$/);
        if (!startMatch || !endMatch) return;

        let curHour = parseInt(startMatch[1], 10);
        let curMin = parseInt(startMatch[2], 10);
        const endHour = parseInt(endMatch[1], 10);
        const endMin = parseInt(endMatch[2], 10);

        let lStart = -1, lEnd = -1;
        if (barberData.lunchStart && barberData.lunchEnd) {
            const [lsH, lsM] = barberData.lunchStart.split(':').map(Number);
            const [leH, leM] = barberData.lunchEnd.split(':').map(Number);
            lStart = lsH * 60 + lsM;
            lEnd = leH * 60 + leM;
        }

        const newSlots = [];
        let count = 0;
        while ((curHour < endHour || (curHour === endHour && curMin < endMin)) && count < 100) {
            const timeMins = curHour * 60 + curMin;
            const isLunch = lStart !== -1 && (timeMins >= lStart && timeMins < lEnd);

            if (!isLunch) {
                const timeString = `${curHour.toString().padStart(2, '0')}:${curMin.toString().padStart(2, '0')}`;
                newSlots.push(timeString);
            }

            curMin += 30;
            if (curMin >= 60) {
                curMin -= 60;
                curHour += 1;
            }
            count++;
        }
        setSlots(newSlots);
    };

    const toggleSlot = (time) => {
        setSelectedSlot((prev) => (prev === time ? null : time));
    };

    if (barber === 'not_found') {
        return (
            <div className="min-h-screen bg-[var(--background)] flex justify-center items-center p-4">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Barber not found</h2>
            </div>
        );
    }

    if (!barber) return <div className="p-10 text-center">Loading...</div>;

    return (
        <div className="min-h-screen bg-[var(--background)] flex justify-center p-4 sm:p-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="w-full max-w-md bg-[var(--card-bg)] rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden relative transition-all duration-500">
                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-5 left-5 z-20 w-10 h-10 bg-[var(--card-bg)] opacity-90 rounded-full flex items-center justify-center shadow-sm backdrop-blur-md cursor-pointer hover:opacity-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <div className="relative h-64 w-full">
                    <img
                        src={barber.shopImage || barber.profileImage || "https://placehold.co/600x400/purple/white?text=Shop+Cover"}
                        alt="barber"
                        className="w-full h-full object-cover rounded-b-[2rem]"
                        onError={(e) => { e.currentTarget.src = "https://placehold.co/600x400/purple/white?text=Shop+Cover"; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent w-full h-full object-cover rounded-b-[2rem]"></div>
                </div>

                <div className="p-6 space-y-7 -mt-4 relative z-10 bg-[var(--card-bg)] rounded-[2rem]">

                    <div>
                        <h2 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight leading-tight">
                            {barber.shopName || "Gentleman's Atelier"}
                        </h2>
                        <p className="text-sm font-medium text-[var(--text-secondary)] mt-1">{barber.name || "By Anvar Rakhimov"}</p>
                    </div>

                    <div className="flex justify-between items-center bg-[var(--background)] opacity-90 rounded-2xl p-4 text-sm border border-[var(--border)]">
                        <div className="flex flex-col gap-1">
                            <p className="text-[10px] font-bold text-[var(--text-secondary)] tracking-wider uppercase">Average Price</p>
                            <p className="font-bold text-[var(--text-primary)] text-base">{barber.avgPrice || "150,000 UZS"}</p>
                        </div>
                        <div className="w-[1px] h-8 bg-[var(--border)]"></div>
                        <div className="flex flex-col gap-1 items-end">
                            <p className="text-[10px] font-bold text-[var(--text-secondary)] tracking-wider uppercase">Today</p>
                            <p className="font-bold text-[var(--text-primary)] text-base">{barber.workingHours || "09:00 - 21:00"}</p>
                        </div>
                    </div>

                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-normal">
                        An exclusive grooming experience tailored for the modern gentleman in
                        Tashkent. We combine traditional techniques with contemporary
                        aesthetics to define your personal style.
                    </p>

                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-[var(--text-primary)] text-lg">
                                Available Slots
                            </h3>
                            <button className="text-sm font-semibold text-[var(--primary)] hover:opacity-80 transition-colors">
                                View Calendar
                            </button>
                        </div>

                        <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
                            {slots.length > 0 ? slots.map((time) => (
                                <label
                                    key={time}
                                    className={`min-w-[85px] flex flex-col items-center justify-center px-4 py-3 rounded-2xl border cursor-pointer hover:-translate-y-1 hover:shadow-sm transition-all duration-200
                  ${selectedSlot === time
                                            ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-md"
                                            : "bg-[var(--card-bg)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--primary)]"
                                        }`}
                                >
                                    <span className="text-xs">
                                        {parseInt(time.split(':')[0]) < 12 ? 'MORNING' : parseInt(time.split(':')[0]) < 17 ? 'AFTERNOON' : 'EVENING'}
                                    </span>
                                    <span className="font-semibold">{time}</span>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={selectedSlot === time}
                                        onChange={() => toggleSlot(time)}
                                    />
                                </label>
                            )) : (
                                <p className="text-sm text-[var(--text-secondary)]">No available slots today.</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] tracking-wider uppercase mb-1">Location</p>
                        <p className="text-sm font-medium text-[var(--text-primary)] mb-3">
                            {barber.location || "Amir Temur Avenue 108, Tashkent"}
                        </p>

                        <div className="w-full h-28 bg-[var(--background)] border border-[var(--border)] rounded-2xl flex items-center justify-center text-[var(--text-secondary)] text-sm font-medium">
                            Map Preview
                        </div>
                    </div>

                    <button className="w-full bg-[var(--primary)] text-white py-4 mt-2 rounded-[1.25rem] font-bold text-[15px] shadow-lg hover:opacity-90 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
                        Book Now
                    </button>
                </div>
            </div>
        </div>
    );
}
