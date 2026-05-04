import { X, Phone, Clock, MapPin, Heart } from 'lucide-react';

function BarberProfileModal({ barber, isOpen, onClose, onBookNow, onToggleFavorite, isFavorite }) {

    if (!isOpen || !barber) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="relative">
                    <img
                        src={barber.shopImage || 'Background.png'}
                        alt={barber.shopName || barber.name}
                        className="w-full h-48 object-cover rounded-t-2xl"
                        onError={(e) => { e.currentTarget.src = 'Background.png'; }}
                    />
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-2 rounded-full hover:bg-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                    
                    {/* Profile Info Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6 rounded-b-2xl">
                        <h2 className="text-2xl font-bold text-white mb-1">
                            {barber.shopName || barber.name || 'Barbershop'}
                        </h2>
                        <p className="text-white/90">{barber.name || 'Professional Barber'}</p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Quick Actions */}
                    <div className="flex gap-3 mb-6">
                        <button
                            onClick={onBookNow}
                            className="flex-1 bg-[var(--primary)] text-white px-4 py-3 rounded-lg font-bold hover:bg-[var(--primary)]/90 transition-colors"
                        >
                            Book Now
                        </button>
                        <button
                            onClick={() => onToggleFavorite(barber.id)}
                            className={`px-4 py-3 rounded-lg font-bold transition-colors ${
                                isFavorite
                                    ? 'bg-red-50 text-red-500 hover:bg-red-100'
                                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                            }`}
                        >
                            <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
                        </button>
                    </div>

                    {/* Basic Info */}
                    <div className="space-y-4 mb-6">
                        <div className="flex items-center gap-3 text-gray-600">
                            <Phone size={18} />
                            <span>{barber.phone || '+998 XX XXX XX XX'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-gray-600">
                            <Clock size={18} />
                            <span>{barber.workingHours || '09:00 - 18:00'}</span>
                        </div>
                        {barber.district && (
                            <div className="flex items-center gap-3 text-gray-600">
                                <MapPin size={18} />
                                <span>{barber.district}</span>
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    {barber.office_description && (
                        <div className="mb-6">
                            <h3 className="font-bold text-gray-900 mb-2">About</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                {barber.office_description}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default BarberProfileModal;
