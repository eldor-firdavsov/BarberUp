import { useState, useEffect } from 'react';
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
    const [activeTab, setActiveTab] = useState('all'); // 'favorites', 'all', 'nearby'
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
        if (barber.isWorkingNow === false) return 'Currently Offline';
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();

        if (barber.lunchStart && barber.lunchEnd) {
            const [lStartH, lStartM] = barber.lunchStart.split(':').map(Number);
            const [lEndH, lEndM] = barber.lunchEnd.split(':').map(Number);
            const lStartMins = lStartH * 60 + lStartM;
            const lEndMins = lEndH * 60 + lEndM;
            if (currentMins >= lStartMins && currentMins < lEndMins) return 'On Break';
        }
        return 'Available';
    };

    
    return (
        <section className="page-animate max-w-md mx-auto px-6 py-8 flex flex-col">
            <header className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                    <img src="./Female_icon.png" alt="icon" className="w-8 h-8" />
                    <h1 className="text-h1">NavbatGo</h1>
                </div>
                <div className="flex gap-4 items-center">
                    <button className="btn-ghost btn-sm p-2">
                        <img src="./search.png" alt="Search" className="w-5 h-5" />
                    </button>
                    <button className="btn-ghost btn-sm p-2">
                        <img src="./bell.png" alt="Notifications" className="w-4 h-5" />
                    </button>
                </div>
            </header>

            {/* My Barber Section */}
            {favoriteBarbers.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-h2 mb-6">My Barber</h2>
                    {(() => {
                        const favoriteBarber = barbers.find(barber => isFavorite(barber.id));
                        if (!favoriteBarber) return null;
                        
                        return (
                            <div 
                                className="card-base bg-gradient-to-r from-[var(--primary)] to-purple-600 text-white cursor-pointer transition-all hover:transform hover:-translate-y-2"
                                onClick={() => navigate(`/barber/${encodeURIComponent(favoriteBarber.id ?? favoriteBarber.email)}`)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <img
                                            src={favoriteBarber.shopImage || favoriteBarber.profileImage || 'Background.png'}
                                            alt={favoriteBarber.shopName || favoriteBarber.name}
                                            className="w-16 h-16 rounded-full border-3 border-white/20 shadow-lg"
                                            onError={(e) => { e.currentTarget.src = 'Background.png'; }}
                                        />
                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"></div>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-h2 text-white mb-1">{favoriteBarber.shopName || favoriteBarber.name}</h3>
                                        <p className="text-white/80 text-body mb-3">{favoriteBarber.name || 'Your favorite barber'}</p>
                                        <div className="flex items-center gap-3">
                                            <span className={`status-badge ${
                                                getBarberStatus(favoriteBarber) === 'Available' 
                                                    ? 'success' 
                                                    : 'neutral'
                                            }`}>
                                                {getBarberStatus(favoriteBarber)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/barber/${encodeURIComponent(favoriteBarber.id ?? favoriteBarber.email)}`);
                                            }}
                                            className="bg-white text-[var(--primary)] px-4 py-2 rounded-lg font-bold text-sm hover:bg-white/90 transition-all hover:scale-105"
                                        >
                                            Book Now
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openProfileModal(favoriteBarber);
                                            }}
                                            className="bg-white/20 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-white/30 transition-all hover:scale-105"
                                        >
                                            View Profile
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Find Your Barber Section (when no favorites) */}
            {favoriteBarbers.length === 0 && (
                <div className="mb-8">
                    <h2 className="text-h2 mb-6">Find your barber</h2>
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <Heart size={40} className="text-gray-400" />
                        </div>
                        <h3 className="empty-state-title">No favorite barber yet</h3>
                        <p className="empty-state-description">
                            Save barbers as favorites for faster booking and personalized recommendations
                        </p>
                        <button 
                            onClick={() => setActiveTab('all')}
                            className="btn-primary empty-state-action"
                        >
                            Explore Barbers
                        </button>
                    </div>
                </div>
            )}

            <h1 className="text-4xl font-bold text-[#1D0065] leading-tight mb-4">
                <span className="text-black">Elevate your <br /></span>Grooming.
            </h1>
            <p className="text-base text-[var(--text-muted)] leading-relaxed font-normal mb-8">
                Discover the finest ateliers in the city. <br />Hand-picked masters of the craft, ready <br />for your next transformation.
            </p>

            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar mb-8">
                <button 
                    onClick={() => setActiveTab('favorites')}
                    className={`btn-secondary whitespace-nowrap text-sm ${
                        activeTab === 'favorites' ? '!bg-[var(--primary)] !text-white' : ''
                    }`}
                >
                    Favorites {favoriteBarbers.length > 0 && `(${favoriteBarbers.length})`}
                </button>
                <button 
                    onClick={() => setActiveTab('all')}
                    className={`btn-secondary whitespace-nowrap text-sm ${
                        activeTab === 'all' ? '!bg-[var(--primary)] !text-white' : ''
                    }`}
                >
                    All Masters
                </button>
                <button 
                    onClick={() => setActiveTab('nearby')}
                    className={`btn-secondary whitespace-nowrap text-sm ${
                        activeTab === 'nearby' ? '!bg-[var(--primary)] !text-white' : ''
                    }`}
                >
                    Nearby
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
                    
                    {barbers
                        .filter(barber => {
                            if (activeTab === 'favorites') {
                                return isFavorite(barber.id);
                            }
                            return true; // Show all for 'all' and 'nearby' tabs
                        })
                        // Sort based on active tab
                        .sort((a, b) => {
                            if (activeTab === 'nearby') {
                                // Sort by name for now (real distance calculation requires backend)
                                return (a.shopName || a.name || '').localeCompare(b.shopName || b.name || '');
                            } else {
                                // Default sorting: favorites first, then by name
                                const aFav = isFavorite(a.id);
                                const bFav = isFavorite(b.id);
                                if (aFav && !bFav) return -1;
                                if (!aFav && bFav) return 1;
                                return (a.shopName || a.name || '').localeCompare(b.shopName || b.name || '');
                            }
                        })
                        .map((barber, index) => (
                        <div
                            key={barber.id ?? index}
                            onClick={() => navigate(`/barber/${encodeURIComponent(barber.id ?? barber.email)}`)}
                            className="card-base cursor-pointer group"
                        >
                            <div className="relative overflow-hidden rounded-t-2xl">
                                <img
                                    src={barber.shopImage || 'Background.png'}
                                    alt="Shop"
                                    className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-300"
                                    onError={(e) => { e.currentTarget.src = 'Background.png'; }}
                                />
                                <div className="absolute top-4 right-4">
                                    <button
                                        onClick={(e) => toggleFavorite(barber.id, e)}
                                        className="bg-white/90 backdrop-blur-sm p-2 rounded-full hover:bg-white transition-all hover:scale-110 shadow-lg"
                                    >
                                        <Heart size={16} fill={isFavorite(barber.id) ? 'currentColor' : 'none'} color={isFavorite(barber.id) ? '#EF4444' : '#9CA3AF'} />
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
                                    <h3 className="text-h2 mb-2">{barber.shopName || barber.name || 'Modern Atelier'}</h3>
                                    <div className="flex items-center gap-3 text-small text-muted">
                                        <span>{barber.name}</span>
                                        {barber.workingHours && (
                                            <>
                                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                <span>{barber.workingHours}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xs font-semibold text-[var(--primary)] opacity-80 mb-1">
                                            Status
                                        </h2>
                                        <p className="text-sm font-bold text-[#312E81]">
                                            {getBarberStatus(barber)}
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
