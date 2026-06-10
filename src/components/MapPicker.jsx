import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Search } from 'lucide-react';
import { t } from '../utils/i18n.js';

// Simple MapPicker component using OpenStreetMap (Leaflet alternative)
// This is a lightweight implementation that doesn't require external map libraries
function MapPicker({ onLocationChange, initialLocation = null }) {
    const DEFAULT_COORDS = [69.2401, 41.2995];
    const [location, setLocation] = useState({
        address: initialLocation?.address || '',
        coordinates:
            Array.isArray(initialLocation?.coordinates) &&
                initialLocation.coordinates.length === 2
                ? initialLocation.coordinates
                : DEFAULT_COORDS
    });
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Get current location using browser geolocation
    const getCurrentLocation = () => {
        setLoading(true);
        if (!navigator.geolocation) {
            alert(t('components.mapPicker.geoNotSupported'));
            setLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                const coords = [longitude, latitude]; // [lng, lat] format

                // Reverse geocode to get address
                try {
                    const address = await reverseGeocode(latitude, longitude);
                    const newLocation = { address, coordinates: coords };
                    setLocation(newLocation);
                    onLocationChange(newLocation);
                } catch (error) {
                    console.error('Reverse geocoding failed:', error);
                    const newLocation = {
                        address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                        coordinates: coords
                    };
                    setLocation(newLocation);
                    onLocationChange(newLocation);
                }
                setLoading(false);
            },
            (error) => {
                console.error('Error getting location:', error);
                let errorMessage = t('components.mapPicker.geoUnable');

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = t('components.mapPicker.geoDenied');
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = t('components.mapPicker.geoUnavailable');
                        break;
                    case error.TIMEOUT:
                        errorMessage = t('components.mapPicker.geoTimeout');
                        break;
                }

                alert(errorMessage);
                setLoading(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000, // 10 second timeout
                maximumAge: 60000 // Accept cached position up to 1 minute old
            }
        );
    };

    // Reverse geocoding using Nominatim (OpenStreetMap)
    const reverseGeocode = async (lat, lng) => {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
        );
        const data = await response.json();
        return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    };

    // Search for location by address
    const searchLocation = async () => {
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`
            );
            const data = await response.json();
            setSearchResults(data);
        } catch (error) {
            console.error('Search failed:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    // Select location from search results
    const selectLocation = async (result) => {
        const coords = [parseFloat(result.lon), parseFloat(result.lat)];
        const newLocation = { address: result.display_name, coordinates: coords };
        setLocation(newLocation);
        onLocationChange(newLocation);
        setSearchResults([]);
        setSearchQuery('');
    };

    // Manual address input
    const handleAddressChange = (address) => {
        const newLocation = { ...location, address };
        setLocation(newLocation);
        onLocationChange(newLocation);
    };

    // Manual coordinate input
    const handleCoordinateChange = (index, value) => {
        const newCoords = [...location.coordinates];
        newCoords[index] = parseFloat(value) || 0;
        const newLocation = { ...location, coordinates: newCoords };
        setLocation(newLocation);
        onLocationChange(newLocation);
    };

    return (
        <div className="space-y-5">
            {/* Current Geolocation Finder Button */}
            <div className="flex">
                <button
                    onClick={getCurrentLocation}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2.5 h-12 bg-[#378ADD] hover:bg-[#185FA5] text-white font-bold rounded-2xl transition-all shadow-[0_10px_25px_rgba(55,138,221,0.2)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-sm cursor-pointer"
                >
                    <Navigation size={16} className={loading ? 'animate-pulse' : ''} />
                    {loading ? t('components.mapPicker.gettingLocation') : t('components.mapPicker.useCurrentLocation')}
                </button>
            </div>

            {/* Address Search Bar */}
            <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.08em]">{t('components.mapPicker.searchAddress')}</label>
                <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-[#f8f8f8] border border-black/5 rounded-2xl px-4 h-12 focus-within:border-[#185FA5]/30 focus-within:bg-white transition-all">
                        <Search size={16} className="text-[#888]" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && searchLocation()}
                            placeholder={t('components.mapPicker.searchPlaceholder')}
                            className="flex-1 outline-none text-sm font-medium text-[#111] bg-transparent"
                        />
                    </div>
                    <button
                        onClick={searchLocation}
                        disabled={isSearching || !searchQuery.trim()}
                        className="px-5 h-12 bg-[#f8f8f8] border border-black/5 hover:bg-[#f0f0f0] text-[#666] font-bold rounded-2xl transition-all active:scale-[0.97] disabled:opacity-40 text-xs cursor-pointer"
                    >
                        {isSearching ? t('common.searching') : t('common.search')}
                    </button>
                </div>

                {/* Dropdown Search Results */}
                {searchResults.length > 0 && (
                    <div className="border border-black/5 bg-white rounded-2xl max-h-48 overflow-y-auto shadow-[0_10px_30px_rgba(0,0,0,0.08)] divide-y divide-black/5 animate-slideDown">
                        {searchResults.map((result, index) => (
                            <button
                                key={index}
                                onClick={() => selectLocation(result)}
                                className="w-full text-left px-4 py-3 hover:bg-[#f8f8f8] transition-colors text-xs font-semibold text-[#333] leading-snug"
                            >
                                {result.display_name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Manual Edit Section */}
            <div className="space-y-4 pt-2 border-t border-black/5">
                <div>
                    <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.08em] mb-2">{t('components.mapPicker.address')}</label>
                    <input
                        type="text"
                        value={location.address ?? ''}
                        onChange={(e) => handleAddressChange(e.target.value)}
                        placeholder={t('components.mapPicker.addressPlaceholder')}
                        className="w-full h-12 px-4 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white transition-all text-sm"
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.08em] mb-2">{t('components.mapPicker.coordinates')}</label>
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="block text-[10px] text-[#888] font-bold uppercase tracking-wider mb-1">{t('components.mapPicker.longitude')}</label>
                            <input
                                type="number"
                                step="0.000001"
                                value={location.coordinates?.[0] ?? ''}
                                onChange={(e) => handleCoordinateChange(0, e.target.value)}
                                className="w-full h-11 px-3 bg-[#f8f8f8] border border-black/5 rounded-xl text-[#111] font-medium outline-none focus:border-[#185FA5]/30 focus:bg-white transition-all text-xs text-center"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-[10px] text-[#888] font-bold uppercase tracking-wider mb-1">{t('components.mapPicker.latitude')}</label>
                            <input
                                type="number"
                                step="0.000001"
                                value={location.coordinates?.[1] ?? ''}
                                onChange={(e) => handleCoordinateChange(1, e.target.value)}
                                className="w-full h-11 px-3 bg-[#f8f8f8] border border-black/5 rounded-xl text-[#111] font-medium outline-none focus:border-[#185FA5]/30 focus:bg-white transition-all text-xs text-center"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Display Selected Location Details */}
            {location.address && (
                <div className="p-4 bg-[#E6F1FB] border border-[#378ADD]/10 rounded-2xl flex items-start gap-3">
                    <MapPin size={16} className="text-[#378ADD] shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                        <div className="text-[10px] font-black text-[#185FA5] uppercase tracking-wider">{t('components.mapPicker.selectedLocation')}</div>
                        <div className="text-xs text-[#111] font-semibold leading-relaxed">{location.address}</div>
                        <div className="text-[10px] text-[#666] font-medium">
                            {location.coordinates?.[0]?.toFixed(6) || '0.000000'}, {location.coordinates?.[1]?.toFixed(6) || '0.000000'}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MapPicker;
