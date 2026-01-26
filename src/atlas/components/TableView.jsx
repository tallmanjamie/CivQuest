// src/atlas/components/TableView.jsx
// CivQuest Atlas - Table View Component
// AG Grid data table with sorting, filtering, and export
// Search input has been moved to unified SearchToolbar in AtlasApp

import React, { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { 
  Download, 
  Columns,
  RefreshCw,
  X,
  Loader2,
  ChevronDown,
  Map,
  Eye,
  Filter,
  SortAsc,
  ArrowUpDown
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';

/**
 * TableView Component
 * AG Grid data table for search results
 */
const TableView = forwardRef(function TableView(props, ref) {
  const {
    config,
    activeMap,
    searchResults,
    updateSearchResults,
    isSearching,
    zoomToFeature,
    highlightFeature,
    setMode
  } = useAtlas();

  // Refs
  const gridRef = useRef(null);
  const gridApiRef = useRef(null);

  // State
  const [isGridReady, setIsGridReady] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [rowCount, setRowCount] = useState(0);

  const themeColor = config?.ui?.themeColor || 'sky';
  const hasResults = searchResults?.features?.length > 0;

  /**
   * Get column definitions from config
   */
  const getColumnDefs = useCallback(() => {
    const tableColumns = activeMap?.tableColumns || [];
    
    if (tableColumns.length === 0) {
      // Auto-generate columns from first feature
      if (searchResults?.features?.[0]?.attributes) {
        return Object.keys(searchResults.features[0].attributes)
          .filter(k => !k.startsWith('_') && k !== 'OBJECTID')
          .map(field => ({
            field,
            headerName: field,
            sortable: true,
            filter: true,
            resizable: true,
            minWidth: 100
          }));
      }
      return [];
    }

    return tableColumns.map(col => ({
      field: col.field,
      headerName: col.headerName || col.field,
      width: col.width,
      minWidth: col.minWidth || 80,
      sortable: col.sortable !== false,
      filter: col.filter !== false,
      resizable: col.resizable !== false,
      cellRenderer: col.cellRenderer,
      valueFormatter: col.valueFormatter ? 
        (params) => {
          try {
            return new Function('params', `return ${col.valueFormatter}`)(params);
          } catch {
            return params.value;
          }
        } : undefined
    }));
  }, [activeMap?.tableColumns, searchResults?.features]);

  /**
   * Get row data from search results
   */
  const getRowData = useCallback(() => {
    if (!searchResults?.features) return [];
    return searchResults.features.map((f, idx) => ({
      ...f.attributes,
      _index: idx,
      _geometry: f.geometry
    }));
  }, [searchResults]);

  /**
   * Initialize AG Grid
   */
  const initializeGrid = useCallback(() => {
    if (!gridRef.current || !window.agGrid) {
      console.warn('[TableView] AG Grid not available');
      return;
    }

    const columnDefs = getColumnDefs();
    
    // Add action column at the beginning
    const allColumns = [
      {
        headerName: '',
        field: '_actions',
        width: 50,
        sortable: false,
        filter: false,
        resizable: false,
        pinned: 'left',
        cellRenderer: (params) => {
          const btn = document.createElement('button');
          btn.className = 'p-1 hover:bg-slate-100 rounded';
          btn.innerHTML = '<svg class="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
          btn.onclick = () => {
            const feature = searchResults?.features?.[params.data._index];
            if (feature) {
              zoomToFeature(feature);
              setMode('map');
            }
          };
          return btn;
        }
      },
      ...columnDefs
    ];

    const gridOptions = {
      columnDefs: allColumns,
      rowData: getRowData(),
      defaultColDef: {
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: 80
      },
      animateRows: true,
      rowSelection: 'single',
      suppressCellFocus: true,
      onGridReady: (params) => {
        gridApiRef.current = params.api;
        setIsGridReady(true);
        setVisibleColumns(columnDefs.map(c => c.field));
        
        // Auto-size columns
        params.api.sizeColumnsToFit();
      },
      onRowClicked: (params) => {
        const feature = searchResults?.features?.[params.data._index];
        if (feature) {
          highlightFeature(feature);
        }
      },
      onRowDoubleClicked: (params) => {
        const feature = searchResults?.features?.[params.data._index];
        if (feature) {
          zoomToFeature(feature);
          setMode('map');
        }
      },
      onModelUpdated: (params) => {
        setRowCount(params.api.getDisplayedRowCount());
      }
    };

    // Destroy existing grid if any
    if (gridApiRef.current) {
      gridApiRef.current.destroy();
    }

    // Create new grid
    new window.agGrid.Grid(gridRef.current, gridOptions);
  }, [getColumnDefs, getRowData, searchResults, zoomToFeature, highlightFeature, setMode]);

  /**
   * Update grid data when results change
   */
  useEffect(() => {
    if (gridApiRef.current && searchResults?.features) {
      gridApiRef.current.setRowData(getRowData());
      gridApiRef.current.sizeColumnsToFit();
    } else if (searchResults?.features && !gridApiRef.current) {
      // Initialize grid if not yet done
      initializeGrid();
    }
  }, [searchResults, getRowData, initializeGrid]);

  /**
   * Initialize grid on mount
   */
  useEffect(() => {
    // Load AG Grid if not already loaded
    if (!window.agGrid) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/ag-grid-community@31.0.1/dist/ag-grid-community.min.js';
      script.onload = () => {
        if (searchResults?.features) {
          initializeGrid();
        }
      };
      document.head.appendChild(script);

      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = 'https://cdn.jsdelivr.net/npm/ag-grid-community@31.0.1/styles/ag-grid.css';
      document.head.appendChild(style);

      const theme = document.createElement('link');
      theme.rel = 'stylesheet';
      theme.href = 'https://cdn.jsdelivr.net/npm/ag-grid-community@31.0.1/styles/ag-theme-alpine.css';
      document.head.appendChild(theme);
    } else if (searchResults?.features) {
      initializeGrid();
    }

    return () => {
      if (gridApiRef.current) {
        gridApiRef.current.destroy();
        gridApiRef.current = null;
      }
    };
  }, []);

  /**
   * Export to CSV
   */
  const exportCSV = useCallback(() => {
    if (!gridApiRef.current) return;
    
    gridApiRef.current.exportDataAsCsv({
      fileName: `atlas-export-${new Date().toISOString().split('T')[0]}.csv`,
      columnKeys: visibleColumns
    });
  }, [visibleColumns]);

  /**
   * Toggle column visibility
   */
  const toggleColumn = useCallback((field) => {
    if (!gridApiRef.current) return;
    
    const isVisible = visibleColumns.includes(field);
    const newVisible = isVisible
      ? visibleColumns.filter(f => f !== field)
      : [...visibleColumns, field];
    
    setVisibleColumns(newVisible);
    gridApiRef.current.setColumnsVisible([field], !isVisible);
  }, [visibleColumns]);

  /**
   * Clear table
   */
  const clearTable = useCallback(() => {
    updateSearchResults({ features: [] });
    if (gridApiRef.current) {
      gridApiRef.current.setRowData([]);
    }
  }, [updateSearchResults]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    exportCSV,
    clearTable,
    getRowCount: () => rowCount
  }), [exportCSV, clearTable, rowCount]);

  const allColumns = getColumnDefs();

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 p-2 border-b border-slate-200 bg-slate-50">
        {/* Left: Result count */}
        <div className="flex items-center gap-2">
          {hasResults ? (
            <span className={`px-2 py-1 bg-${themeColor}-100 text-${themeColor}-700 rounded-full text-xs font-medium`}>
              {rowCount} record{rowCount !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-sm text-slate-500">No results</span>
          )}
          
          {isSearching && (
            <div className="flex items-center gap-1 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Searching...</span>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {/* Column Picker */}
          <div className="relative">
            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              disabled={!hasResults}
              className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              title="Show/hide columns"
            >
              <Columns className="w-4 h-4" />
              <span className="hidden sm:inline">Columns</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showColumnPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowColumnPicker(false)} />
                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50 max-h-80 overflow-y-auto">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Toggle Columns</span>
                  </div>
                  {allColumns.map((col) => (
                    <button
                      key={col.field}
                      onClick={() => toggleColumn(col.field)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        visibleColumns.includes(col.field)
                          ? `bg-${themeColor}-600 border-${themeColor}-600 text-white`
                          : 'border-slate-300'
                      }`}>
                        {visibleColumns.includes(col.field) && (
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <span className="text-slate-700">{col.headerName || col.field}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Export */}
          <button
            onClick={exportCSV}
            disabled={!hasResults}
            className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export to CSV"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* View on Map */}
          <button
            onClick={() => setMode('map')}
            disabled={!hasResults}
            className={`flex items-center gap-1 px-2 py-1.5 text-sm text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed`}
            title="View on map"
          >
            <Map className="w-4 h-4" />
            <span className="hidden sm:inline">Map</span>
          </button>

          {/* Clear */}
          <button
            onClick={clearTable}
            disabled={!hasResults}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear table"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Grid Container */}
        <div className="flex-1 relative">
          {/* Empty State */}
          {!hasResults && !isSearching && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 text-slate-300">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">No Data to Display</h3>
                <p className="text-slate-500 text-sm mb-4">
                  Search for properties using the search bar to populate the table with results.
                </p>
                {config?.messages?.exampleQuestions?.[0] && (
                  <div className="inline-flex items-center gap-2 text-sm text-slate-400 bg-slate-100 px-3 py-2 rounded-lg">
                    <span>💡</span>
                    <span>Try: "{config.messages.exampleQuestions[0]}"</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loading State */}
          {isSearching && !hasResults && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className={`w-8 h-8 text-${themeColor}-600 animate-spin mx-auto mb-2`} />
                <p className="text-sm text-slate-600">Searching...</p>
              </div>
            </div>
          )}

          {/* AG Grid */}
          <div
            ref={gridRef}
            className={`ag-theme-alpine w-full h-full ${!hasResults ? 'invisible' : ''}`}
          />
        </div>
      </div>

      {/* Footer */}
      {hasResults && (
        <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
          <div className="flex items-center justify-between">
            <span>Double-click a row to view on map</span>
            <span>{rowCount} of {searchResults?.features?.length || 0} records shown</span>
          </div>
        </div>
      )}
    </div>
  );
});

export default TableView;
