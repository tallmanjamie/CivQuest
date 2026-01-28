// src/admin/components/FeatureExportTemplateEditor.jsx
// Visual editor for designing feature export templates
// Supports drag-and-drop element placement, resizing, and property editing
//
// TEMPLATE ELEMENTS (Attribute Export):
// - title: Text title block
// - text: Custom text/description block
// - logo: Organization logo from settings
// - date: Current date display
// - pageNumber: Page number indicator
// - attributeData: Feature attribute data display
//
// MAP EXPORT:
// - mapExportTemplateId: Reference to an existing map export template

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Save,
  Plus,
  Trash2,
  Type,
  Image,
  FileText,
  Calendar,
  Hash,
  Table2,
  ChevronDown,
  ChevronRight,
  Copy,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Map,
  FileOutput,
  Info
} from 'lucide-react';

// Page size presets (in inches)
const PAGE_SIZES = {
  'letter-landscape': { name: 'Letter Landscape', width: 11, height: 8.5 },
  'letter-portrait': { name: 'Letter Portrait', width: 8.5, height: 11 },
  'legal-landscape': { name: 'Legal Landscape', width: 14, height: 8.5 },
  'legal-portrait': { name: 'Legal Portrait', width: 8.5, height: 14 },
  'tabloid-landscape': { name: 'Tabloid Landscape', width: 17, height: 11 },
  'tabloid-portrait': { name: 'Tabloid Portrait', width: 11, height: 17 },
  'a4-landscape': { name: 'A4 Landscape', width: 11.69, height: 8.27 },
  'a4-portrait': { name: 'A4 Portrait', width: 8.27, height: 11.69 },
  'a3-landscape': { name: 'A3 Landscape', width: 16.54, height: 11.69 },
  'a3-portrait': { name: 'A3 Portrait', width: 11.69, height: 16.54 },
  'custom': { name: 'Custom', width: 11, height: 8.5 }
};

// Element type definitions for feature export
const ELEMENT_TYPES = {
  title: {
    name: 'Title',
    icon: Type,
    defaultSize: { width: 100, height: 8 },
    minSize: { width: 10, height: 5 },
    required: false,
    resizable: true,
    hasContent: true,
    defaultContent: { text: 'Feature Report', fontSize: 24, fontWeight: 'bold', align: 'center', backgroundColor: '#1e293b', color: '#ffffff' }
  },
  text: {
    name: 'Text Block',
    icon: FileText,
    defaultSize: { width: 30, height: 10 },
    minSize: { width: 10, height: 5 },
    required: false,
    resizable: true,
    hasContent: true,
    defaultContent: { text: 'Custom text content', fontSize: 12, fontWeight: 'normal', align: 'left', backgroundColor: '#ffffff', color: '#333333' }
  },
  logo: {
    name: 'Organization Logo',
    icon: Image,
    defaultSize: { width: 15, height: 10 },
    minSize: { width: 5, height: 5 },
    required: false,
    resizable: true,
    hasContent: true,
    defaultContent: { source: 'org-logo', alt: 'Organization Logo' }
  },
  date: {
    name: 'Date',
    icon: Calendar,
    defaultSize: { width: 15, height: 5 },
    minSize: { width: 8, height: 3 },
    required: false,
    resizable: true,
    hasContent: true,
    defaultContent: { format: 'MMMM D, YYYY', fontSize: 10, align: 'right', color: '#333333' }
  },
  pageNumber: {
    name: 'Page Number',
    icon: Hash,
    defaultSize: { width: 10, height: 4 },
    minSize: { width: 5, height: 3 },
    required: false,
    resizable: true,
    hasContent: true,
    defaultContent: { format: 'Page {current} of {total}', fontSize: 9, align: 'center', color: '#666666' }
  },
  attributeData: {
    name: 'Attribute Data',
    icon: Table2,
    defaultSize: { width: 96, height: 50 },
    minSize: { width: 20, height: 15 },
    required: false,
    resizable: true,
    hasContent: true,
    defaultContent: { style: 'table', showLabels: true, fontSize: 11, headerColor: '#f1f5f9', borderColor: '#e2e8f0' }
  }
};

// Default template structure
const createDefaultTemplate = () => ({
  id: `feature-template-${Date.now()}`,
  name: 'New Feature Export Template',
  pageSize: 'letter-portrait',
  customWidth: 8.5,
  customHeight: 11,
  margins: { top: 0.25, right: 0.25, bottom: 0.25, left: 0.25 },
  backgroundColor: '#ffffff',
  elements: [
    {
      id: 'title-1',
      type: 'title',
      x: 0,
      y: 0,
      width: 100,
      height: 8,
      locked: false,
      visible: true,
      content: { text: 'Feature Report', fontSize: 24, fontWeight: 'bold', align: 'center', backgroundColor: '#1e293b', color: '#ffffff' }
    },
    {
      id: 'date-1',
      type: 'date',
      x: 80,
      y: 2,
      width: 18,
      height: 4,
      locked: false,
      visible: true,
      content: { format: 'MMMM D, YYYY', fontSize: 10, align: 'right', color: '#ffffff' }
    },
    {
      id: 'attributes-1',
      type: 'attributeData',
      x: 2,
      y: 12,
      width: 96,
      height: 70,
      locked: false,
      visible: true,
      content: { style: 'table', showLabels: true, fontSize: 11, headerColor: '#f1f5f9', borderColor: '#e2e8f0' }
    },
    {
      id: 'pageNumber-1',
      type: 'pageNumber',
      x: 45,
      y: 95,
      width: 10,
      height: 3,
      locked: false,
      visible: true,
      content: { format: 'Page {current} of {total}', fontSize: 9, align: 'center', color: '#666666' }
    }
  ],
  mapExportTemplateId: null
});

/**
 * FeatureExportTemplateEditor Modal
 *
 * Visual editor for creating and editing feature export templates
 *
 * Props:
 * @param {object} data - Existing template data (null for new template)
 * @param {object} orgData - Organization data for logo URLs
 * @param {array} mapExportTemplates - Available map export templates for linking
 * @param {function} onClose - Called when modal is closed
 * @param {function} onSave - Called with updated template when saved
 * @param {string} [accentColor] - Theme accent color
 */
export default function FeatureExportTemplateEditor({
  data,
  orgData,
  mapExportTemplates = [],
  onClose,
  onSave,
  accentColor = '#004E7C'
}) {
  // Initialize template from data or create new
  const [template, setTemplate] = useState(() =>
    data ? { ...createDefaultTemplate(), ...data } : createDefaultTemplate()
  );

  const [selectedElementId, setSelectedElementId] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [resizeState, setResizeState] = useState(null);
  const [showElementPalette, setShowElementPalette] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    page: true,
    elements: true,
    properties: true,
    mapExport: true
  });
  const [errors, setErrors] = useState({});
  const [zoom, setZoom] = useState(0.75);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Filter to only enabled map export templates
  const enabledMapExportTemplates = mapExportTemplates.filter(t => t.enabled !== false);

  // Get page dimensions
  const getPageDimensions = useCallback(() => {
    if (template.pageSize === 'custom') {
      return { width: template.customWidth, height: template.customHeight };
    }
    return PAGE_SIZES[template.pageSize] || PAGE_SIZES['letter-portrait'];
  }, [template.pageSize, template.customWidth, template.customHeight]);

  const pageDimensions = getPageDimensions();

  // Convert inches to pixels for display (96 DPI base)
  const SCALE = 96 * zoom;
  const canvasWidth = pageDimensions.width * SCALE;
  const canvasHeight = pageDimensions.height * SCALE;

  // Get selected element
  const selectedElement = template.elements.find(e => e.id === selectedElementId);

  // Convert percentage to pixels
  const pctToPx = (pct, dimension) => (pct / 100) * dimension;
  const pxToPct = (px, dimension) => (px / dimension) * 100;

  // Update template field
  const updateTemplate = (updates) => {
    setTemplate(prev => ({ ...prev, ...updates }));
  };

  // Update element
  const updateElement = (elementId, updates) => {
    setTemplate(prev => ({
      ...prev,
      elements: prev.elements.map(el =>
        el.id === elementId ? { ...el, ...updates } : el
      )
    }));
  };

  // Add new element
  const addElement = (type) => {
    const typeConfig = ELEMENT_TYPES[type];
    const newElement = {
      id: `${type}-${Date.now()}`,
      type,
      x: 10,
      y: 20,
      width: typeConfig.defaultSize.width,
      height: typeConfig.defaultSize.height,
      locked: false,
      visible: true,
      content: typeConfig.hasContent ? { ...typeConfig.defaultContent } : undefined
    };

    setTemplate(prev => ({
      ...prev,
      elements: [...prev.elements, newElement]
    }));
    setSelectedElementId(newElement.id);
    setShowElementPalette(false);
  };

  // Delete element
  const deleteElement = (elementId) => {
    setTemplate(prev => ({
      ...prev,
      elements: prev.elements.filter(e => e.id !== elementId)
    }));

    if (selectedElementId === elementId) {
      setSelectedElementId(null);
    }
  };

  // Duplicate element
  const duplicateElement = (elementId) => {
    const element = template.elements.find(e => e.id === elementId);
    if (!element) return;

    const newElement = {
      ...element,
      id: `${element.type}-${Date.now()}`,
      x: Math.min(element.x + 5, 90),
      y: Math.min(element.y + 5, 90)
    };

    setTemplate(prev => ({
      ...prev,
      elements: [...prev.elements, newElement]
    }));
    setSelectedElementId(newElement.id);
  };

  // Handle mouse down on element (drag start)
  const handleElementMouseDown = (e, elementId) => {
    e.stopPropagation();
    const element = template.elements.find(el => el.id === elementId);
    if (!element || element.locked) return;

    setSelectedElementId(elementId);

    const rect = canvasRef.current.getBoundingClientRect();
    setDragState({
      elementId,
      startX: e.clientX,
      startY: e.clientY,
      elementStartX: element.x,
      elementStartY: element.y,
      canvasRect: rect
    });
  };

  // Handle resize start
  const handleResizeMouseDown = (e, elementId, handle) => {
    e.stopPropagation();
    const element = template.elements.find(el => el.id === elementId);
    if (!element || element.locked) return;

    const rect = canvasRef.current.getBoundingClientRect();
    setResizeState({
      elementId,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      elementStartX: element.x,
      elementStartY: element.y,
      elementStartW: element.width,
      elementStartH: element.height,
      canvasRect: rect
    });
  };

  // Handle mouse move
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (dragState) {
        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;

        const dxPct = pxToPct(dx, canvasWidth);
        const dyPct = pxToPct(dy, canvasHeight);

        const element = template.elements.find(el => el.id === dragState.elementId);
        if (!element) return;

        let newX = Math.max(0, Math.min(100 - element.width, dragState.elementStartX + dxPct));
        let newY = Math.max(0, Math.min(100 - element.height, dragState.elementStartY + dyPct));

        // Snap to grid (1% increments)
        newX = Math.round(newX);
        newY = Math.round(newY);

        updateElement(dragState.elementId, { x: newX, y: newY });
      }

      if (resizeState) {
        const dx = e.clientX - resizeState.startX;
        const dy = e.clientY - resizeState.startY;

        const dxPct = pxToPct(dx, canvasWidth);
        const dyPct = pxToPct(dy, canvasHeight);

        const element = template.elements.find(el => el.id === resizeState.elementId);
        if (!element) return;

        const typeConfig = ELEMENT_TYPES[element.type];
        const minW = typeConfig?.minSize?.width || 5;
        const minH = typeConfig?.minSize?.height || 5;

        let updates = {};

        switch (resizeState.handle) {
          case 'se':
            updates.width = Math.max(minW, Math.round(resizeState.elementStartW + dxPct));
            updates.height = Math.max(minH, Math.round(resizeState.elementStartH + dyPct));
            break;
          case 'sw':
            updates.x = Math.max(0, Math.round(resizeState.elementStartX + dxPct));
            updates.width = Math.max(minW, Math.round(resizeState.elementStartW - dxPct));
            updates.height = Math.max(minH, Math.round(resizeState.elementStartH + dyPct));
            break;
          case 'ne':
            updates.y = Math.max(0, Math.round(resizeState.elementStartY + dyPct));
            updates.width = Math.max(minW, Math.round(resizeState.elementStartW + dxPct));
            updates.height = Math.max(minH, Math.round(resizeState.elementStartH - dyPct));
            break;
          case 'nw':
            updates.x = Math.max(0, Math.round(resizeState.elementStartX + dxPct));
            updates.y = Math.max(0, Math.round(resizeState.elementStartY + dyPct));
            updates.width = Math.max(minW, Math.round(resizeState.elementStartW - dxPct));
            updates.height = Math.max(minH, Math.round(resizeState.elementStartH - dyPct));
            break;
          case 'e':
            updates.width = Math.max(minW, Math.round(resizeState.elementStartW + dxPct));
            break;
          case 'w':
            updates.x = Math.max(0, Math.round(resizeState.elementStartX + dxPct));
            updates.width = Math.max(minW, Math.round(resizeState.elementStartW - dxPct));
            break;
          case 's':
            updates.height = Math.max(minH, Math.round(resizeState.elementStartH + dyPct));
            break;
          case 'n':
            updates.y = Math.max(0, Math.round(resizeState.elementStartY + dyPct));
            updates.height = Math.max(minH, Math.round(resizeState.elementStartH - dyPct));
            break;
        }

        // Constrain to canvas
        if (updates.x !== undefined && updates.width !== undefined) {
          if (updates.x + updates.width > 100) {
            updates.width = 100 - updates.x;
          }
        }
        if (updates.y !== undefined && updates.height !== undefined) {
          if (updates.y + updates.height > 100) {
            updates.height = 100 - updates.y;
          }
        }

        updateElement(resizeState.elementId, updates);
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
      setResizeState(null);
    };

    if (dragState || resizeState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, resizeState, canvasWidth, canvasHeight, template.elements]);

  // Validate template
  const validate = () => {
    const newErrors = {};

    if (!template.name?.trim()) {
      newErrors.name = 'Template name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = () => {
    if (!validate()) return;

    onSave({
      ...template,
      updatedAt: new Date().toISOString()
    });
  };

  // Render element on canvas
  const renderElement = (element) => {
    const typeConfig = ELEMENT_TYPES[element.type];
    const Icon = typeConfig?.icon || FileText;
    const isSelected = selectedElementId === element.id;

    const style = {
      position: 'absolute',
      left: `${element.x}%`,
      top: `${element.y}%`,
      width: `${element.width}%`,
      height: `${element.height}%`,
      opacity: element.visible ? 1 : 0.3,
      cursor: element.locked ? 'not-allowed' : 'move'
    };

    const getElementBackground = () => {
      if (element.content?.backgroundColor) {
        return element.content.backgroundColor;
      }
      switch (element.type) {
        case 'title': return '#1e293b';
        case 'text': return element.content?.backgroundColor || '#f8fafc';
        case 'logo': return '#f1f5f9';
        case 'date': return 'transparent';
        case 'pageNumber': return 'transparent';
        case 'attributeData': return '#ffffff';
        default: return '#f1f5f9';
      }
    };

    const getElementTextColor = () => {
      if (element.content?.color) return element.content.color;
      if (element.type === 'title') return '#ffffff';
      return '#333333';
    };

    return (
      <div
        key={element.id}
        style={style}
        className={`
          border-2 transition-colors flex flex-col items-center justify-center overflow-hidden
          ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-300 hover:border-slate-400'}
          ${element.locked ? 'pointer-events-none' : ''}
        `}
        onMouseDown={(e) => handleElementMouseDown(e, element.id)}
        onClick={(e) => { e.stopPropagation(); setSelectedElementId(element.id); }}
      >
        {/* Element content preview */}
        <div
          className="w-full h-full flex flex-col items-center justify-center p-1"
          style={{ backgroundColor: getElementBackground() }}
        >
          {element.type === 'title' && (
            <div
              className="w-full h-full flex items-center justify-center px-2"
              style={{
                color: getElementTextColor(),
                fontSize: `${Math.max(8, (element.content?.fontSize || 24) * zoom * 0.4)}px`,
                fontWeight: element.content?.fontWeight || 'bold',
                textAlign: element.content?.align || 'center'
              }}
            >
              {element.content?.text || 'Title'}
            </div>
          )}

          {element.type === 'text' && (
            <div
              className="w-full h-full flex items-center px-2"
              style={{
                color: getElementTextColor(),
                fontSize: `${Math.max(6, (element.content?.fontSize || 12) * zoom * 0.35)}px`,
                fontWeight: element.content?.fontWeight || 'normal',
                textAlign: element.content?.align || 'left'
              }}
            >
              {element.content?.text || 'Text content'}
            </div>
          )}

          {element.type === 'logo' && (
            <div className="flex flex-col items-center justify-center text-slate-400">
              <Image className="w-6 h-6" />
              <span className="text-[8px]">Logo</span>
            </div>
          )}

          {element.type === 'date' && (
            <div
              className="w-full h-full flex items-center justify-center px-2"
              style={{
                color: getElementTextColor(),
                fontSize: `${Math.max(6, (element.content?.fontSize || 10) * zoom * 0.4)}px`,
                textAlign: element.content?.align || 'right'
              }}
            >
              <Calendar className="w-3 h-3 mr-1" />
              {element.content?.format || 'Date'}
            </div>
          )}

          {element.type === 'pageNumber' && (
            <div
              className="w-full h-full flex items-center justify-center px-1"
              style={{
                color: getElementTextColor(),
                fontSize: `${Math.max(6, (element.content?.fontSize || 9) * zoom * 0.4)}px`,
                textAlign: element.content?.align || 'center'
              }}
            >
              <Hash className="w-3 h-3 mr-1" />
              Page #
            </div>
          )}

          {element.type === 'attributeData' && (
            <div className="flex flex-col items-center justify-center w-full h-full p-2 bg-slate-50 border border-slate-200">
              <Table2 className="w-8 h-8 text-slate-400 mb-1" />
              <span className="text-[10px] text-slate-500 font-medium">Attribute Data</span>
              <span className="text-[8px] text-slate-400">
                {element.content?.style === 'table' ? 'Table View' : 'List View'}
              </span>
            </div>
          )}
        </div>

        {/* Resize handles (only show when selected and not locked) */}
        {isSelected && !element.locked && (
          <>
            {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(handle => (
              <div
                key={handle}
                className={`absolute w-3 h-3 bg-blue-500 border border-white rounded-sm cursor-${getCursorForHandle(handle)}-resize z-10`}
                style={getHandlePosition(handle)}
                onMouseDown={(e) => handleResizeMouseDown(e, element.id, handle)}
              />
            ))}
          </>
        )}

        {/* Lock indicator */}
        {element.locked && (
          <div className="absolute top-1 right-1 text-slate-400">
            <Lock className="w-3 h-3" />
          </div>
        )}
      </div>
    );
  };

  // Get cursor type for resize handle
  const getCursorForHandle = (handle) => {
    const cursors = {
      nw: 'nwse', ne: 'nesw', sw: 'nesw', se: 'nwse',
      n: 'ns', s: 'ns', e: 'ew', w: 'ew'
    };
    return cursors[handle] || 'move';
  };

  // Get position style for resize handle
  const getHandlePosition = (handle) => {
    const positions = {
      nw: { top: -4, left: -4 },
      n: { top: -4, left: '50%', marginLeft: -4 },
      ne: { top: -4, right: -4 },
      e: { top: '50%', right: -4, marginTop: -4 },
      se: { bottom: -4, right: -4 },
      s: { bottom: -4, left: '50%', marginLeft: -4 },
      sw: { bottom: -4, left: -4 },
      w: { top: '50%', left: -4, marginTop: -4 }
    };
    return positions[handle] || {};
  };

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg text-white"
              style={{ backgroundColor: accentColor }}
            >
              <FileOutput className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {data ? 'Edit Feature Export Template' : 'Create Feature Export Template'}
              </h2>
              <p className="text-sm text-slate-500">
                Design your feature export layout with drag-and-drop elements
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar - Settings & Elements */}
          <div className="w-72 border-r border-slate-200 overflow-y-auto bg-slate-50">
            {/* Template Name */}
            <div className="p-4 border-b border-slate-200 bg-white">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Template Name
              </label>
              <input
                type="text"
                value={template.name}
                onChange={(e) => updateTemplate({ name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${
                  errors.name ? 'border-red-300 bg-red-50' : 'border-slate-300'
                }`}
                placeholder="Enter template name"
              />
              {errors.name && (
                <p className="text-xs text-red-500 mt-1">{errors.name}</p>
              )}
            </div>

            {/* Page Settings */}
            <div className="border-b border-slate-200 bg-white">
              <button
                onClick={() => toggleSection('page')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50"
              >
                <span className="font-medium text-slate-700">Page Settings</span>
                {expandedSections.page ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {expandedSections.page && (
                <div className="px-4 pb-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Page Size
                    </label>
                    <select
                      value={template.pageSize}
                      onChange={(e) => updateTemplate({ pageSize: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      {Object.entries(PAGE_SIZES).map(([key, size]) => (
                        <option key={key} value={key}>{size.name}</option>
                      ))}
                    </select>
                  </div>

                  {template.pageSize === 'custom' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Width (in)
                        </label>
                        <input
                          type="number"
                          value={template.customWidth}
                          onChange={(e) => updateTemplate({ customWidth: parseFloat(e.target.value) || 8.5 })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          min="4"
                          max="44"
                          step="0.5"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Height (in)
                        </label>
                        <input
                          type="number"
                          value={template.customHeight}
                          onChange={(e) => updateTemplate({ customHeight: parseFloat(e.target.value) || 11 })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          min="4"
                          max="44"
                          step="0.5"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Background Color
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={template.backgroundColor}
                        onChange={(e) => updateTemplate({ backgroundColor: e.target.value })}
                        className="w-10 h-10 rounded border border-slate-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={template.backgroundColor}
                        onChange={(e) => updateTemplate({ backgroundColor: e.target.value })}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Map Export Template Selection */}
            <div className="border-b border-slate-200 bg-white">
              <button
                onClick={() => toggleSection('mapExport')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50"
              >
                <span className="font-medium text-slate-700 flex items-center gap-2">
                  <Map className="w-4 h-4" />
                  Map Export
                </span>
                {expandedSections.mapExport ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {expandedSections.mapExport && (
                <div className="px-4 pb-4 space-y-3">
                  <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p>
                      Optionally link an existing map export template to include a map in the feature export.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Map Export Template
                    </label>
                    <select
                      value={template.mapExportTemplateId || ''}
                      onChange={(e) => updateTemplate({ mapExportTemplateId: e.target.value || null })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="">None (no map)</option>
                      {enabledMapExportTemplates.map(mapTemplate => (
                        <option key={mapTemplate.id} value={mapTemplate.id}>
                          {mapTemplate.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {enabledMapExportTemplates.length === 0 && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs text-amber-700">
                        No map export templates available. Create map export templates first to link them here.
                      </p>
                    </div>
                  )}

                  {template.mapExportTemplateId && (
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                      <Map className="w-4 h-4 text-blue-600" />
                      <span className="text-xs text-blue-700">
                        Map will be included in export
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Elements List */}
            <div className="border-b border-slate-200 bg-white">
              <button
                onClick={() => toggleSection('elements')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50"
              >
                <span className="font-medium text-slate-700">Elements</span>
                {expandedSections.elements ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {expandedSections.elements && (
                <div className="px-4 pb-4">
                  {errors.elements && (
                    <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.elements}
                      </p>
                    </div>
                  )}

                  <div className="space-y-1 mb-3">
                    {template.elements.map(element => {
                      const typeConfig = ELEMENT_TYPES[element.type];
                      const Icon = typeConfig?.icon || FileText;
                      const isSelected = selectedElementId === element.id;

                      return (
                        <div
                          key={element.id}
                          className={`
                            flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer
                            ${isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-100'}
                          `}
                          onClick={() => setSelectedElementId(element.id)}
                        >
                          <Icon className="w-4 h-4 text-slate-500" />
                          <span className="flex-1 text-sm text-slate-700 truncate">
                            {typeConfig?.name || element.type}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); updateElement(element.id, { visible: !element.visible }); }}
                            className="p-1 hover:bg-slate-200 rounded"
                          >
                            {element.visible ? (
                              <Eye className="w-3 h-3 text-slate-400" />
                            ) : (
                              <EyeOff className="w-3 h-3 text-slate-300" />
                            )}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); updateElement(element.id, { locked: !element.locked }); }}
                            className="p-1 hover:bg-slate-200 rounded"
                          >
                            {element.locked ? (
                              <Lock className="w-3 h-3 text-amber-500" />
                            ) : (
                              <Unlock className="w-3 h-3 text-slate-300" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setShowElementPalette(!showElementPalette)}
                    className="w-full px-3 py-2 text-sm border border-dashed border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Element
                  </button>

                  {showElementPalette && (
                    <div className="mt-2 p-2 bg-slate-100 rounded-lg grid grid-cols-2 gap-1">
                      {Object.entries(ELEMENT_TYPES).map(([type, config]) => (
                        <button
                          key={type}
                          onClick={() => addElement(type)}
                          className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-700 bg-white rounded hover:bg-slate-50 border border-slate-200"
                        >
                          <config.icon className="w-3 h-3" />
                          {config.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected Element Properties */}
            {selectedElement && (
              <div className="bg-white">
                <button
                  onClick={() => toggleSection('properties')}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-700">Element Properties</span>
                  {expandedSections.properties ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {expandedSections.properties && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-2 rounded">
                      <span>{ELEMENT_TYPES[selectedElement.type]?.name}</span>
                      <span>ID: {selectedElement.id.split('-')[1]}</span>
                    </div>

                    {/* Position */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">X (%)</label>
                        <input
                          type="number"
                          value={selectedElement.x}
                          onChange={(e) => updateElement(selectedElement.id, { x: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                          min="0"
                          max="100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Y (%)</label>
                        <input
                          type="number"
                          value={selectedElement.y}
                          onChange={(e) => updateElement(selectedElement.id, { y: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                          min="0"
                          max="100"
                        />
                      </div>
                    </div>

                    {/* Size */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Width (%)</label>
                        <input
                          type="number"
                          value={selectedElement.width}
                          onChange={(e) => updateElement(selectedElement.id, { width: parseFloat(e.target.value) || 10 })}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                          min="5"
                          max="100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Height (%)</label>
                        <input
                          type="number"
                          value={selectedElement.height}
                          onChange={(e) => updateElement(selectedElement.id, { height: parseFloat(e.target.value) || 10 })}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                          min="5"
                          max="100"
                        />
                      </div>
                    </div>

                    {/* Content properties based on type */}
                    {(selectedElement.type === 'title' || selectedElement.type === 'text') && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Text</label>
                          {selectedElement.type === 'text' ? (
                            <textarea
                              value={selectedElement.content?.text || ''}
                              onChange={(e) => updateElement(selectedElement.id, {
                                content: { ...selectedElement.content, text: e.target.value }
                              })}
                              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                              rows={3}
                            />
                          ) : (
                            <input
                              type="text"
                              value={selectedElement.content?.text || ''}
                              onChange={(e) => updateElement(selectedElement.id, {
                                content: { ...selectedElement.content, text: e.target.value }
                              })}
                              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                            />
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Font Size</label>
                            <input
                              type="number"
                              value={selectedElement.content?.fontSize || 12}
                              onChange={(e) => updateElement(selectedElement.id, {
                                content: { ...selectedElement.content, fontSize: parseInt(e.target.value) || 12 }
                              })}
                              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                              min="8"
                              max="72"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Align</label>
                            <select
                              value={selectedElement.content?.align || 'left'}
                              onChange={(e) => updateElement(selectedElement.id, {
                                content: { ...selectedElement.content, align: e.target.value }
                              })}
                              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Background</label>
                            <input
                              type="color"
                              value={selectedElement.content?.backgroundColor || '#ffffff'}
                              onChange={(e) => updateElement(selectedElement.id, {
                                content: { ...selectedElement.content, backgroundColor: e.target.value }
                              })}
                              className="w-full h-8 rounded border border-slate-300 cursor-pointer"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Text Color</label>
                            <input
                              type="color"
                              value={selectedElement.content?.color || '#333333'}
                              onChange={(e) => updateElement(selectedElement.id, {
                                content: { ...selectedElement.content, color: e.target.value }
                              })}
                              className="w-full h-8 rounded border border-slate-300 cursor-pointer"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {selectedElement.type === 'date' && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Date Format</label>
                          <select
                            value={selectedElement.content?.format || 'MMMM D, YYYY'}
                            onChange={(e) => updateElement(selectedElement.id, {
                              content: { ...selectedElement.content, format: e.target.value }
                            })}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                          >
                            <option value="MMMM D, YYYY">January 1, 2025</option>
                            <option value="MM/DD/YYYY">01/01/2025</option>
                            <option value="DD/MM/YYYY">01/01/2025</option>
                            <option value="YYYY-MM-DD">2025-01-01</option>
                            <option value="MMM D, YYYY">Jan 1, 2025</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Font Size</label>
                            <input
                              type="number"
                              value={selectedElement.content?.fontSize || 10}
                              onChange={(e) => updateElement(selectedElement.id, {
                                content: { ...selectedElement.content, fontSize: parseInt(e.target.value) || 10 }
                              })}
                              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                              min="6"
                              max="24"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Text Color</label>
                            <input
                              type="color"
                              value={selectedElement.content?.color || '#333333'}
                              onChange={(e) => updateElement(selectedElement.id, {
                                content: { ...selectedElement.content, color: e.target.value }
                              })}
                              className="w-full h-8 rounded border border-slate-300 cursor-pointer"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {selectedElement.type === 'pageNumber' && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Format</label>
                          <select
                            value={selectedElement.content?.format || 'Page {current} of {total}'}
                            onChange={(e) => updateElement(selectedElement.id, {
                              content: { ...selectedElement.content, format: e.target.value }
                            })}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                          >
                            <option value="Page {current} of {total}">Page 1 of 3</option>
                            <option value="{current}/{total}">1/3</option>
                            <option value="{current}">1</option>
                            <option value="Page {current}">Page 1</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Font Size</label>
                            <input
                              type="number"
                              value={selectedElement.content?.fontSize || 9}
                              onChange={(e) => updateElement(selectedElement.id, {
                                content: { ...selectedElement.content, fontSize: parseInt(e.target.value) || 9 }
                              })}
                              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                              min="6"
                              max="18"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Align</label>
                            <select
                              value={selectedElement.content?.align || 'center'}
                              onChange={(e) => updateElement(selectedElement.id, {
                                content: { ...selectedElement.content, align: e.target.value }
                              })}
                              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </div>
                        </div>
                      </>
                    )}

                    {selectedElement.type === 'attributeData' && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Display Style</label>
                          <select
                            value={selectedElement.content?.style || 'table'}
                            onChange={(e) => updateElement(selectedElement.id, {
                              content: { ...selectedElement.content, style: e.target.value }
                            })}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                          >
                            <option value="table">Table (rows and columns)</option>
                            <option value="list">List (label: value pairs)</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Font Size</label>
                            <input
                              type="number"
                              value={selectedElement.content?.fontSize || 11}
                              onChange={(e) => updateElement(selectedElement.id, {
                                content: { ...selectedElement.content, fontSize: parseInt(e.target.value) || 11 }
                              })}
                              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                              min="8"
                              max="16"
                            />
                          </div>
                          <div className="flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedElement.content?.showLabels !== false}
                                onChange={(e) => updateElement(selectedElement.id, {
                                  content: { ...selectedElement.content, showLabels: e.target.checked }
                                })}
                                className="w-4 h-4 rounded border-slate-300"
                              />
                              <span className="text-xs text-slate-600">Show Labels</span>
                            </label>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Header Color</label>
                            <input
                              type="color"
                              value={selectedElement.content?.headerColor || '#f1f5f9'}
                              onChange={(e) => updateElement(selectedElement.id, {
                                content: { ...selectedElement.content, headerColor: e.target.value }
                              })}
                              className="w-full h-8 rounded border border-slate-300 cursor-pointer"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Border Color</label>
                            <input
                              type="color"
                              value={selectedElement.content?.borderColor || '#e2e8f0'}
                              onChange={(e) => updateElement(selectedElement.id, {
                                content: { ...selectedElement.content, borderColor: e.target.value }
                              })}
                              className="w-full h-8 rounded border border-slate-300 cursor-pointer"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-slate-200">
                      <button
                        onClick={() => duplicateElement(selectedElement.id)}
                        className="flex-1 px-2 py-1.5 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200 flex items-center justify-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        Duplicate
                      </button>
                      <button
                        onClick={() => deleteElement(selectedElement.id)}
                        className="flex-1 px-2 py-1.5 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Canvas Area */}
          <div
            ref={containerRef}
            className="flex-1 overflow-auto bg-slate-200 p-8"
            onClick={() => setSelectedElementId(null)}
          >
            {/* Zoom controls */}
            <div className="fixed bottom-8 right-8 bg-white rounded-lg shadow-lg border border-slate-200 flex items-center gap-1 p-1 z-20">
              <button
                onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
                className="px-3 py-1 text-sm hover:bg-slate-100 rounded"
              >
                -
              </button>
              <span className="px-3 py-1 text-sm text-slate-600 min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(z => Math.min(2, z + 0.25))}
                className="px-3 py-1 text-sm hover:bg-slate-100 rounded"
              >
                +
              </button>
            </div>

            {/* Canvas */}
            <div
              ref={canvasRef}
              className="relative mx-auto shadow-xl"
              style={{
                width: canvasWidth,
                height: canvasHeight,
                backgroundColor: template.backgroundColor,
                minWidth: canvasWidth,
                minHeight: canvasHeight
              }}
            >
              {/* Grid overlay */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)
                  `,
                  backgroundSize: `${canvasWidth / 10}px ${canvasHeight / 10}px`
                }}
              />

              {/* Elements */}
              {template.elements.map(element => renderElement(element))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <div className="text-sm text-slate-500">
            {pageDimensions.width}" × {pageDimensions.height}" • {template.elements.length} elements
            {template.mapExportTemplateId && (
              <span className="ml-2 text-blue-600">
                + Map Export
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-white rounded-lg font-medium flex items-center gap-2"
              style={{ backgroundColor: accentColor }}
            >
              <Save className="w-4 h-4" />
              Save Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
