'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Circle as LeafletCircle } from 'leaflet';
import { FullscreenOverlay, FullscreenButton } from './FullscreenOverlay';

export interface MapRendererProps {
    data: Array<Record<string, unknown>>;
    latField?: string;
    lonField?: string;
    centerLat?: number;
    centerLon?: number;
    radiusMiles?: number;
    title?: string;
    fullscreenEnabled?: boolean;
}

export function MapRenderer({
    data,
    latField,
    lonField,
    centerLat,
    centerLon,
    radiusMiles,
    title,
    fullscreenEnabled = true,
}: MapRendererProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<LeafletMap | null>(null);
    const radiusCircleRef = useRef<LeafletCircle | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Auto-detect lat/lon fields
    const detectedLatField = latField || (data.length > 0 ?
        Object.keys(data[0]).find(k => {
            const kLower = k.toLowerCase();
            return kLower === 'lat' || kLower === 'latitude' || kLower.includes('lat_');
        }) : null
    );

    const detectedLonField = lonField || (data.length > 0 ?
        Object.keys(data[0]).find(k => {
            const kLower = k.toLowerCase();
            return kLower === 'lon' || kLower === 'lng' || kLower === 'longitude' || kLower.includes('lon_');
        }) : null
    );

    useEffect(() => {
        if (!mapRef.current || !detectedLatField || !detectedLonField) {
            setError('Missing latitude or longitude fields');
            setIsLoading(false);
            return;
        }

        // Dynamically import Leaflet to avoid SSR issues
        let L: typeof import('leaflet');
        let map: LeafletMap;
        let markers: Array<ReturnType<typeof L.marker>> = [];

        const initMap = async () => {
            try {
                // Import Leaflet
                L = (await import('leaflet')).default;

                // Fix for default marker icons in Next.js
                delete (L.Icon.Default.prototype as any)._getIconUrl;
                L.Icon.Default.mergeOptions({
                    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
                    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                });

                // Calculate center and bounds
                const validPoints = data.filter(item => {
                    const lat = item[detectedLatField!] as number;
                    const lon = item[detectedLonField!] as number;
                    return typeof lat === 'number' && typeof lon === 'number' &&
                        !isNaN(lat) && !isNaN(lon);
                });

                if (validPoints.length === 0) {
                    setError('No valid geographic coordinates found');
                    setIsLoading(false);
                    return;
                }

                // Determine map center
                let mapCenter: [number, number];
                if (centerLat !== undefined && centerLon !== undefined) {
                    mapCenter = [centerLat, centerLon];
                } else {
                    // Calculate center from data
                    const avgLat = validPoints.reduce((sum, p) => sum + (p[detectedLatField!] as number), 0) / validPoints.length;
                    const avgLon = validPoints.reduce((sum, p) => sum + (p[detectedLonField!] as number), 0) / validPoints.length;
                    mapCenter = [avgLat, avgLon];
                }

                // Initialize map
                map = L.map(mapRef.current!, {
                    center: mapCenter,
                    zoom: 11,
                });

                mapInstanceRef.current = map;

                // Add tile layer
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                    maxZoom: 19,
                }).addTo(map);

                // Add radius circle if specified
                if (radiusMiles && centerLat !== undefined && centerLon !== undefined) {
                    const radiusMeters = radiusMiles * 1609.34; // Convert miles to meters
                    const circle = L.circle([centerLat, centerLon], {
                        color: '#3b82f6',
                        fillColor: '#3b82f6',
                        fillOpacity: 0.1,
                        radius: radiusMeters,
                    }).addTo(map);
                    radiusCircleRef.current = circle;
                }

                // Add markers
                validPoints.forEach((item, idx) => {
                    const lat = item[detectedLatField!] as number;
                    const lon = item[detectedLonField!] as number;

                    // Create popup content
                    const popupContent = createPopupContent(item, idx);

                    const marker = L.marker([lat, lon])
                        .addTo(map)
                        .bindPopup(popupContent);

                    markers.push(marker);
                });

                // Fit bounds to show all markers
                if (validPoints.length > 1) {
                    const bounds = L.latLngBounds(
                        validPoints.map(p => [
                            p[detectedLatField!] as number,
                            p[detectedLonField!] as number
                        ])
                    );
                    map.fitBounds(bounds, { padding: [50, 50] });
                }

                setIsLoading(false);
            } catch (err) {
                console.error('Error initializing map:', err);
                setError('Failed to load map');
                setIsLoading(false);
            }
        };

        initMap();

        // Cleanup
        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, [data, detectedLatField, detectedLonField, centerLat, centerLon, radiusMiles]);

    const createPopupContent = (item: Record<string, unknown>, idx: number): string => {
        const entries = Object.entries(item).filter(([key]) =>
            key !== detectedLatField && key !== detectedLonField
        );

        let html = '<div class="map-popup" style="min-width: 200px;">';
        html += `<div style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">Location ${idx + 1}</div>`;
        html += '<div style="font-size: 12px;">';

        entries.forEach(([key, value]) => {
            html += `<div style="margin-bottom: 4px;">`;
            html += `<span style="font-weight: 600;">${key}:</span> `;
            html += `<span>${String(value)}</span>`;
            html += `</div>`;
        });

        html += '</div></div>';
        return html;
    };

    if (error) {
        return (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <p className="font-semibold">Map Error</p>
                <p className="text-sm">{error}</p>
            </div>
        );
    }

    return (
        <div className="map-container">
            <div className="flex items-center justify-between mb-4">
                {title && (
                    <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
                )}
                {!title && <div />}
                {fullscreenEnabled && (
                    <FullscreenButton onClick={() => setIsFullscreen(true)} />
                )}
            </div>

            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading map...</p>
                    </div>
                </div>
            )}

            <div
                ref={mapRef}
                className="w-full h-[600px] rounded-lg shadow-lg border border-gray-200"
                style={{ minHeight: '400px' }}
            />

            {/* Legend */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between text-sm text-gray-600">
                    <div>
                        <span className="font-semibold">{data.length}</span> location{data.length !== 1 ? 's' : ''}
                    </div>
                    {radiusMiles && (
                        <div>
                            Radius: <span className="font-semibold">{radiusMiles} miles</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Fullscreen overlay */}
            <FullscreenOverlay
                isOpen={isFullscreen}
                onClose={() => setIsFullscreen(false)}
                title={title || 'Map View'}
            >
                <div className="w-full h-full p-4">
                    <MapRenderer
                        data={data}
                        latField={latField}
                        lonField={lonField}
                        centerLat={centerLat}
                        centerLon={centerLon}
                        radiusMiles={radiusMiles}
                        title={title}
                        fullscreenEnabled={false}
                    />
                </div>
            </FullscreenOverlay>
        </div>
    );
}
