import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';
import { t } from '../utils/i18n.js';

export default function InteractiveMap({ coordinates, address, shopName = '' }) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const [mapError, setMapError] = useState(false);

    // Normalize coordinates format: expects [lng, lat] or GeoJSON
    let coordsArray = null;
    if (Array.isArray(coordinates)) {
        coordsArray = coordinates;
    } else if (coordinates?.coordinates && Array.isArray(coordinates.coordinates)) {
        coordsArray = coordinates.coordinates;
    } else if (coordinates?.location?.coordinates && Array.isArray(coordinates.location.coordinates)) {
        coordsArray = coordinates.location.coordinates;
    }

    const hasValidCoords =
        Array.isArray(coordsArray) &&
        coordsArray.length === 2 &&
        typeof coordsArray[0] === 'number' &&
        typeof coordsArray[1] === 'number' &&
        !(coordsArray[0] === 0 && coordsArray[1] === 0);

    const lng = hasValidCoords ? coordsArray[0] : null;
    const lat = hasValidCoords ? coordsArray[1] : null;

    useEffect(() => {
        if (!hasValidCoords || !mapRef.current) return;

        try {
            // If map instance already exists, remove it first
            if (mapInstance.current) {
                mapInstance.current.remove();
            }

            // Initialize standard Leaflet Map (direct initialization avoids React 19 wrapper context issues)
            const map = L.map(mapRef.current, {
                center: [lat, lng],
                zoom: 15,
                zoomControl: true,
                attributionControl: false,
                scrollWheelZoom: false // Prevent scrolling page issues
            });

            mapInstance.current = map;

            // Load CartoDB Voyager tiles (clean, lightweight, premium aesthetic matching NavbatGo styling)
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                maxZoom: 20
            }).addTo(map);

            // Pulse Pin style
            const customIcon = L.divIcon({
                className: 'custom-map-marker-pin',
                html: `
                    <div class="relative flex items-center justify-center w-10 h-10">
                        <div class="absolute w-10 h-10 rounded-full bg-[#378ADD]/20 animate-ping" style="animation-duration: 2s;"></div>
                        <div class="relative w-8 h-8 rounded-full bg-white border border-[#378ADD]/20 flex items-center justify-center shadow-[0_4px_12px_rgba(55,138,221,0.25)]">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#378ADD" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                        </div>
                    </div>
                `,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            // Drop marker
            const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

            // Pop up with shop name
            if (shopName) {
                marker.bindPopup(`<strong style="font-family: sans-serif; color: #111;">${shopName}</strong>`).openPopup();
            }

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
    }, [lat, lng, shopName, hasValidCoords]);

    // External Maps links generators
    const getGoogleMapsUrl = () => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    const getYandexMapsUrl = () => `https://yandex.com/maps/?pt=${lng},${lat}&z=16&l=map`;

    if (!hasValidCoords) {
        return (
            <div className="bg-[#f8f8f8] border border-black/5 rounded-3xl p-6 text-center space-y-2">
                <div className="w-12 h-12 bg-black/5 rounded-2xl flex items-center justify-center mx-auto text-[#aaa]">
                    <MapPin size={22} />
                </div>
                <h4 className="font-bold text-[#111] text-sm">{t('client.barbershopDetails.addressNotProvided')}</h4>
                <p className="text-xs text-[#888] font-medium max-w-[240px] mx-auto">
                    {address || 'Salon joylashuvi xaritada belgilanmagan.'}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Map Container Element */}
            <div className="relative w-full h-[220px] rounded-3xl overflow-hidden border border-black/5 shadow-sm bg-[#e5e5e5]">
                {mapError ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#f8f8f8] text-sm font-semibold text-[#888]">
                        Xarita yuklanmadi
                    </div>
                ) : (
                    <div ref={mapRef} className="w-full h-full z-0" />
                )}
            </div>

            {/* Address Details & Navigation Redirections */}
            <div className="bg-[#f8f8f8] border border-black/5 rounded-3xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                    <MapPin size={18} className="text-[#378ADD] shrink-0 mt-0.5" />
                    <div>
                        <p className="text-[11px] font-bold text-[#999] uppercase tracking-wider">Salon manzili</p>
                        <p className="text-sm font-semibold text-[#333] mt-0.5 leading-snug">{address}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-black/5">
                    <a
                        href={getGoogleMapsUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 h-11 bg-white border border-black/5 hover:border-black/10 active:scale-[0.98] transition-all rounded-2xl text-xs font-bold text-[#333] shadow-sm cursor-pointer"
                    >
                        <Navigation size={13} className="text-emerald-500" />
                        Google Maps
                        <ExternalLink size={11} className="text-[#aaa]" />
                    </a>
                    <a
                        href={getYandexMapsUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 h-11 bg-white border border-black/5 hover:border-black/10 active:scale-[0.98] transition-all rounded-2xl text-xs font-bold text-[#333] shadow-sm cursor-pointer"
                    >
                        <Navigation size={13} className="text-red-500" />
                        Yandex Maps
                        <ExternalLink size={11} className="text-[#aaa]" />
                    </a>
                </div>
            </div>
        </div>
    );
}
