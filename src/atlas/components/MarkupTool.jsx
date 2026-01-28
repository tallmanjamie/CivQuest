import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Pencil,
  Circle,
  Minus,
  Square,
  Type,
  X,
  Trash2,
  ZoomIn,
  MessageSquare,
  Plus
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

import { useAtlas } from '../AtlasApp';
import { getThemeColors } from '../utils/themeColors';

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

export default function MarkupTool({
  view,
  graphicsLayer,
  config,
  isExpanded = false,
  onToggle,
  className = ''
}) {
  const { config: atlasConfig } = useAtlas();
  const themeColor = config?.ui?.themeColor || atlasConfig?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  // State
  const [activeTool, setActiveTool] = useState(null);
  const [expandedSettings, setExpandedSettings] = useState(null);
  const [markups, setMarkups] = useState([]);
  
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

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

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
      updateOnGraphicClick: true,
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

        graphic.attributes = {
          id: `markup_${Date.now()}`,
          tool,
          symbolStyle,
          color: tool === 'polygon' ? s.polygonFillColor.value : 
                 tool === 'polyline' ? s.lineColor.value : 
                 tool === 'text' ? s.textColor.value : s.pointColor.value,
          metric: metricText,
          isMarkup: true,
          timestamp: Date.now()
        };

        const showLabel = (tool === 'point' && s.pointShowLabel) || 
                          (tool === 'polyline' && s.lineShowLabel) || 
                          (tool === 'polygon' && s.polygonShowLabel);

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
        
        setTimeout(() => {
          if (activeToolRef.current && sketchVMRef.current) {
            sketchVMRef.current.create(activeToolRef.current === 'text' ? 'point' : activeToolRef.current);
          }
        }, 100);
      }
    });

    sketchVM.on('delete', () => {
      if (layerRef.current) {
        setMarkups([...layerRef.current.graphics.items.filter(g => g.attributes?.isMarkup)]);
      }
    });

    sketchVMRef.current = sketchVM;

    return () => {
      sketchVM.destroy();
      if (!graphicsLayer && layerRef.current && view.map) {
        view.map.remove(layerRef.current);
      }
    };
  }, [view, graphicsLayer]);

  const startTool = (tool) => {
    if (!sketchVMRef.current) return;
    
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
    const target = graphic.geometry.type === 'point' ? { target: graphic.geometry, zoom: 16 } : graphic.geometry.extent.expand(1.5);
    view.goTo(target);
  };

  if (!isExpanded) {
    return (
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-md border border-slate-200 hover:bg-slate-50 transition-all ${className}`}
      >
        <Pencil className="w-4 h-4" style={{ color: colors.bg600 }} />
        <span className="text-sm font-semibold text-slate-700">Markup</span>
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
        <button onClick={onToggle} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Toolbar - COMPACTED */}
      <div className="p-1.5 border-b border-slate-100">
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

        {/* Dynamic Tool Settings */}
        {expandedSettings && (
          <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-4 animate-in slide-in-from-top-1 duration-200">
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

      {/* Markup List */}
      <div className="flex-1 overflow-y-auto p-2 bg-slate-50/30">
        {markups.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 p-8 text-center">
            <Pencil className="w-8 h-8 mb-2 opacity-10" />
            <p className="text-xs font-medium">Select a tool above to start drawing on the map</p>
          </div>
        ) : (
          <div className="space-y-1">
            {markups.slice().reverse().map((m) => {
              const tool = m.attributes?.tool;
              const styleId = m.attributes?.symbolStyle;
              const Icon = tool === 'polyline' ? Minus : tool === 'polygon' ? Square : tool === 'text' ? Type : Circle;
              
              const getFriendlyStyleLabel = (tool, id) => {
                if (tool === 'point') return POINT_TYPES.find(t => t.id === id)?.label || id;
                if (tool === 'polyline' || tool === 'polygon') return LINE_TYPES.find(t => t.id === id)?.label || id;
                if (tool === 'text') return FONT_FAMILIES.find(t => t.id === id)?.label || id;
                return id;
              };

              return (
                <div key={m.attributes?.id} className="group flex items-center gap-3 p-2 rounded-lg bg-white border border-slate-100 hover:border-blue-200 transition-all shadow-sm">
                  <div className="w-8 h-8 rounded flex items-center justify-center bg-slate-50">
                    <Icon className="w-4 h-4" style={{ color: m.attributes?.color }} fill={tool === 'polygon' ? m.attributes?.color : 'none'} opacity={tool === 'polygon' ? 0.4 : 1} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-bold text-slate-700 truncate capitalize">
                        {tool === 'text' ? (m.symbol?.text || 'Label') : (tool || 'Markup')}
                      </p>
                      <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-tight">
                        {getFriendlyStyleLabel(tool, styleId)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{m.attributes?.metric}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => zoomTo(m)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="Zoom to"><ZoomIn className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteMarkup(m)} className="p-1.5 hover:bg-red-50 rounded text-red-600" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}