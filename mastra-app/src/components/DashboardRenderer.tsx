import React from 'react';
import { Chart } from './Chart';
import { DataTable } from './DataTable';

interface DashboardStat {
    label: string;
    value: string | number;
    change?: string;
    color?: 'red' | 'green' | 'blue' | 'orange' | 'gray';
}

interface DashboardAlert {
    message: string;
    severity: 'critical' | 'warning' | 'info';
}

interface DashboardChart {
    id: string;
    title: string;
    type: 'bar_chart' | 'line_chart' | 'pie_chart';
    data: Record<string, unknown>[];
    xKey: string;
    yKey: string;
}

interface DashboardTable {
    id: string;
    title: string;
    data: Record<string, unknown>[];
    columns: string[];
}

export interface DashboardConfig {
    title: string;
    stats: DashboardStat[];
    alerts: DashboardAlert[];
    charts: DashboardChart[];
    tables: DashboardTable[];
    metadata?: Record<string, unknown>;
}

interface DashboardRendererProps {
    config: DashboardConfig;
}

export function DashboardRenderer({ config }: DashboardRendererProps) {
    // Add validation before processing widgets
    if (!config || typeof config !== 'object') {
        return (
            <div className="empty-state">
                <div className="empty-state-title">Invalid Configuration</div>
                <div className="empty-state-message">Dashboard configuration is invalid or missing</div>
            </div>
        );
    }
    
    const { title, stats = [], alerts = [], charts = [], tables = [] } = config;

    // Render stats cards
    const renderStat = (stat: DashboardStat, index: number) => {
        // Validate stat object
        if (!stat || typeof stat !== 'object') return null;
        
        const colors = {
            red: 'bg-red-50 text-red-700 border-red-200',
            green: 'bg-green-50 text-green-700 border-green-200',
            blue: 'bg-blue-50 text-blue-700 border-blue-200',
            orange: 'bg-orange-50 text-orange-700 border-orange-200',
            gray: 'bg-gray-50 text-gray-700 border-gray-200',
        };
        const colorClass = colors[stat.color || 'gray'];

        return (
            <div key={index} className={`p-4 rounded-lg border ${colorClass} flex flex-col items-center justify-center min-w-[150px]`}>
                <div className="text-3xl font-bold mb-1">{stat?.value ?? '—'}</div>
                <div className="text-sm opacity-80 uppercase tracking-wide">{stat?.label ?? 'Unknown'}</div>
                {stat?.change && <div className="text-xs mt-2 font-medium">{stat.change}</div>}
            </div>
        );
    };

    return (
        <div className="dashboard-container p-6 bg-white rounded-xl shadow-sm border border-gray-100 space-y-8">
            {/* Header */}
            <div className="dashboard-header border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
                <div className="text-sm text-gray-500 mt-1">Generated {new Date().toLocaleDateString()}</div>
            </div>

            {/* Alerts Banner */}
            {alerts && Array.isArray(alerts) && alerts.length > 0 && (
                <div className="dashboard-alerts space-y-2">
                    {alerts.map((alert, idx) => {
                        if (!alert || typeof alert !== 'object') return null;
                        return (
                            <div
                                key={idx}
                                className={`p-3 rounded-md flex items-center gap-3 ${alert.severity === 'critical' ? 'bg-red-100 text-red-800 border border-red-200' :
                                    alert.severity === 'warning' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                        'bg-blue-100 text-blue-800 border border-blue-200'
                                    }`}
                            >
                                <span className="text-xl">
                                    {alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️'}
                                </span>
                                <span className="font-medium">{alert?.message || 'No message'}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Key Metrics Grid - Responsive: 2 cols on mobile, 4 on desktop */}
            {stats && Array.isArray(stats) && stats.length > 0 && (
                <div className="dashboard-stats grid grid-cols-2 md:grid-cols-4 gap-4">
                    {stats.map(renderStat)}
                </div>
            )}

            {/* Charts Grid - Uses responsive classes for mobile stacking */}
            {charts && Array.isArray(charts) && charts.length > 0 && (
                <div className="dashboard-charts visualization-grid grid grid-cols-1 md:grid-cols-2 gap-6">
                    {charts.map((chart, idx) => {
                        if (!chart || typeof chart !== 'object') return null;
                        return (
                            <div key={idx} className="chart-wrapper p-4 border rounded-lg shadow-sm bg-white responsive-visualization">
                                <Chart
                                    type={chart.type}
                                    data={chart.data || []}
                                    xColumn={chart.xKey}
                                    yColumn={chart.yKey}
                                    title={chart.title}
                                />
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Tables */}
            {tables && Array.isArray(tables) && tables.length > 0 && (
                <div className="dashboard-tables space-y-6">
                    {tables.map((table, idx) => {
                        if (!table || typeof table !== 'object') return null;
                        return (
                            <div key={idx} className="table-wrapper">
                                <h3 className="text-lg font-semibold text-gray-800 mb-3">{table?.title || 'Table'}</h3>
                                <DataTable data={table.data || []} title={table.title} />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
