import { Heart, Phone, MapPin, Clock } from 'lucide-react';
import { t } from '../utils/i18n.js';
import { Sheet, Button } from './ui/index.js';

function BarberProfileModal({ barber, isOpen, onClose, onBookNow, onToggleFavorite, isFavorite }) {
    if (!barber) return null;

    const shopImg = (barber.office_img && barber.office_img !== '')
        ? barber.office_img
        : (barber.shopImage && barber.shopImage !== '')
            ? barber.shopImage
            : 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&auto=format&fit=crop';

    return (
        <Sheet isOpen={isOpen} onClose={onClose} title={barber.office_name || barber.shopName || t('common.barbershop')}>
            <div className="relative h-40 -mx-4 -mt-2 mb-4 overflow-hidden rounded-[var(--radius-md)]">
                <img src={shopImg} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&auto=format&fit=crop'; }} />
            </div>

            <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-[var(--brand-primary-light)] flex items-center justify-center font-bold text-[var(--brand-primary)]">
                    {(barber.fullname || barber.name || 'B').charAt(0).toUpperCase()}
                </div>
                <div>
                    <p className="font-bold">{barber.fullname || barber.name || t('common.barber')}</p>
                    <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
                        <Clock size={11} />
                        {barber.working_hours || barber.workingHours || t('common.defaultWorkingHours')}
                    </p>
                </div>
            </div>

            {barber.phone && (
                <p className="text-sm text-[var(--text-secondary)] flex items-center gap-2 mb-2">
                    <Phone size={14} /> {barber.phone}
                </p>
            )}
            {barber.address && (
                <p className="text-sm text-[var(--text-secondary)] flex items-center gap-2 mb-4">
                    <MapPin size={14} /> {barber.address}
                </p>
            )}

            <div className="flex gap-3 pt-2">
                <Button className="flex-1" onClick={onBookNow}>{t('components.barberProfileModal.bookSession')}</Button>
                <Button variant="secondary" onClick={() => onToggleFavorite(barber.id)}>
                    <Heart size={18} fill={isFavorite ? '#EF4444' : 'none'} color={isFavorite ? '#EF4444' : 'currentColor'} />
                </Button>
            </div>
        </Sheet>
    );
}

export default BarberProfileModal;
