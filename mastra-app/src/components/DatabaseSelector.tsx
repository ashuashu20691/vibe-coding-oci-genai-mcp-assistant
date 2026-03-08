'use client';

import { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'selected-database-connection';

interface Props {
  value?: string;
  onChange: (connectionName: string) => void;
}

interface DatabaseConnection {
  name: string;
  status?: 'connected' | 'available' | 'error';
}

export function DatabaseSelector({ value, onChange }: Props) {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'available' | 'error'>('available');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch available database connections
  useEffect(() => {
    async function fetchConnections() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/databases');
        if (!response.ok) {
          throw new Error('Failed to fetch connections');
        }
        const data = await response.json();
        setConnections(data?.connections || []);
        
        // Restore saved connection from localStorage
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && data?.connections?.some((c: DatabaseConnection) => c.name === saved)) {
          onChange(saved);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load connections');
        console.error('[DatabaseSelector] Error fetching connections:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchConnections();
  }, []); // eslint-disable-line

  // Persist selected connection to localStorage
  useEffect(() => {
    if (value) {
      localStorage.setItem(STORAGE_KEY, value);
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle connection selection
  const handleSelect = async (connectionName: string) => {
    setIsOpen(false);
    setConnectionStatus('available');
    
    try {
      const response = await fetch('/api/databases/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionName }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to connect to database');
      }
      
      const result = await response.json();
      setConnectionStatus(result.connected ? 'connected' : 'available');
      onChange(connectionName);
    } catch (err) {
      setConnectionStatus('error');
      setError(err instanceof Error ? err.message : 'Connection failed');
      console.error('[DatabaseSelector] Connection error:', err);
    }
  };

  // Get status indicator properties
  const getStatusIndicator = (status: 'connected' | 'available' | 'error') => {
    switch (status) {
      case 'connected':
        return { color: '#10B981', label: 'Connected' };
      case 'error':
        return { color: '#EF4444', label: 'Error' };
      case 'available':
      default:
        return { color: '#9CA3AF', label: 'Available' };
    }
  };

  // Get status indicator CSS class
  const getStatusClass = (status: 'connected' | 'available' | 'error') => {
    switch (status) {
      case 'connected':
        return 'status-connected';
      case 'error':
        return 'status-error';
      case 'available':
      default:
        return 'status-available';
    }
  };

  if (isLoading) {
    return (
      <div className="database-selector-container">
        <label className="selector-label">Database</label>
        <div 
          className="h-9 w-48 rounded-md animate-pulse" 
          style={{ background: 'var(--bg-secondary)' }} 
        />
      </div>
    );
  }

  const selectedConnection = connections.find(c => c.name === value);
  const currentStatus = getStatusIndicator(connectionStatus);

  return (
    <div className="database-selector-container" ref={dropdownRef}>
      {/* Label */}
      <label id="database-selector-label" className="selector-label">Database</label>
      
      {/* Selected database button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          // Support Space and Enter keys for activation - Requirement 27.4
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
          // Support Escape key to close dropdown
          if (e.key === 'Escape' && isOpen) {
            e.preventDefault();
            setIsOpen(false);
          }
        }}
        className="database-selector"
        tabIndex={0} // Ensure proper tab navigation - Requirement 27.3
        aria-labelledby="database-selector-label"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select database connection"
        style={{
          borderColor: isOpen ? '#3B82F6' : '#D1D5DB',
          boxShadow: isOpen ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* Connection status dot */}
        <span 
          className={`status-dot ${getStatusClass(connectionStatus)}`}
          title={currentStatus.label}
        />
        
        <span className="database-selector-text">
          {selectedConnection?.name || 'Select database'}
        </span>
        
        {/* Dropdown arrow */}
        <svg 
          className="database-selector-arrow"
          style={{ 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Error message */}
      {error && (
        <div className="selector-error" title={error}>
          {error}
        </div>
      )}

      {/* Dropdown menu */}
      {isOpen && (
        <div className="database-dropdown">
          <div className="database-dropdown-scroll">
            {/* Header */}
            <div className="database-dropdown-header">
              <span>🗄️</span>
              <span>Database Connections</span>
              <span className="database-dropdown-count">
                {connections.length} available
              </span>
            </div>
            
            {/* Connection list */}
            {connections.length === 0 ? (
              <div className="database-dropdown-empty">
                No database connections available
              </div>
            ) : (
              connections.map((connection) => {
                const isSelected = connection.name === value;
                const itemStatus = isSelected ? connectionStatus : 'available';
                const statusInfo = getStatusIndicator(itemStatus);
                
                return (
                  <button
                    key={connection.name}
                    type="button"
                    onClick={() => handleSelect(connection.name)}
                    onKeyDown={(e) => {
                      // Support Space and Enter keys for activation - Requirement 27.4
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        handleSelect(connection.name);
                      }
                    }}
                    className="database-dropdown-item"
                    tabIndex={0} // Ensure proper tab navigation - Requirement 27.3
                    style={{ 
                      backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
                      fontWeight: isSelected ? 500 : 400,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = '#F9FAFB';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {/* Status dot */}
                    <span 
                      className={`status-dot ${getStatusClass(itemStatus)}`}
                      title={statusInfo.label}
                    />
                    
                    {/* Connection name */}
                    <span className="database-dropdown-item-text">
                      {connection.name}
                    </span>
                    
                    {/* Checkmark for selected */}
                    {isSelected && (
                      <svg 
                        className="database-dropdown-check" 
                        fill="currentColor" 
                        viewBox="0 0 20 20"
                      >
                        <path 
                          fillRule="evenodd" 
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                          clipRule="evenodd" 
                        />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
      
      <style jsx>{`
        .database-selector-container {
          display: flex;
          flex-direction: column;
          gap: 6px;
          position: relative;
        }

        .selector-label {
          font-size: 14px;
          font-weight: 500;
          color: #6B7280;
        }

        .database-selector {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          font-size: 14px;
          font-weight: 400;
          color: #1F2937;
          background-color: #FFFFFF;
          border: 1px solid #D1D5DB;
          border-radius: 6px;
          min-width: 200px;
          cursor: pointer;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          outline: none;
        }

        .database-selector:hover {
          border-color: #9CA3AF;
        }

        .database-selector:focus {
          border-color: #3B82F6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .database-selector-text {
          flex: 1;
          text-align: left;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .database-selector-arrow {
          width: 16px;
          height: 16px;
          color: #6B7280;
          flex-shrink: 0;
          transition: transform 0.2s ease;
        }

        .selector-error {
          font-size: 12px;
          color: #EF4444;
          margin-top: -2px;
        }

        .database-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 4px;
          min-width: 280px;
          background-color: #FFFFFF;
          border: 1px solid #D1D5DB;
          border-radius: 6px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          z-index: var(--z-index-dropdown);
          overflow: hidden;
        }

        .database-dropdown-scroll {
          max-height: 320px;
          overflow-y: auto;
        }

        .database-dropdown-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #6B7280;
          background-color: #F9FAFB;
          border-bottom: 1px solid #E5E7EB;
          sticky: top 0;
        }

        .database-dropdown-count {
          margin-left: auto;
          font-size: 11px;
          font-weight: 400;
          color: #9CA3AF;
        }

        .database-dropdown-empty {
          padding: 16px 12px;
          font-size: 14px;
          text-align: center;
          color: #9CA3AF;
        }

        .database-dropdown-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 12px;
          font-size: 14px;
          color: #1F2937;
          background-color: transparent;
          border: none;
          cursor: pointer;
          transition: background-color 0.15s ease;
          text-align: left;
        }

        .database-dropdown-item-text {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .database-dropdown-check {
          width: 16px;
          height: 16px;
          color: #10B981;
          flex-shrink: 0;
        }

        /* Dark mode support */
        :global(.dark) .database-selector {
          background-color: #1F2937;
          color: #F9FAFB;
          border-color: #374151;
        }

        :global(.dark) .database-selector:hover {
          border-color: #4B5563;
        }

        :global(.dark) .database-dropdown {
          background-color: #1F2937;
          border-color: #374151;
        }

        :global(.dark) .database-dropdown-header {
          background-color: #111827;
          border-bottom-color: #374151;
        }

        :global(.dark) .database-dropdown-item {
          color: #F9FAFB;
        }

        :global(.dark) .database-dropdown-item[style*="background-color: #EFF6FF"] {
          background-color: #1E3A8A !important;
        }

        :global(.dark) .database-dropdown-item:hover {
          background-color: #374151 !important;
        }
      `}</style>
    </div>
  );
}
