import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBarbers } from '../../api/barberApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Heart } from 'lucide-react';
import BarberProfileModal from '../../components/BarberProfileModal.jsx';

function Client() {
    const { user } = useAuth();
    const [barbers, setBarbers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [retrying, setRetrying] = useState(false);
    const [favoriteBarbers, setFavoriteBarbers] = useState([]);
    const [activeTab, setActiveTab] = useState('nearby'); // 'favorites', 'nearby'
    const [profileModal, setProfileModal] = useState({ open: false, barber: null });
    const navigate = useNavigate();

    useEffect(() => {
        let isMounted = true;
        async function fetchAPI() {
            setLoading(true);
            setError('');
            console.log('[ClientDashboard] Fetching barbers…');
            const { data, error: apiError } = await getBarbers();

            if (!isMounted) return;

            console.log('[ClientDashboard] result → data:', data, '| error:', apiError);

            if (apiError || !data) {
                setError('Something went wrong');
                setBarbers([]);
            } else {
                const filtered = (data ?? []).filter(
                    (barber) => barber.id !== user?.id && barber.email !== user?.email
                );
                setBarbers(filtered);
            }
            setLoading(false);
        }
        fetchAPI();
        return () => { isMounted = false; };
    }, [user?.id, user?.email]);

    // Load favorite barbers from localStorage
    useEffect(() => {
        if (user?.id) {
            const storageKey = `favorite_barbers_${user.id}`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                try {
                    const favorites = JSON.parse(stored);
                    setFavoriteBarbers(Array.isArray(favorites) ? favorites : []);
                    console.log('[FAVORITES] Loaded:', favorites);
                } catch (error) {
                    console.error('[FAVORITES] Error loading:', error);
                    setFavoriteBarbers([]);
                }
            }
        }
    }, [user?.id]);

    const toggleFavorite = (barberId, event) => {
        event.stopPropagation(); // Prevent card click
        
        if (!user?.id) {
            console.error('[FAVORITES] Cannot toggle favorite - no user ID');
            return;
        }
        
        const storageKey = `favorite_barbers_${user.id}`;
        let newFavorites;
        
        if (favoriteBarbers.includes(barberId)) {
            // Remove from favorites
            newFavorites = favoriteBarbers.filter(id => id !== barberId);
            console.log('[FAVORITES] Removed:', barberId);
        } else {
            // Add to favorites
            newFavorites = [...favoriteBarbers, barberId];
            console.log('[FAVORITES] Added:', barberId);
        }
        
        setFavoriteBarbers(newFavorites);
        localStorage.setItem(storageKey, JSON.stringify(newFavorites));
    };

    const isFavorite = (barberId) => {
        return favoriteBarbers.includes(barberId);
    };

    const openProfileModal = (barber) => {
        setProfileModal({ open: true, barber });
        console.log('[PROFILE MODAL] Opening for barber:', barber.id);
    };

    const closeProfileModal = () => {
        setProfileModal({ open: false, barber: null });
    };

    const handleBookFromProfile = (barber) => {
        closeProfileModal();
        navigate(`/barber/${encodeURIComponent(barber.id ?? barber.email)}`);
    };

    const handleRetry = async () => {
        setRetrying(true);
        setLoading(true);
        setError('');
        const { data, error: apiError } = await getBarbers();
        if (apiError || !data) {
            setError('Something went wrong');
            setBarbers([]);
        } else {
            const filtered = (data ?? []).filter(
                (barber) => barber.id !== user?.id && barber.email !== user?.email
            );
            setBarbers(filtered);
        }
        setLoading(false);
        setRetrying(false);
    };

    const getBarberStatus = (barber) => {
        if (barber.status === 'inactive') return 'Currently Offline';
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();

        // Parse working hours (e.g., "09:00 AM - 08:00 PM")
        if (barber.working_hours) {
            const [openTime, closeTime] = barber.working_hours.split(' - ');
            const [openHour, openMin, openPeriod] = openTime.match(/(\d+):(\d+)\s*(AM|PM)/i)?.slice(1) || [];
            const [closeHour, closeMin, closePeriod] = closeTime.match(/(\d+):(\d+)\s*(AM|PM)/i)?.slice(1) || [];
            
            if (openHour && closeHour) {
                let openHour24 = parseInt(openHour);
                let closeHour24 = parseInt(closeHour);
                
                if (openPeriod?.toUpperCase() === 'PM' && openHour24 !== 12) openHour24 += 12;
                if (openPeriod?.toUpperCase() === 'AM' && openHour24 === 12) openHour24 = 0;
                if (closePeriod?.toUpperCase() === 'PM' && closeHour24 !== 12) closeHour24 += 12;
                if (closePeriod?.toUpperCase() === 'AM' && closeHour24 === 12) closeHour24 = 0;
                
                const openMins = openHour24 * 60 + parseInt(openMin || 0);
                const closeMins = closeHour24 * 60 + parseInt(closeMin || 0);
                
                if (currentMins < openMins || currentMins >= closeMins) {
                    return 'Currently Offline';
                }
            }
        }
        return 'Available';
    };

    // Memoized client location to avoid repeated localStorage parsing
    const clientLocation = useMemo(() => {
        try {
            const stored = localStorage.getItem('client_location');
            return stored ? JSON.parse(stored) : { coordinates: [69.2401, 41.2995] }; // Default: Tashkent
        } catch (error) {
            console.error('[ClientDashboard] Error parsing client location:', error);
            return { coordinates: [69.2401, 41.2995] };
        }
    }, []);

    // Memoized distance calculation function
    const calculateDistance = useCallback((barber) => {
        if (!barber.location?.coordinates || !Array.isArray(barber.location.coordinates) || barber.location.coordinates.length < 2) {
            return 999999; // Put barbers without location at the end
        }
        
        const [lng1, lat1] = clientLocation.coordinates;
        const [lng2, lat2] = barber.location.coordinates;
        
        // Haversine distance formula
        const R = 6371; // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        return distance;
    }, [clientLocation]);

    // Memoized filtered and sorted barbers to prevent recalculation on every render
    const filteredAndSortedBarbers = useMemo(() => {
        return barbers
            .filter(barber => {
                if (activeTab === 'favorites') {
                    return favoriteBarbers.includes(barber.id);
                }
                return true; // Show all for nearby tab
            })
            .sort((a, b) => {
                // Sort by distance (nearest first) for both tabs
                return calculateDistance(a) - calculateDistance(b);
            });
    }, [barbers, activeTab, favoriteBarbers, calculateDistance]);

    
    return (
        <section className="page-animate max-w-md mx-auto px-6 py-8 flex flex-col">
            

            
            
            <h1 className="text-4xl font-bold text-[#1D0065] leading-tight mb-4">
                <span className="text-black">Elevate your <br /></span>Grooming.
            </h1>
            <p className="text-base text-[var(--text-muted)] leading-relaxed font-normal mb-8">
                Discover the finest ateliers in the city. <br />Hand-picked masters of the craft, ready <br />for your next transformation.
            </p>

            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar mb-8">
                <button 
                    onClick={() => setActiveTab('nearby')}
                    className={`btn-secondary whitespace-nowrap text-sm ${
                        activeTab === 'nearby' ? '!bg-[var(--primary)] !text-white' : ''
                    }`}
                >
                    Nearby
                </button>
                <button 
                    onClick={() => setActiveTab('favorites')}
                    className={`btn-secondary whitespace-nowrap text-sm ${
                        activeTab === 'favorites' ? '!bg-[var(--primary)] !text-white' : ''
                    }`}
                >
                    Favorites {favoriteBarbers.length > 0 && `(${favoriteBarbers.length})`}
                </button>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="skeleton-card"></div>
                    ))}
                </div>
            )}

            {/* Error State */}
            {error && !loading && (
                <div className="error-container">
                    <div className="error-container-header">
                        <svg className="error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="error-title">Failed to Load Barbers</span>
                    </div>
                    <p className="error-message">{error}</p>
                    <div className="error-actions">
                        <button
                            onClick={handleRetry}
                            disabled={retrying}
                            className="btn-primary"
                        >
                            {retrying ? (
                                <>
                                    <div className="spinner"></div>
                                    Retrying...
                                </>
                            ) : (
                                'Retry'
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Barber List */}
            {!loading && !error && barbers.length > 0 && (
                <div className="space-y-8 pb-10">
                    {/* Show empty state for favorites */}
                    {activeTab === 'favorites' && favoriteBarbers.length === 0 && (
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                <Heart size={40} className="text-gray-400" />
                            </div>
                            <h3 className="empty-state-title">No favorite barbers yet</h3>
                            <p className="empty-state-description">
                                Tap the heart icon on any barber to save them as favorites for faster booking
                            </p>
                            <button 
                                onClick={() => setActiveTab('all')}
                                className="btn-primary empty-state-action"
                            >
                                Discover Barbers
                            </button>
                        </div>
                    )}
                    
                    {filteredAndSortedBarbers.map((barber, index) => (
                        <div
                            key={barber.id ?? index}
                            onClick={() => navigate(`/barber/${encodeURIComponent(barber.id ?? barber.email)}`)}
                            className="card-base cursor-pointer group"
                        >
                            <div className="relative overflow-hidden rounded-t-2xl">
                                <img
                                    src={barber.shopImage || 'https://d2zdpiztbgorvt.cloudfront.net/region1/us/1322907/biz_photo/3806c4bb1b924e4c87908a506761cb-old-steel-barbershop-biz-photo-425e6efceeb04c7b9e42564ff6852b-booksy.jpeg'}
                                    alt="Shop"
                                    className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-300"
                                    onError={(e) => { e.currentTarget.src = 'Background.png'; }}
                                />
                                <div className="absolute top-4 right-4">
                                    <button
                                        onClick={(e) => toggleFavorite(barber.id, e)}
                                        className="bg-white/90 backdrop-blur-sm p-2 rounded-full hover:bg-white transition-all hover:scale-110 shadow-lg"
                                    >
                                        <Heart size={16} fill={isFavorite(barber.id) ? 'red' : 'none'} color={isFavorite(barber.id) ? '#EF4444' : '#9CA3AF'} />
                                    </button>
                                </div>
                                <div className="absolute bottom-4 left-4">
                                    <span className={`status-badge ${(() => {
                                        const status = getBarberStatus(barber);
                                        if (status === 'Available') return 'success';
                                        if (status === 'Currently Offline') return 'error';
                                        if (status === 'On Break') return 'warning';
                                        return 'neutral';
                                    })()}`}>
                                        {getBarberStatus(barber)}
                                    </span>
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="mb-4">
                                    <h3 className="text-h2 mb-2">{barber.office_name || barber.fullname || 'Modern Atelier'}</h3>
                                    <div className="flex items-center gap-3 text-small text-muted">
                                        <span>{barber.fullname}</span>
                                        {barber.working_hours && (
                                            <>
                                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                <span>{barber.working_hours}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xs font-semibold text-[var(--primary)] opacity-80 mb-1">
                                            {activeTab === 'nearby' ? 'Distance' : 'Status'}
                                        </h2>
                                        <p className="text-sm font-bold text-[#312E81]">
                                            {activeTab === 'nearby' 
                                                ? `${calculateDistance(barber).toFixed(1)} km`
                                                : getBarberStatus(barber)
                                            }
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openProfileModal(barber);
                                            }}
                                            className="px-4 py-2 border border-[var(--border-color)] rounded-lg text-[var(--text-main)] text-sm hover:bg-gray-50 transition-colors"
                                        >
                                            View Profile
                                        </button>
                                        <button
                                            className="btn-primary !w-auto px-6 !h-12 !text-sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/barber/${encodeURIComponent(barber.id ?? barber.email)}`);
                                            }}
                                        >
                                            Book session
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && barbers.length === 0 && (
                <div className="py-10 text-center">
                    <p className="text-base text-[var(--text-muted)] font-semibold">No barbers available</p>
                </div>
            )}

            {/* Barber Profile Modal */}
            <BarberProfileModal
                barber={profileModal.barber}
                isOpen={profileModal.open}
                onClose={closeProfileModal}
                onBookNow={() => handleBookFromProfile(profileModal.barber)}
                onToggleFavorite={(barberId) => toggleFavorite(barberId, { stopPropagation: () => {} })}
                isFavorite={profileModal.barber ? isFavorite(profileModal.barber.id) : false}
            />
        </section>
    );
}

export default Client;
