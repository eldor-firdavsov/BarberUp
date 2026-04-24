import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

function BarbershopDetails() {
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
            navigate('/client/dashboard');
        }
    }, [id, navigate]);

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

    if (!barber) return <div className="p-10 text-center">Loading...</div>;

    return (
        <section className="page-animate min-h-screen flex flex-col bg-gray-50 pb-12">
            <div className="relative h-64 w-full bg-black">
                <img
                    src={barber.shopImage || "Background.png"}
                    alt="Shop Cover"
                    className="w-full h-full object-cover opacity-80"
                    onError={(e) => { e.currentTarget.src = "Background.png"; }}
                />
                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-6 left-6 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md cursor-pointer hover:bg-gray-100 transition-all"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D0065" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
            </div>

            <div className="max-w-md mx-auto w-full px-6 -mt-12 relative z-10 flex flex-col">
                <div className="bg-white rounded-3xl p-6 shadow-md border border-gray-100 flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                        <img
                            src={barber.profileImage || "Icon.png"}
                            alt="Barber"
                            className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-sm bg-gray-100"
                        />
                        <div>
                            <h1 className="text-2xl font-bold text-black leading-tight">{barber.shopName}</h1>
                            <p className="text-sm font-semibold text-[var(--text-muted)] mt-1">{barber.name}</p>
                        </div>
                    </div>

                    <hr className="border-gray-100 my-2" />

                    <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl">
                        <div>
                            <p className="text-xs text-[var(--text-light)] font-semibold uppercase tracking-wider mb-1">Details</p>
                            <p className="text-sm font-semibold text-black">{barber.workingHours}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-[var(--text-light)] font-semibold uppercase tracking-wider mb-1">Status</p>
                            <p className={`text-sm font-bold ${barber.isWorkingNow === false ? 'text-red-500' : 'text-green-500'}`}>
                                {barber.isWorkingNow === false ? 'Offline' : 'Online'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-8">
                    <h2 className="text-xl font-bold text-black mb-4">Available Times</h2>
                    {slots.length > 0 ? (
                        <div className="grid grid-cols-3 gap-3">
                            {slots.map((slot, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedSlot(slot)}
                                    className={`py-3 rounded-xl text-sm font-bold transition-all border ${selectedSlot === slot ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-md' : 'bg-white text-[var(--text-muted)] border-gray-200 hover:border-[var(--primary)] hover:text-[var(--primary)]'}`}
                                >
                                    {slot}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[var(--text-light)] text-sm">No available slots.</p>
                    )}
                </div>

                <button
                    disabled={!selectedSlot}
                    className="btn-primary mt-10"
                    onClick={() => alert(`Slot ${selectedSlot} booked successfully!`)}
                >
                    {selectedSlot ? `Book for ${selectedSlot}` : "Select a time"}
                </button>
            </div>
        </section>
    );
}

export default BarbershopDetails;
