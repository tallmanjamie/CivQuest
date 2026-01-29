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
  GripVertical,
  Loader2,
  Eye,
  Maximize2,
  Minimize2
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
  isMarkupFeature = false,
  onWidthChange,
  isExportingPDF = false,
  exportPDFProgress = ''
}) {
  const { config: atlasConfig, orgId, isPictometryEnabled, openEagleView, isNearmapEnabled, openNearmap } = useAtlas();
  const themeColor = config?.ui?.themeColor || atlasConfig?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  // Layout State
  const [activeTab, setActiveTab] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  
  // Title State (Resolved from Feature Widget)
  const [dynamicTitle, setDynamicTitle] = useState(null);
  
  // Resizing State
  const [desktopWidth, setDesktopWidth] = useState(400); 
  const [isResizing, setIsResizing] = useState(false);
  
  // Refs
  const featureWidgetRef = useRef(null);
  const featureContainerRef = useRef(null);
  const titleWatcherRef = useRef(null); // Ref to hold the title watcher handle
  const resizeRef = useRef({ startX: 0, startW: 0 });

  // Notify parent of width changes for positioning navigation controls
  // When maximized, report a very large width to push controls out of view
  useEffect(() => {
    if (isMaximized) {
      onWidthChange?.(9999); // Signal maximized state
    } else {
      onWidthChange?.(desktopWidth);
    }
  }, [desktopWidth, isMaximized, onWidthChange]);

  // Reset maximized state when feature changes
  useEffect(() => {
    setIsMaximized(false);
  }, [feature]);

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

  // Reset dynamic title when feature changes
  useEffect(() => {
    setDynamicTitle(null);
  }, [feature]);

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
        // Dynamically load modules
        const [FeatureClass, GraphicClass, reactiveUtils] = await Promise.all([
          import('@arcgis/core/widgets/Feature').then(m => m.default).catch(() => window.esri?.widgets?.Feature),
          import('@arcgis/core/Graphic').then(m => m.default).catch(() => window.esri?.Graphic),
          import('@arcgis/core/core/reactiveUtils').catch(() => window.esri?.core?.reactiveUtils)
        ]);
        
        if (!FeatureClass || !GraphicClass || !featureContainerRef.current) return;

        const currentTab = tabs.find(t => t.id === activeTab);
        const isInfoTab = currentTab?.isCustom || activeTab === 'info';

        if (!isInfoTab) {
          if (featureWidgetRef.current) featureWidgetRef.current.container = null;
          return;
        }

        // --- Fix for Geometry Autocast Error ---
        // Ensure geometry is a valid object with a 'type' property if it's a plain JSON object
        let geometry = feature.geometry;
        if (geometry && typeof geometry === 'object' && !geometry.declaredClass) {
          // It's likely a plain JSON object. Clone it to avoid mutating props.
          geometry = { ...geometry };
          
          // Injects type if missing (required for Graphic autocasting)
          if (!geometry.type) {
             if (geometry.rings) geometry.type = 'polygon';
             else if (geometry.paths) geometry.type = 'polyline';
             else if (geometry.x !== undefined) geometry.type = 'point';
             else if (geometry.xmin !== undefined) geometry.type = 'extent';
             else if (geometry.points) geometry.type = 'multipoint';
          }
        }

        const graphic = new GraphicClass({
          geometry: geometry,
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

        // Initialize or update widget
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

        // --- Title Resolution Logic (Updated for reactiveUtils) ---
        // Clean up old watcher if exists
        if (titleWatcherRef.current) {
          titleWatcherRef.current.remove();
          titleWatcherRef.current = null;
        }

        const updateTitle = (newTitle) => {
          if (newTitle && typeof newTitle === 'string') {
             setDynamicTitle(newTitle);
          }
        };

        // Set initial value if available
        if (featureWidgetRef.current.title) {
          updateTitle(featureWidgetRef.current.title);
        }

        // Start watching using reactiveUtils (replaces deprecated .watch)
        if (reactiveUtils) {
          titleWatcherRef.current = reactiveUtils.watch(
            () => featureWidgetRef.current.title,
            updateTitle
          );
        }

      } catch (err) {
        console.warn("ArcGIS modules error:", err);
      }
    };

    const timer = setTimeout(loadArcGIS, 50);
    
    // Cleanup function
    return () => {
      clearTimeout(timer);
      if (titleWatcherRef.current) {
        titleWatcherRef.current.remove();
        titleWatcherRef.current = null;
      }
    };
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

  // Fallback title logic if Widget hasn't loaded or fails
  const getFeatureTitle = useCallback(() => {
    // Priority 1: Check for 'displayName' (set by SearchResults or passed enrichment)
    if (feature?.attributes?.displayName) return feature.attributes.displayName;

    // Priority 2: Check for popup template title from the source layer
    const template = sourceLayer?.popupTemplate || feature?.popupTemplate;
    if (template?.title) {
      const attrs = feature?.attributes || {};
      // Build a case-insensitive lookup map for attribute field names
      const attrKeys = Object.keys(attrs);
      const attrLookup = {};
      attrKeys.forEach(key => {
        attrLookup[key.toLowerCase()] = key;
      });

      // If title is a string with placeholders like "{FIELD_NAME}", resolve them
      if (typeof template.title === 'string') {
        const resolvedTitle = template.title.replace(/\{([^}]+)\}/g, (match, fieldName) => {
          // First try exact match, then case-insensitive match
          let value = attrs[fieldName];
          if (value === undefined || value === null) {
            const actualKey = attrLookup[fieldName.toLowerCase()];
            if (actualKey) {
              value = attrs[actualKey];
            }
          }
          return value !== undefined && value !== null ? String(value) : '';
        });
        // Only use if we got a meaningful resolved title
        if (resolvedTitle && resolvedTitle.trim() && !resolvedTitle.includes('{')) {
          return resolvedTitle.trim();
        }
      }
    }

    // Priority 3: Fallback to standard attribute fields
    const attrs = feature?.attributes || {};
    return attrs.title || attrs.TITLE || attrs.name || attrs.NAME ||
           attrs.ADDRESS || attrs.address || attrs.PARCELID || 'Feature Details';
  }, [feature, sourceLayer]);

  // Determine final title to display
  const displayTitle = dynamicTitle || getFeatureTitle();

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

  // Handle EagleView button click
  const handleOpenEagleView = useCallback(() => {
    if (!feature?.geometry) return;

    openEagleView({
      geometry: feature.geometry,
      title: displayTitle,
      themeColor: colors.bg500
    });
  }, [feature, displayTitle, colors.bg500, openEagleView]);

  // Handle Nearmap button click
  const handleOpenNearmap = useCallback(() => {
    if (!feature?.geometry) return;

    openNearmap({
      geometry: feature.geometry,
      title: displayTitle,
      themeColor: colors.bg500
    });
  }, [feature, displayTitle, colors.bg500, openNearmap]);

  const ActionButtons = () => (
    <div className="flex items-center gap-2 p-3 bg-slate-50 border-b border-slate-200">
      <ActionButton icon={Bookmark} label="Markup" onClick={() => onSaveAsMarkup?.(feature, displayTitle)} />
      <ActionButton
        icon={isExportingPDF ? Loader2 : Download}
        label={isExportingPDF ? (exportPDFProgress || 'Exporting...') : 'Export'}
        onClick={() => !isExportingPDF && onExportPDF?.(feature, displayTitle)}
        disabled={isExportingPDF}
        isLoading={isExportingPDF}
      />
      <ActionButton icon={Target} label="Zoom" onClick={() => onZoomTo?.(feature)} />
      {isPictometryEnabled && (
        <ActionButton
          icon={Eye}
          label="EagleView"
          onClick={handleOpenEagleView}
        />
      )}
      {isNearmapEnabled && (
        <ActionButton
          icon={MapPin}
          label="Nearmap"
          onClick={handleOpenNearmap}
        />
      )}
    </div>
  );

  if (!feature) return null;

  // Get search bar position from config
  const searchBarPosition = atlasConfig?.ui?.searchBarPosition || 'top';
  const searchBarHeight = searchBarPosition === 'bottom' ? 60 : 0; // Approximate height of search toolbar

  if (isMobile) {
    // Mobile view: 1/3 height by default, full height when maximized
    // When search bar is at bottom, position popup above it to avoid covering it
    const mobileStyle = isMaximized
      ? { top: '64px', bottom: searchBarHeight } // Full height from header, accounting for bottom search bar
      : { height: '33vh', maxHeight: 'calc(100vh - 180px)', bottom: searchBarHeight }; // 1/3 of viewport, positioned above search bar

    return (
      <div
        className={`fixed inset-x-0 bg-white z-40 flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 ${
          isMaximized ? '' : 'rounded-t-2xl'
        }`}
        style={mobileStyle}
      >
        {/* Mobile: No resize handle - users can only maximize or close */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-20">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-white shadow-sm border border-slate-100">
              <MapPin className="w-3 h-3" style={{ color: colors.bg500 }} />
            </div>
            <h3 className="font-semibold text-slate-800 truncate text-base">{displayTitle}</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 hover:bg-slate-100 rounded-full transition active:scale-90"
              title={isMaximized ? 'Minimize' : 'Maximize'}
            >
              {isMaximized ? (
                <Minimize2 className="w-5 h-5 text-slate-500" />
              ) : (
                <Maximize2 className="w-5 h-5 text-slate-500" />
              )}
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full transition active:scale-90"><X className="w-5 h-5 text-slate-500" /></button>
          </div>
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

  // Desktop view: resizable sidebar by default, full map area when maximized
  const desktopStyle = isMaximized
    ? { left: 0, right: 0, width: 'auto' } // Full width of map container
    : { width: desktopWidth };

  return (
    <div
      className={`absolute right-0 top-0 bottom-0 bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.05)] z-40 flex flex-col border-l border-slate-200 ${
        isMaximized ? 'transition-all duration-300' : ''
      }`}
      style={desktopStyle}
    >
      {/* Resize handle - only show when not maximized */}
      {!isMaximized && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize transition-colors z-50 flex items-center justify-center group"
          style={{ '--hover-bg': `${colors.bg500}4D` }}
          onMouseDown={startResizingDesktop}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${colors.bg500}4D`}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <div className="hidden group-hover:block"><GripVertical className="w-3 h-3" style={{ color: colors.text600 }} /></div>
        </div>
      )}

      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: colors.bg500 }} />
          <h3 className="font-semibold text-slate-800 truncate text-sm">{displayTitle}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 hover:bg-white rounded-lg transition"
            title={isMaximized ? 'Minimize' : 'Maximize'}
          >
            {isMaximized ? (
              <Minimize2 className="w-4 h-4 text-slate-500" />
            ) : (
              <Maximize2 className="w-4 h-4 text-slate-500" />
            )}
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-white rounded-lg transition"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
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

function ActionButton({ icon: Icon, label, onClick, disabled = false, isLoading = false, themeColor = null }) {
  // If themeColor is provided, use it for a highlighted button style
  const isHighlighted = !!themeColor;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold rounded-lg transition-all border ${
        disabled
          ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
          : isHighlighted
            ? 'text-white hover:opacity-90 active:scale-95'
            : 'text-slate-600 bg-white hover:bg-slate-50 hover:shadow-sm active:scale-95 border-slate-200'
      }`}
      style={isHighlighted && !disabled ? { backgroundColor: themeColor, borderColor: themeColor } : {}}
    >
      <Icon className={`w-4 h-4 ${disabled ? 'text-slate-300' : isHighlighted ? 'text-white' : 'text-slate-400'} ${isLoading ? 'animate-spin' : ''}`} />
      <span className="truncate">{label}</span>
    </button>
  );
}