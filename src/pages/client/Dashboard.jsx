import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBarbers } from '../../api/barberApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatTo24h } from '../../utils/time.js';
import { Heart, MapPin } from 'lucide-react';
import BarberProfileModal from '../../components/BarberProfileModal.jsx';


// NOTE FOR BACKEND:
// barber.location currently returns:
// { address: "string", type: "Point" }
// It is MISSING the coordinates array.
// Expected format:
// { 
//   address: "string", 
//   type: "Point",
//   coordinates: [longitude, latitude] 
// }
// Until backend is fixed, distance 
// will show "Location not set" for all barbers.



function Client() {
    const { user } = useAuth();
    const [barbers, setBarbers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [retrying, setRetrying] = useState(false);
    const [favoriteBarbers, setFavoriteBarbers] = useState([]);
    const [activeTab, setActiveTab] = useState('nearby'); // 'favorites', 'nearby', 'map'
    const [clientCoords, setClientCoords] = useState(null);
    const [locationError, setLocationError] = useState(null);
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
                if (filtered.length > 0) {
                    const b = filtered[0];
                    console.log('=== BARBER IMAGE AUDIT ===');
                    console.log('profile_img:', JSON.stringify(b.profile_img));
                    console.log('profileImage:', JSON.stringify(b.profileImage));
                    console.log('office_img:', JSON.stringify(b.office_img));
                    console.log('shopImage:', JSON.stringify(b.shopImage));
                    console.log('=== BARBER LOCATION AUDIT ===');
                    console.log('coordinates:', JSON.stringify(b.coordinates));
                    console.log('location:', JSON.stringify(b.location));
                    console.log('address:', JSON.stringify(b.address));
                    console.log('=== FULL BARBER OBJECT ===');
                    console.log(JSON.stringify(b, null, 2));
                }
            }
            setLoading(false);
        }
        fetchAPI();
        return () => { isMounted = false; };
    }, [user?.id, user?.email]);

    // Get client's current location
    useEffect(() => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by your browser');
            return;
        }

        const handleSuccess = (position) => {
            const { latitude, longitude } = position.coords;
            setClientCoords({ lat: latitude, lng: longitude });
            console.log('=== CLIENT COORDS SET ===',
                position.coords.latitude, position.coords.longitude);

            // Store in localStorage for persistence
            localStorage.setItem('client_location', JSON.stringify({
                coordinates: [longitude, latitude],
                timestamp: Date.now()
            }));
        };

        const handleError = (error) => {
            console.error('[GEOLOCATION] Error:', error);
            console.log('=== GEOLOCATION FAILED ===',
                error.message);
            setLocationError('Unable to get your location');
            // Use default Tashkent coordinates
            setClientCoords({ lat: 41.2995, lng: 69.2401 });
        };

        navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
        });
    }, []);

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
        const workingHours = barber.working_hours || barber.workingHours || '';
        if (!workingHours) return 'Available';
        const parts = workingHours.split(' - ');
        if (parts.length < 2) return 'Available';
        const start = formatTo24h(parts[0]);
        const end = formatTo24h(parts[1]);
        if (!start || !end) return 'Available';
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;
        if (nowMins < startMins || nowMins >= endMins) return 'Currently Offline';
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

    // Haversine distance calculation function
    const getDistanceKm = (lat1, lng1, lat2, lng2) => {
        const R = 6371; // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Memoized distance calculation function
    const calculateDistance = useCallback((barber) => {
        if (!clientCoords) return null;

        // Try all possible coordinate locations
        // Backend may store as:
        // barber.coordinates = [lng, lat]
        // barber.location.coordinates = [lng, lat]  
        // barber.location = { address, type: "Point" }
        //   (no coordinates — backend bug)

        let coords = null;

        if (Array.isArray(barber.coordinates) &&
            barber.coordinates.length >= 2) {
            coords = barber.coordinates;
        } else if (barber.location &&
            Array.isArray(barber.location.coordinates) &&
            barber.location.coordinates.length >= 2) {
            coords = barber.location.coordinates;
        }

        if (!coords) return null;

        const [lng2, lat2] = coords;

        // Validate coordinate ranges
        if (isNaN(lat2) || isNaN(lng2)) return null;
        if (Math.abs(lat2) > 90 || Math.abs(lng2) > 180)
            return null;
        if (lat2 === 0 && lng2 === 0) return null;

        const dist = getDistanceKm(
            clientCoords.lat,
            clientCoords.lng,
            lat2,
            lng2
        );

        // Sanity check — Tashkent barbers within 500km
        if (dist > 500) return null;

        return dist;
    }, [clientCoords]);

    // Memoized filtered and sorted barbers to prevent recalculation on every render
    const filteredAndSortedBarbers = useMemo(() => {
        return barbers
            .map(barber => ({
                ...barber,
                _dist: calculateDistance(barber)
            }))
            .filter(barber => {
                if (activeTab === 'favorites') {
                    return favoriteBarbers.includes(barber.id);
                }
                return true; // Show all for nearby tab
            })
            .sort((a, b) => {
                if (activeTab === 'nearby') {
                    // Barbers with no distance go to end
                    if (a._dist === null && b._dist === null)
                        return 0;
                    if (a._dist === null) return 1;
                    if (b._dist === null) return -1;
                    return a._dist - b._dist;
                }
                return (a.office_name || '').localeCompare(b.office_name || '');
            });
    }, [barbers, activeTab, favoriteBarbers, calculateDistance]);


    return (
        <section className="min-h-screen bg-[#f5f5f7] max-w-md mx-auto px-4 py-8 sm:px-6 sm:py-12 flex flex-col">
            <h1 className="text-[28px] font-bold text-[#111] tracking-[-0.03em] leading-tight mb-3">
                Elevate your<br />Grooming.
            </h1>
            <p className="text-sm text-[#666] font-medium mb-8">
                Discover the finest ateliers in the city. Hand-picked masters of the craft, ready for your next transformation.
            </p>

            <div className="flex bg-[#f8f8f8] p-1.5 rounded-2xl mb-8 border border-black/5">
                <button
                    onClick={() => setActiveTab('nearby')}
                    className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all uppercase tracking-wider ${activeTab === 'nearby' ? 'bg-white shadow-sm text-[#111]' : 'text-[#666]'
                        }`}
                >
                    Nearby
                </button>
                <button
                    onClick={() => setActiveTab('favorites')}
                    className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all uppercase tracking-wider ${activeTab === 'favorites' ? 'bg-white shadow-sm text-[#111]' : 'text-[#666]'
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
                                onClick={() => setActiveTab('nearby')}
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
                            className="bg-white rounded-[32px] overflow-hidden border border-black/5 shadow-[0_10px_40px_rgba(0,0,0,0.06)] cursor-pointer group min-h-[120px] transition-all duration-200 hover:shadow-[0_15px_50px_rgba(0,0,0,0.08)]"
                        >
                            <div className="relative overflow-hidden rounded-t-[32px]">
                                <img
                                    src={
                                        (barber.office_img && barber.office_img !== '')
                                            ? barber.office_img
                                            : (barber.shopImage && barber.shopImage !== '')
                                                ? barber.shopImage
                                                : 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&auto=format&fit=crop'
                                    }
                                    alt="Shop"
                                    className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-300"
                                    onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&auto=format&fit=crop'; }}
                                />
                                <div className="absolute top-4 right-4">
                                    <button
                                        onClick={(e) => toggleFavorite(barber.id, e)}
                                        className="bg-white/90 backdrop-blur-sm p-2.5 rounded-full hover:bg-white transition-all hover:scale-110 shadow-lg"
                                    >
                                        <Heart size={18} fill={isFavorite(barber.id) ? 'red' : 'none'} color={isFavorite(barber.id) ? '#EF4444' : '#9CA3AF'} />
                                    </button>
                                </div>
                                <div className="absolute bottom-4 left-4">
                                    <span className={getBarberStatus(barber) === 'Available' ? "bg-green-500 text-white shadow-md text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-full" : "bg-[#111] text-white shadow-md text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-full"}>
                                        {getBarberStatus(barber)}
                                    </span>
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="mb-4">
                                    <h3 className="text-xl mb-1 font-bold text-[#111] truncate">{barber.office_name || barber.shopName || 'Barbershop'}</h3>
                                    <div className="flex items-center gap-3 mt-2">
                                        <div className="flex items-center gap-2">
                                            {(barber.profile_img && barber.profile_img.trim() !== '') ? (
                                                <img
                                                    src={barber.profile_img}
                                                    alt={barber.fullname || barber.name || 'B'}
                                                    className="w-7 h-7 rounded-full object-cover bg-[#f8f8f8] flex-shrink-0 border border-black/5"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                    }}
                                                />
                                            ) : (
                                                <div className="w-7 h-7 bg-[#f8f8f8] rounded-full flex items-center justify-center flex-shrink-0 border border-black/5">
                                                    <span className="text-[#111] text-xs font-bold">
                                                        {(barber.fullname || barber.name || 'B').charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                            )}
                                            <span className="font-semibold text-sm text-[#666] truncate">{barber.fullname || barber.name || 'Barber'}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 mt-3">
                                        <div className="bg-[#f8f8f8] px-2.5 py-1 rounded-xl text-xs font-semibold text-[#666] border border-black/5">
                                            {(barber.average_price ?? barber.avgPrice ?? 0).toLocaleString()} UZS
                                        </div>
                                        <div className="bg-[#f8f8f8] px-2.5 py-1 rounded-xl text-xs font-semibold text-[#666] border border-black/5">
                                            {barber.working_hours || barber.workingHours || '09:00 - 21:00'}
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-black/5 flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-[10px] font-bold text-[#666] uppercase tracking-wider mb-0.5">
                                                {activeTab === 'nearby' ? 'Distance' : 'Status'}
                                            </h2>
                                            {activeTab === 'nearby' ? (
                                                <span className="text-sm font-bold text-[#111] flex items-center gap-1">
                                                    <MapPin size={16} className="text-[#111]" /> {barber._dist !== null && barber._dist !== undefined ? `${Number(barber._dist).toFixed(1)} km away` : 'Location not set'}
                                                </span>
                                            ) : (
                                                <span className="text-sm font-bold text-[#111]">
                                                    {getBarberStatus(barber)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openProfileModal(barber);
                                            }}
                                            className="h-11 rounded-2xl bg-white border border-black/5 text-[#111] font-semibold text-xs transition-all duration-200 hover:bg-[#f8f8f8] hover:border-black/10 shadow-[0_4px_20px_rgba(0,0,0,0.04)]"
                                        >
                                            View Profile
                                        </button>
                                        <button
                                            className="h-11 rounded-2xl bg-black hover:bg-[#111] text-white font-semibold text-xs transition-all duration-200 shadow-[0_10px_25px_rgba(0,0,0,0.12)]"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/barber/${encodeURIComponent(barber.id ?? barber.email)}`);
                                            }}
                                        >
                                            Book Session
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
                    <p className="text-base text-[#666] font-semibold">No barbers available</p>
                </div>
            )}

            {/* Barber Profile Modal */}
            <BarberProfileModal
                barber={profileModal.barber}
                isOpen={profileModal.open}
                onClose={closeProfileModal}
                onBookNow={() => handleBookFromProfile(profileModal.barber)}
                onToggleFavorite={(barberId) => toggleFavorite(barberId, { stopPropagation: () => { } })}
                isFavorite={profileModal.barber ? isFavorite(profileModal.barber.id) : false}
            />
        </section>
    );
}

export default Client;
