import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Search } from 'lucide-react';

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
            alert('Geolocation is not supported by your browser');
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
                let errorMessage = 'Unable to get your location. Please enter address manually.';

                // Provide specific error messages based on error code
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location permission denied. Please enable location access and try again.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information unavailable. Please enter address manually.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Location request timed out. Please check your connection and try again.';
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
        <div className="space-y-4">
            {/* Current Location Button */}
            <div className="flex gap-2">
                <button
                    onClick={getCurrentLocation}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
                >
                    <Navigation size={16} />
                    {loading ? 'Getting location...' : 'Use Current Location'}
                </button>
            </div>

            {/* Search */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Search Address</label>
                <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2">
                        <Search size={16} className="text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && searchLocation()}
                            placeholder="Search for address..."
                            className="flex-1 outline-none"
                        />
                    </div>
                    <button
                        onClick={searchLocation}
                        disabled={isSearching || !searchQuery.trim()}
                        className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-400 transition-colors"
                    >
                        {isSearching ? 'Searching...' : 'Search'}
                    </button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                    <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                        {searchResults.map((result, index) => (
                            <button
                                key={index}
                                onClick={() => selectLocation(result)}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                            >
                                <div className="text-sm font-medium">{result.display_name}</div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Manual Input */}
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                        type="text"
                        value={location.coordinates?.[0] ?? ''}
                        onChange={(e) => handleAddressChange(e.target.value)}
                        placeholder="Enter address manually"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Coordinates</label>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">Longitude</label>
                            <input
                                type="number"
                                step="0.000001"
                                value={location.coordinates?.[0] ?? ''}
                                onChange={(e) => handleCoordinateChange(0, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">Latitude</label>
                            <input
                                type="number"
                                step="0.000001"
                                value={location.coordinates?.[1] ?? ''}
                                onChange={(e) => handleCoordinateChange(1, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Current Location Display */}
            {location.address && (
                <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start gap-2">
                        <MapPin size={16} className="text-gray-500 mt-1" />
                        <div className="flex-1">
                            <div className="text-sm font-medium text-gray-700">Selected Location</div>
                            <div className="text-sm text-gray-600">{location.address}</div>
                            <div className="text-xs text-gray-500 mt-1">
                                Coordinates: {location.coordinates?.[0]?.toFixed(6) || '0.000000'}, {location.coordinates?.[1]?.toFixed(6) || '0.000000'}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MapPicker;
