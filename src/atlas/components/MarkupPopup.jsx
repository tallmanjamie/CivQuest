import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  ZoomIn,
  Edit3,
  Check,
  MapPin,
  Ruler,
  Square,
  Circle,
  Minus,
  Type,
  Tag,
  FileText,
  GripVertical,
  Eye,
  Radar
} from 'lucide-react';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';
import Point from '@arcgis/core/geometry/Point';
import Polyline from '@arcgis/core/geometry/Polyline';
import Polygon from '@arcgis/core/geometry/Polygon';
import { getThemeColors } from '../utils/themeColors';
import { useAtlas } from '../AtlasApp';
import { useIntegrations } from '../hooks/useIntegrations';
import NearbySearchTool from './NearbySearchTool';

/**
 * Ensures the geometry is a proper ArcGIS Geometry class instance.
 * Plain JSON objects need to be converted to class instances for geometryEngine to work.
 */
const ensureGeometry = (geom) => {
  if (!geom) return null;

  // If it's already a proper geometry instance with declaredClass, return as-is
  if (geom.declaredClass) return geom;

  // Otherwise, construct the appropriate geometry class based on type
  const type = geom.type;
  const spatialReference = geom.spatialReference || { wkid: 4326 };

  if (type === 'point') {
    return new Point({
      x: geom.x,
      y: geom.y,
      spatialReference
    });
  } else if (type === 'polyline') {
    return new Polyline({
      paths: geom.paths,
      spatialReference
    });
  } else if (type === 'polygon') {
    return new Polygon({
      rings: geom.rings,
      spatialReference
    });
  }

  // Fallback - return the original
  return geom;
};

// Unit configurations for different geometry types
const POINT_UNITS = [
  { id: 'dd', label: 'Decimal Degrees', format: (lat, lon) => `${lat.toFixed(6)}°, ${lon.toFixed(6)}°` },
  { id: 'dms', label: 'DMS', format: (lat, lon) => `${toDMS(lat, true)}, ${toDMS(lon, false)}` },
  { id: 'latlon', label: 'Lat / Lon', format: (lat, lon) => `Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}` }
];

const LINE_UNITS = [
  { id: 'feet', label: 'Feet', suffix: 'ft' },
  { id: 'meters', label: 'Meters', suffix: 'm' },
  { id: 'miles', label: 'Miles', suffix: 'mi' },
  { id: 'kilometers', label: 'Kilometers', suffix: 'km' }
];

const POLYGON_UNITS = [
  { id: 'acres', label: 'Acres', suffix: 'ac', arcgisUnit: 'acres' },
  { id: 'sqfeet', label: 'Square Feet', suffix: 'sq ft', arcgisUnit: 'square-feet' },
  { id: 'sqmeters', label: 'Square Meters', suffix: 'sq m', arcgisUnit: 'square-meters' },
  { id: 'hectares', label: 'Hectares', suffix: 'ha', arcgisUnit: 'hectares' }
];

// Helper function for DMS conversion
const toDMS = (coord, isLat) => {
  const abs = Math.abs(coord);
  const d = Math.floor(abs);
  const m = Math.floor((abs - d) * 60);
  const s = ((abs - d - m / 60) * 3600).toFixed(1);
  const dir = isLat ? (coord >= 0 ? 'N' : 'S') : (coord >= 0 ? 'E' : 'W');
  return `${d}°${m}'${s}"${dir}`;
};

/**
 * MarkupPopup Component
 * Displays detailed information and editing controls for markup features
 */
export default function MarkupPopup({
  markup,
  view,
  config,
  onClose,
  onZoomTo,
  onEditMarkup,
  onDoneEditing,
  onCancelEditing,
  onUpdateMarkup,
  onUpdateLabel,
  onNearbySearch,
  onSaveBufferAsMarkup,
  isEditing = false,
  onWidthChange,
  refreshKey = 0
}) {
  const { config: atlasConfig, orgId, activeMap } = useAtlas();
  const themeColor = config?.ui?.themeColor || atlasConfig?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  // Integrations (EagleView/Pictometry)
  const { isPictometryEnabled, openEagleView } = useIntegrations(orgId);

  // State
  const [name, setName] = useState(markup?.attributes?.name || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [notes, setNotes] = useState(markup?.attributes?.notes || '');
  const [showLabel, setShowLabel] = useState(markup?.attributes?.showLabel || false);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [measurement, setMeasurement] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [desktopWidth, setDesktopWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [showNearbyTool, setShowNearbyTool] = useState(false);
  const resizeRef = React.useRef({ startX: 0, startW: 0 });

  // Determine markup type
  const markupType = useMemo(() => {
    return markup?.attributes?.tool || 'point';
  }, [markup]);

  // Get available units based on markup type
  const availableUnits = useMemo(() => {
    switch (markupType) {
      case 'point':
      case 'text':
        return POINT_UNITS;
      case 'polyline':
        return LINE_UNITS;
      case 'polygon':
        return POLYGON_UNITS;
      default:
        return POINT_UNITS;
    }
  }, [markupType]);

  // Initialize unit selection - reset when markup type changes or unit is invalid
  useEffect(() => {
    if (availableUnits.length > 0) {
      // Check if current selectedUnit is valid for this markup type
      const currentUnitValid = selectedUnit && availableUnits.some(u => u.id === selectedUnit.id);

      if (!currentUnitValid) {
        // Try to restore saved unit preference, or use first available
        const savedUnit = markup?.attributes?.measurementUnit;
        const found = availableUnits.find(u => u.id === savedUnit);
        setSelectedUnit(found || availableUnits[0]);
      }
    }
  }, [availableUnits, markup]);

  // Calculate measurement when unit or geometry changes (refreshKey triggers recalc after editing)
  useEffect(() => {
    if (!markup?.geometry || !selectedUnit) return;

    try {
      // Ensure geometry is a proper ArcGIS Geometry class instance
      const geometry = ensureGeometry(markup.geometry);
      if (!geometry) return;

      if (markupType === 'point' || markupType === 'text') {
        const lon = geometry.longitude ?? geometry.x;
        const lat = geometry.latitude ?? geometry.y;
        if (lon !== undefined && lat !== undefined) {
          setMeasurement(selectedUnit.format(lat, lon));
        }
      } else if (markupType === 'polyline' && geometryEngine) {
        const length = geometryEngine.geodesicLength(geometry, selectedUnit.id);
        setMeasurement(`${length.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${selectedUnit.suffix}`);
      } else if (markupType === 'polygon' && geometryEngine) {
        const area = geometryEngine.geodesicArea(geometry, selectedUnit.arcgisUnit);
        setMeasurement(`${Math.abs(area).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${selectedUnit.suffix}`);
      }
    } catch (err) {
      console.warn('[MarkupPopup] Measurement error:', err);
      setMeasurement('Unable to calculate');
    }
  }, [markup, selectedUnit, markupType, refreshKey]);

  // Sync name with markup (refreshKey triggers sync after editing)
  useEffect(() => {
    setName(markup?.attributes?.name || '');
    setNotes(markup?.attributes?.notes || '');
    setShowLabel(markup?.attributes?.showLabel || false);
  }, [markup, refreshKey]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Notify parent of width changes
  useEffect(() => {
    onWidthChange?.(desktopWidth);
  }, [desktopWidth, onWidthChange]);

  // Handle name save
  const handleSaveName = useCallback(() => {
    if (name.trim() && markup) {
      onUpdateMarkup?.(markup, { name: name.trim() });
    }
    setIsEditingName(false);
  }, [name, markup, onUpdateMarkup]);

  // Handle notes save
  const handleNotesChange = useCallback((newNotes) => {
    setNotes(newNotes);
    if (markup) {
      onUpdateMarkup?.(markup, { notes: newNotes });
    }
  }, [markup, onUpdateMarkup]);

  // Handle unit change - also update label on map if showing
  const handleUnitChange = useCallback((unitId) => {
    const unit = availableUnits.find(u => u.id === unitId);
    if (unit) {
      setSelectedUnit(unit);
      if (markup) {
        onUpdateMarkup?.(markup, { measurementUnit: unitId });
      }
    }
  }, [availableUnits, markup, onUpdateMarkup]);

  // Update label on map when measurement changes and showLabel is true
  useEffect(() => {
    if (showLabel && measurement && markup) {
      onUpdateLabel?.(markup, true, measurement);
    }
  }, [measurement, showLabel, markup, onUpdateLabel]);

  // Handle label toggle
  const handleLabelToggle = useCallback((checked) => {
    setShowLabel(checked);
    if (markup) {
      onUpdateMarkup?.(markup, { showLabel: checked });
      onUpdateLabel?.(markup, checked, measurement);
    }
  }, [markup, measurement, onUpdateMarkup, onUpdateLabel]);

  // Handle zoom
  const handleZoom = useCallback(() => {
    if (markup) {
      onZoomTo?.(markup);
    }
  }, [markup, onZoomTo]);

  // Handle edit
  const handleEdit = useCallback(() => {
    if (markup) {
      onEditMarkup?.(markup);
    }
  }, [markup, onEditMarkup]);

  // Handle done editing
  const handleDoneEditing = useCallback(() => {
    onDoneEditing?.();
  }, [onDoneEditing]);

  // Handle cancel editing
  const handleCancelEditing = useCallback(() => {
    onCancelEditing?.();
  }, [onCancelEditing]);

  // Handle EagleView button click
  const handleOpenEagleView = useCallback(() => {
    if (!markup?.geometry) return;

    openEagleView({
      geometry: markup.geometry,
      title: name || 'Markup',
      themeColor: colors.bg500
    });
  }, [markup, name, colors.bg500, openEagleView]);

  // Handle Nearby button click
  const handleNearbyClick = useCallback(() => {
    setShowNearbyTool(true);
  }, []);

  // Handle Nearby search results
  const handleNearbyResults = useCallback((features, bufferGeometry, searchInfo) => {
    console.log('[MarkupPopup] Nearby search found', features.length, 'features');
    setShowNearbyTool(false);
    if (onNearbySearch) {
      onNearbySearch(features, bufferGeometry, searchInfo);
    }
  }, [onNearbySearch]);

  // Handle saving buffer as markup from nearby tool
  const handleSaveBuffer = useCallback((bufferGeometry, bufferName) => {
    if (onSaveBufferAsMarkup) {
      onSaveBufferAsMarkup(bufferGeometry, bufferName);
    }
  }, [onSaveBufferAsMarkup]);

  // Get endpoint for nearby search
  const nearbyEndpoint = activeMap?.endpoint || config?.data?.endpoint;

  // Desktop resizing
  const startResizingDesktop = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = { startX: e.clientX, startW: desktopWidth };
    const onMouseMove = (moveEvent) => {
      const delta = resizeRef.current.startX - moveEvent.clientX;
      setDesktopWidth(Math.min(window.innerWidth * 0.8, Math.max(300, resizeRef.current.startW + delta)));
    };
    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [desktopWidth]);

  // Get icon for markup type
  const getMarkupIcon = () => {
    switch (markupType) {
      case 'polyline': return Minus;
      case 'polygon': return Square;
      case 'text': return Type;
      default: return Circle;
    }
  };

  const MarkupIcon = getMarkupIcon();
  const markupColor = markup?.attributes?.color || colors.bg500;

  if (!markup) return null;

  const content = (
    <>
      {/* Header with editable name */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${markupColor}20` }}
          >
            <MarkupIcon
              className="w-4 h-4"
              style={{ color: markupColor }}
              fill={markupType === 'polygon' ? markupColor : 'none'}
              opacity={markupType === 'polygon' ? 0.5 : 1}
            />
          </div>

          {isEditingName ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                className="flex-1 min-w-0 px-2 py-1 text-sm font-semibold border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={handleSaveName}
                className="p-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="flex items-center gap-2 min-w-0 group"
            >
              <h3 className="font-semibold text-slate-800 truncate text-sm group-hover:text-blue-600 transition">
                {name || 'Untitled Markup'}
              </h3>
              <Edit3 className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-200 rounded-lg transition ml-2"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 p-3 bg-slate-50 border-b border-slate-200">
        {isEditing ? (
          <>
            {/* Done/Cancel buttons when editing */}
            <button
              onClick={handleCancelEditing}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 rounded-lg transition border border-slate-200"
            >
              <X className="w-4 h-4 text-slate-400" />
              <span>Cancel</span>
            </button>
            <button
              onClick={handleDoneEditing}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-white rounded-lg transition border border-green-600"
              style={{ backgroundColor: '#22c55e' }}
            >
              <Check className="w-4 h-4 text-white" />
              <span>Done</span>
            </button>
          </>
        ) : (
          <>
            {/* Zoom/Edit/Nearby buttons when not editing */}
            <button
              onClick={handleZoom}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 rounded-lg transition border border-slate-200"
            >
              <ZoomIn className="w-4 h-4 text-slate-400" />
              <span>Zoom To</span>
            </button>
            <button
              onClick={handleEdit}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 rounded-lg transition border border-slate-200"
            >
              <Edit3 className="w-4 h-4 text-slate-400" />
              <span>Edit</span>
            </button>
            <button
              onClick={handleNearbyClick}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 rounded-lg transition border border-slate-200"
            >
              <Radar className="w-4 h-4 text-slate-400" />
              <span>Nearby</span>
            </button>
            {isPictometryEnabled && (
              <button
                onClick={handleOpenEagleView}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-white rounded-lg transition border hover:opacity-90"
                style={{ backgroundColor: colors.bg500, borderColor: colors.bg500 }}
              >
                <Eye className="w-4 h-4 text-white" />
                <span>EagleView</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Nearby Search Tool */}
      {showNearbyTool && (
        <div className="p-3 border-b border-slate-200">
          <NearbySearchTool
            geometry={markup?.geometry}
            endpoint={nearbyEndpoint}
            customFeatureInfo={activeMap?.customFeatureInfo}
            onResults={handleNearbyResults}
            onSaveBufferAsMarkup={handleSaveBuffer}
            onClose={() => setShowNearbyTool(false)}
            themeColor={themeColor}
            sourceName={name || 'Markup'}
          />
        </div>
      )}

      {/* Measurement Display */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-2 mb-2">
          <Ruler className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold uppercase text-slate-500 tracking-wide">
            {markupType === 'point' || markupType === 'text' ? 'Coordinates' :
             markupType === 'polyline' ? 'Length' : 'Area'}
          </span>
        </div>

        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-sm font-mono text-slate-700 mb-3">
            {measurement || 'Calculating...'}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {availableUnits.map(unit => (
              <button
                key={unit.id}
                onClick={() => handleUnitChange(unit.id)}
                className={`px-2 py-1 text-[10px] font-bold uppercase rounded transition ${
                  selectedUnit?.id === unit.id
                    ? 'text-white'
                    : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                }`}
                style={selectedUnit?.id === unit.id ? { backgroundColor: colors.bg500 } : {}}
              >
                {unit.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Label Toggle */}
      <div className="px-4 py-3 border-b border-slate-200">
        <button
          onClick={() => handleLabelToggle(!showLabel)}
          className="flex items-center gap-3 cursor-pointer group w-full text-left"
        >
          <div className={`relative w-10 h-5 rounded-full transition flex-shrink-0 ${showLabel ? '' : 'bg-slate-200'}`}
               style={showLabel ? { backgroundColor: colors.bg500 } : {}}>
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              showLabel ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
          </div>
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-700 font-medium">Show measurement label</span>
          </div>
        </button>
        <p className="text-[11px] text-slate-400 mt-1.5 ml-[52px]">
          Display the measurement value on the map
        </p>
      </div>

      {/* Notes Section */}
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold uppercase text-slate-500 tracking-wide">Notes</span>
        </div>

        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Add notes about this markup..."
          className="w-full h-32 px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    </>
  );

  // Mobile layout
  if (isMobile) {
    return (
      <div
        className="fixed inset-x-0 bottom-0 bg-white z-40 flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300"
        style={{ top: '64px' }}
      >
        {content}
      </div>
    );
  }

  // Desktop layout
  return (
    <div
      className="absolute right-0 top-0 bottom-0 bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.05)] z-40 flex flex-col border-l border-slate-200"
      style={{ width: desktopWidth }}
    >
      {/* Resize Handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize transition-colors z-50 flex items-center justify-center group"
        onMouseDown={startResizingDesktop}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${colors.bg500}4D`}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <div className="hidden group-hover:block">
          <GripVertical className="w-3 h-3" style={{ color: colors.text600 }} />
        </div>
      </div>

      {content}
    </div>
  );
}
