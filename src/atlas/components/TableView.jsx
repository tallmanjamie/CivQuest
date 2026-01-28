// src/atlas/components/TableView.jsx
// CivQuest Atlas - Table View Component
// AG Grid data table with sorting, filtering, side panel details, and export
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
  Map,
  Eye,
  MapPin,
  BarChart3
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';
import { getThemeColors } from '../utils/themeColors';

// Configuration
const DEFAULT_PAGE_SIZE = 100;
const ROW_HEIGHT = 42;

/**
 * TableView Component
 * AG Grid data table for search results with side panel details
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
    mode,
    mapViewRef
  } = useAtlas();

  // Refs
  const gridRef = useRef(null);
  const searchResultsRef = useRef(searchResults);

  // State
  const [isGridReady, setIsGridReady] = useState(false);
  const [showColumnDialog, setShowColumnDialog] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);

  const themeColor = config?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);
  const hasResults = searchResults?.features?.length > 0;

  // Keep searchResultsRef in sync
  useEffect(() => {
    searchResultsRef.current = searchResults;
  }, [searchResults]);

  /**
   * Format date values for display
   */
  const formatDate = useCallback((value) => {
    if (!value) return '';
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) return value;
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return value;
    }
  }, []);

  /**
   * Format number values for display
   */
  const formatNumber = useCallback((value) => {
    if (value === null || value === undefined || value === '') return '';
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }, []);

  /**
   * Action button cell renderer component
   */
  const ActionCellRenderer = useCallback((params) => {
    return (
      <button
        className="table-row-action"
        onClick={(e) => {
          e.stopPropagation();
          const feature = searchResultsRef.current?.features?.[params.data._index];
          if (feature) {
            zoomToFeature(feature);
            setMode('map');
            // Open the map's feature panel after switching to map mode
            setTimeout(() => {
              if (mapViewRef?.current?.selectFeature) {
                mapViewRef.current.selectFeature(feature);
              }
            }, 100);
          }
        }}
        title="View on map"
      >
        <MapPin className="w-4 h-4" />
      </button>
    );
  }, [zoomToFeature, setMode, mapViewRef]);

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
          .map(field => {
            const colDef = {
              field,
              headerName: field,
              headerTooltip: field,
              tooltipField: field,
              sortable: true,
              filter: true,
              resizable: true,
              minWidth: 80,
              cellClass: 'table-cell-truncate'
            };

            // Auto-detect date fields
            if (field.toUpperCase().includes('DATE')) {
              colDef.valueFormatter = (params) => formatDate(params.value);
              colDef.filter = 'agDateColumnFilter';
            }

            // Auto-detect numeric fields
            if (field === 'SALEAMOUNT' || field === 'LIVINGAREA' ||
                field === 'LEGALACRES' || field === 'YEARBUILT' ||
                field === 'STORIES' || field === 'FRONTAGE' ||
                field === 'ASSESSEDVALUE' || field === 'TAXAMOUNT') {
              colDef.valueFormatter = (params) => formatNumber(params.value);
              colDef.filter = 'agNumberColumnFilter';
              colDef.type = 'numericColumn';
              colDef.cellStyle = { textAlign: 'right' };
            }

            return colDef;
          });
      }
    } else {
      dataCols = tableColumns.map(col => {
        const colDef = {
          field: col.field,
          headerName: col.headerName || col.field,
          headerTooltip: col.headerName || col.field,
          tooltipField: col.field,
          width: col.width,
          minWidth: col.minWidth || 80,
          sortable: col.sortable !== false,
          filter: col.filter !== false,
          resizable: col.resizable !== false,
          cellClass: 'table-cell-truncate'
        };

        // Date formatting
        if (col.field.toUpperCase().includes('DATE')) {
          colDef.valueFormatter = (params) => formatDate(params.value);
          colDef.filter = 'agDateColumnFilter';
        }

        // Number formatting
        if (col.field === 'SALEAMOUNT' || col.field === 'LIVINGAREA' ||
            col.field === 'LEGALACRES' || col.field === 'YEARBUILT' ||
            col.field === 'STORIES' || col.field === 'FRONTAGE' ||
            col.field === 'ASSESSEDVALUE' || col.field === 'TAXAMOUNT') {
          colDef.valueFormatter = (params) => formatNumber(params.value);
          colDef.filter = 'agNumberColumnFilter';
          colDef.type = 'numericColumn';
          colDef.cellStyle = { textAlign: 'right' };
        }

        // Custom formatter
        if (col.valueFormatter) {
          colDef.valueFormatter = (params) => {
            try {
              return new Function('params', `return ${col.valueFormatter}`)(params);
            } catch {
              return params.value;
            }
          };
        }

        return colDef;
      });
    }

    return dataCols;
  }, [activeMap?.tableColumns, searchResults?.features, formatDate, formatNumber]);

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
        minWidth: 50,
        maxWidth: 50,
        sortable: false,
        filter: false,
        resizable: false,
        pinned: 'left',
        suppressHeaderMenuButton: true,
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
      _geometry: f.geometry,
      _feature: f
    }));
  }, [searchResults]);

  /**
   * Default column definition
   */
  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 80,
    wrapText: false,
    autoHeight: false,
    cellStyle: {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    },
    filterParams: {
      buttons: ['reset', 'apply'],
      closeOnApply: true
    },
    menuTabs: ['filterMenuTab'],
    suppressHeaderMenuButton: false
  }), []);

  /**
   * Auto-size columns to fit content
   */
  const autoSizeColumns = useCallback((api) => {
    if (!api) return;
    // Get all column IDs except the action column
    const allColumnIds = api.getColumns()
      ?.filter(col => col.getColId() !== '_actions')
      ?.map(col => col.getColId()) || [];

    if (allColumnIds.length > 0) {
      // Auto-size columns to fit content
      api.autoSizeColumns(allColumnIds);
    }
  }, []);

  /**
   * Grid ready callback
   */
  const onGridReady = useCallback((params) => {
    console.log('[TableView] Grid ready');
    setIsGridReady(true);
    const dataCols = getColumnDefs();
    setVisibleColumns(dataCols.map(c => c.field));
    // Auto-size columns to fit content
    setTimeout(() => {
      autoSizeColumns(params.api);
    }, 100);
  }, [getColumnDefs, autoSizeColumns]);

  /**
   * Row click handler - opens side panel
   */
  const onRowClicked = useCallback((params) => {
    const feature = searchResultsRef.current?.features?.[params.data._index];
    if (feature) {
      highlightFeature(feature);
      setSelectedRecord(params.data);
      setSidePanelOpen(true);
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
   * First data rendered callback
   */
  const onFirstDataRendered = useCallback((params) => {
    autoSizeColumns(params.api);
  }, [autoSizeColumns]);

  /**
   * Resize columns when mode changes to table
   */
  useEffect(() => {
    if (mode === 'table' && gridRef.current?.api) {
      const timer = setTimeout(() => {
        console.log('[TableView] Mode changed to table, resizing grid');
        autoSizeColumns(gridRef.current.api);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mode, autoSizeColumns]);

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
   * Close side panel when results change
   */
  useEffect(() => {
    setSidePanelOpen(false);
    setSelectedRecord(null);
  }, [searchResults]);

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
   * Show all columns
   */
  const showAllColumns = useCallback(() => {
    if (!gridRef.current?.api) return;

    const allFields = getColumnDefs().map(c => c.field);
    setVisibleColumns(allFields);
    gridRef.current.api.setColumnsVisible(allFields, true);
  }, [getColumnDefs]);

  /**
   * Reset table state
   */
  const resetTable = useCallback(() => {
    if (!gridRef.current?.api) return;

    // Show all columns
    showAllColumns();

    // Reset column order and widths
    gridRef.current.api.resetColumnState();

    // Clear sort
    gridRef.current.api.applyColumnState({ defaultState: { sort: null } });

    // Clear all filters
    gridRef.current.api.setFilterModel(null);

    // Auto-size columns to fit content
    setTimeout(() => {
      autoSizeColumns(gridRef.current.api);
    }, 100);
  }, [showAllColumns, autoSizeColumns]);

  /**
   * Clear table
   */
  const clearTable = useCallback(() => {
    updateSearchResults({ features: [] });
    setSidePanelOpen(false);
    setSelectedRecord(null);
  }, [updateSearchResults]);

  /**
   * Close side panel
   */
  const closeSidePanel = useCallback(() => {
    setSidePanelOpen(false);
    setSelectedRecord(null);
    if (gridRef.current?.api) {
      gridRef.current.api.deselectAll();
    }
  }, []);

  /**
   * View selected record on map
   */
  const viewOnMap = useCallback(() => {
    if (selectedRecord?._feature) {
      zoomToFeature(selectedRecord._feature);
      setMode('map');
      // Open the map's feature panel after switching to map mode
      setTimeout(() => {
        if (mapViewRef?.current?.selectFeature) {
          mapViewRef.current.selectFeature(selectedRecord._feature);
        }
      }, 100);
    }
  }, [selectedRecord, zoomToFeature, setMode, mapViewRef]);

  /**
   * Format value for side panel display
   */
  const formatValueForDisplay = useCallback((field, value) => {
    if (value === null || value === undefined || value === '') return '';

    if (field.toUpperCase().includes('DATE')) {
      return formatDate(value);
    }

    if (field === 'SALEAMOUNT' || field === 'LIVINGAREA' ||
        field === 'LEGALACRES' || field === 'YEARBUILT' ||
        field === 'STORIES' || field === 'FRONTAGE' ||
        field === 'ASSESSEDVALUE' || field === 'TAXAMOUNT') {
      return formatNumber(value);
    }

    return String(value);
  }, [formatDate, formatNumber]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    exportCSV,
    clearTable,
    getRowCount: () => rowCount
  }), [exportCSV, clearTable, rowCount]);

  const allColumns = getColumnDefs();

  // Compute display count - use AG Grid's displayed count if available, otherwise fallback to data length
  const displayCount = useMemo(() => {
    if (!hasResults) return 0;
    // If rowCount has been set by AG Grid, use it (it respects filters)
    if (rowCount > 0) return rowCount;
    // Fallback to the actual data length if rowCount hasn't been set yet
    return searchResults?.features?.length || 0;
  }, [hasResults, rowCount, searchResults?.features?.length]);

  return (
    <div className="table-view-wrapper">
      {/* Inject Styles */}
      <style>{tableViewStyles}</style>

      {/* Tools Bar */}
      <div className="table-tools-bar">
        <div className="table-tools-left">
          <div className="table-status">
            <BarChart3 className="w-4 h-4" style={{ color: colors.text600 }} />
            <span className="table-status-text">
              {hasResults
                ? `${displayCount.toLocaleString()} ${displayCount === 1 ? 'record' : 'records'}`
                : 'No results to display'}
            </span>
          </div>

          {isSearching && (
            <div className="table-search-status">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Searching...</span>
            </div>
          )}
        </div>

        <div className="table-tools-right">
          <button
            className="table-tool-btn"
            onClick={() => setShowColumnDialog(true)}
            disabled={!hasResults}
            title="Show/Hide columns"
          >
            <Columns className="w-4 h-4" />
          </button>

          <button
            className="table-tool-btn"
            onClick={resetTable}
            disabled={!hasResults}
            title="Reset table layout"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            className="table-tool-btn"
            onClick={exportCSV}
            disabled={!hasResults}
            title="Export to CSV"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            className="table-tool-btn"
            onClick={clearTable}
            disabled={!hasResults}
            title="Clear table"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="table-content-area">
        {/* Empty State */}
        {!hasResults && !isSearching && (
          <div className="table-empty-state">
            <div className="table-empty-content">
              <div className="table-empty-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-16 h-16">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
              </div>
              <h3 className="table-empty-title">No Data to Display</h3>
              <p className="table-empty-text">
                Search for properties using the search bar to populate the table with results.
              </p>
              {config?.messages?.exampleQuestions?.[0] && (
                <div className="table-empty-hint">
                  <span className="hint-icon">💡</span>
                  <span>Try: "{config.messages.exampleQuestions[0]}"</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading State */}
        {isSearching && !hasResults && (
          <div className="table-empty-state">
            <div className="table-empty-content">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: colors.text600 }} />
              <p className="text-slate-600">Searching...</p>
            </div>
          </div>
        )}

        {/* Grid Container */}
        <div
          className={`table-grid-container ag-theme-alpine ${!hasResults ? 'hidden' : ''} ${sidePanelOpen ? 'with-panel' : ''}`}
        >
          <AgGridReact
            ref={gridRef}
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            animateRows={true}
            rowSelection="single"
            suppressCellFocus={true}
            enableCellTextSelection={true}
            rowHeight={ROW_HEIGHT}
            headerHeight={44}
            pagination={true}
            paginationPageSize={DEFAULT_PAGE_SIZE}
            paginationPageSizeSelector={[25, 50, 100, 250, 500]}
            tooltipShowDelay={500}
            onGridReady={onGridReady}
            onRowClicked={onRowClicked}
            onRowDoubleClicked={onRowDoubleClicked}
            onModelUpdated={onModelUpdated}
            onFirstDataRendered={onFirstDataRendered}
            overlayLoadingTemplate='<div class="table-loading"><div class="table-loading-spinner"></div><span>Loading data...</span></div>'
            overlayNoRowsTemplate='<div class="table-no-rows">No matching records found</div>'
          />
        </div>

        {/* Side Panel */}
        <div className={`table-side-panel ${sidePanelOpen ? 'open' : ''}`}>
          <div className="side-panel-header">
            <h3 className="side-panel-title">Record Details</h3>
            <button
              className="side-panel-close"
              onClick={closeSidePanel}
              title="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="side-panel-content">
            {selectedRecord ? (
              <div className="side-panel-fields">
                {allColumns.map((col) => {
                  const value = selectedRecord[col.field];
                  const displayValue = formatValueForDisplay(col.field, value);

                  if (displayValue === '' || displayValue === null || displayValue === undefined) {
                    return null;
                  }

                  return (
                    <div key={col.field} className="side-panel-field">
                      <div className="field-label">{col.headerName || col.field}</div>
                      <div className="field-value">{displayValue}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="side-panel-placeholder">Select a record to view details</p>
            )}
          </div>

          {selectedRecord && (
            <div className="side-panel-footer">
              <button
                className="side-panel-action-btn"
                onClick={viewOnMap}
                style={{ backgroundColor: colors.bg600 }}
              >
                <MapPin className="w-4 h-4" />
                View on Map
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Column Visibility Dialog */}
      {showColumnDialog && (
        <div
          className="table-dialog-overlay visible"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowColumnDialog(false);
          }}
        >
          <div className="table-dialog">
            <div className="table-dialog-header">
              <h3>Show/Hide Columns</h3>
              <button
                className="table-dialog-close"
                onClick={() => setShowColumnDialog(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="table-dialog-content">
              {allColumns.map((col) => (
                <label key={col.field} className="column-visibility-item">
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(col.field)}
                    onChange={() => toggleColumn(col.field)}
                  />
                  <span className="column-checkbox-custom" />
                  <span className="column-name">{col.headerName || col.field}</span>
                </label>
              ))}
            </div>

            <div className="table-dialog-footer">
              <button
                className="table-dialog-btn secondary"
                onClick={showAllColumns}
              >
                Show All
              </button>
              <button
                className="table-dialog-btn primary"
                onClick={() => setShowColumnDialog(false)}
                style={{ backgroundColor: colors.bg600 }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * Table View Styles
 */
const tableViewStyles = `
  /* Table View Wrapper */
  .table-view-wrapper {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: #f8fafc;
    overflow: hidden;
  }

  /* Content Area */
  .table-content-area {
    flex: 1;
    display: flex;
    position: relative;
    overflow: hidden;
  }

  /* Tools Bar */
  .table-tools-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    background: white;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
    gap: 12px;
  }

  .table-tools-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .table-tools-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .table-status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #475569;
    font-weight: 500;
  }

  .table-search-status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #0369a1;
    font-weight: 500;
    padding: 4px 10px;
    background: #f0f9ff;
    border-radius: 6px;
    border: 1px solid #bae6fd;
  }

  .table-tool-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .table-tool-btn:hover:not(:disabled) {
    background: #e2e8f0;
    color: #0369a1;
    border-color: #cbd5e1;
  }

  .table-tool-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .table-tool-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Empty State */
  .table-empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
  }

  .table-empty-content {
    text-align: center;
    max-width: 400px;
  }

  .table-empty-icon {
    margin-bottom: 20px;
    color: #cbd5e1;
  }

  .table-empty-icon svg {
    width: 80px;
    height: 80px;
    margin: 0 auto;
  }

  .table-empty-title {
    font-size: 20px;
    font-weight: 600;
    color: #334155;
    margin-bottom: 8px;
  }

  .table-empty-text {
    font-size: 14px;
    color: #64748b;
    line-height: 1.5;
    margin-bottom: 20px;
  }

  .table-empty-hint {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 10px;
    font-size: 13px;
    color: #0369a1;
  }

  /* Grid Container */
  .table-grid-container {
    flex: 1;
    width: 100%;
    overflow: hidden;
    transition: width 0.3s ease;
  }

  .table-grid-container.hidden {
    display: none;
  }

  .table-grid-container.with-panel {
    width: calc(100% - 380px);
  }

  /* Side Panel */
  .table-side-panel {
    position: absolute;
    top: 0;
    right: 0;
    width: 380px;
    height: 100%;
    background: white;
    border-left: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    z-index: 100;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.08);
  }

  .table-side-panel.open {
    transform: translateX(0);
  }

  .side-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #e2e8f0;
    background: linear-gradient(to bottom, #f8fafc, white);
  }

  .side-panel-title {
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }

  .side-panel-close {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .side-panel-close:hover {
    background: #f1f5f9;
    color: #334155;
  }

  .side-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
  }

  .side-panel-placeholder {
    text-align: center;
    color: #94a3b8;
    padding: 40px 20px;
  }

  .side-panel-fields {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .side-panel-field {
    display: flex;
    flex-direction: column;
    padding: 12px 14px;
    background: #f8fafc;
    border-radius: 8px;
    margin-bottom: 8px;
    transition: background 0.15s ease;
  }

  .side-panel-field:hover {
    background: #f1f5f9;
  }

  .field-label {
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 4px;
  }

  .field-value {
    font-size: 14px;
    color: #1e293b;
    word-break: break-word;
    line-height: 1.5;
  }

  .side-panel-footer {
    padding: 16px 20px;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .side-panel-action-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    background: #0369a1;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .side-panel-action-btn:hover {
    filter: brightness(0.9);
  }

  .side-panel-action-btn:active {
    transform: scale(0.98);
  }

  /* Column Visibility Dialog */
  .table-dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    opacity: 0;
    visibility: hidden;
    transition: all 0.2s ease;
    backdrop-filter: blur(4px);
  }

  .table-dialog-overlay.visible {
    opacity: 1;
    visibility: visible;
  }

  .table-dialog {
    background: white;
    border-radius: 12px;
    width: 90%;
    max-width: 400px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    transform: scale(0.95);
    transition: transform 0.2s ease;
  }

  .table-dialog-overlay.visible .table-dialog {
    transform: scale(1);
  }

  .table-dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    border-bottom: 1px solid #e2e8f0;
  }

  .table-dialog-header h3 {
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }

  .table-dialog-close {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .table-dialog-close:hover {
    background: #f1f5f9;
    color: #334155;
  }

  .table-dialog-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px 20px;
    max-height: 400px;
  }

  .column-visibility-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .column-visibility-item:hover {
    background: #f1f5f9;
  }

  .column-visibility-item input {
    display: none;
  }

  .column-checkbox-custom {
    width: 20px;
    height: 20px;
    border: 2px solid #cbd5e1;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .column-visibility-item input:checked + .column-checkbox-custom {
    background: #0369a1;
    border-color: #0369a1;
  }

  .column-visibility-item input:checked + .column-checkbox-custom::after {
    content: '';
    width: 6px;
    height: 10px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    margin-top: -2px;
  }

  .column-name {
    font-size: 14px;
    color: #334155;
  }

  .table-dialog-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 20px;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
    border-radius: 0 0 12px 12px;
  }

  .table-dialog-btn {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .table-dialog-btn.secondary {
    background: white;
    border: 1px solid #e2e8f0;
    color: #475569;
  }

  .table-dialog-btn.secondary:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
  }

  .table-dialog-btn.primary {
    background: #0369a1;
    border: none;
    color: white;
  }

  .table-dialog-btn.primary:hover {
    filter: brightness(0.9);
  }

  /* Cell truncation */
  .table-cell-truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Row Action Button */
  .table-row-action {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .table-row-action:hover {
    background: #e0f2fe;
    color: #0369a1;
  }

  /* Loading State */
  .table-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 40px;
    color: #64748b;
  }

  .table-loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e2e8f0;
    border-top-color: #0369a1;
    border-radius: 50%;
    animation: table-spin 0.8s linear infinite;
  }

  @keyframes table-spin {
    to { transform: rotate(360deg); }
  }

  .table-no-rows {
    padding: 40px;
    text-align: center;
    color: #64748b;
    font-size: 14px;
  }

  /* AG Grid Theme Overrides */
  .table-grid-container.ag-theme-alpine {
    --ag-header-height: 44px;
    --ag-header-foreground-color: #334155;
    --ag-header-background-color: #f8fafc;
    --ag-header-cell-hover-background-color: #f1f5f9;
    --ag-row-hover-color: #f0f9ff;
    --ag-selected-row-background-color: #e0f2fe;
    --ag-font-family: inherit;
    --ag-font-size: 13px;
    --ag-row-border-color: #f1f5f9;
    --ag-border-color: #e2e8f0;
    --ag-secondary-border-color: #f1f5f9;
    --ag-alpine-active-color: #0369a1;
    --ag-input-focus-border-color: #0369a1;
  }

  .table-grid-container .ag-header-cell {
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding-left: 12px;
    padding-right: 12px;
  }

  .table-grid-container .ag-header-cell-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .table-grid-container .ag-header-cell-menu-button {
    opacity: 0.5;
    transition: opacity 0.15s ease;
  }

  .table-grid-container .ag-header-cell:hover .ag-header-cell-menu-button {
    opacity: 1;
  }

  .table-grid-container .ag-header-cell-menu-button:hover {
    color: #0369a1;
  }

  .table-grid-container .ag-cell {
    display: flex;
    align-items: center;
    padding-left: 12px;
    padding-right: 12px;
    line-height: 1.4;
    overflow: hidden;
  }

  .table-grid-container .ag-cell-value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .table-grid-container .ag-row {
    border-bottom: 1px solid #f1f5f9;
    cursor: pointer;
  }

  .table-grid-container .ag-row:hover {
    background-color: #f0f9ff;
  }

  .table-grid-container .ag-row-selected {
    background-color: #e0f2fe !important;
  }

  .table-grid-container .ag-paging-panel {
    border-top: 1px solid #e2e8f0;
    background: white;
    padding: 8px 16px;
    height: 48px;
  }

  /* Filter popup styling */
  .table-grid-container .ag-filter {
    padding: 12px;
  }

  .table-grid-container .ag-filter-apply-panel {
    padding: 8px 0 0 0;
  }

  /* Tooltip styling */
  .table-grid-container .ag-tooltip {
    background-color: #1e293b;
    color: white;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12px;
    max-width: 300px;
    word-wrap: break-word;
    white-space: normal;
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .table-tools-bar {
      padding: 8px 12px;
    }

    .table-status {
      font-size: 13px;
    }

    .table-tool-btn {
      width: 30px;
      height: 30px;
    }

    .table-empty-content {
      padding: 0 16px;
    }

    .table-empty-icon svg {
      width: 60px;
      height: 60px;
    }

    .table-empty-title {
      font-size: 18px;
    }

    .table-empty-hint {
      font-size: 12px;
      padding: 10px 12px;
    }

    .table-grid-container.ag-theme-alpine {
      --ag-font-size: 12px;
    }

    .table-grid-container .ag-header-cell {
      font-size: 10px;
      padding-left: 8px;
      padding-right: 8px;
    }

    .table-grid-container .ag-cell {
      padding-left: 8px;
      padding-right: 8px;
    }

    /* Side panel full width on mobile */
    .table-side-panel {
      width: 100%;
    }

    .table-grid-container.with-panel {
      display: none;
    }
  }
`;

export default TableView;
