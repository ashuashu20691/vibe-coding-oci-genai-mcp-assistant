'use client';

import { useState, useMemo } from 'react';

export interface TimelineRendererProps {
    data: Array<Record<string, unknown>>;
    timeField?: string;
    groupBy?: 'year' | 'month' | 'day';
    title?: string;
}

export function TimelineRenderer({
    data,
    timeField,
    groupBy = 'year',
    title,
}: TimelineRendererProps) {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    // Auto-detect time field
    const detectedTimeField = useMemo(() => {
        if (timeField) return timeField;
        if (data.length === 0) return null;

        const keys = Object.keys(data[0]);
        return keys.find(k => {
            const kLower = k.toLowerCase();
            return kLower.includes('date') || kLower.includes('time') || kLower === 'year';
        }) || null;
    }, [data, timeField]);

    // Group data by time period
    const groupedData = useMemo(() => {
        if (!detectedTimeField) return {};

        const groups: Record<string, Array<Record<string, unknown>>> = {};

        data.forEach(item => {
            const timeValue = item[detectedTimeField];
            let groupKey: string;

            if (typeof timeValue === 'number') {
                // Assume it's a year
                groupKey = String(timeValue);
            } else if (typeof timeValue === 'string') {
                const date = new Date(timeValue);
                if (!isNaN(date.getTime())) {
                    if (groupBy === 'year') {
                        groupKey = date.getFullYear().toString();
                    } else if (groupBy === 'month') {
                        groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    } else {
                        groupKey = date.toISOString().split('T')[0];
                    }
                } else {
                    groupKey = String(timeValue);
                }
            } else {
                groupKey = 'Unknown';
            }

            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(item);
        });

        // Sort groups in descending order (most recent first)
        const sortedGroups: Record<string, Array<Record<string, unknown>>> = {};
        Object.keys(groups)
            .sort((a, b) => b.localeCompare(a))
            .forEach(key => {
                sortedGroups[key] = groups[key];
            });

        return sortedGroups;
    }, [data, detectedTimeField, groupBy]);

    const toggleGroup = (groupKey: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(groupKey)) {
            newExpanded.delete(groupKey);
        } else {
            newExpanded.add(groupKey);
        }
        setExpandedGroups(newExpanded);
    };

    const formatGroupLabel = (groupKey: string): string => {
        if (groupBy === 'year') {
            return groupKey;
        } else if (groupBy === 'month') {
            const [year, month] = groupKey.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1);
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        } else {
            const date = new Date(groupKey);
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        }
    };

    const getMetadataFields = (item: Record<string, unknown>) => {
        return Object.entries(item).filter(([key]) => key !== detectedTimeField);
    };

    if (!detectedTimeField) {
        return (
            <div className="p-4 text-center text-gray-500">
                No time field detected in data
            </div>
        );
    }

    return (
        <div className="timeline-container">
            {/* Header */}
            {title && (
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
                </div>
            )}

            {/* Timeline */}
            <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300"></div>

                {/* Groups */}
                <div className="space-y-6">
                    {Object.entries(groupedData).map(([groupKey, items]) => {
                        const isExpanded = expandedGroups.has(groupKey);
                        const itemCount = items.length;

                        return (
                            <div key={groupKey} className="relative">
                                {/* Group Header */}
                                <div className="flex items-start">
                                    {/* Timeline dot */}
                                    <div className="relative z-10">
                                        <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
                                            <span className="text-white font-bold text-sm">{itemCount}</span>
                                        </div>
                                    </div>

                                    {/* Group label and toggle */}
                                    <div className="ml-6 flex-1">
                                        <button
                                            onClick={() => toggleGroup(groupKey)}
                                            className="w-full text-left bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 border border-gray-200"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="text-xl font-semibold text-gray-800">
                                                        {formatGroupLabel(groupKey)}
                                                    </h3>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        {itemCount} {itemCount === 1 ? 'item' : 'items'}
                                                    </p>
                                                </div>
                                                <div className="text-gray-400">
                                                    {isExpanded ? (
                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    )}
                                                </div>
                                            </div>
                                        </button>

                                        {/* Expanded items */}
                                        {isExpanded && (
                                            <div className="mt-4 space-y-3 ml-4">
                                                {items.map((item, idx) => {
                                                    const metadataFields = getMetadataFields(item);

                                                    return (
                                                        <div
                                                            key={idx}
                                                            className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:bg-gray-100 transition-colors"
                                                        >
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                                {metadataFields.map(([key, value]) => (
                                                                    <div key={key} className="text-sm">
                                                                        <span className="font-medium text-gray-700">{key}:</span>{' '}
                                                                        <span className="text-gray-600">{String(value)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Summary */}
            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">
                    <span className="font-semibold">{data.length}</span> total items across{' '}
                    <span className="font-semibold">{Object.keys(groupedData).length}</span> time periods
                </div>
            </div>
        </div>
    );
}
