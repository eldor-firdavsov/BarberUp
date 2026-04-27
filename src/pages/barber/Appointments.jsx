import React, { useState } from 'react';
import { Calendar as CalendarIcon, Check, X, Clock, MapPin } from 'lucide-react';

function Appointments() {
    // Generate a fixed mock schedule for today
    const [bookings, setBookings] = useState([
        { id: 101, client: "James Smith", time: "09:00", service: "Haircut", status: "pending", image: "https://i.pravatar.cc/150?u=12" },
        { id: 102, client: "Richard Roe", time: "10:30", service: "Beard Trim", status: "accepted", image: "https://i.pravatar.cc/150?u=13" },
        { id: 103, client: "Samuel Jackson", time: "13:00", service: "Haircut & Beard", status: "pending", image: "https://i.pravatar.cc/150?u=14" },
        { id: 104, client: "Daniel Craig", time: "15:00", service: "Haircut", status: "accepted", image: "https://i.pravatar.cc/150?u=15" },
        { id: 105, client: "Tom Hardy", time: "16:30", service: "Styling", status: "rejected", image: "https://i.pravatar.cc/150?u=16" },
    ]);

    const handleStatusUpdate = (id, newStatus) => {
        setBookings(bookings.map(b => b.id === id ? { ...b, status: newStatus } : b));
    };

    // For rendering a day timeline, simply list the current bookings sorted by time for simplicity
    const sortedBookings = [...bookings].sort((a, b) => a.time.localeCompare(b.time));

    // Get today's formatted date
    const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    return (
        <div className="px-6 py-4 space-y-6 page-animate h-full pb-24">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--primary)]">Schedule</h1>
                    <p className="text-[var(--text-light)] text-sm mt-1">Manage your appointments</p>
                </div>
                <div className="bg-[var(--primary)]/10 text-[var(--primary)] p-3 rounded-xl flex flex-col items-center justify-center">
                    <span className="text-xs font-bold uppercase">{new Date().toLocaleDateString('en-US', { month: 'short' })}</span>
                    <span className="text-xl font-black leading-none">{new Date().getDate()}</span>
                </div>
            </div>

            {/* Date Selector (Visual Only) */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
                {[0, 1, 2, 3, 4].map((offset) => {
                    const d = new Date();
                    d.setDate(d.getDate() + offset);
                    const isToday = offset === 0;
                    return (
                        <div key={offset} className={`min-w-[60px] p-3 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${isToday ? 'bg-[var(--primary)] text-white shadow-md' : 'bg-white border border-[var(--border-color)] text-[var(--text-muted)]'}`}>
                            <span className="text-xs font-medium mb-1">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                            <span className="text-lg font-bold">{d.getDate()}</span>
                        </div>
                    );
                })}
            </div>

            {/* Timeline View */}
            <div className="space-y-4">
                <h2 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mx-1">Today's Schedule</h2>

                <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-[var(--border-color)] overflow-hidden divide-y divide-[var(--border-color)]">
                    {sortedBookings.map((booking) => (
                        <div key={booking.id} className="p-4 flex gap-4">
                            {/* Time Column */}
                            <div className="flex flex-col items-center w-16 pt-1">
                                <span className="font-bold text-[var(--text-main)] text-sm">{booking.time}</span>
                                <span className="text-xs text-[var(--text-light)]">AM/PM</span> {/* Simplification */}
                            </div>

                            {/* Divider Line */}
                            <div className="w-px bg-gray-200 relative">
                                <div className={`absolute top-2 -left-1 w-2.5 h-2.5 rounded-full ${booking.status === 'accepted' ? 'bg-green-500' : booking.status === 'pending' ? 'bg-orange-400' : 'bg-red-500'}`} />
                            </div>

                            {/* Booking Card */}
                            <div className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-100">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <img src={booking.image} alt={booking.client} className="w-8 h-8 rounded-full" />
                                        <div>
                                            <h3 className="font-bold text-[var(--text-main)] text-sm">{booking.client}</h3>
                                            <p className="text-xs text-[var(--text-light)]">{booking.service}</p>
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    {booking.status === 'accepted' && (
                                        <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">Confirmed</span>
                                    )}
                                    {booking.status === 'rejected' && (
                                        <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">Rejected</span>
                                    )}
                                    {booking.status === 'pending' && (
                                        <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider flex items-center gap-1">
                                            <Clock size={10} /> Pending
                                        </span>
                                    )}
                                </div>

                                {/* Actions for Pending */}
                                {booking.status === 'pending' && (
                                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                                        <button
                                            onClick={() => handleStatusUpdate(booking.id, 'accepted')}
                                            className="flex-1 flex items-center justify-center gap-1 bg-green-500 text-white text-xs font-bold py-2 rounded-lg transition-transform active:scale-95"
                                        >
                                            <Check size={14} /> Accept
                                        </button>
                                        <button
                                            onClick={() => handleStatusUpdate(booking.id, 'rejected')}
                                            className="flex-1 flex items-center justify-center gap-1 bg-gray-200 text-gray-700 text-xs font-bold py-2 rounded-lg transition-transform active:scale-95"
                                        >
                                            <X size={14} /> Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
}

export default Appointments;
