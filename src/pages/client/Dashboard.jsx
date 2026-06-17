import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBarbers } from '../../api/barberApi.js';
import { useClient } from '../../context/ClientContext.jsx';
import { formatTo24h } from '../../utils/time.js';
import { Heart, MapPin } from 'lucide-react';
import BarberProfileModal from '../../components/BarberProfileModal.jsx';
import AllBarbersMap from '../../components/AllBarbersMap.jsx';
import SkeletonLoader from '../../components/SkeletonLoader.jsx';
import { t } from '../../utils/i18n.js';
import { supabase } from '../../api/supabase.js';


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
    const { clientPhone } = useClient();
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

    /* ── Swipe gesture for tab switching ──────────────────────────────────── */
    const TAB_ORDER = ['nearby', 'favorites', 'map'];
    const touchRef = useRef({ startX: 0, startY: 0 });

    const onSwipeTouchStart = useCallback((e) => {
        touchRef.current.startX = e.touches[0].clientX;
        touchRef.current.startY = e.touches[0].clientY;
    }, []);

    const onSwipeTouchEnd = useCallback((e) => {
        const deltaX = touchRef.current.startX - e.changedTouches[0].clientX;
        const deltaY = touchRef.current.startY - e.changedTouches[0].clientY;

        // Only horizontal swipes that exceed 50px threshold
        if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
            setActiveTab(prev => {
                const i = TAB_ORDER.indexOf(prev);
                if (deltaX > 0 && i < TAB_ORDER.length - 1) return TAB_ORDER[i + 1];
                if (deltaX < 0 && i > 0) return TAB_ORDER[i - 1];
                return prev;
            });
        }
    }, []);

    const fetchBarbers = useCallback(async () => {
        setLoading(true);
        setError('');
        const { data, error: apiError } = await getBarbers();
        if (apiError || !data) {
            setError(t('client.dashboard.somethingWrong'));
            setBarbers([]);
        } else {
            setBarbers(data ?? []);
        }
        setLoading(false);
    }, []);

    // Initial load + Supabase Realtime: barber status/availability changes push instantly
    useEffect(() => {
        fetchBarbers();

        const channel = supabase
            .channel('client-dashboard-barbers')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'barbers' }, () => {
                fetchBarbers();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchBarbers]);

    // Get client's current location
    useEffect(() => {
        if (!navigator.geolocation) {
            setLocationError(t('client.dashboard.geoNotSupported'));
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
            setLocationError(t('client.dashboard.geoFailed'));
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
        if (clientPhone) {
            const storageKey = `favorite_barbers_${clientPhone}`;
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
    }, [clientPhone]);

    const toggleFavorite = (barberId, event) => {
        event.stopPropagation(); // Prevent card click

        if (!clientPhone) {
            console.error('[FAVORITES] Cannot toggle favorite - no client phone');
            return;
        }

        const storageKey = `favorite_barbers_${clientPhone}`;
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
        navigate(`/client/barber/${encodeURIComponent(barber.id)}`);
    };

    const handleRetry = async () => {
        setRetrying(true);
        setLoading(true);
        setError('');
        const { data, error: apiError } = await getBarbers();
        if (apiError || !data) {
            setError(t('client.dashboard.somethingWrong'));
            setBarbers([]);
        } else {
            setBarbers(data ?? []);
        }
        setLoading(false);
        setRetrying(false);
    };

    const getBarberStatus = (barber) => {
        // Use explicit DB status if set and not just the default
        const dbStatus = barber.status;
        if (dbStatus === 'working-busy') return t('status.working-busy');
        if (dbStatus === 'lunch') return t('status.lunch');
        if (dbStatus === 'closed') return t('status.closed');

        // For 'available' or missing status, validate against working hours
        const workingHours = barber.working_hours || barber.workingHours || '';
        if (!workingHours) return t('status.available');
        const parts = workingHours.split(' - ');
        if (parts.length < 2) return t('status.available');
        const start = formatTo24h(parts[0]);
        const end = formatTo24h(parts[1]);
        if (!start || !end) return t('status.available');
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;
        if (nowMins < startMins || nowMins >= endMins) return t('status.offline');
        return t('status.available');
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
                // Priority: premium > standard > free
                const tierRank = { premium: 2, standard: 1, free: 0, pro: 1 }; // pro maps same as standard for legacy
                const aRank = tierRank[a.tier] ?? 0;
                const bRank = tierRank[b.tier] ?? 0;
                if (aRank !== bRank) return bRank - aRank;

                if (activeTab === 'nearby') {
                    if (a._dist === null && b._dist === null) return 0;
                    if (a._dist === null) return 1;
                    if (b._dist === null) return -1;
                    return a._dist - b._dist;
                }
                return (a.office_name || '').localeCompare(b.office_name || '');
            });
    }, [barbers, activeTab, favoriteBarbers, calculateDistance]);


    return (
        <section className="min-h-screen bg-[#f5f5f7] max-w-md md:max-w-6xl mx-auto px-4 py-6 pb-32 sm:px-6 sm:py-12 flex flex-col safe-bottom">
            <h1 className="text-[28px] font-bold text-[#111] tracking-[-0.03em] leading-tight mb-3">
                {t('client.dashboard.titleLine1')}<br />{t('client.dashboard.titleLine2')}
            </h1>
            <p className="text-sm text-[#666] font-medium mb-8">
                {t('client.dashboard.subtitle')}
            </p>

            <div className="sticky top-2 z-20 mx-auto w-full max-w-[400px] mb-6 mt-2">
                <div className="bg-white/60 backdrop-blur-xl p-1.5 rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-white/80">
                    <div className="relative flex">
                        {/* Sliding pill — lives inside the flex row so w-1/3 = flex-1 width exactly */}
                        <div 
                            className="absolute inset-y-0 w-1/3 pointer-events-none transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                            style={{ 
                                transform: `translateX(${
                                    activeTab === 'nearby' ? 0 : activeTab === 'favorites' ? 100 : 200
                                }%)`
                            }}
                        >
                            <div className="w-full h-full bg-[#111] rounded-[18px] shadow-lg" />
                        </div>

                        <button
                            onClick={() => setActiveTab('nearby')}
                            className={`relative flex-1 py-3.5 text-[13px] font-bold rounded-[18px] transition-colors duration-300 z-10 ${
                                activeTab === 'nearby' ? 'text-white' : 'text-[#666]'
                            }`}
                        >
                            {t('client.dashboard.nearby')}
                        </button>
                        <button
                            onClick={() => setActiveTab('favorites')}
                            className={`relative flex-1 py-3.5 text-[13px] font-bold rounded-[18px] transition-colors duration-300 z-10 ${
                                activeTab === 'favorites' ? 'text-white' : 'text-[#666]'
                            }`}
                        >
                            {t('client.dashboard.favorites')}
                        </button>
                        <button
                            onClick={() => setActiveTab('map')}
                            className={`relative flex-1 py-3.5 text-[13px] font-bold rounded-[18px] transition-colors duration-300 z-10 ${
                                activeTab === 'map' ? 'text-white' : 'text-[#666]'
                            }`}
                        >
                            {t('client.dashboard.map', 'Xarita')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Swipeable Content Area */}
            <div
                onTouchStart={onSwipeTouchStart}
                onTouchEnd={onSwipeTouchEnd}
                className="flex-1 min-h-0"
            >
            {/* Loading State */}
            {loading && (
                <div className="mt-4 pt-4 md:pt-0">
                    <SkeletonLoader count={6} />
                </div>
            )}

            {/* Error State */}
            {error && !loading && (
                <div className="error-container">
                    <div className="error-container-header">
                        <svg className="error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="error-title">{t('client.dashboard.failedLoadBarbers')}</span>
                    </div>
                    <p className="error-message">{error}</p>
                    <div className="error-actions">
                        <button
                            onClick={handleRetry}
                            disabled={retrying}
                            className="btn-primary min-h-[48px]"
                        >
                            {retrying ? (
                                <>
                                    <div className="spinner"></div>
                                    {t('common.retrying')}
                                </>
                            ) : (
                                t('common.retry')
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Barber List */}
            {!loading && !error && barbers.length > 0 && (
                activeTab === 'map' ? (
                    <div className="mt-4 pb-10 fade-in">
                        <AllBarbersMap 
                            barbers={filteredAndSortedBarbers} 
                            clientCoords={clientCoords || { lat: 41.2995, lng: 69.2401 }} 
                        />
                    </div>
                ) : (
                <div className={activeTab === 'favorites' && favoriteBarbers.length === 0 ? "pb-10 fade-in" : "space-y-8 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6 pb-10 fade-in"}>
                    {/* Show empty state for favorites */}
                    {activeTab === 'favorites' && favoriteBarbers.length === 0 && (
                        <div className="empty-state min-h-[300px] sm:min-h-0">
                            <div className="empty-state-icon">
                                <Heart size={40} className="text-gray-400" />
                            </div>
                            <h3 className="empty-state-title">{t('client.dashboard.noFavoritesTitle')}</h3>
                            <p className="empty-state-description">
                                {t('client.dashboard.noFavoritesDesc')}
                            </p>
                            <button
                                onClick={() => setActiveTab('nearby')}
                                className="btn-primary empty-state-action min-h-[44px]"
                            >
                                {t('client.dashboard.discoverBarbers')}
                            </button>
                        </div>
                    )}

                    {filteredAndSortedBarbers.map((barber, index) => (
                        <div
                            key={barber.id ?? index}
                            onClick={() => navigate(`/client/barber/${encodeURIComponent(barber.id)}`)}
                            className="bg-white rounded-[32px] overflow-hidden border border-black/5 shadow-[0_10px_40px_rgba(0,0,0,0.04)] cursor-pointer group flex flex-col transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] hover:-translate-y-1"
                        >
                            <div className="relative overflow-hidden rounded-t-[32px] aspect-[4/3]">
                                {barber.tier === 'premium' && (
                                    <div className="absolute top-4 left-4 z-10 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-400 text-white font-extrabold text-[9px] px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1 uppercase tracking-wider">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M2 19h20l-2-8-5 3.5L12 8l-3 6.5L4 11z" /></svg>
                                        <span>PREMIUM</span>
                                    </div>
                                )}
                                {(barber.tier === 'standard' || barber.tier === 'pro') && (
                                    <div className="absolute top-4 left-4 z-10 bg-gradient-to-r from-[#378ADD] to-[#185FA5] text-white font-extrabold text-[9px] px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1 uppercase tracking-wider">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9z" /></svg>
                                        <span>STANDART</span>
                                    </div>
                                )}
                                <img
                                    src={
                                        (barber.office_img && barber.office_img !== '')
                                            ? barber.office_img
                                            : (barber.shopImage && barber.shopImage !== '')
                                                ? barber.shopImage
                                                : 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&auto=format&fit=crop'
                                    }
                                    alt={t('common.shop')}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&auto=format&fit=crop'; }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
                                <div className="absolute top-4 right-4">
                                    <button
                                        onClick={(e) => toggleFavorite(barber.id, e)}
                                        className="glass p-2.5 rounded-full hover:bg-white transition-all hover:scale-110 shadow-lg text-white"
                                    >
                                        <Heart size={18} fill={isFavorite(barber.id) ? '#EF4444' : 'none'} color={isFavorite(barber.id) ? '#EF4444' : 'currentColor'} />
                                    </button>
                                </div>
                                <div className="absolute bottom-4 left-4">
                                    {(() => {
                                        const statusText = getBarberStatus(barber);
                                        const rawStatus = barber.status;
                                        let badgeCls = 'bg-[#185FA5] text-white'; // default offline
                                        if (rawStatus === 'available') badgeCls = 'bg-green-500 text-white';
                                        else if (rawStatus === 'working-busy') badgeCls = 'bg-orange-500 text-white';
                                        else if (rawStatus === 'lunch') badgeCls = 'bg-yellow-500 text-white';
                                        else if (rawStatus === 'closed') badgeCls = 'bg-gray-500 text-white';
                                        else {
                                            // fall back to working hours check
                                            const isAvailable = statusText === t('status.available');
                                            badgeCls = isAvailable ? 'bg-green-500 text-white' : 'bg-[#185FA5] text-white';
                                        }
                                        return (
                                            <span className={`${badgeCls} shadow-md text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-full`}>
                                                {statusText}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="mb-4">
                                    <h3 className="text-xl mb-1 font-bold text-[#111] truncate">{barber.office_name || barber.shopName || t('common.barbershop')}</h3>
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
                                            <span className="font-semibold text-sm text-[#666] truncate">{barber.fullname || barber.name || t('common.barber')}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 mt-3">
                                        <div className="bg-[#f8f8f8] px-2.5 py-1 rounded-xl text-xs font-semibold text-[#666] border border-black/5">
                                            {(barber.average_price ?? barber.avgPrice ?? 0).toLocaleString()} UZS
                                        </div>
                                        <div className="bg-[#f8f8f8] px-2.5 py-1 rounded-xl text-xs font-semibold text-[#666] border border-black/5">
                                            {barber.working_hours || barber.workingHours || t('common.defaultWorkingHours')}
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-black/5 flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-[10px] font-bold text-[#666] uppercase tracking-wider mb-0.5">
                                                {activeTab === 'nearby' ? t('client.dashboard.distance') : t('client.dashboard.statusLabel')}
                                            </h2>
                                            {activeTab === 'nearby' ? (
                                                <span className="text-sm font-bold text-[#111] flex items-center gap-1">
                                                    <MapPin size={16} className="text-[#378ADD]" /> {barber._dist !== null && barber._dist !== undefined ? t('client.dashboard.kmAway', { distance: Number(barber._dist).toFixed(1) }) : t('client.dashboard.locationNotSet')}
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
                                            className="h-12 sm:h-11 rounded-2xl bg-white border border-[#2563eb]/20 text-[#2563eb] font-bold text-xs transition-all duration-200 hover:bg-[#eff6ff] hover:border-[#2563eb]/40 active:scale-[0.98] shadow-sm"
                                        >
                                            {t('client.dashboard.viewProfile')}
                                        </button>
                                        <button
                                            className="h-12 sm:h-11 rounded-2xl bg-[#2563eb] active:bg-[#1d4ed8] hover:bg-[#1d4ed8] text-white font-bold text-xs transition-all duration-200 shadow-[0_10px_25px_rgba(37,99,235,0.25)] active:scale-[0.98]"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/client/barber/${encodeURIComponent(barber.id)}`);
                                            }}
                                        >
                                            {t('client.dashboard.bookSession')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                )
            )}



            {/* Empty State */}
            {!loading && !error && barbers.length === 0 && (
                <div className="py-10 text-center">
                    <p className="text-base text-[#666] font-semibold">{t('client.dashboard.noBarbers')}</p>
                </div>
            )}
            </div>{/* End swipeable area */}

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
