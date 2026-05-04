import { useState, useEffect } from 'react';
import { X, Phone, Calendar, Clock, TrendingUp, User, AlertCircle } from 'lucide-react';
import { getBookings } from '../api/bookingApi.js';

function ClientProfileModal({ client, isOpen, onClose }) {
    const [stats, setStats] = useState({
        totalVisits: 0,
        cancellations: 0,
        lastBooking: null,
        completedBookings: 0,
        noShows: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && client?.id) {
            fetchClientStats();
        }
    }, [isOpen, client?.id]);

    const fetchClientStats = async () => {
        try {
            setLoading(true);
            const { data: bookings } = await getBookings();
            
            if (bookings) {
                const clientBookings = bookings.filter(b => b.client === client.id);
                const completedBookings = clientBookings.filter(b => b.status === 'completed');
                const cancelledBookings = clientBookings.filter(b => b.status === 'cancelled');
                const noShows = clientBookings.filter(b => b.status === 'rejected' || b.status === 'no-show');
                
                // Sort by date to get last booking
                const sortedBookings = clientBookings.sort((a, b) => 
                    new Date(b.createdAt) - new Date(a.createdAt)
                );
                
                setStats({
                    totalVisits: clientBookings.length,
                    cancellations: cancelledBookings.length,
                    lastBooking: sortedBookings[0] || null,
                    completedBookings: completedBookings.length,
                    noShows: noShows.length
                });
            }
        } catch (error) {
            console.error('[CLIENT PROFILE] Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !client) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="relative bg-gradient-to-r from-blue-500 to-purple-600 p-6 rounded-t-2xl">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-2 rounded-full hover:bg-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                    
                    <div className="flex items-center gap-4">
                        <img
                            src="https://i.pravatar.cc/150?u=client"
                            alt={client.name || client.fullname || 'Client'}
                            className="w-20 h-20 rounded-full border-4 border-white/20"
                        />
                        <div className="text-white">
                            <h2 className="text-2xl font-bold mb-1">
                                {client.name || client.fullname || 'Client'}
                            </h2>
                            <p className="text-white/90">Client since {new Date(client.createdAt).getFullYear()}</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Basic Info */}
                    <div className="space-y-4 mb-6">
                        <div className="flex items-center gap-3 text-gray-600">
                            <Phone size={18} />
                            <span>{client.phone || '+998 XX XXX XX XX'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-gray-600">
                            <User size={18} />
                            <span>{client.email || 'client@example.com'}</span>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="mb-6">
                        <h3 className="font-bold text-gray-900 mb-4">Booking History</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <div className="flex items-center gap-2 text-gray-600 mb-1">
                                    <Calendar size={16} />
                                    <span className="text-sm">Total Visits</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900">
                                    {loading ? '...' : stats.totalVisits}
                                </p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <div className="flex items-center gap-2 text-gray-600 mb-1">
                                    <TrendingUp size={16} />
                                    <span className="text-sm">Completed</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900">
                                    {loading ? '...' : stats.completedBookings}
                                </p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <div className="flex items-center gap-2 text-gray-600 mb-1">
                                    <X size={16} />
                                    <span className="text-sm">Cancellations</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900">
                                    {loading ? '...' : stats.cancellations}
                                </p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <div className="flex items-center gap-2 text-gray-600 mb-1">
                                    <AlertCircle size={16} />
                                    <span className="text-sm">No Shows</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900">
                                    {loading ? '...' : stats.noShows}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Last Booking */}
                    {stats.lastBooking && (
                        <div className="mb-6">
                            <h3 className="font-bold text-gray-900 mb-3">Last Booking</h3>
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-sm text-gray-600">Date</p>
                                        <p className="font-medium text-gray-900">
                                            {new Date(stats.lastBooking.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-gray-600">Time</p>
                                        <p className="font-medium text-gray-900">
                                            {stats.lastBooking.booking_hours}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <span className={`px-2 py-1 text-xs font-bold rounded-md ${
                                        stats.lastBooking.status === 'completed' 
                                            ? 'bg-green-100 text-green-700' 
                                            : stats.lastBooking.status === 'cancelled'
                                            ? 'bg-red-100 text-red-700'
                                            : stats.lastBooking.status === 'rejected'
                                            ? 'bg-gray-100 text-gray-700'
                                            : 'bg-orange-100 text-orange-700'
                                    }`}>
                                        {stats.lastBooking.status || 'pending'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Client Reliability */}
                    <div>
                        <h3 className="font-bold text-gray-900 mb-3">Reliability Score</h3>
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-gray-600">Show-up Rate</span>
                                <span className="font-bold text-gray-900">
                                    {stats.totalVisits > 0 
                                        ? Math.round((stats.completedBookings / stats.totalVisits) * 100) 
                                        : 0}%
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                                    style={{ 
                                        width: `${stats.totalVisits > 0 
                                            ? (stats.completedBookings / stats.totalVisits) * 100 
                                            : 0}%` 
                                    }}
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                {stats.totalVisits > 0 
                                    ? stats.completedBookings >= stats.totalVisits * 0.8 
                                        ? 'Excellent reliability'
                                        : stats.completedBookings >= stats.totalVisits * 0.6
                                        ? 'Good reliability'
                                        : 'Needs improvement'
                                    : 'No booking history yet'
                                }
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ClientProfileModal;
