import { X, Phone, MapPin, Heart } from 'lucide-react';

function BarberProfileModal({ barber, isOpen, onClose, onBookNow, onToggleFavorite, isFavorite }) {

    if (!isOpen || !barber) return null;

    const shopImg = (barber.office_img && barber.office_img !== '')
        ? barber.office_img
        : (barber.shopImage && barber.shopImage !== '')
            ? barber.shopImage
            : 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&auto=format&fit=crop';

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
            <div className="bg-white rounded-[32px] border border-black/5 shadow-[0_20px_60px_rgba(0,0,0,0.15)] max-w-md w-full max-h-[92vh] overflow-y-auto">

                {/* Cover Image */}
                <div className="relative h-56 rounded-t-[32px] overflow-hidden">
                    <img
                        src={shopImg}
                        alt={barber.office_name || barber.shopName || 'Barbershop'}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&auto=format&fit=crop'; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 backdrop-blur-md w-10 h-10 rounded-full flex items-center justify-center transition-all border border-white/20"
                    >
                        <X size={18} className="text-white" />
                    </button>

                    {/* Profile image + name overlay */}
                    <div className="absolute bottom-5 left-5 flex items-end gap-3">
                        {(barber.profile_img && barber.profile_img.trim() !== '') ? (
                            <img
                                src={barber.profile_img}
                                alt={barber.fullname || barber.name || 'B'}
                                className="w-14 h-14 rounded-full border-2 border-white object-cover ring-4 ring-white/20"
                                onError={(e) => { e.target.style.display = 'none'; }}
                            />
                        ) : (
                            <div className="w-14 h-14 rounded-full border-2 border-white bg-black flex items-center justify-center ring-4 ring-white/20">
                                <span className="text-white text-lg font-bold">
                                    {(barber.fullname || barber.name || 'B').charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                        <div>
                            <h2 className="text-xl font-bold text-white leading-tight tracking-[-0.02em]">
                                {barber.office_name || barber.shopName || 'Barbershop'}
                            </h2>
                            <p className="text-white/80 text-sm font-medium">
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
                            className="flex-1 h-13 bg-black text-white px-4 py-3 rounded-2xl font-semibold text-sm hover:bg-[#111] transition-all duration-200 shadow-[0_8px_20px_rgba(0,0,0,0.15)]"
                        >
                            Book Session
                        </button>
                        <button
                            onClick={() => onToggleFavorite(barber.id)}
                            className={`w-13 h-13 px-3 py-3 rounded-2xl font-bold transition-all duration-200 border ${isFavorite
                                ? 'bg-black text-white border-black'
                                : 'bg-[#f8f8f8] text-[#888] border-black/5 hover:bg-[#f0f0f0]'
                                }`}
                        >
                            <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
                        </button>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#f8f8f8] rounded-3xl p-5 border border-black/5">
                            <p className="text-[11px] font-semibold text-[#888] uppercase tracking-[0.12em] mb-2">Price</p>
                            <p className="font-bold text-[#111] text-[18px]">
                                {(barber.average_price ?? barber.avgPrice ?? 0).toLocaleString()} UZS
                            </p>
                        </div>
                        <div className="bg-[#f8f8f8] rounded-3xl p-5 border border-black/5">
                            <p className="text-[11px] font-semibold text-[#888] uppercase tracking-[0.12em] mb-2">Hours</p>
                            <p className="font-bold text-[#111] text-sm leading-tight">
                                {barber.working_hours || barber.workingHours || 'N/A'}
                            </p>
                        </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-3">
                        {barber.phone && (
                            <div className="flex items-center gap-3 bg-[#f8f8f8] border border-black/5 rounded-3xl p-4">
                                <Phone size={15} className="text-[#888] flex-shrink-0" />
                                <span className="text-sm font-medium text-[#555]">{barber.phone}</span>
                            </div>
                        )}
                        {barber.address && (
                            <div className="flex items-start gap-3 bg-[#f8f8f8] border border-black/5 rounded-3xl p-4">
                                <MapPin size={15} className="text-[#888] flex-shrink-0 mt-0.5" />
                                <span className="text-sm font-medium text-[#555]">{barber.address}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default BarberProfileModal;
