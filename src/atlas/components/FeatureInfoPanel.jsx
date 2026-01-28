import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  FileText,
  MapPin,
  Target,
  Download,
  Layers,
  GripVertical
} from 'lucide-react';

import { useAtlas } from '../AtlasApp';
import { getThemeColors } from '../utils/themeColors';

/**
 * FeatureInfoPanel Component
 * Displays feature information in a responsive, resizable panel.
 */
export default function FeatureInfoPanel({
  feature,
  view,
  config,
  customFeatureInfo,
  sourceLayer,
  onClose,
  onSaveAsMarkup,
  onExportPDF,
  onZoomTo,
  relatedFeatures = [],
  currentRelatedIndex = 0,
  onNavigateRelated,
  isMarkupFeature = false
}) {
  const { config: atlasConfig } = useAtlas();
  const themeColor = config?.ui?.themeColor || atlasConfig?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  // Layout State
  const [activeTab, setActiveTab] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Resizing State
  const [desktopWidth, setDesktopWidth] = useState(400); 
  const [isResizing, setIsResizing] = useState(false);
  
  // Refs
  const featureWidgetRef = useRef(null);
  const featureContainerRef = useRef(null);
  const resizeRef = useRef({ startX: 0, startW: 0 });

  const useCustomTabs = useMemo(() => {
    if (!customFeatureInfo?.layerId || !customFeatureInfo?.tabs?.length) return false;
    const featureLayerId = feature?.sourceLayerId || sourceLayer?.id;
    return featureLayerId === customFeatureInfo.layerId;
  }, [customFeatureInfo, feature, sourceLayer]);

  const arcadeExpressions = useMemo(() => {
    const template = sourceLayer?.popupTemplate || feature?.popupTemplate;
    if (!template?.content || !Array.isArray(template.content)) return [];
    return template.content
      .filter(el => el.type === 'expression' && el.expressionInfo)
      .map(el => el.expressionInfo?.name || el.expressionInfo?.title || '')
      .filter(Boolean);
  }, [sourceLayer, feature]);

  const tabs = useMemo(() => {
    if (isMarkupFeature) {
      return [
        { id: 'properties', label: 'Properties', icon: FileText },
        { id: 'style', label: 'Style', icon: Layers },
        { id: 'elevation', label: 'Elevation', icon: Target }
      ];
    }
    if (useCustomTabs && customFeatureInfo?.tabs?.length > 0) {
      return customFeatureInfo.tabs.map((tab, idx) => ({
        id: `custom-${idx}`,
        label: tab.name || `Tab ${idx + 1}`,
        icon: FileText,
        elements: tab.elements || [],
        isCustom: true
      }));
    }
    if (arcadeExpressions.length > 0) {
      return arcadeExpressions.map((name, idx) => ({
        id: `custom-${idx}`,
        label: name,
        icon: FileText,
        elements: [name],
        isCustom: true
      }));
    }
    return [
      { id: 'info', label: 'Info', icon: FileText }
    ];
  }, [isMarkupFeature, useCustomTabs, customFeatureInfo, arcadeExpressions]);

  useEffect(() => {
    if (tabs.length > 0 && (!activeTab || !tabs.find(t => t.id === activeTab))) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!feature || !view || !activeTab) return;

    const loadArcGIS = async () => {
      try {
        const FeatureClass = await import('@arcgis/core/widgets/Feature').then(m => m.default).catch(() => window.esri?.widgets?.Feature);
        const GraphicClass = await import('@arcgis/core/Graphic').then(m => m.default).catch(() => window.esri?.Graphic);
        
        if (!FeatureClass || !GraphicClass || !featureContainerRef.current) return;

        const currentTab = tabs.find(t => t.id === activeTab);
        const isInfoTab = currentTab?.isCustom || activeTab === 'info';

        if (!isInfoTab) {
          if (featureWidgetRef.current) featureWidgetRef.current.container = null;
          return;
        }

        const graphic = new GraphicClass({
          geometry: feature.geometry,
          attributes: feature.attributes || {},
          layer: sourceLayer
        });

        const originalTemplate = sourceLayer?.popupTemplate || feature.popupTemplate;
        if (currentTab?.isCustom && currentTab.elements?.length > 0 && originalTemplate) {
          graphic.popupTemplate = {
            title: originalTemplate.title,
            content: (Array.isArray(originalTemplate.content) ? originalTemplate.content : [originalTemplate.content]).filter(el => {
              const titleText = el.title || el.description || el.text || '';
              const expr = el.expressionInfo?.name || el.expressionInfo?.title || '';
              return currentTab.elements.some(name => 
                titleText.toLowerCase().includes(name.toLowerCase()) || 
                expr.toLowerCase().includes(name.toLowerCase())
              );
            }),
            expressionInfos: originalTemplate.expressionInfos,
            fieldInfos: originalTemplate.fieldInfos
          };
        }

        if (!featureWidgetRef.current) {
          featureWidgetRef.current = new FeatureClass({
            graphic,
            view,
            container: featureContainerRef.current
          });
        } else {
          featureWidgetRef.current.container = featureContainerRef.current;
          featureWidgetRef.current.graphic = graphic;
        }
      } catch (err) {
        console.warn("ArcGIS modules not available for preview.");
      }
    };

    const timer = setTimeout(loadArcGIS, 50);
    return () => clearTimeout(timer);
  }, [feature, view, sourceLayer, activeTab, tabs, isMobile]);

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

  const getFeatureTitle = useCallback(() => {
    // Priority 1: Check for 'displayName' (set by SearchResults or passed enrichment)
    if (feature?.attributes?.displayName) return feature.attributes.displayName;
    
    // Priority 2: Fallback to standard attribute fields
    const attrs = feature?.attributes || {};
    return attrs.title || attrs.TITLE || attrs.name || attrs.NAME || 
           attrs.ADDRESS || attrs.address || attrs.PARCELID || 'Feature Details';
  }, [feature]);

  const renderTabsList = () => (
    <div className="flex border-b border-slate-200 overflow-x-auto bg-white sticky top-0 z-10 no-scrollbar">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => !tab.disabled && setActiveTab(tab.id)}
          disabled={tab.disabled}
          className={`flex-1 py-2 px-2.5 text-xs font-bold uppercase tracking-wider transition whitespace-nowrap border-b-2 ${
            activeTab === tab.id ? 'text-slate-900' : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
          }`}
          style={activeTab === tab.id ? { borderBottomColor: colors.bg500, color: colors.text700 } : {}}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  const ActionButtons = () => (
    <div className="flex items-center gap-2 p-3 bg-slate-50 border-b border-slate-200">
      <ActionButton icon={Bookmark} label="Save to Markup" onClick={() => onSaveAsMarkup?.(feature)} />
      <ActionButton icon={Download} label="Export PDF" onClick={onExportPDF} />
      <ActionButton icon={Target} label="Zoom To" onClick={() => onZoomTo?.(feature)} />
    </div>
  );

  if (!feature) return null;

  if (isMobile) {
    return (
      <div
        className="fixed inset-x-0 bottom-0 bg-white z-40 flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300"
        style={{ top: '64px' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-white shadow-sm border border-slate-100">
              <MapPin className="w-4 h-4" style={{ color: colors.bg500 }} />
            </div>
            <h3 className="font-bold text-slate-800 truncate text-lg">{getFeatureTitle()}</h3>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-slate-100 rounded-full transition active:scale-90"><X className="w-6 h-6 text-slate-500" /></button>
        </div>
        <ActionButtons />
        <div className="flex-1 flex flex-col overflow-hidden">
          {renderTabsList()}
          <div className="flex-1 overflow-y-auto p-5 pb-20">
            <div ref={featureContainerRef} className="feature-widget-container" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="absolute right-0 top-0 bottom-0 bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.05)] z-40 flex flex-col border-l border-slate-200"
      style={{ width: desktopWidth }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize transition-colors z-50 flex items-center justify-center group"
        style={{ '--hover-bg': `${colors.bg500}4D` }}
        onMouseDown={startResizingDesktop}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${colors.bg500}4D`}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <div className="hidden group-hover:block"><GripVertical className="w-3 h-3" style={{ color: colors.text600 }} /></div>
      </div>

      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center gap-3 min-w-0">
          <MapPin className="w-5 h-5 flex-shrink-0" style={{ color: colors.bg500 }} />
          <h3 className="font-bold text-slate-800 truncate text-base">{getFeatureTitle()}</h3>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white rounded-lg transition"><X className="w-4 h-4 text-slate-500" /></button>
      </div>

      <ActionButtons />
      {renderTabsList()}

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-6">
          <div ref={featureContainerRef} className="feature-widget-container" />
        </div>
      </div>

      <style>{`
        .feature-widget-container .esri-feature { background: transparent !important; padding: 0 !important; }
        .feature-widget-container .esri-feature__title { display: none !important; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 hover:shadow-sm rounded-lg transition-all border border-slate-200 active:scale-95">
      <Icon className="w-4 h-4 text-slate-400" />
      <span className="truncate">{label}</span>
    </button>
  );
}

