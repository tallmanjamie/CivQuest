// src/atlas/components/TableView.jsx
// CivQuest Atlas - Table View Component
// AG Grid-based data table with sorting, filtering, and export

import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import { 
  Download, 
  Columns, 
  RotateCcw, 
  X, 
  Filter, 
  ChevronDown,
  MapPin,
  Loader2,
  Search
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';

// Storage keys
const getStorageKey = (orgId, suffix = '') => `atlas_table_${orgId}${suffix ? '_' + suffix : ''}`;

/**
 * TableView Component
 * Renders search results in an AG Grid data table
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
    mode,
    enabledModes
  } = useAtlas();

  // Refs
  const gridRef = useRef(null);
  const gridApiRef = useRef(null);

  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [selectedRow, setSelectedRow] = useState(null);
  const [showSidePanel, setShowSidePanel] = useState(false);

  /**
   * Build column definitions from config
   */
  const columnDefs = useMemo(() => {
    const tableColumns = activeMap?.tableColumns || [];
    
    if (tableColumns.length === 0) {
      // Auto-generate from first result if no config
      if (searchResults?.features?.[0]?.attributes) {
        return Object.keys(searchResults.features[0].attributes).map(field => ({
          field,
          headerName: field.replace(/_/g, ' '),
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
      headerName: col.label || col.field,
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: 100,
      hide: columnVisibility[col.field] === false,
      valueFormatter: (params) => formatCellValue(params.value, col.field)
    }));
  }, [activeMap?.tableColumns, searchResults, columnVisibility]);

  /**
   * Format cell values
   */
  const formatCellValue = useCallback((value, field) => {
    if (value === null || value === undefined) return '';
    
    // Date formatting
    if (typeof value === 'number' && value > 1000000000000) {
      return new Date(value).toLocaleDateString();
    }
    
    // Currency formatting
    if (field?.toLowerCase().includes('amount') || field?.toLowerCase().includes('price')) {
      if (typeof value === 'number') {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
      }
    }
    
    // Number formatting
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    
    return String(value);
  }, []);

  /**
   * Build row data from search results
   */
  const rowData = useMemo(() => {
    if (!searchResults?.features?.length) return [];
    return searchResults.features.map((feature, index) => ({
      ...feature.attributes,
      _geometry: feature.geometry,
      _index: index
    }));
  }, [searchResults]);

  /**
   * Initialize AG Grid
   */
  const initializeGrid = useCallback(() => {
    if (!gridRef.current || isInitialized) return;

    const gridOptions = {
      columnDefs,
      rowData,
      defaultColDef: {
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: 80
      },
      rowSelection: 'single',
      animateRows: true,
      pagination: true,
      paginationPageSize: 100,
      paginationPageSizeSelector: [25, 50, 100, 500],
      suppressCellFocus: true,
      enableCellTextSelection: true,
      onRowClicked: (event) => {
        setSelectedRow(event.data);
        setShowSidePanel(true);
        
        // Highlight on map if map mode is available
        if (event.data._geometry && highlightFeature) {
          highlightFeature({
            attributes: event.data,
            geometry: event.data._geometry
          });
        }
      },
      onGridReady: (params) => {
        gridApiRef.current = params.api;
        
        // Restore saved column state
        const savedState = localStorage.getItem(getStorageKey(config?.id, 'columns'));
        if (savedState) {
          try {
            params.api.applyColumnState({ state: JSON.parse(savedState) });
          } catch (e) {
            console.warn('[TableView] Failed to restore column state:', e);
          }
        }
        
        // Auto-size columns on first load
        params.api.sizeColumnsToFit();
      },
      onColumnMoved: () => saveColumnState(),
      onColumnResized: () => saveColumnState(),
      onColumnVisible: () => saveColumnState(),
      onSortChanged: () => saveColumnState()
    };

    // Create grid
    if (typeof agGrid !== 'undefined') {
      agGrid.createGrid(gridRef.current, gridOptions);
      setIsInitialized(true);
    } else {
      console.error('[TableView] AG Grid not loaded');
    }
  }, [columnDefs, rowData, config?.id, highlightFeature, isInitialized]);

  /**
   * Save column state to localStorage
   */
  const saveColumnState = useCallback(() => {
    if (!gridApiRef.current || !config?.id) return;
    
    const state = gridApiRef.current.getColumnState();
    localStorage.setItem(getStorageKey(config.id, 'columns'), JSON.stringify(state));
  }, [config?.id]);

  /**
   * Reset table layout
   */
  const resetLayout = useCallback(() => {
    if (!gridApiRef.current) return;
    
    gridApiRef.current.resetColumnState();
    gridApiRef.current.sizeColumnsToFit();
    setColumnVisibility({});
    
    if (config?.id) {
      localStorage.removeItem(getStorageKey(config.id, 'columns'));
    }
  }, [config?.id]);

  /**
   * Export to CSV
   */
  const exportToCSV = useCallback(() => {
    if (!gridApiRef.current) return;
    
    gridApiRef.current.exportDataAsCsv({
      fileName: `atlas-export-${config?.id || 'data'}-${Date.now()}.csv`,
      allColumns: false, // Only visible columns
      skipPinnedTop: true,
      skipPinnedBottom: true
    });
  }, [config?.id]);

  /**
   * Toggle column visibility
   */
  const toggleColumn = useCallback((field, visible) => {
    setColumnVisibility(prev => ({ ...prev, [field]: visible }));
    
    if (gridApiRef.current) {
      gridApiRef.current.setColumnsVisible([field], visible);
    }
  }, []);

  /**
   * View selected row on map
   */
  const viewOnMap = useCallback(() => {
    if (!selectedRow || !selectedRow._geometry) return;
    
    zoomToFeature({
      attributes: selectedRow,
      geometry: selectedRow._geometry
    });
  }, [selectedRow, zoomToFeature]);

  /**
   * Clear table
   */
  const clearTable = useCallback(() => {
    if (gridApiRef.current) {
      gridApiRef.current.setGridOption('rowData', []);
    }
    setSelectedRow(null);
    setShowSidePanel(false);
    updateSearchResults(null);
  }, [updateSearchResults]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    exportToCSV,
    resetLayout,
    clearTable,
    gridApi: gridApiRef.current
  }), [exportToCSV, resetLayout, clearTable]);

  // Initialize grid on mount
  useEffect(() => {
    // Wait for AG Grid to be available
    const checkAndInit = () => {
      if (typeof agGrid !== 'undefined') {
        initializeGrid();
      } else {
        setTimeout(checkAndInit, 100);
      }
    };
    checkAndInit();
  }, [initializeGrid]);

  // Update grid data when results change
  useEffect(() => {
    if (gridApiRef.current && rowData) {
      gridApiRef.current.setGridOption('rowData', rowData);
      gridApiRef.current.setGridOption('columnDefs', columnDefs);
    }
  }, [rowData, columnDefs]);

  const themeColor = config?.ui?.themeColor || 'sky';
  const hasResults = rowData.length > 0;
  const mapEnabled = enabledModes.includes('map');

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-4">
          {/* Record Count */}
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="text-lg">📊</span>
            {isSearching ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching...
              </span>
            ) : (
              <span>
                {hasResults ? `${rowData.length} record${rowData.length !== 1 ? 's' : ''}` : 'No results to display'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Column Picker */}
          <div className="relative">
            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              title="Show/Hide columns"
            >
              <Columns className="w-4 h-4" />
            </button>

            {showColumnPicker && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-2 z-50 max-h-80 overflow-y-auto">
                <div className="px-3 py-2 border-b border-slate-100">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase">Columns</h4>
                </div>
                {columnDefs.map(col => (
                  <label
                    key={col.field}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={columnVisibility[col.field] !== false}
                      onChange={(e) => toggleColumn(col.field, e.target.checked)}
                      className={`rounded border-slate-300 text-${themeColor}-600 focus:ring-${themeColor}-500`}
                    />
                    <span className="text-sm text-slate-700">{col.headerName}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Reset Layout */}
          <button
            onClick={resetLayout}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
            title="Reset table layout"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Export CSV */}
          <button
            onClick={exportToCSV}
            disabled={!hasResults}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export to CSV"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Clear Table */}
          <button
            onClick={clearTable}
            disabled={!hasResults}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
                {activeMap?.searchPlaceholder && (
                  <div className="inline-flex items-center gap-2 text-sm text-slate-400 bg-slate-100 px-3 py-2 rounded-lg">
                    <span>💡</span>
                    <span>Try: "{config?.messages?.exampleQuestions?.[0] || 'Search for a property'}"</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AG Grid */}
          <div
            ref={gridRef}
            className={`ag-theme-alpine w-full h-full ${!hasResults ? 'opacity-0' : ''}`}
          />
        </div>

        {/* Side Panel for Selected Row */}
        {showSidePanel && selectedRow && (
          <div className="w-80 bg-white border-l border-slate-200 flex flex-col">
            <div className={`bg-${themeColor}-700 text-white p-3 flex justify-between items-center`}>
              <h3 className="font-semibold text-sm">Property Details</h3>
              <button
                onClick={() => {
                  setShowSidePanel(false);
                  setSelectedRow(null);
                }}
                className="p-1 hover:bg-white/20 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <SidePanelDetails 
                data={selectedRow} 
                columns={activeMap?.tableColumns}
                formatValue={formatCellValue}
              />
            </div>

            {/* Actions */}
            {mapEnabled && selectedRow._geometry && (
              <div className="p-3 border-t border-slate-200">
                <button
                  onClick={viewOnMap}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 bg-${themeColor}-600 text-white rounded-lg hover:bg-${themeColor}-700`}
                >
                  <MapPin className="w-4 h-4" />
                  View on Map
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Close column picker when clicking outside */}
      {showColumnPicker && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowColumnPicker(false)}
        />
      )}
    </div>
  );
});

/**
 * Side Panel Details Component
 */
function SidePanelDetails({ data, columns, formatValue }) {
  if (!data) return null;

  // Use configured columns or all attributes
  const fields = columns?.length 
    ? columns.filter(col => data[col.field] !== undefined)
    : Object.keys(data).filter(k => !k.startsWith('_')).map(field => ({ field, label: field }));

  return (
    <div className="space-y-2">
      {fields.map(({ field, label }) => {
        const value = data[field];
        if (value === null || value === undefined || value === '') return null;

        return (
          <div key={field} className="border-b border-slate-100 pb-2">
            <dt className="text-xs text-slate-500 font-medium uppercase tracking-wide">
              {label || field}
            </dt>
            <dd className="text-sm text-slate-800 mt-0.5">
              {formatValue(value, field)}
            </dd>
          </div>
        );
      })}
    </div>
  );
}

export default TableView;
