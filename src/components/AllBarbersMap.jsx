import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, X, Navigation, Star, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { t } from '../utils/i18n.js';

export default function AllBarbersMap({ barbers, clientCoords }) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersLayer = useRef(null);
    const navigate = useNavigate();

    const [selectedBarber, setSelectedBarber] = useState(null);
    const [mapError, setMapError] = useState(false);

    // Initial map setup
    useEffect(() => {
        if (!mapRef.current) return;

        try {
            if (mapInstance.current) {
                mapInstance.current.remove();
            }

            // Default center: Tashkent or Client Coords
            const defaultLat = clientCoords?.lat || 41.2995;
            const defaultLng = clientCoords?.lng || 69.2401;

            const map = L.map(mapRef.current, {
                center: [defaultLat, defaultLng],
                zoom: 13, // Good city-level zoom
                zoomControl: false, // We'll position it manually or hide for mobile feel
                attributionControl: false
            });

            L.control.zoom({ position: 'topright' }).addTo(map);

            mapInstance.current = map;
            markersLayer.current = L.layerGroup().addTo(map);

            // Load CartoDB Voyager tiles (clean, lightweight, premium aesthetic matching NavbatGo styling)
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                maxZoom: 20
            }).addTo(map);

            setMapError(false);
        } catch (err) {
            console.error('Failed to initialize Leaflet Map:', err);
            setMapError(true);
        }

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, [clientCoords?.lat, clientCoords?.lng]);

    // Update markers when barbers change
    useEffect(() => {
        if (!mapInstance.current || !markersLayer.current) return;

        // Clear existing markers
        markersLayer.current.clearLayers();

        const validBarbers = [];

        barbers.forEach(barber => {
            let coordsArray = null;
            if (Array.isArray(barber.coordinates) && barber.coordinates.length >= 2) {
                coordsArray = barber.coordinates;
            } else if (barber.location && Array.isArray(barber.location.coordinates) && barber.location.coordinates.length >= 2) {
                coordsArray = barber.location.coordinates;
            }

            if (coordsArray && coordsArray.length >= 2) {
                const lng = coordsArray[0];
                const lat = coordsArray[1];

                if (typeof lat === 'number' && typeof lng === 'number' && !(lat === 0 && lng === 0)) {
                    validBarbers.push({ barber, lat, lng });

                    const imageUrl = (barber.office_img && barber.office_img !== '') ? barber.office_img : 
                                     (barber.shopImage && barber.shopImage !== '') ? barber.shopImage : 
                                     'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=100&auto=format&fit=crop';
                    
                    // Style tier color
                    const isPremium = barber.tier === 'premium';
                    const ringColor = isPremium ? '#F59E0B' : '#378ADD'; // Amber-500 or Brand Primary

                    const customIcon = L.divIcon({
                        className: 'custom-barber-marker',
                        html: `
                            <div class="relative flex flex-col items-center group cursor-pointer transition-transform duration-300 hover:scale-110 hover:z-50">
                                <div class="w-12 h-12 rounded-full border-4 shadow-lg overflow-hidden bg-white flex items-center justify-center relative" style="border-color: ${ringColor};">
                                    <img src="${imageUrl}" alt="Barber" class="w-full h-full object-cover" onerror="this.src='https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=100&auto=format&fit=crop'" />
                                    ${isPremium ? '<div class="absolute bottom-0 right-0 w-3.5 h-3.5 bg-gradient-to-br from-yellow-300 to-amber-500 rounded-full border border-white flex items-center justify-center"><svg width="6" height="6" viewBox="0 0 24 24" fill="white"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div>' : ''}
                                </div>
                                <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px]" style="border-top-color: ${ringColor}; margin-top: -1px;"></div>
                            </div>
                        `,
                        iconSize: [48, 56],
                        iconAnchor: [24, 56]
                    });

                    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(markersLayer.current);
                    
                    marker.on('click', () => {
                        setSelectedBarber(barber);
                        // Optionally pan to the marker smoothly
                        mapInstance.current.flyTo([lat, lng], Math.max(mapInstance.current.getZoom(), 15), {
                            animate: true,
                            duration: 0.5
                        });
                    });
                }
            }
        });

        // If there are valid barbers, fit bounds to show all markers
        if (validBarbers.length > 0 && !selectedBarber) {
             const bounds = L.latLngBounds(validBarbers.map(b => [b.lat, b.lng]));
             // Add client coords to bounds if available
             if (clientCoords?.lat && clientCoords?.lng) {
                 bounds.extend([clientCoords.lat, clientCoords.lng]);
             }
             mapInstance.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [barbers]);

    // Handle client coords marker separately
    useEffect(() => {
        if (!mapInstance.current || !clientCoords?.lat || !clientCoords?.lng) return;

        const clientIcon = L.divIcon({
            className: 'custom-client-marker',
            html: `
                <div class="relative flex items-center justify-center w-8 h-8">
                    <div class="absolute w-8 h-8 rounded-full bg-blue-500/30 animate-ping" style="animation-duration: 2s;"></div>
                    <div class="relative w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-lg"></div>
                </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        const clientMarker = L.marker([clientCoords.lat, clientCoords.lng], { icon: clientIcon, zIndexOffset: 1000 }).addTo(mapInstance.current);

        return () => {
            if (mapInstance.current && clientMarker) {
                mapInstance.current.removeLayer(clientMarker);
            }
        };
    }, [clientCoords?.lat, clientCoords?.lng]);


    if (mapError) {
        return (
            <div className="w-full h-[60vh] bg-[#f8f8f8] rounded-3xl border border-black/5 flex flex-col items-center justify-center text-center p-6 text-[#888]">
                <MapPin size={40} className="mb-4 text-gray-300" />
                <p>{t('client.dashboard.failedLoadBarbers')}</p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-[calc(100vh-250px)] min-h-[400px] rounded-3xl overflow-hidden border border-black/5 shadow-[0_10px_40px_rgba(0,0,0,0.06)] bg-[#e5e5e5]">
            <div ref={mapRef} className="w-full h-full z-0" />

            {/* Barber Details Bottom Sheet */}
            <div className={`absolute bottom-0 left-0 right-0 z-50 p-4 transition-transform duration-300 ease-out ${selectedBarber ? 'translate-y-0' : 'translate-y-[120%]'}`}>
                {selectedBarber && (
                    <div className="bg-white rounded-3xl p-5 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border border-black/5 relative">
                        <button 
                            onClick={() => setSelectedBarber(null)}
                            className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                        >
                            <X size={16} />
                        </button>

                        <div className="flex gap-4">
                            <img 
                                src={(selectedBarber.office_img && selectedBarber.office_img !== '') ? selectedBarber.office_img : 
                                     (selectedBarber.shopImage && selectedBarber.shopImage !== '') ? selectedBarber.shopImage : 
                                     'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&auto=format&fit=crop'} 
                                alt="Shop" 
                                className="w-20 h-20 rounded-2xl object-cover shadow-sm border border-black/5 shrink-0"
                            />
                            <div className="flex-1 min-w-0 pr-6">
                                <h3 className="font-bold text-lg text-[#111] truncate">{selectedBarber.office_name || 'Saloon'}</h3>
                                <p className="text-sm text-[#666] font-medium truncate">{selectedBarber.fullname}</p>
                                
                                <div className="flex items-center gap-2 mt-2">
                                    {selectedBarber.tier === 'premium' && (
                                        <div className="bg-gradient-to-r from-amber-500 to-yellow-400 text-white font-extrabold text-[9px] px-2 py-0.5 rounded shadow-sm flex items-center gap-1 uppercase tracking-wider">
                                            <Star size={8} fill="currentColor" /> PREMIUM
                                        </div>
                                    )}
                                    {selectedBarber._dist !== null && selectedBarber._dist !== undefined && (
                                        <div className="flex items-center gap-1 text-xs font-bold text-[#378ADD] bg-[#e6f1fb] px-2 py-0.5 rounded">
                                            <Navigation size={10} />
                                            {selectedBarber._dist < 1 ? `${Math.round(selectedBarber._dist * 1000)} m` : `${selectedBarber._dist.toFixed(1)} km`}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-5">
                            <button 
                                onClick={() => navigate(`/client/barber/${encodeURIComponent(selectedBarber.id)}`)}
                                className="w-full bg-[#378ADD] hover:bg-[#185FA5] text-white font-bold h-12 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-[0_8px_20px_rgba(55,138,221,0.25)] text-sm uppercase tracking-wide"
                            >
                                <Clock size={16} />
                                Band qilish (Book)
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
