import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBarbers } from '../../api/barberApi.js';
import { useClient } from '../../context/ClientContext.jsx';
import { Heart, MapPin, Clock } from 'lucide-react';
import BarberProfileModal from '../../components/BarberProfileModal.jsx';
import AllBarbersMap from '../../components/AllBarbersMap.jsx';
import SkeletonLoader from '../../components/SkeletonLoader.jsx';
import { SegmentedControl, ShortcutCard, Button, EmptyState } from '../../components/ui/index.js';
import { t } from '../../utils/i18n.js';
import PageContainer from '../../components/layout/PageContainer.jsx';
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

    // Initial load + Supabase Realtime: barber profile/hours changes push instantly
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
        <PageContainer
            hasHeader={true}
            hasBottomNav={true}
            extraBottom={16}
            className="max-w-lg md:max-w-2xl mx-auto flex flex-col page-animate"
        >
            <h1 className="text-2xl font-bold text-[var(--text-primary)] leading-tight mb-1">
                {t('client.dashboard.titleLine1')}
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mb-5">{t('client.dashboard.subtitle')}</p>

            <SegmentedControl
                className="mb-5"
                value={activeTab}
                onChange={setActiveTab}
                options={[
                    { value: 'nearby', label: t('client.dashboard.nearby') },
                    { value: 'favorites', label: t('client.dashboard.favorites') },
                    { value: 'map', label: t('client.dashboard.map') },
                ]}
            />

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
                <div className="space-y-3 pb-6">
                    {activeTab === 'favorites' && favoriteBarbers.length === 0 && (
                        <EmptyState
                            icon={Heart}
                            title={t('client.dashboard.noFavoritesTitle')}
                            description={t('client.dashboard.noFavoritesDesc')}
                            action={<Button onClick={() => setActiveTab('nearby')}>{t('client.dashboard.discoverBarbers')}</Button>}
                        />
                    )}

                    {filteredAndSortedBarbers.map((barber, index) => {
                        const imgSrc = (barber.office_img && barber.office_img !== '')
                            ? barber.office_img
                            : (barber.shopImage && barber.shopImage !== '')
                                ? barber.shopImage
                                : 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400&auto=format&fit=crop';

                        return (
                            <ShortcutCard
                                key={barber.id ?? index}
                                onClick={() => navigate(`/client/barber/${encodeURIComponent(barber.id)}`)}
                                image={<img src={imgSrc} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400&auto=format&fit=crop'; }} />}
                                title={barber.office_name || barber.shopName || t('common.barbershop')}
                                subtitle={barber.fullname || barber.name || t('common.barber')}
                                meta={
                                    <>
                                        <span className="meta-chip">
                                            <Clock size={10} />
                                            {barber.working_hours || barber.workingHours || t('common.defaultWorkingHours')}
                                        </span>
                                        {activeTab === 'nearby' && barber._dist != null && (
                                            <span className="meta-chip">
                                                <MapPin size={10} />
                                                {t('client.dashboard.kmAway', { distance: Number(barber._dist).toFixed(1) })}
                                            </span>
                                        )}
                                        <span className="meta-chip">
                                            {(barber.average_price ?? barber.avgPrice ?? 0).toLocaleString()} {t('common.uzs')}
                                        </span>
                                    </>
                                }
                                action={
                                    <button
                                        onClick={(e) => toggleFavorite(barber.id, e)}
                                        className="p-2 rounded-full hover:bg-[var(--bg-hover)]"
                                    >
                                        <Heart size={18} fill={isFavorite(barber.id) ? '#EF4444' : 'none'} color={isFavorite(barber.id) ? '#EF4444' : 'var(--text-secondary)'} />
                                    </button>
                                }
                            />
                        );
                    })}
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
        </PageContainer>
    );
}

export default Client;
