'use client';

import { useState } from 'react';

export interface AnalysisResult {
  summary: string;
  statistics: Record<string, unknown>;
  insights: string[];
  recommendations: string[];
  suggestedVisualizations: string[];
}

interface AnalysisCardProps {
  analysis: AnalysisResult;
}

/**
 * AnalysisCard - Displays data analysis results in a beautiful card format.
 * Shows insights, statistics, and recommendations from the Analysis Agent.
 */
export function AnalysisCard({ analysis }: AnalysisCardProps) {
  const [expanded, setExpanded] = useState(false);

  const columnStats = analysis.statistics.columnStats as Record<string, {
    type: string;
    sum?: number;
    avg?: number;
    min?: number;
    max?: number;
    uniqueCount?: number;
  }> | undefined;

  // Find numeric columns for quick stats
  const numericStats = columnStats
    ? Object.entries(columnStats)
        .filter(([, stats]) => stats.type === 'numeric')
        .slice(0, 4)
    : [];

  return (
    <div className="analysis-card bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 rounded-xl border border-indigo-200 dark:border-indigo-800 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="font-semibold">Data Analysis</span>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-white/80 hover:text-white transition-colors"
          >
            {expanded ? 'Show Less' : 'Show More'}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 py-3 border-b border-indigo-200 dark:border-indigo-800">
        <p className="text-sm text-gray-700 dark:text-gray-300">{analysis.summary}</p>
      </div>

      {/* Quick Stats */}
      {numericStats.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
          {numericStats.map(([column, stats]) => (
            <div key={column} className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">
                {column}
              </div>
              <div className="mt-1 text-lg font-bold text-indigo-600 dark:text-indigo-400">
                {stats.sum !== undefined ? stats.sum.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Avg: {stats.avg?.toFixed(2) || '-'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Insights */}
      {analysis.insights.length > 0 && (
        <div className="px-4 py-3 border-t border-indigo-200 dark:border-indigo-800">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
            </svg>
            Insights
          </h4>
          <ul className="space-y-1">
            {analysis.insights.slice(0, expanded ? undefined : 3).map((insight, i) => (
              <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                <span className="text-indigo-500 mt-1">•</span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations (expanded only) */}
      {expanded && analysis.recommendations.length > 0 && (
        <div className="px-4 py-3 border-t border-indigo-200 dark:border-indigo-800">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Recommendations
          </h4>
          <ul className="space-y-1">
            {analysis.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                <span className="text-green-500 mt-1">→</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested Visualizations (expanded only) */}
      {expanded && analysis.suggestedVisualizations.length > 0 && (
        <div className="px-4 py-3 border-t border-indigo-200 dark:border-indigo-800">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
            Suggested Visualizations
          </h4>
          <div className="flex flex-wrap gap-2">
            {analysis.suggestedVisualizations.map((viz, i) => (
              <span
                key={i}
                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full"
              >
                {viz}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
