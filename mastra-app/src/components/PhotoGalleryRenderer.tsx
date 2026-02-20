'use client';

import { useState, useMemo } from 'react';

export interface PhotoGalleryProps {
    data: Array<Record<string, unknown>>;
    imageUrlField?: string;
    similarityField?: string;
    title?: string;
    groupBy?: string;
}

type SortOption = 'similarity' | 'default';

export function PhotoGalleryRenderer({
    data,
    imageUrlField,
    similarityField,
    title,
    groupBy,
}: PhotoGalleryProps) {
    const [sortBy, setSortBy] = useState<SortOption>('similarity');
    const [minSimilarity, setMinSimilarity] = useState(0);

    // Auto-detect fields if not provided
    const detectedImageField = useMemo(() => {
        if (imageUrlField) return imageUrlField;
        if (data.length === 0) return null;

        const keys = Object.keys(data[0]);
        return keys.find(k =>
            k.toLowerCase().includes('url') ||
            k.toLowerCase().includes('image') ||
            k.toLowerCase().includes('photo')
        ) || null;
    }, [data, imageUrlField]);

    const detectedSimilarityField = useMemo(() => {
        if (similarityField) return similarityField;
        if (data.length === 0) return null;

        const keys = Object.keys(data[0]);
        return keys.find(k =>
            k.toLowerCase().includes('similarity') ||
            k.toLowerCase().includes('score')
        ) || null;
    }, [data, similarityField]);

    // Filter and sort data
    const processedData = useMemo(() => {
        let filtered = data;

        // Filter by similarity threshold
        if (detectedSimilarityField && minSimilarity > 0) {
            filtered = filtered.filter(item => {
                const similarity = item[detectedSimilarityField] as number;
                return similarity >= minSimilarity;
            });
        }

        // Sort
        if (sortBy === 'similarity' && detectedSimilarityField) {
            filtered = [...filtered].sort((a, b) => {
                const simA = (a[detectedSimilarityField] as number) || 0;
                const simB = (b[detectedSimilarityField] as number) || 0;
                return simB - simA; // Descending
            });
        }

        return filtered;
    }, [data, detectedSimilarityField, minSimilarity, sortBy]);

    // Group data if groupBy is specified
    const groupedData = useMemo(() => {
        if (!groupBy) return { 'All': processedData };

        const groups: Record<string, Array<Record<string, unknown>>> = {};

        processedData.forEach(item => {
            const groupValue = String(item[groupBy] || 'Unknown');
            if (!groups[groupValue]) {
                groups[groupValue] = [];
            }
            groups[groupValue].push(item);
        });

        // Sort groups by key (descending for years)
        const sortedGroups: Record<string, Array<Record<string, unknown>>> = {};
        Object.keys(groups)
            .sort((a, b) => b.localeCompare(a))
            .forEach(key => {
                sortedGroups[key] = groups[key];
            });

        return sortedGroups;
    }, [processedData, groupBy]);

    // Get similarity color
    const getSimilarityColor = (similarity: number): string => {
        if (similarity >= 0.9) return 'bg-green-500';
        if (similarity >= 0.7) return 'bg-blue-500';
        if (similarity >= 0.5) return 'bg-yellow-500';
        return 'bg-gray-500';
    };

    // Format metadata
    const getMetadataChips = (item: Record<string, unknown>) => {
        const chips: Array<{ label: string; value: string }> = [];

        Object.entries(item).forEach(([key, value]) => {
            // Skip image URL and similarity fields
            if (key === detectedImageField || key === detectedSimilarityField) return;

            // Add relevant metadata
            const keyLower = key.toLowerCase();
            if (keyLower.includes('view') ||
                keyLower.includes('distance') ||
                keyLower.includes('date') ||
                keyLower.includes('location') ||
                keyLower.includes('name')) {
                chips.push({ label: key, value: String(value) });
            }
        });

        return chips;
    };

    if (!detectedImageField) {
        return (
            <div className="p-4 text-center text-gray-500">
                No image field detected in data
            </div>
        );
    }

    return (
        <div className="photo-gallery-container">
            {/* Header */}
            {title && (
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
                </div>
            )}

            {/* Controls */}
            <div className="mb-6 flex flex-wrap gap-4 items-center bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Sort by:</label>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="similarity">Similarity</option>
                        <option value="default">Default</option>
                    </select>
                </div>

                {detectedSimilarityField && (
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">
                            Min Similarity: {(minSimilarity * 100).toFixed(0)}%
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={minSimilarity}
                            onChange={(e) => setMinSimilarity(parseFloat(e.target.value))}
                            className="w-32"
                        />
                    </div>
                )}

                <div className="ml-auto text-sm text-gray-600">
                    {processedData.length} {processedData.length === 1 ? 'photo' : 'photos'}
                </div>
            </div>

            {/* Gallery */}
            {Object.entries(groupedData).map(([groupName, items]) => (
                <div key={groupName} className="mb-8">
                    {groupBy && (
                        <h3 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">
                            {groupName}
                        </h3>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {items.map((item, idx) => {
                            const imageUrl = item[detectedImageField] as string;
                            const similarity = detectedSimilarityField
                                ? (item[detectedSimilarityField] as number)
                                : null;
                            const metadataChips = getMetadataChips(item);

                            return (
                                <div
                                    key={idx}
                                    className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300"
                                >
                                    {/* Image */}
                                    <div className="relative aspect-square bg-gray-100">
                                        <img
                                            src={imageUrl}
                                            alt={`Photo ${idx + 1}`}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23ddd" width="400" height="400"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3ENo Image%3C/text%3E%3C/svg%3E';
                                            }}
                                        />

                                        {/* Similarity Badge */}
                                        {similarity !== null && (
                                            <div className="absolute top-2 right-2">
                                                <div className={`${getSimilarityColor(similarity)} text-white px-3 py-1 rounded-full text-sm font-semibold shadow-lg`}>
                                                    {(similarity * 100).toFixed(0)}%
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Metadata */}
                                    {metadataChips.length > 0 && (
                                        <div className="p-4">
                                            <div className="flex flex-wrap gap-2">
                                                {metadataChips.map((chip, chipIdx) => (
                                                    <div
                                                        key={chipIdx}
                                                        className="bg-gray-100 px-2 py-1 rounded text-xs text-gray-700"
                                                    >
                                                        <span className="font-medium">{chip.label}:</span>{' '}
                                                        {chip.value}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            {processedData.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                    No photos match the current filters
                </div>
            )}
        </div>
    );
}
