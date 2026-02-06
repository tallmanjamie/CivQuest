import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  Pencil,
  Circle,
  Minus,
  Square,
  Type,
  X,
  Trash2,
  ZoomIn,
  Eye,
  EyeOff,
  MessageSquare,
  Plus,
  Edit3,
  Check,
  Lock,
  Download,
  FileArchive,
  FileSpreadsheet,
  Loader2,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  GripVertical
} from 'lucide-react';

/**
 * ArcGIS Core Imports
 * Note: These require @arcgis/core to be installed in your project.
 * The preview environment may show resolution errors for these modules,
 * but the code is architected correctly for a standard ArcGIS ESM project.
 */
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';
import * as geometryJsonUtils from '@arcgis/core/geometry/support/jsonUtils';
import * as symbolJsonUtils from '@arcgis/core/symbols/support/jsonUtils';

import { useAtlas } from '../AtlasApp';
import { getThemeColors } from '../utils/themeColors';
import { exportMarkupsToShapefile } from '../utils/ShapefileExportService';

const COLORS = [
  { name: 'Green', value: '#22c55e', dark: '#15803d' },
  { name: 'Blue', value: '#3b82f6', dark: '#1d4ed8' },
  { name: 'Red', value: '#ef4444', dark: '#b91c1c' },
  { name: 'Orange', value: '#f97316', dark: '#c2410c' },
  { name: 'Yellow', value: '#eab308', dark: '#a16207' },
  { name: 'Purple', value: '#8b5cf6', dark: '#6d28d9' },
  { name: 'Pink', value: '#ec4899', dark: '#be185d' },
  { name: 'Cyan', value: '#06b6d4', dark: '#0891b2' },
  { name: 'Black', value: '#1e293b', dark: '#0f172a' },
  { name: 'White', value: '#ffffff', dark: '#e2e8f0' }
];

const POINT_TYPES = [
  { id: 'circle', label: 'Circle' },
  { id: 'square', label: 'Square' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'cross', label: 'Cross' },
  { id: 'x', label: 'X' }
];

const LINE_TYPES = [
  { id: 'solid', label: 'Solid' },
  { id: 'dash', label: 'Dash' },
  { id: 'dot', label: 'Dot' },
  { id: 'dash-dot', label: 'Dash-Dot' }
];

const FONT_FAMILIES = [
  { id: 'sans-serif', label: 'Sans Serif' },
  { id: 'serif', label: 'Serif' },
  { id: 'monospace', label: 'Monospace' }
];

const POINT_SIZES = [4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32].map(s => ({ id: s.toString(), label: s.toString() }));
const LINE_WIDTHS = [1, 2, 3, 4, 5, 6, 8, 10, 12].map(s => ({ id: s.toString(), label: s.toString() }));
const TEXT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40].map(s => ({ id: s.toString(), label: s.toString() }));

const DEFAULT_FOLDER_ID = 'folder_my_markup';
const DEFAULT_FOLDER = {
  id: DEFAULT_FOLDER_ID,
  name: 'My Markup',
  expanded: true,
  visible: true
};

const hexToRgba = (hex, opacity = 1) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0, opacity];
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
    opacity
  ];
};

const toDMS = (coord, isLat) => {
  const abs = Math.abs(coord);
  const d = Math.floor(abs);
  const m = Math.floor((abs - d) * 60);
  const s = ((abs - d - m / 60) * 3600).toFixed(1);
  const dir = isLat ? (coord >= 0 ? 'N' : 'S') : (coord >= 0 ? 'E' : 'W');
  return `${d}°${m}'${s}"${dir}`;
};

/** UI Support Components */
const ColorPicker = ({ value, onChange, label }) => {
  const customColorRef = useRef(null);
  const isPredefined = COLORS.some(c => c.value.toLowerCase() === value.value.toLowerCase());

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase font-bold text-slate-400 block">{label}</label>
      <div className="flex flex-wrap gap-1 items-center">
        {COLORS.map(color => (
          <button
            key={color.value}
            onClick={() => onChange(color)}
            className={`w-5 h-5 rounded-full border-2 transition
                       ${value.value === color.value ? 'border-slate-800 scale-110' : 'border-white shadow-sm hover:scale-110'}`}
            style={{ backgroundColor: color.value }}
          />
        ))}
        <div className="relative flex items-center justify-center">
          <button
            onClick={() => customColorRef.current?.click()}
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition
                       ${!isPredefined ? 'border-slate-800 scale-110 shadow-md ring-1 ring-slate-400' : 'border-dashed border-slate-300 hover:border-slate-400 hover:scale-110'}`}
            style={!isPredefined ? { backgroundColor: value.value } : {}}
            title="Pick custom color"
          >
            {isPredefined && <Plus className="w-3 h-3 text-slate-400" />}
          </button>
          <input
            ref={customColorRef}
            type="color"
            value={!isPredefined ? value.value : '#000000'}
            onChange={(e) => onChange({ name: 'Custom', value: e.target.value, dark: e.target.value })}
            className="absolute opacity-0 pointer-events-none w-0 h-0"
          />
        </div>
      </div>
    </div>
  );
};

const Select = ({ value, onChange, options, label }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] uppercase font-bold text-slate-400 block">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white text-slate-700 focus:ring-1 focus:ring-blue-500 outline-none"
    >
      {options.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
    </select>
  </div>
);

const Slider = ({ value, onChange, min, max, step = 1, label, suffix = '' }) => (
  <div>
    <div className="flex justify-between items-center mb-1">
      <label className="text-[10px] uppercase font-bold text-slate-400">{label}</label>
      <span className="text-[10px] font-mono text-slate-600">{step < 1 ? Math.round(value * 100) + '%' : value}{suffix}</span>
    </div>
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value))}
      className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
    />
  </div>
);

const TextInput = ({ value, onChange, label, placeholder }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] uppercase font-bold text-slate-400 block">{label}</label>
    <input
      type="text" value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  </div>
);

const Checkbox = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2 cursor-pointer group">
    <div className={`w-4 h-4 rounded border flex items-center justify-center transition
      ${checked ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300 group-hover:border-blue-400'}`}>
      {checked && <X className="w-3 h-3 text-white" />}
    </div>
    <input type="checkbox" className="hidden" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span className="text-xs text-slate-600 select-none">{label}</span>
  </label>
);

const MarkupTool = forwardRef(function MarkupTool({
  view,
  graphicsLayer,
  config,
  isExpanded = false,
  onToggle,
  onMarkupCreated,
  className = '',
  justification = 'left'
}, ref) {
  const { config: atlasConfig, orgId } = useAtlas();
  const themeColor = config?.ui?.themeColor || atlasConfig?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  // State
  const [activeTool, setActiveTool] = useState(null);
  const [expandedSettings, setExpandedSettings] = useState(null);
  const [markups, setMarkups] = useState([]);
  const [editingMarkup, setEditingMarkup] = useState(null); // The graphic currently being edited
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Folder state - initialize with default "My Markup" folder
  const [folders, setFolders] = useState([{ ...DEFAULT_FOLDER }]);
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [markupMenuId, setMarkupMenuId] = useState(null); // Which markup's context menu is open
  // folderMenuId removed - folder actions are now inline buttons
  const [isFolderExporting, setIsFolderExporting] = useState(null); // folder id being exported
  const [draggedMarkup, setDraggedMarkup] = useState(null); // markup being dragged
  const [dragOverFolderId, setDragOverFolderId] = useState(null); // folder being dragged over
  const [dragOverMarkupId, setDragOverMarkupId] = useState(null); // markup being dragged over (for reordering)
  const [dropPosition, setDropPosition] = useState(null); // 'before' | 'after' relative to display order
  const [renamingMarkupId, setRenamingMarkupId] = useState(null); // markup being renamed inline
  const [renamingMarkupName, setRenamingMarkupName] = useState('');

  const [settings, setSettings] = useState({
    pointType: 'circle',
    pointColor: COLORS[1],
    pointSize: 10,
    pointOpacity: 0.9,
    pointMeasurementUnit: 'dd',
    pointShowLabel: false,
    lineType: 'solid',
    lineColor: COLORS[2],
    lineWidth: 3,
    lineOpacity: 1,
    lineMeasurementUnit: 'feet',
    lineShowLabel: false,
    polygonLineType: 'solid',
    polygonLineColor: COLORS[0],
    polygonFillColor: COLORS[0],
    polygonLineWidth: 2,
    polygonOpacity: 0.35,
    polygonMeasurementUnit: 'acres',
    polygonShowLabel: false,
    textFont: 'sans-serif',
    textColor: COLORS[8],
    textSize: 14,
    textOpacity: 1,
    textContent: 'New Label'
  });

  const sketchVMRef = useRef(null);
  const layerRef = useRef(null);
  const activeToolRef = useRef(null);
  const settingsRef = useRef(settings);
  const editingMarkupRef = useRef(null);
  const onMarkupCreatedRef = useRef(onMarkupCreated);

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { editingMarkupRef.current = editingMarkup; }, [editingMarkup]);
  useEffect(() => { onMarkupCreatedRef.current = onMarkupCreated; }, [onMarkupCreated]);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Helper to find color object from hex value
  const findColorByValue = (hexValue) => {
    if (!hexValue) return COLORS[1];
    const found = COLORS.find(c => c.value.toLowerCase() === hexValue.toLowerCase());
    return found || { name: 'Custom', value: hexValue, dark: hexValue };
  };

  // Extract settings from an existing graphic
  const extractSettingsFromGraphic = useCallback((graphic) => {
    const tool = graphic.attributes?.tool;
    const symbol = graphic.symbol;

    if (!tool || !symbol) return null;

    const extracted = {};

    if (tool === 'point') {
      extracted.pointType = symbol.style || 'circle';
      extracted.pointColor = findColorByValue(graphic.attributes?.color);
      extracted.pointSize = symbol.size || 10;
      extracted.pointOpacity = Array.isArray(symbol.color) ? symbol.color[3] : 0.9;
    } else if (tool === 'polyline') {
      extracted.lineType = symbol.style || 'solid';
      extracted.lineColor = findColorByValue(graphic.attributes?.color);
      extracted.lineWidth = symbol.width || 3;
      extracted.lineOpacity = Array.isArray(symbol.color) ? symbol.color[3] : 1;
    } else if (tool === 'polygon') {
      extracted.polygonLineType = symbol.outline?.style || 'solid';
      extracted.polygonFillColor = findColorByValue(graphic.attributes?.color);
      // Handle outline color - can be array [r,g,b,a] or Color object with r,g,b properties
      let outlineColorHex = graphic.attributes?.color;
      if (symbol.outline?.color) {
        const oc = symbol.outline.color;
        if (Array.isArray(oc)) {
          outlineColorHex = `#${oc.slice(0,3).map(c => c.toString(16).padStart(2,'0')).join('')}`;
        } else if (typeof oc === 'object' && 'r' in oc) {
          // ArcGIS Color object with r, g, b properties
          outlineColorHex = `#${[oc.r, oc.g, oc.b].map(c => c.toString(16).padStart(2,'0')).join('')}`;
        }
      }
      extracted.polygonLineColor = findColorByValue(outlineColorHex);
      extracted.polygonLineWidth = symbol.outline?.width || 2;
      extracted.polygonOpacity = Array.isArray(symbol.color) ? symbol.color[3] : 0.35;
    } else if (tool === 'text') {
      extracted.textContent = symbol.text || 'Label';
      extracted.textColor = findColorByValue(graphic.attributes?.color);
      extracted.textFont = symbol.font?.family || 'sans-serif';
      extracted.textSize = symbol.font?.size || 14;
      extracted.textOpacity = Array.isArray(symbol.color) ? symbol.color[3] : 1;
    }

    return extracted;
  }, []);

  const getSymbol = useCallback((type, s) => {
    if (!s) return null;
    switch(type) {
      case 'point':
        return {
          type: 'simple-marker',
          style: s.pointType || 'circle',
          color: hexToRgba(s.pointColor.value, s.pointOpacity),
          size: s.pointSize,
          outline: { color: hexToRgba(s.pointColor.dark, 1), width: 1.5 }
        };
      case 'polyline':
        return {
          type: 'simple-line',
          style: s.lineType || 'solid',
          color: hexToRgba(s.lineColor.value, s.lineOpacity),
          width: s.lineWidth
        };
      case 'polygon':
        return {
          type: 'simple-fill',
          color: hexToRgba(s.polygonFillColor.value, s.polygonOpacity),
          outline: { color: hexToRgba(s.polygonLineColor.value, 1), style: s.polygonLineType, width: s.polygonLineWidth }
        };
      case 'text':
        return {
          type: 'text',
          color: hexToRgba(s.textColor.value, s.textOpacity),
          text: s.textContent || 'Text',
          font: { size: s.textSize, family: s.textFont, weight: 'bold' },
          haloColor: [255, 255, 255, 0.8],
          haloSize: 1.5
        };
      default: return null;
    }
  }, []);

  /** Sync SketchViewModel symbols when settings change */
  useEffect(() => {
    if (!sketchVMRef.current) return;
    const vm = sketchVMRef.current;
    const s = settings;
    vm.pointSymbol = getSymbol(activeTool === 'text' ? 'text' : 'point', s);
    vm.polylineSymbol = getSymbol('polyline', s);
    vm.polygonSymbol = getSymbol('polygon', s);
  }, [settings, activeTool, getSymbol]);

  /** Initialize SketchViewModel and keep stable */
  useEffect(() => {
    if (!view) return;

    let layer = graphicsLayer;
    if (!layer) {
      layer = new GraphicsLayer({ title: 'Markup Layer', listMode: 'hide' });
      view.map.add(layer);
    }
    layerRef.current = layer;

    const sketchVM = new SketchViewModel({
      view,
      layer,
      updateOnGraphicClick: false, // Disable auto-edit on click - only explicit Edit button starts editing
      defaultCreateOptions: { hasZ: false }
    });

    sketchVM.on('create', (event) => {
      if (event.state === 'complete') {
        const { graphic } = event;
        const tool = activeToolRef.current;
        const s = settingsRef.current;

        if (!tool) return;

        let metricText = '';
        try {
          if (tool === 'point' || tool === 'text') {
            const lon = graphic.geometry.longitude || graphic.geometry.x;
            const lat = graphic.geometry.latitude || graphic.geometry.y;
            const unit = s.pointMeasurementUnit;
            if (unit === 'dd') metricText = `${lat.toFixed(6)}°, ${lon.toFixed(6)}°`;
            else if (unit === 'dms') metricText = `${toDMS(lat, true)}, ${toDMS(lon, false)}`;
            else if (unit === 'latlon') metricText = `Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}`;
          } else if (tool === 'polyline' && geometryEngine) {
            const len = geometryEngine.geodesicLength(graphic.geometry, s.lineMeasurementUnit);
            const labelMap = { feet: 'ft', meters: 'm', miles: 'mi', kilometers: 'km' };
            metricText = `${len.toLocaleString(undefined, {maxFractionDigits:1})} ${labelMap[s.lineMeasurementUnit] || s.lineMeasurementUnit}`;
          } else if (tool === 'polygon' && geometryEngine) {
            const unitMapping = { 'acres': 'acres', 'sqfeet': 'square-feet', 'sqmeters': 'square-meters' };
            const arcgisUnit = unitMapping[s.polygonMeasurementUnit] || 'acres';
            const area = geometryEngine.geodesicArea(graphic.geometry, arcgisUnit);
            const labelMap = { acres: 'ac', sqfeet: 'sq ft', sqmeters: 'sq m' };
            metricText = `${area.toLocaleString(undefined, {maxFractionDigits:1})} ${labelMap[s.polygonMeasurementUnit] || s.polygonMeasurementUnit}`;
          }
        } catch (e) { console.error("Measurement error:", e); }

        const symbolStyle = 
          tool === 'point' ? s.pointType :
          tool === 'polyline' ? s.lineType :
          tool === 'polygon' ? s.polygonLineType :
          tool === 'text' ? s.textFont : 'default';

        // Generate default name based on tool type
        const defaultName = tool === 'point' ? 'Point' :
                            tool === 'polyline' ? 'Polyline' :
                            tool === 'polygon' ? 'Polygon' :
                            tool === 'text' ? (s.textContent || 'Label') : 'Markup';

        const showLabel = (tool === 'point' && s.pointShowLabel) ||
                          (tool === 'polyline' && s.lineShowLabel) ||
                          (tool === 'polygon' && s.polygonShowLabel);

        const measurementUnit = tool === 'point' || tool === 'text' ? s.pointMeasurementUnit :
                                tool === 'polyline' ? s.lineMeasurementUnit :
                                tool === 'polygon' ? s.polygonMeasurementUnit : 'dd';

        graphic.attributes = {
          id: `markup_${Date.now()}`,
          name: defaultName,
          tool,
          symbolStyle,
          color: tool === 'polygon' ? s.polygonFillColor.value :
                 tool === 'polyline' ? s.lineColor.value :
                 tool === 'text' ? s.textColor.value : s.pointColor.value,
          metric: metricText,
          measurementUnit,
          showLabel,
          isMarkup: true,
          timestamp: Date.now(),
          folderId: DEFAULT_FOLDER_ID
        };

        if (showLabel && metricText) {
          const labelPoint = graphic.geometry.type === 'point' ? graphic.geometry : 
                             graphic.geometry.type === 'polygon' ? graphic.geometry.centroid : 
                             graphic.geometry.extent?.center || graphic.geometry;
          
          const label = new Graphic({
            geometry: labelPoint,
            symbol: {
              type: 'text',
              color: [40, 40, 40, 1],
              text: metricText,
              haloColor: [255, 255, 255, 0.9],
              haloSize: 1.5,
              font: { size: 10, weight: 'bold' },
              yoffset: graphic.geometry.type === 'point' ? 12 : 0
            },
            attributes: { parentId: graphic.attributes.id, isLabel: true }
          });
          layer.add(label);
        }

        setMarkups(prev => [...prev, graphic]);

        // After creation: disable tool, close properties, notify parent
        if (sketchVMRef.current) {
          sketchVMRef.current.cancel();
        }
        setActiveTool(null);
        setExpandedSettings(null);

        // Notify parent so MapView can open the popup (desktop) or just finish (mobile)
        if (onMarkupCreatedRef.current) {
          onMarkupCreatedRef.current(graphic);
        }
      }
    });

    sketchVM.on('delete', () => {
      if (layerRef.current) {
        setMarkups([...layerRef.current.graphics.items.filter(g => g.attributes?.isMarkup)]);
      }
    });

    // Handle update events for editing geometry
    sketchVM.on('update', (event) => {
      if (event.state === 'complete') {
        // Editing is complete, update metrics if geometry changed
        const graphic = event.graphics?.[0];
        if (graphic && graphic.attributes?.isMarkup) {
          const tool = graphic.attributes?.tool;
          const s = settingsRef.current;
          let metricText = '';

          try {
            if (tool === 'point' || tool === 'text') {
              const lon = graphic.geometry.longitude || graphic.geometry.x;
              const lat = graphic.geometry.latitude || graphic.geometry.y;
              const unit = graphic.attributes?.measurementUnit || s.pointMeasurementUnit;
              if (unit === 'dd') metricText = `${lat.toFixed(6)}°, ${lon.toFixed(6)}°`;
              else if (unit === 'dms') metricText = `${toDMS(lat, true)}, ${toDMS(lon, false)}`;
              else if (unit === 'latlon') metricText = `Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}`;
            } else if (tool === 'polyline' && geometryEngine) {
              const unit = graphic.attributes?.measurementUnit || s.lineMeasurementUnit;
              const len = geometryEngine.geodesicLength(graphic.geometry, unit);
              const labelMap = { feet: 'ft', meters: 'm', miles: 'mi', kilometers: 'km' };
              metricText = `${len.toLocaleString(undefined, {maximumFractionDigits:2})} ${labelMap[unit] || unit}`;
            } else if (tool === 'polygon' && geometryEngine) {
              const unit = graphic.attributes?.measurementUnit || s.polygonMeasurementUnit;
              const unitMapping = { 'acres': 'acres', 'sqfeet': 'square-feet', 'sqmeters': 'square-meters' };
              const arcgisUnit = unitMapping[unit] || 'acres';
              const area = geometryEngine.geodesicArea(graphic.geometry, arcgisUnit);
              const labelMap = { acres: 'ac', sqfeet: 'sq ft', sqmeters: 'sq m' };
              metricText = `${Math.abs(area).toLocaleString(undefined, {maximumFractionDigits:2})} ${labelMap[unit] || unit}`;
            }

            if (metricText) {
              graphic.attributes.metric = metricText;
            }
          } catch (e) { console.error("Measurement update error:", e); }

          // Update label if showLabel is enabled
          if (graphic.attributes?.showLabel && metricText && layer) {
            const markupId = graphic.attributes?.id;
            // Remove existing labels
            const existingLabels = layer.graphics.items.filter(g => g.attributes?.parentId === markupId && g.attributes?.isLabel);
            if (existingLabels.length > 0) {
              layer.removeMany(existingLabels);
            }
            // Create new label at updated position
            const labelPoint = graphic.geometry.type === 'point' ? graphic.geometry :
                               graphic.geometry.type === 'polygon' ? graphic.geometry.centroid :
                               graphic.geometry.extent?.center || graphic.geometry;
            const newLabel = new Graphic({
              geometry: labelPoint,
              symbol: {
                type: 'text',
                color: [40, 40, 40, 1],
                text: metricText,
                haloColor: [255, 255, 255, 0.9],
                haloSize: 1.5,
                font: { size: 10, weight: 'bold' },
                yoffset: graphic.geometry.type === 'point' ? 12 : 0
              },
              attributes: { parentId: markupId, isLabel: true }
            });
            layer.add(newLabel);
          }

          // Clear editing state
          if (editingMarkupRef.current === graphic) {
            setEditingMarkup(null);
            setExpandedSettings(null);
          }

          // Refresh markups list
          setMarkups(prev => [...prev]);
        }
      } else if (event.state === 'cancel') {
        // Editing was cancelled
        if (editingMarkupRef.current) {
          setEditingMarkup(null);
          setExpandedSettings(null);
        }
      }
    });

    sketchVMRef.current = sketchVM;

    // Load saved markups from localStorage (org-scoped)
    if (orgId) {
      try {
        const savedMarkups = localStorage.getItem(`atlas_markups_${orgId}`);
        if (savedMarkups) {
          const markupData = JSON.parse(savedMarkups);
          const loadedMarkups = [];
          markupData.forEach(item => {
            if (!item.geometry || !item.attributes) return;
            // Use proper fromJSON deserialization for geometry and symbol
            // toJSON() produces REST API format (e.g. "esriSMS") which autocasting doesn't handle
            let geometry, symbol;
            try {
              geometry = geometryJsonUtils.fromJSON(item.geometry);
            } catch (e) {
              console.warn('[MarkupTool] Failed to deserialize geometry, using raw:', e);
              geometry = item.geometry;
            }
            try {
              symbol = item.symbol ? symbolJsonUtils.fromJSON(item.symbol) : item.symbol;
            } catch (e) {
              console.warn('[MarkupTool] Failed to deserialize symbol, using raw:', e);
              symbol = item.symbol;
            }
            const graphic = new Graphic({
              geometry,
              symbol,
              attributes: item.attributes
            });
            if (item.visible === false) graphic.visible = false;
            layer.add(graphic);
            loadedMarkups.push(graphic);

            // Recreate labels for markups that had labels enabled
            if (graphic.attributes?.showLabel && graphic.attributes?.metric) {
              const geom = graphic.geometry;
              const labelPoint = geom.type === 'point' ? geom :
                                 geom.type === 'polygon' ? geom.centroid :
                                 geom.extent?.center || geom;
              const labelGraphic = new Graphic({
                geometry: labelPoint,
                symbol: {
                  type: 'text',
                  color: [40, 40, 40, 1],
                  text: graphic.attributes.metric,
                  haloColor: [255, 255, 255, 0.9],
                  haloSize: 1.5,
                  font: { size: 10, weight: 'bold' },
                  yoffset: geom.type === 'point' ? 12 : 0
                },
                attributes: { parentId: graphic.attributes.id, isLabel: true }
              });
              layer.add(labelGraphic);
            }
          });
          if (loadedMarkups.length > 0) {
            setMarkups(loadedMarkups);
          }
        }
      } catch (e) {
        console.error('[MarkupTool] Failed to load markups from localStorage:', e);
      }

      try {
        const savedFolders = localStorage.getItem(`atlas_markup_folders_${orgId}`);
        if (savedFolders) {
          const parsed = JSON.parse(savedFolders);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setFolders(parsed);
          }
        }
      } catch (e) {
        console.error('[MarkupTool] Failed to load folders from localStorage:', e);
      }

      setInitialLoadDone(true);
    }

    // Watch for graphics added directly to the layer (e.g., from "Save to Markup" in FeatureInfoPanel or nearby buffer)
    const layerChangeHandle = layer.graphics.on('change', (event) => {
      if (event.added && event.added.length > 0) {
        event.added.forEach(graphic => {
          // Only add if it's a markup graphic not already in our list
          // Include graphics from feature-info-panel, nearby-search, and nearby-search-popup sources
          const savedFrom = graphic.attributes?.savedFrom;
          const isExternalMarkup = savedFrom === 'feature-info-panel' ||
                                   savedFrom === 'nearby-search' ||
                                   savedFrom === 'nearby-search-popup';
          if (graphic.attributes?.isMarkup && isExternalMarkup) {
            // Assign to default folder if not already in a folder
            if (!graphic.attributes.folderId) {
              graphic.attributes.folderId = DEFAULT_FOLDER_ID;
            }
            setMarkups(prev => {
              const exists = prev.some(m => m.attributes?.id === graphic.attributes?.id);
              if (!exists) {
                return [...prev, graphic];
              }
              return prev;
            });
          }
        });
      }
    });

    return () => {
      sketchVM.destroy();
      layerChangeHandle?.remove();
      if (!graphicsLayer && layerRef.current && view.map) {
        view.map.remove(layerRef.current);
      }
    };
  }, [view, graphicsLayer, orgId]);

  // Save markups to localStorage when they change (org-scoped)
  useEffect(() => {
    if (!initialLoadDone || !orgId) return;
    try {
      const data = markups.map(m => ({
        geometry: m.geometry?.toJSON?.() || null,
        symbol: m.symbol?.toJSON?.() || m.symbol,
        attributes: { ...m.attributes },
        visible: m.visible !== false
      }));
      localStorage.setItem(`atlas_markups_${orgId}`, JSON.stringify(data));
    } catch (e) {
      console.error('[MarkupTool] Failed to save markups:', e);
    }
  }, [markups, orgId, initialLoadDone]);

  // Save folders to localStorage when they change (org-scoped)
  useEffect(() => {
    if (!initialLoadDone || !orgId) return;
    try {
      localStorage.setItem(`atlas_markup_folders_${orgId}`, JSON.stringify(folders));
    } catch (e) {
      console.error('[MarkupTool] Failed to save folders:', e);
    }
  }, [folders, orgId, initialLoadDone]);

  const startTool = (tool) => {
    if (!sketchVMRef.current) return;

    // Cancel any editing in progress
    if (editingMarkup) {
      sketchVMRef.current.cancel();
      setEditingMarkup(null);
    }

    if (activeTool === tool) {
      sketchVMRef.current.cancel();
      setActiveTool(null);
      setExpandedSettings(null);
      return;
    }

    sketchVMRef.current.cancel();
    setActiveTool(tool);
    setExpandedSettings(tool);
    
    const s = settings;
    sketchVMRef.current.pointSymbol = getSymbol(tool === 'text' ? 'text' : 'point', s);
    sketchVMRef.current.polylineSymbol = getSymbol('polyline', s);
    sketchVMRef.current.polygonSymbol = getSymbol('polygon', s);

    sketchVMRef.current.create(tool === 'text' ? 'point' : tool);
  };

  const deleteMarkup = (graphic) => {
    const id = graphic.attributes?.id;
    const layer = layerRef.current;
    if (!layer || !id) return;
    
    const toRemove = layer.graphics.items.filter(g => g === graphic || g.attributes?.parentId === id);
    layer.removeMany(toRemove);
    setMarkups(prev => prev.filter(m => m !== graphic));
  };

  const zoomTo = (graphic) => {
    if (!view || !graphic.geometry) return;
    const geometry = graphic.geometry;
    if (geometry.type === 'point') {
      view.goTo({ target: geometry, zoom: 16 }, { duration: 500 });
    } else {
      // Clone the extent before expanding to avoid modifying the original
      const extent = geometry.extent?.clone?.() || geometry.extent;
      const expandedExtent = extent?.expand?.(1.5) || extent;
      view.goTo({ target: expandedExtent }, { duration: 500 });
    }
  };

  const toggleVisibility = (graphic) => {
    if (!graphic) return;
    const layer = layerRef.current;
    const markupId = graphic.attributes?.id;

    // Toggle the graphic's visibility
    const newVisibility = !graphic.visible;
    graphic.visible = newVisibility;

    // Also toggle visibility of associated labels
    if (layer && markupId) {
      const labels = layer.graphics.items.filter(g => g.attributes?.parentId === markupId && g.attributes?.isLabel);
      labels.forEach(label => {
        label.visible = newVisibility;
      });
    }

    // Force update to reflect the change in UI
    setMarkups(prev => [...prev]);
  };

  // Export markups to shapefile
  const exportToShapefile = useCallback(async () => {
    if (markups.length === 0) {
      alert('No markups to export. Add some markups first.');
      return;
    }

    setIsExporting(true);
    setShowExportMenu(false);

    try {
      const result = await exportMarkupsToShapefile({
        markups,
        filename: 'markups',
        onProgress: (status) => {
          console.log('[MarkupTool] Shapefile export:', status);
        }
      });

      console.log('[MarkupTool] Export complete:', result);
    } catch (err) {
      console.error('[MarkupTool] Shapefile export error:', err);
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  }, [markups]);

  // Export markups to CSV
  const exportToCSV = useCallback(() => {
    if (markups.length === 0) {
      alert('No markups to export. Add some markups first.');
      return;
    }

    setShowExportMenu(false);

    // Build CSV content from markups
    const headers = ['Type', 'Label', 'Color', 'Notes', 'Geometry Type', 'Coordinates'];

    const rows = markups.map(markup => {
      const attrs = markup.attributes || {};
      const geom = markup.geometry;

      // Determine geometry type and coordinates
      let geomType = 'unknown';
      let coords = '';
      if (geom) {
        if (geom.type === 'point' || (geom.x !== undefined && geom.y !== undefined)) {
          geomType = 'point';
          coords = `${geom.x}, ${geom.y}`;
        } else if (geom.type === 'polyline' || geom.paths) {
          geomType = 'polyline';
          coords = JSON.stringify(geom.paths);
        } else if (geom.type === 'polygon' || geom.rings) {
          geomType = 'polygon';
          coords = JSON.stringify(geom.rings);
        }
      }

      return [
        attrs.tool || geomType,
        attrs.label || '',
        attrs.color || '',
        attrs.notes || '',
        geomType,
        coords
      ];
    });

    // Escape CSV values
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `markups-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [markups]);

  // Start editing a markup - enables geometry editing and opens settings panel
  const startEdit = (graphic) => {
    if (!sketchVMRef.current || !graphic) return;

    // Cancel any active creation tool
    sketchVMRef.current.cancel();
    setActiveTool(null);

    // Extract settings from the graphic and update the settings state
    const extracted = extractSettingsFromGraphic(graphic);
    if (extracted) {
      setSettings(prev => ({ ...prev, ...extracted }));
    }

    // Set editing state
    setEditingMarkup(graphic);

    // Map tool to settings panel key
    const tool = graphic.attributes?.tool;
    const settingsKey = tool === 'text' ? 'text' :
                        tool === 'polyline' ? 'polyline' :
                        tool === 'polygon' ? 'polygon' : 'point';
    setExpandedSettings(settingsKey);

    // Start geometry editing with SketchViewModel
    sketchVMRef.current.update(graphic, {
      tool: 'reshape',
      enableRotation: false,
      enableScaling: false,
      preserveAspectRatio: false,
      toggleToolOnClick: false
    });

    // Zoom to the graphic for better visibility
    zoomTo(graphic);
  };

  // Cancel editing and restore original state
  const cancelEdit = () => {
    if (!sketchVMRef.current) return;
    sketchVMRef.current.cancel();
    setEditingMarkup(null);
    setExpandedSettings(null);
  };

  // Complete editing
  const completeEdit = () => {
    if (!sketchVMRef.current) return;
    sketchVMRef.current.complete();
    setEditingMarkup(null);
    setExpandedSettings(null);
  };

  // Apply symbol changes to the graphic being edited
  const applySymbolToEditingMarkup = useCallback((newSettings) => {
    const graphic = editingMarkupRef.current;
    if (!graphic) return;

    const tool = graphic.attributes?.tool;
    let newSymbol;

    if (tool === 'point') {
      newSymbol = {
        type: 'simple-marker',
        style: newSettings.pointType || 'circle',
        color: hexToRgba(newSettings.pointColor.value, newSettings.pointOpacity),
        size: newSettings.pointSize,
        outline: { color: hexToRgba(newSettings.pointColor.dark, 1), width: 1.5 }
      };
      graphic.attributes.color = newSettings.pointColor.value;
      graphic.attributes.symbolStyle = newSettings.pointType;
    } else if (tool === 'polyline') {
      newSymbol = {
        type: 'simple-line',
        style: newSettings.lineType || 'solid',
        color: hexToRgba(newSettings.lineColor.value, newSettings.lineOpacity),
        width: newSettings.lineWidth
      };
      graphic.attributes.color = newSettings.lineColor.value;
      graphic.attributes.symbolStyle = newSettings.lineType;
    } else if (tool === 'polygon') {
      newSymbol = {
        type: 'simple-fill',
        color: hexToRgba(newSettings.polygonFillColor.value, newSettings.polygonOpacity),
        outline: {
          color: hexToRgba(newSettings.polygonLineColor.value, 1),
          style: newSettings.polygonLineType,
          width: newSettings.polygonLineWidth
        }
      };
      graphic.attributes.color = newSettings.polygonFillColor.value;
      graphic.attributes.symbolStyle = newSettings.polygonLineType;
    } else if (tool === 'text') {
      newSymbol = {
        type: 'text',
        color: hexToRgba(newSettings.textColor.value, newSettings.textOpacity),
        text: newSettings.textContent || 'Text',
        font: { size: newSettings.textSize, family: newSettings.textFont, weight: 'bold' },
        haloColor: [255, 255, 255, 0.8],
        haloSize: 1.5
      };
      graphic.attributes.color = newSettings.textColor.value;
      graphic.attributes.symbolStyle = newSettings.textFont;
    }

    if (newSymbol) {
      graphic.symbol = newSymbol;
      // Force markups state update to reflect changes in UI
      setMarkups(prev => [...prev]);
    }
  }, []);

  // Effect to apply symbol changes when editing
  useEffect(() => {
    if (editingMarkup) {
      applySymbolToEditingMarkup(settings);
    }
  }, [settings, editingMarkup, applySymbolToEditingMarkup]);

  // Update markup attributes
  const updateMarkupAttributes = useCallback((graphic, updates) => {
    if (!graphic || !updates) return;

    Object.assign(graphic.attributes, updates);
    setMarkups(prev => [...prev]);
  }, []);

  // Update or create label for a markup
  const updateMarkupLabel = useCallback((graphic, showLabel, labelText) => {
    const layer = layerRef.current;
    if (!layer || !graphic) return;

    const markupId = graphic.attributes?.id;
    if (!markupId) return;

    // Find and remove existing label
    const existingLabels = layer.graphics.items.filter(g => g.attributes?.parentId === markupId && g.attributes?.isLabel);
    if (existingLabels.length > 0) {
      layer.removeMany(existingLabels);
    }

    // Update the showLabel attribute
    graphic.attributes.showLabel = showLabel;

    // Create new label if enabled
    if (showLabel && labelText) {
      const labelPoint = graphic.geometry.type === 'point' ? graphic.geometry :
                         graphic.geometry.type === 'polygon' ? graphic.geometry.centroid :
                         graphic.geometry.extent?.center || graphic.geometry;

      const label = new Graphic({
        geometry: labelPoint,
        symbol: {
          type: 'text',
          color: [40, 40, 40, 1],
          text: labelText,
          haloColor: [255, 255, 255, 0.9],
          haloSize: 1.5,
          font: { size: 10, weight: 'bold' },
          yoffset: graphic.geometry.type === 'point' ? 12 : 0
        },
        attributes: { parentId: markupId, isLabel: true }
      });
      layer.add(label);
    }

    setMarkups(prev => [...prev]);
  }, []);

  // === Folder Management ===

  const createFolder = useCallback((name = 'New Folder') => {
    const folder = {
      id: `folder_${Date.now()}`,
      name,
      expanded: true,
      visible: true
    };
    setFolders(prev => [...prev, folder]);
    setEditingFolderId(folder.id);
    setEditingFolderName(name);
    return folder;
  }, []);

  const renameFolder = useCallback((folderId, newName) => {
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: newName } : f));
    setEditingFolderId(null);
    setEditingFolderName('');
  }, []);

  const deleteFolder = useCallback((folderId) => {
    // Prevent deletion of the default folder
    if (folderId === DEFAULT_FOLDER_ID) return;
    // Move all markups in this folder to the default folder
    setMarkups(prev => {
      prev.forEach(m => {
        if (m.attributes?.folderId === folderId) {
          m.attributes.folderId = DEFAULT_FOLDER_ID;
        }
      });
      return [...prev];
    });
    setFolders(prev => prev.filter(f => f.id !== folderId));
  }, []);

  const toggleFolderExpanded = useCallback((folderId) => {
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, expanded: !f.expanded } : f));
  }, []);

  const toggleFolderVisibility = useCallback((folderId) => {
    setFolders(prev => {
      const folder = prev.find(f => f.id === folderId);
      if (!folder) return prev;
      const newVisible = !folder.visible;

      // Toggle all markups in this folder
      const layer = layerRef.current;
      markups.forEach(m => {
        if (m.attributes?.folderId === folderId) {
          m.visible = newVisible;
          // Also toggle labels
          if (layer && m.attributes?.id) {
            const labels = layer.graphics.items.filter(g => g.attributes?.parentId === m.attributes.id && g.attributes?.isLabel);
            labels.forEach(label => { label.visible = newVisible; });
          }
        }
      });
      setMarkups(prev => [...prev]);
      return prev.map(f => f.id === folderId ? { ...f, visible: newVisible } : f);
    });
  }, [markups]);

  const moveMarkupToFolder = useCallback((graphic, folderId) => {
    if (!graphic?.attributes) return;
    graphic.attributes.folderId = folderId;
    setMarkups(prev => [...prev]);
    setMarkupMenuId(null);
  }, []);

  // Markup inline rename
  const startRenameMarkup = useCallback((markup) => {
    setRenamingMarkupId(markup.attributes?.id);
    setRenamingMarkupName(markup.attributes?.name || '');
  }, []);

  const finishRenameMarkup = useCallback((markup) => {
    if (markup && renamingMarkupName.trim()) {
      markup.attributes.name = renamingMarkupName.trim();
      setMarkups(prev => [...prev]);
    }
    setRenamingMarkupId(null);
    setRenamingMarkupName('');
  }, [renamingMarkupName]);

  // Drag-and-drop handlers
  const handleDragStart = useCallback((e, graphic) => {
    setDraggedMarkup(graphic);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', graphic.attributes?.id || '');
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedMarkup(null);
    setDragOverFolderId(null);
    setDragOverMarkupId(null);
    setDropPosition(null);
  }, []);

  const handleFolderDragOver = useCallback((e, folderId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolderId(folderId);
    setDragOverMarkupId(null);
    setDropPosition(null);
  }, []);

  const handleFolderDragLeave = useCallback(() => {
    setDragOverFolderId(null);
  }, []);

  const handleFolderDrop = useCallback((e, folderId) => {
    e.preventDefault();
    if (draggedMarkup) {
      moveMarkupToFolder(draggedMarkup, folderId);
    }
    setDraggedMarkup(null);
    setDragOverFolderId(null);
  }, [draggedMarkup, moveMarkupToFolder]);

  // Drag-over handler for individual markup rows (reordering)
  const handleMarkupDragOver = useCallback((e, markupId) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'before' : 'after';

    setDragOverMarkupId(markupId);
    setDropPosition(position);
    setDragOverFolderId(null);
  }, []);

  // Drop handler for reordering within/across folders
  const handleMarkupDrop = useCallback((e, targetMarkupId, targetFolderId) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedMarkup || !targetMarkupId) {
      setDraggedMarkup(null);
      setDragOverMarkupId(null);
      setDropPosition(null);
      setDragOverFolderId(null);
      return;
    }

    const draggedId = draggedMarkup.attributes?.id;
    if (draggedId === targetMarkupId) {
      setDraggedMarkup(null);
      setDragOverMarkupId(null);
      setDropPosition(null);
      setDragOverFolderId(null);
      return;
    }

    setMarkups(prev => {
      const newMarkups = [...prev];

      // Find and remove dragged item
      const draggedIndex = newMarkups.findIndex(m => m.attributes?.id === draggedId);
      if (draggedIndex === -1) return prev;
      const [draggedItem] = newMarkups.splice(draggedIndex, 1);

      // Update folder assignment
      draggedItem.attributes.folderId = targetFolderId;

      // Find target position (after removing dragged item)
      const targetIndex = newMarkups.findIndex(m => m.attributes?.id === targetMarkupId);
      if (targetIndex === -1) {
        newMarkups.push(draggedItem);
        return newMarkups;
      }

      // Display is reversed (newest first), so:
      // 'before' in display (above target) → insert AFTER target in array
      // 'after' in display (below target) → insert AT target index in array
      if (dropPosition === 'before') {
        newMarkups.splice(targetIndex + 1, 0, draggedItem);
      } else {
        newMarkups.splice(targetIndex, 0, draggedItem);
      }

      return newMarkups;
    });

    setDraggedMarkup(null);
    setDragOverMarkupId(null);
    setDropPosition(null);
    setDragOverFolderId(null);
  }, [draggedMarkup, dropPosition]);

  const getMarkupsInFolder = useCallback((folderId) => {
    return markups.filter(m => m.attributes?.folderId === folderId);
  }, [markups]);

  const exportFolderToShapefile = useCallback(async (folderId) => {
    const folderMarkups = getMarkupsInFolder(folderId);
    const folder = folders.find(f => f.id === folderId);
    if (folderMarkups.length === 0) {
      alert('No markups in this folder to export.');
      return;
    }

    setIsFolderExporting(folderId);

    try {
      await exportMarkupsToShapefile({
        markups: folderMarkups,
        filename: folder?.name || 'folder-markups',
        onProgress: (status) => console.log('[MarkupTool] Folder export:', status)
      });
    } catch (err) {
      console.error('[MarkupTool] Folder export error:', err);
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsFolderExporting(null);
    }
  }, [getMarkupsInFolder, folders]);

  // Find markup by ID
  const findMarkupById = useCallback((markupId) => {
    return markups.find(m => m.attributes?.id === markupId);
  }, [markups]);

  // Edit a markup by ID (called from MarkupPopup)
  const editMarkupById = useCallback((markupId) => {
    const graphic = findMarkupById(markupId);
    if (graphic) {
      startEdit(graphic);
    }
  }, [findMarkupById, startEdit]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    editMarkupById,
    startEdit,
    cancelEdit,
    completeEdit,
    updateMarkupAttributes,
    updateMarkupLabel,
    findMarkupById,
    get editingMarkup() { return editingMarkup; },
    get markups() { return markups; }
  }), [editMarkupById, startEdit, cancelEdit, completeEdit, updateMarkupAttributes, updateMarkupLabel, findMarkupById, editingMarkup, markups]);

  // Render a single markup row (used in both folder contents and uncategorized)
  const renderMarkupRow = (m, isInFolder, folderId) => {
    const tool = m.attributes?.tool;
    const Icon = tool === 'polyline' ? Minus : tool === 'polygon' ? Square : tool === 'text' ? Type : Circle;
    const isBeingEdited = editingMarkup && editingMarkup.attributes?.id === m.attributes?.id;
    const markupId = m.attributes?.id;
    const isDragging = draggedMarkup?.attributes?.id === markupId;
    const isReorderTarget = dragOverMarkupId === markupId && draggedMarkup && draggedMarkup.attributes?.id !== markupId;

    return (
      <div
        key={markupId}
        draggable
        onDragStart={(e) => handleDragStart(e, m)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => handleMarkupDragOver(e, markupId)}
        onDrop={(e) => handleMarkupDrop(e, markupId, folderId)}
        className={`relative group flex items-center gap-1.5 p-1.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing
          ${isDragging ? 'opacity-40 border-dashed border-blue-300 bg-blue-50/50' : ''}
          ${isBeingEdited
            ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
            : 'bg-white border-slate-100 hover:border-blue-200'}`}
      >
        {isReorderTarget && dropPosition === 'before' && (
          <div className="absolute -top-[3px] left-1 right-1 h-[2px] bg-blue-500 rounded-full z-10 pointer-events-none">
            <div className="absolute -left-[3px] -top-[3px] w-2 h-2 rounded-full bg-blue-500" />
          </div>
        )}
        {isReorderTarget && dropPosition === 'after' && (
          <div className="absolute -bottom-[3px] left-1 right-1 h-[2px] bg-blue-500 rounded-full z-10 pointer-events-none">
            <div className="absolute -left-[3px] -top-[3px] w-2 h-2 rounded-full bg-blue-500" />
          </div>
        )}
        <div className="flex-shrink-0 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
          <GripVertical className="w-3 h-3" />
        </div>
        <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${isBeingEdited ? 'bg-blue-100' : 'bg-slate-50'}`}>
          <Icon className="w-3.5 h-3.5" style={{ color: m.attributes?.color }} fill={tool === 'polygon' ? m.attributes?.color : 'none'} opacity={tool === 'polygon' ? 0.4 : 1} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            {renamingMarkupId === markupId ? (
              <input
                type="text"
                value={renamingMarkupName}
                onChange={(e) => setRenamingMarkupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') finishRenameMarkup(m);
                  if (e.key === 'Escape') { setRenamingMarkupId(null); setRenamingMarkupName(''); }
                }}
                onBlur={() => finishRenameMarkup(m)}
                className="text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 rounded px-1 py-0.5 w-full min-w-0 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <p
                className="text-[11px] font-semibold text-slate-700 truncate cursor-pointer hover:text-blue-600"
                onClick={() => startRenameMarkup(m)}
                title="Click to rename"
              >
                {m.attributes?.name || (tool === 'text' ? (m.symbol?.text || 'Label') : (tool || 'Markup'))}
              </p>
            )}
            {isBeingEdited && (
              <span className="text-[8px] font-semibold px-1 py-0.5 rounded bg-blue-500 text-white uppercase tracking-tight animate-pulse">
                Editing
              </span>
            )}
          </div>
        </div>
        <div className={`flex items-center gap-0.5 transition-opacity ${isBeingEdited ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button onClick={() => zoomTo(m)} className="p-1 hover:bg-blue-50 rounded text-blue-600" title="Zoom to"><ZoomIn className="w-3 h-3" /></button>
          <button
            onClick={() => toggleVisibility(m)}
            className={`p-1 rounded ${m.visible === false ? 'bg-slate-200 text-slate-400' : 'hover:bg-purple-50 text-purple-600'}`}
            title={m.visible === false ? "Show" : "Hide"}
          >
            {m.visible === false ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
          {['feature-info-panel', 'nearby-search', 'nearby-search-popup'].includes(m.attributes?.savedFrom) ? (
            <button disabled className="p-1 rounded bg-slate-100 text-slate-400 cursor-not-allowed" title="Locked">
              <Lock className="w-3 h-3" />
            </button>
          ) : (
            <button
              onClick={() => isBeingEdited ? completeEdit() : startEdit(m)}
              className={`p-1 rounded ${isBeingEdited ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'hover:bg-amber-50 text-amber-600'}`}
              title={isBeingEdited ? "Done editing" : "Edit"}
            >
              {isBeingEdited ? <Check className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
            </button>
          )}
          <button
            onClick={() => deleteMarkup(m)}
            className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  };

  const justifyClass = justification === 'center' ? 'justify-center' : justification === 'right' ? 'justify-end' : 'justify-start';

  if (!isExpanded) {
    return (
      <button
        onClick={onToggle}
        className={`flex items-center ${justifyClass} gap-1.5 w-24 px-2 py-1.5 bg-white rounded-lg shadow-lg border border-slate-200 hover:bg-slate-50 transition-colors ${className}`}
      >
        <Pencil className="w-4 h-4" style={{ color: colors.bg600 }} />
        <span className="text-sm font-medium text-slate-700">Markup</span>
      </button>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-2xl border border-slate-200 w-80 flex flex-col max-h-[85vh] overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-white shadow-sm border border-slate-100">
            <Pencil className="w-3.5 h-3.5" style={{ color: colors.text600 }} />
          </div>
          <span className="text-sm font-bold text-slate-800">Map Markup</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Export dropdown - only show if at least one export option is enabled */}
          {(atlasConfig?.exportOptions?.mapMarkup?.csv !== false || atlasConfig?.exportOptions?.mapMarkup?.shp !== false) && (
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={markups.length === 0 || isExporting}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200"
                title="Export markups"
              >
                {isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <ChevronDown className="w-3 h-3" />
                  </>
                )}
              </button>
              {showExportMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowExportMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                    {atlasConfig?.exportOptions?.mapMarkup?.csv !== false && (
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        onClick={exportToCSV}
                      >
                        <FileSpreadsheet className="w-4 h-4 text-green-600" />
                        Export to CSV
                      </button>
                    )}
                    {atlasConfig?.exportOptions?.mapMarkup?.shp !== false && (
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        onClick={exportToShapefile}
                      >
                        <FileArchive className="w-4 h-4 text-blue-600" />
                        Export to Shapefile
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <button onClick={onToggle} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Toolbar - COMPACTED - Hidden when editing */}
      <div className="p-1.5 border-b border-slate-100">
        {!editingMarkup && (
          <div className="grid grid-cols-4 gap-1">
            {[
              { id: 'point', icon: Circle, label: 'Point' },
              { id: 'polyline', icon: Minus, label: 'Line' },
              { id: 'polygon', icon: Square, label: 'Area' },
              { id: 'text', icon: Type, label: 'Text' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => startTool(t.id)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg border transition-all
                  ${activeTool === t.id ? 'bg-blue-50 border-blue-200 shadow-inner' : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'}`}
              >
                <t.icon className={`w-3.5 h-3.5 ${activeTool === t.id ? 'text-blue-600' : 'text-slate-500'}`} />
                <span className={`text-[9px] font-bold uppercase tracking-wide ${activeTool === t.id ? 'text-blue-700' : 'text-slate-400'}`}>
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Dynamic Tool Settings */}
        {expandedSettings && (
          <div className={`${editingMarkup ? '' : 'mt-3'} p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-4 animate-in slide-in-from-top-1 duration-200`}>
             {/* Editing Header with Done/Cancel buttons */}
             {editingMarkup && (
               <div className="pb-2 mb-2 border-b border-slate-200">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                     <span className="text-xs font-bold text-blue-700">Editing Markup</span>
                   </div>
                   <div className="flex items-center gap-1">
                     <button
                       onClick={cancelEdit}
                       className="px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-200 rounded transition-colors"
                     >
                       Cancel
                     </button>
                     <button
                       onClick={completeEdit}
                       className="px-2 py-1 text-[10px] font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded transition-colors flex items-center gap-1"
                     >
                       <Check className="w-3 h-3" />
                       Done
                     </button>
                   </div>
                 </div>
                 <p className="text-[10px] text-slate-500 mt-1.5">
                   {editingMarkup.attributes?.tool === 'point' || editingMarkup.attributes?.tool === 'text'
                     ? 'Drag on map to move. Change style settings below.'
                     : 'Drag vertices on map to reshape. Change style settings below.'}
                 </p>
                 {/* Name editing field */}
                 <div className="mt-2">
                   <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Name</label>
                   <input
                     type="text"
                     value={editingMarkup.attributes?.name || ''}
                     onChange={(e) => {
                       editingMarkup.attributes.name = e.target.value;
                       setMarkups(prev => [...prev]);
                     }}
                     placeholder="Enter markup name..."
                     className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                   />
                 </div>
               </div>
             )}
             {expandedSettings === 'point' && (
               <>
                 <ColorPicker label="Color" value={settings.pointColor} onChange={v => setSettings(p => ({...p, pointColor: v}))} />
                 <div className="grid grid-cols-2 gap-3">
                   <Select label="Type" value={settings.pointType} options={POINT_TYPES} onChange={v => setSettings(p => ({...p, pointType: v}))} />
                   <Select label="Size" value={settings.pointSize.toString()} options={POINT_SIZES} onChange={v => setSettings(p => ({...p, pointSize: parseInt(v)}))} />
                 </div>
                 <div className="grid grid-cols-2 gap-3 items-end">
                    <Select 
                      label="Units" 
                      value={settings.pointMeasurementUnit} 
                      options={[{id:'dd',label:'DD'}, {id:'dms',label:'DMS'}, {id:'latlon',label:'Lat / Lon'}]} 
                      onChange={v => setSettings(p => ({...p, pointMeasurementUnit: v}))} 
                    />
                    <div className="pb-1">
                      <Checkbox label="Label Markup" checked={settings.pointShowLabel} onChange={v => setSettings(p => ({...p, pointShowLabel: v}))} />
                    </div>
                 </div>
               </>
             )}
             {expandedSettings === 'polyline' && (
               <>
                 <ColorPicker label="Color" value={settings.lineColor} onChange={v => setSettings(p => ({...p, lineColor: v}))} />
                 <div className="grid grid-cols-2 gap-3">
                    <Select label="Type" value={settings.lineType} options={LINE_TYPES} onChange={v => setSettings(p => ({...p, lineType: v}))} />
                    <Select label="Width" value={settings.lineWidth.toString()} options={LINE_WIDTHS} onChange={v => setSettings(p => ({...p, lineWidth: parseInt(v)}))} />
                 </div>
                 <div className="grid grid-cols-2 gap-3 items-end">
                    <Select 
                      label="Units" 
                      value={settings.lineMeasurementUnit} 
                      options={[{id:'feet',label:'Feet'}, {id:'meters',label:'Meters'}, {id:'miles',label:'Miles'}, {id:'kilometers',label:'Kilometers'}]} 
                      onChange={v => setSettings(p => ({...p, lineMeasurementUnit: v}))} 
                    />
                    <div className="pb-1">
                      <Checkbox label="Label Markup" checked={settings.lineShowLabel} onChange={v => setSettings(p => ({...p, lineShowLabel: v}))} />
                    </div>
                 </div>
               </>
             )}
             {expandedSettings === 'polygon' && (
               <>
                 <ColorPicker label="Fill Color" value={settings.polygonFillColor} onChange={v => setSettings(p => ({...p, polygonFillColor: v}))} />
                 <div className="grid grid-cols-2 gap-3">
                    <Select label="Type" value={settings.polygonLineType} options={LINE_TYPES} onChange={v => setSettings(p => ({...p, polygonLineType: v}))} />
                    <Select label="Width" value={settings.polygonLineWidth.toString()} options={LINE_WIDTHS} onChange={v => setSettings(p => ({...p, polygonLineWidth: parseInt(v)}))} />
                 </div>
                 <Slider label="Opacity" min={0} max={1} step={0.1} value={settings.polygonOpacity} onChange={v => setSettings(p => ({...p, polygonOpacity: v}))} />
                 <div className="grid grid-cols-2 gap-3 items-end">
                    <Select 
                      label="Units" 
                      value={settings.polygonMeasurementUnit} 
                      options={[{id:'acres',label:'Acres'}, {id:'sqfeet',label:'Square Feet'}, {id:'sqmeters',label:'Square Meters'}]} 
                      onChange={v => setSettings(p => ({...p, polygonMeasurementUnit: v}))} 
                    />
                    <div className="pb-1">
                      <Checkbox label="Label Markup" checked={settings.polygonShowLabel} onChange={v => setSettings(p => ({...p, polygonShowLabel: v}))} />
                    </div>
                 </div>
               </>
             )}
             {expandedSettings === 'text' && (
               <>
                 <TextInput label="Label Content" value={settings.textContent} placeholder="Enter text..." onChange={v => setSettings(p => ({...p, textContent: v}))} />
                 <ColorPicker label="Color" value={settings.textColor} onChange={v => setSettings(p => ({...p, textColor: v}))} />
                 <div className="grid grid-cols-2 gap-3">
                    <Select label="Type" value={settings.textFont} options={FONT_FAMILIES} onChange={v => setSettings(p => ({...p, textFont: v}))} />
                    <Select label="Size" value={settings.textSize.toString()} options={TEXT_SIZES} onChange={v => setSettings(p => ({...p, textSize: parseInt(v)}))} />
                 </div>
               </>
             )}
          </div>
        )}
      </div>

      {/* Markup List with Folders */}
      <div className="flex-1 overflow-y-auto bg-slate-50/30 flex flex-col">
        {/* Folder actions bar */}
        <div className="flex items-center justify-between px-2 pt-2 pb-1">
          <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Markups</span>
          <button
            onClick={() => createFolder()}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            title="Create folder"
          >
            <FolderPlus className="w-3 h-3" />
            <span>Folder</span>
          </button>
        </div>

        <div className="space-y-0.5 px-2 pb-2">
          {/* Render folders */}
          {folders.map(folder => {
            const folderMarkups = markups.filter(m => m.attributes?.folderId === folder.id);
            const FolderIcon = folder.expanded ? FolderOpen : Folder;
            const isDropTarget = draggedMarkup && dragOverFolderId === folder.id && draggedMarkup.attributes?.folderId !== folder.id;
            const isDefaultFolder = folder.id === DEFAULT_FOLDER_ID;

            return (
              <div
                key={folder.id}
                onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                onDragLeave={handleFolderDragLeave}
                onDrop={(e) => handleFolderDrop(e, folder.id)}
              >
                {/* Folder header */}
                <div className={`group flex items-center gap-1 py-1.5 px-1.5 rounded-lg transition-colors
                  ${isDropTarget ? 'bg-blue-100 ring-2 ring-blue-300 ring-inset' : 'hover:bg-slate-100'}`}>
                  <button
                    onClick={() => toggleFolderExpanded(folder.id)}
                    className="flex items-center gap-1 flex-1 min-w-0"
                  >
                    <ChevronRight className={`w-3 h-3 text-slate-400 transition-transform flex-shrink-0 ${folder.expanded ? 'rotate-90' : ''}`} />
                    <FolderIcon className={`w-3.5 h-3.5 flex-shrink-0 ${isDropTarget ? 'text-blue-500' : 'text-amber-500'}`} />
                    {editingFolderId === folder.id ? (
                      <input
                        type="text"
                        value={editingFolderName}
                        onChange={(e) => setEditingFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') renameFolder(folder.id, editingFolderName);
                          if (e.key === 'Escape') { setEditingFolderId(null); setEditingFolderName(''); }
                        }}
                        onBlur={() => renameFolder(folder.id, editingFolderName)}
                        className="flex-1 min-w-0 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="text-xs font-semibold text-slate-700 truncate">{folder.name}</span>
                    )}
                    <span className="text-[9px] text-slate-400 flex-shrink-0">({folderMarkups.length})</span>
                  </button>

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => toggleFolderVisibility(folder.id)}
                      className={`p-1 rounded ${folder.visible ? 'hover:bg-purple-50 text-purple-500' : 'bg-slate-200 text-slate-400'}`}
                      title={folder.visible ? "Hide all in folder" : "Show all in folder"}
                    >
                      {folder.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingFolderId(folder.id); setEditingFolderName(folder.name); }}
                      className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                      title="Rename folder"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    {atlasConfig?.exportOptions?.mapMarkup?.shp !== false && (
                      <button
                        onClick={(e) => { e.stopPropagation(); exportFolderToShapefile(folder.id); }}
                        className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 disabled:opacity-50"
                        title="Export Shapefile"
                        disabled={folderMarkups.length === 0 || isFolderExporting === folder.id}
                      >
                        {isFolderExporting === folder.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                      </button>
                    )}
                    {!isDefaultFolder && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id); }}
                        className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                        title="Delete folder"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Folder contents */}
                {folder.expanded && (
                  <div className={`ml-4 space-y-0.5 min-h-[8px] ${isDropTarget && folderMarkups.length === 0 ? 'py-2' : ''}`}>
                    {folderMarkups.length === 0 ? (
                      <p className={`text-[10px] italic py-1 pl-2 ${isDropTarget ? 'text-blue-500 font-medium' : 'text-slate-400'}`}>
                        {isDropTarget ? 'Drop here' : 'Empty folder'}
                      </p>
                    ) : (
                      folderMarkups.slice().reverse().map(m => renderMarkupRow(m, true, folder.id))
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Uncategorized markups (no folder) */}
          {markups.filter(m => !m.attributes?.folderId).length > 0 && (
            <div
              className={`space-y-0.5 pt-1 ${draggedMarkup && dragOverFolderId === 'uncategorized' ? 'bg-slate-100 rounded-lg ring-2 ring-slate-300 ring-inset p-1' : ''}`}
              onDragOver={(e) => handleFolderDragOver(e, 'uncategorized')}
              onDragLeave={handleFolderDragLeave}
              onDrop={(e) => handleFolderDrop(e, null)}
            >
              <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider px-1">Uncategorized</span>
              {markups.filter(m => !m.attributes?.folderId).slice().reverse().map(m => renderMarkupRow(m, false, null))}
            </div>
          )}

          {/* Empty state hint when no markups exist */}
          {markups.length === 0 && (
            <div className="flex flex-col items-center justify-center text-slate-300 p-6 text-center">
              <Pencil className="w-6 h-6 mb-2 opacity-10" />
              <p className="text-[10px] font-medium">Select a tool above to start drawing</p>
            </div>
          )}
        </div>
      </div>

      {/* Click-away handler for context menus */}
    </div>
  );
});

export default MarkupTool;