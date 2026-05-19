import { X, Phone, MapPin, Heart } from 'lucide-react';

function BarberProfileModal({ barber, isOpen, onClose, onBookNow, onToggleFavorite, isFavorite }) {

    if (!isOpen || !barber) return null;

    const shopImg = (barber.office_img && barber.office_img !== '')
        ? barber.office_img
        : (barber.shopImage && barber.shopImage !== '')
            ? barber.shopImage
            : 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&auto=format&fit=crop';

    const hasProfileImg = (barber.profile_img && barber.profile_img !== '');
    const initial = (barber.fullname || barber.name || 'B').charAt(0).toUpperCase();

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[92vh] overflow-y-auto">

                {/* Cover Image */}
                <div className="relative h-52 rounded-t-3xl overflow-hidden">
                    <img
                        src={shopImg}
                        alt={barber.office_name || barber.shopName || 'Barbershop'}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&auto=format&fit=crop'; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm p-2 rounded-full hover:bg-white/40 transition-all"
                    >
                        <X size={20} className="text-white" />
                    </button>

                    {/* Profile image + name overlay */}
                    <div className="absolute bottom-4 left-4 flex items-end gap-3">
                        {(barber.profile_img && barber.profile_img.trim() !== '') ? (
                            <img
                                src={barber.profile_img}
                                alt={barber.fullname || barber.name || 'B'}
                                className="w-14 h-14 rounded-full border-2 border-white object-cover bg-gray-200"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                }}
                            />
                        ) : (
                            <div className="w-14 h-14 rounded-full border-2 border-white bg-[#1D0065] flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-lg font-bold">
                                    {(barber.fullname || barber.name || 'B').charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                        <div>
                            <h2 className="text-xl font-bold text-white leading-tight">
                                {barber.office_name || barber.shopName || 'Barbershop'}
                            </h2>
                            <p className="text-white/80 text-sm">
                                {barber.fullname || barber.name || 'Barber'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5">

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={onBookNow}
                            className="flex-1 bg-[#1D0065] text-white px-4 py-3 rounded-2xl font-bold hover:bg-[#1D0065]/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            Book Session
                        </button>
                        <button
                            onClick={() => onToggleFavorite(barber.id)}
                            className={`p-3 rounded-2xl font-bold transition-all hover:scale-110 ${isFavorite
                                ? 'bg-red-50 text-red-500'
                                : 'bg-gray-100 text-gray-400'
                                }`}
                        >
                            <Heart size={22} fill={isFavorite ? 'currentColor' : 'none'} />
                        </button>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-2xl p-4">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Price</p>
                            <p className="font-bold text-gray-900 text-base">
                                {(barber.average_price ?? barber.avgPrice ?? 0).toLocaleString()} UZS
                            </p>
                        </div>
                        <div className="bg-gray-50 rounded-2xl p-4">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Hours</p>
                            <p className="font-bold text-gray-900 text-sm">
                                {barber.working_hours || barber.workingHours || 'N/A'}
                            </p>
                        </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-3">
                        {barber.phone && (
                            <div className="flex items-center gap-3 text-gray-600 bg-gray-50 rounded-xl p-3">
                                <Phone size={16} className="text-[#1D0065] flex-shrink-0" />
                                <span className="text-sm font-medium">{barber.phone}</span>
                            </div>
                        )}
                        {barber.address && (
                            <div className="flex items-start gap-3 text-gray-600 bg-gray-50 rounded-xl p-3">
                                <MapPin size={16} className="text-[#1D0065] flex-shrink-0 mt-0.5" />
                                <span className="text-sm font-medium">{barber.address}</span>
                            </div>
                        )}
                        {barber.office_description && (
                            <div className="bg-gray-50 rounded-xl p-4">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">About</p>
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    {barber.office_description}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default BarberProfileModal;
