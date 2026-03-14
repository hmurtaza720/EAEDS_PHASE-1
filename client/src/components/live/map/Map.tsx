"use client";

import React, { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import PinBlack from "../../../../public/pin_black.png";
import styles from "./map.module.css";

const Pin = new L.Icon({
    iconUrl: PinBlack.src,
    iconSize: [32, 32], // size of the icon
    iconAnchor: [16, 32], // point of the icon which will correspond to marker's location
    popupAnchor: [0, -32], // point from which the popup should open relative to the iconAnchor
});

interface MapPin {
    coordinates: [number, number];
    popupHtml: string;
}

interface MapProps {
    center: {
        lng: number;
        lat: number;
    };
    pins: MapPin[];
    zoom?: number;
    selectedCoordinates?: [number, number];
    searchedLocation?: { lat: number; lng: number; name: string } | null;
    cityCircle?: { lat: number; lng: number; label?: string } | null;
}

const Map: React.FC<MapProps> = ({ center, pins, zoom = 4, selectedCoordinates, searchedLocation, cityCircle }) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<L.Map | null>(null);
    const searchMarkerRef = useRef<L.Marker | null>(null);
    const cityCircleRef = useRef<L.Circle | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [pois, setPois] = useState<any[]>([]);

    // Initial Map Setup
    useEffect(() => {
        if (!mapContainer.current || mapInstance.current) return;

        // Create map instance
        const m = L.map(mapContainer.current, {
            zoomControl: true,
            dragging: true,
            scrollWheelZoom: true,
            doubleClickZoom: true,
            touchZoom: true,
            boxZoom: true,
            keyboard: false,
        });

        // Use OpenStreetMap standard tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(m);

        // Set initial view immediately
        const lat = !isNaN(center.lat) ? center.lat : 39.8283;
        const lng = !isNaN(center.lng) ? center.lng : -98.5795;
        const z = !isNaN(zoom) ? zoom : 4;

        m.setView([lat, lng], z);

        // Assign to ref for cleanup and updates
        mapInstance.current = m;

        // Mark as ready after a tick to ensure DOM is settled
        const timer = setTimeout(() => {
            if (mapInstance.current) {
                mapInstance.current.invalidateSize();
                setMapReady(true);
            }
        }, 300); // 300ms buffer for layout stability

        return () => {
            clearTimeout(timer);
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
                setMapReady(false);
            }
        };
    }, []);

    // Handle View Updates
    useEffect(() => {
        if (!mapReady || !mapInstance.current) return;

        const lat = typeof center.lat === 'number' && !isNaN(center.lat) ? center.lat : null;
        const lng = typeof center.lng === 'number' && !isNaN(center.lng) ? center.lng : null;
        const z = typeof zoom === 'number' && !isNaN(zoom) ? zoom : null;

        if (lat !== null && lng !== null && z !== null) {
            // Small timeout to ensure layout stability before animation
            const timer = setTimeout(() => {
                if (mapInstance.current) {
                    mapInstance.current.invalidateSize();
                    mapInstance.current.flyTo([lat, lng], z, {
                        animate: true,
                        duration: 1
                    });
                }
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [mapReady, center.lat, center.lng, zoom]);

    // Handle Pin Updates & Range Circle
    useEffect(() => {
        if (!mapReady || !mapInstance.current) return;

        // Clear existing layers
        mapInstance.current.eachLayer((layer) => {
            if (layer instanceof L.Marker || layer instanceof L.Circle || layer instanceof L.CircleMarker) {
                mapInstance.current!.removeLayer(layer);
            }
        });

        // Add pins to the map
        pins.forEach((pin) => {
            const [plat, plng] = pin.coordinates;
            if (!isNaN(plat) && !isNaN(plng)) {
                L.marker(pin.coordinates, { icon: Pin })
                    .addTo(mapInstance.current!)
                    .bindPopup(pin.popupHtml);
            }
        });

        // Add Range Circle & POIs if selected
        if (selectedCoordinates) {
            const [lat, lng] = selectedCoordinates;

            // 1. Draw Range Circle
            L.circle([lat, lng], {
                color: 'rgba(59, 130, 246, 0.5)', // Blue-500
                fillColor: 'rgba(59, 130, 246, 0.1)',
                fillOpacity: 0.3,
                radius: 1200 // 1.2km radius
            }).addTo(mapInstance.current);

            // 2. Render POIs
            pois.forEach(poi => {
                let color = '#64748b'; // default slate-500
                if (poi.tags.amenity === 'fuel') color = '#f97316'; // orange-500
                if (poi.tags.amenity === 'hospital') color = '#ef4444'; // red-500
                if (poi.tags.amenity === 'police') color = '#3b82f6'; // blue-500
                if (poi.tags.shop) color = '#10b981'; // green-500

                L.circleMarker([poi.lat, poi.lon], {
                    radius: 4,
                    fillColor: color,
                    color: '#fff',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                })
                    .bindPopup(`<b>${poi.tags.name || "Unknown"}</b><br/>${poi.tags.amenity || poi.tags.shop}`)
                    .addTo(mapInstance.current!);
            });
        }

    }, [mapReady, pins, selectedCoordinates, pois]);

    // Handle City Circle (shown when only city/state is known)
    useEffect(() => {
        if (!mapReady || !mapInstance.current) return;

        // Clear previous city circle
        if (cityCircleRef.current) {
            mapInstance.current.removeLayer(cityCircleRef.current);
            cityCircleRef.current = null;
        }

        // Don't show city circle if we have a selectedCoordinates (specific address)
        if (!cityCircle || selectedCoordinates) return;

        const { lat, lng, label } = cityCircle;
        if (isNaN(lat) || isNaN(lng)) return;

        // Draw a large city-level circle (5km radius)
        const circle = L.circle([lat, lng], {
            color: 'rgba(59, 130, 246, 0.6)',
            fillColor: 'rgba(59, 130, 246, 0.08)',
            fillOpacity: 0.4,
            radius: 5000, // 5km radius for city-level
            weight: 2,
            dashArray: '8, 6'
        }).addTo(mapInstance.current);

        if (label) {
            circle.bindPopup(`<b>📍 Approximate Area</b><br>${label}`);
        }

        cityCircleRef.current = circle;

    }, [mapReady, cityCircle, selectedCoordinates]);

    // Fetch POIs when selected location changes
    useEffect(() => {
        if (!selectedCoordinates) {
            setPois([]);
            return;
        }

        const [lat, lng] = selectedCoordinates;

        // Debounce fetching
        const fetchPOIs = async () => {
            const query = `
                [out:json];
                (
                  node["amenity"="fuel"](around:1200,${lat},${lng});
                  node["amenity"="hospital"](around:1200,${lat},${lng});
                  node["amenity"="police"](around:1200,${lat},${lng});
                  node["shop"="supermarket"](around:1200,${lat},${lng});
                  node["shop"="convenience"](around:1200,${lat},${lng});
                );
                out;
            `;
            const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

            try {
                const res = await fetch(url);
                const data = await res.json();
                setPois(data.elements);
            } catch (err) {
                console.error("Failed to fetch POIs:", err);
            }
        };

        // Small delay to prevent spamming while panning/selecting rapidly
        const timeoutId = setTimeout(fetchPOIs, 500);
        return () => clearTimeout(timeoutId);

    }, [selectedCoordinates]);

    // Handle Searched Location flyTo & Marker
    useEffect(() => {
        if (!mapReady || !mapInstance.current || !searchedLocation) return;

        const { lat, lng, name } = searchedLocation;

        if (!isNaN(lat) && !isNaN(lng)) {
            mapInstance.current.flyTo([lat, lng], 16, { animate: true, duration: 1.5 });

            // Clear previous search marker if exists
            if (searchMarkerRef.current) {
                mapInstance.current.removeLayer(searchMarkerRef.current);
            }

            // Add temporary marker for the searched location
            const searchIcon = new L.Icon({
                iconUrl: PinBlack.src,
                iconSize: [32, 32],
                iconAnchor: [16, 32],
                popupAnchor: [0, -32],
            });

            const marker = L.marker([lat, lng], { icon: searchIcon })
                .addTo(mapInstance.current)
                .bindPopup(`<b>Searched Location</b><br/>${name}`)
                .openPopup();

            searchMarkerRef.current = marker;
        }
    }, [mapReady, searchedLocation]);

    return (
        <div className={styles.mapWrap}>
            <div ref={mapContainer} className={styles.map} />

            {selectedCoordinates && pois.length > 0 && (
                <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-700 p-2 rounded-lg text-[10px] text-slate-300 z-[1000] shadow-xl backdrop-blur-sm">
                    <p className="font-bold mb-1 border-b border-slate-700 pb-1">Nearby Support</p>
                    <div className="space-y-1">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> Hospital</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Police</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500" /> Fuel Station</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> Store</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Map;
