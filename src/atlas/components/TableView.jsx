// src/atlas/components/TableView.jsx
// CivQuest Atlas - Table View Component
// AG Grid data table with sorting, filtering, and export
// Search input has been moved to unified SearchToolbar in AtlasApp

import React, { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, ClientSideRowModelModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Register AG Grid modules (required for v31+)
ModuleRegistry.registerModules([ClientSideRowModelModule]);
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
import { getThemeColors } from '../utils/themeColors';

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
    setMode,
    mode
  } = useAtlas();

  // Refs
  const gridRef = useRef(null);
  // Use ref to always access latest searchResults in event handlers (avoid stale closures)
  const searchResultsRef = useRef(searchResults);

  // State
  const [isGridReady, setIsGridReady] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [rowCount, setRowCount] = useState(0);

  const themeColor = config?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);
  const hasResults = searchResults?.features?.length > 0;

  // Keep searchResultsRef in sync
  useEffect(() => {
    searchResultsRef.current = searchResults;
  }, [searchResults]);

  /**
   * Action button cell renderer component
   */
  const ActionCellRenderer = useCallback((params) => {
    return (
      <button
        className="p-1 hover:bg-slate-100 rounded"
        onClick={() => {
          const feature = searchResultsRef.current?.features?.[params.data._index];
          if (feature) {
            zoomToFeature(feature);
            setMode('map');
          }
        }}
      >
        <Eye className="w-4 h-4 text-slate-500" />
      </button>
    );
  }, [zoomToFeature, setMode]);

  /**
   * Get column definitions from config
   */
  const getColumnDefs = useCallback(() => {
    const tableColumns = activeMap?.tableColumns || [];

    let dataCols = [];
    if (tableColumns.length === 0) {
      // Auto-generate columns from first feature
      if (searchResults?.features?.[0]?.attributes) {
        dataCols = Object.keys(searchResults.features[0].attributes)
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
    } else {
      dataCols = tableColumns.map(col => ({
        field: col.field,
        headerName: col.headerName || col.field,
        width: col.width,
        minWidth: col.minWidth || 80,
        sortable: col.sortable !== false,
        filter: col.filter !== false,
        resizable: col.resizable !== false,
        valueFormatter: col.valueFormatter ?
          (params) => {
            try {
              return new Function('params', `return ${col.valueFormatter}`)(params);
            } catch {
              return params.value;
            }
          } : undefined
      }));
    }

    return dataCols;
  }, [activeMap?.tableColumns, searchResults?.features]);

  /**
   * Full column definitions including action column
   */
  const columnDefs = useMemo(() => {
    const dataCols = getColumnDefs();
    return [
      {
        headerName: '',
        field: '_actions',
        width: 50,
        sortable: false,
        filter: false,
        resizable: false,
        pinned: 'left',
        cellRenderer: ActionCellRenderer
      },
      ...dataCols
    ];
  }, [getColumnDefs, ActionCellRenderer]);

  /**
   * Row data from search results
   */
  const rowData = useMemo(() => {
    if (!searchResults?.features) return [];
    return searchResults.features.map((f, idx) => ({
      ...f.attributes,
      _index: idx,
      _geometry: f.geometry
    }));
  }, [searchResults]);

  /**
   * Default column definition
   */
  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 80
  }), []);

  /**
   * Grid ready callback
   */
  const onGridReady = useCallback((params) => {
    console.log('[TableView] Grid ready');
    setIsGridReady(true);
    const dataCols = getColumnDefs();
    setVisibleColumns(dataCols.map(c => c.field));
    // Auto-size columns
    params.api.sizeColumnsToFit();
  }, [getColumnDefs]);

  /**
   * Row click handler
   */
  const onRowClicked = useCallback((params) => {
    const feature = searchResultsRef.current?.features?.[params.data._index];
    if (feature) {
      highlightFeature(feature);
    }
  }, [highlightFeature]);

  /**
   * Row double-click handler
   */
  const onRowDoubleClicked = useCallback((params) => {
    const feature = searchResultsRef.current?.features?.[params.data._index];
    if (feature) {
      zoomToFeature(feature);
      setMode('map');
    }
  }, [zoomToFeature, setMode]);

  /**
   * Model updated callback - tracks displayed row count
   */
  const onModelUpdated = useCallback((params) => {
    setRowCount(params.api.getDisplayedRowCount());
  }, []);

  /**
   * Resize columns when mode changes to table
   */
  useEffect(() => {
    if (mode === 'table' && gridRef.current?.api) {
      // Small delay to ensure the container is visible and has dimensions
      const timer = setTimeout(() => {
        console.log('[TableView] Mode changed to table, resizing grid');
        gridRef.current.api.sizeColumnsToFit();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mode]);

  /**
   * Update visible columns when data changes
   */
  useEffect(() => {
    const dataCols = getColumnDefs();
    if (dataCols.length > 0) {
      setVisibleColumns(dataCols.map(c => c.field));
    }
  }, [getColumnDefs]);

  /**
   * Export to CSV
   */
  const exportCSV = useCallback(() => {
    if (!gridRef.current?.api) return;

    gridRef.current.api.exportDataAsCsv({
      fileName: `atlas-export-${new Date().toISOString().split('T')[0]}.csv`,
      columnKeys: visibleColumns
    });
  }, [visibleColumns]);

  /**
   * Toggle column visibility
   */
  const toggleColumn = useCallback((field) => {
    if (!gridRef.current?.api) return;

    const isVisible = visibleColumns.includes(field);
    const newVisible = isVisible
      ? visibleColumns.filter(f => f !== field)
      : [...visibleColumns, field];

    setVisibleColumns(newVisible);
    gridRef.current.api.setColumnsVisible([field], !isVisible);
  }, [visibleColumns]);

  /**
   * Clear table
   */
  const clearTable = useCallback(() => {
    updateSearchResults({ features: [] });
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
            <span
              className="px-2 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: colors.bg100, color: colors.text700 }}
            >
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
                      <div
                        className="w-4 h-4 rounded border flex items-center justify-center"
                        style={visibleColumns.includes(col.field)
                          ? { backgroundColor: colors.bg600, borderColor: colors.border500, color: 'white' }
                          : { borderColor: '#cbd5e1' }
                        }
                      >
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
            className="flex items-center gap-1 px-2 py-1.5 text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: colors.text600 }}
            onMouseEnter={(e) => { if (hasResults) e.target.style.backgroundColor = colors.bg50; }}
            onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; }}
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
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" style={{ color: colors.text600 }} />
                <p className="text-sm text-slate-600">Searching...</p>
              </div>
            </div>
          )}

          {/* AG Grid */}
          <div className={`ag-theme-alpine w-full h-full ${!hasResults ? 'invisible' : ''}`}>
            <AgGridReact
              ref={gridRef}
              rowData={rowData}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              animateRows={true}
              rowSelection="single"
              suppressCellFocus={true}
              onGridReady={onGridReady}
              onRowClicked={onRowClicked}
              onRowDoubleClicked={onRowDoubleClicked}
              onModelUpdated={onModelUpdated}
            />
          </div>
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
