// src/admin/components/customTemplate/CustomTemplateEditor.jsx
// Main container component for custom email template editing
// Features Designer mode with drag-and-drop and HTML mode with live preview

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  FileDown,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Check,
  Info,
  Code,
  MousePointer2,
  GripVertical,
  Trash2,
  Plus,
  Move,
  Monitor,
  Smartphone,
  RefreshCw,
  Database,
  Loader2,
  LayoutTemplate,
  Type,
  BarChart3,
  Table,
  Download,
  FileText,
  Columns,
  Copy,
  Search
} from 'lucide-react';
import ThemeCustomizer from './ThemeCustomizer';
import StatisticsBuilder from './StatisticsBuilder';
import BrandingCustomizer from './BrandingCustomizer';
import { DEFAULT_THEME, DEFAULT_CUSTOM_TEMPLATE_HTML, DEFAULT_BRANDING, PLACEHOLDER_SECTIONS } from './constants';
import { validateCustomTemplate, generateSampleContext } from './validation';

// Visual Builder Element Types for drag-and-drop
const VISUAL_ELEMENTS = [
  {
    id: 'header',
    name: 'Header',
    icon: 'LayoutTemplate',
    category: 'structure',
    defaultContent: {
      type: 'header',
      title: '{{organizationName}}',
      subtitle: '{{notificationName}}',
      usePrimaryColor: true
    }
  },
  {
    id: 'logo',
    name: 'Logo',
    icon: 'LayoutTemplate',
    category: 'structure',
    defaultContent: {
      type: 'logo',
      placeholder: '{{logoHtml}}'
    }
  },
  {
    id: 'text',
    name: 'Text Block',
    icon: 'Type',
    category: 'content',
    defaultContent: {
      type: 'text',
      content: '<p>Add your custom text here...</p>'
    }
  },
  {
    id: 'intro',
    name: 'Email Intro',
    icon: 'Type',
    category: 'content',
    defaultContent: {
      type: 'text',
      content: '{{emailIntro}}'
    }
  },
  {
    id: 'statistics',
    name: 'Statistics',
    icon: 'BarChart3',
    category: 'content',
    defaultContent: {
      type: 'statistics',
      placeholder: '{{statisticsHtml}}'
    }
  },
  {
    id: 'record-count',
    name: 'Record Count',
    icon: 'BarChart3',
    category: 'content',
    defaultContent: {
      type: 'record-count',
      template: 'We found <strong>{{recordCount}}</strong> new records matching your subscription.'
    }
  },
  {
    id: 'date-range',
    name: 'Date Range',
    icon: 'FileText',
    category: 'content',
    defaultContent: {
      type: 'date-range',
      template: '<strong>Reporting Period:</strong> {{dateRangeStart}} - {{dateRangeEnd}}'
    }
  },
  {
    id: 'datatable',
    name: 'Data Table',
    icon: 'Table',
    category: 'data',
    defaultContent: {
      type: 'datatable',
      placeholder: '{{dataTable}}'
    }
  },
  {
    id: 'download-button',
    name: 'Download Button',
    icon: 'Download',
    category: 'data',
    defaultContent: {
      type: 'download-button',
      placeholder: '{{downloadButton}}'
    }
  },
  {
    id: 'more-records',
    name: 'More Records',
    icon: 'Info',
    category: 'data',
    defaultContent: {
      type: 'more-records',
      placeholder: '{{moreRecordsMessage}}'
    }
  },
  {
    id: 'divider',
    name: 'Divider',
    icon: 'Columns',
    category: 'structure',
    defaultContent: {
      type: 'divider'
    }
  },
  {
    id: 'spacer',
    name: 'Spacer',
    icon: 'Columns',
    category: 'structure',
    defaultContent: {
      type: 'spacer',
      height: '20px'
    }
  },
  {
    id: 'footer',
    name: 'Footer',
    icon: 'FileText',
    category: 'structure',
    defaultContent: {
      type: 'footer',
      text: 'You are receiving this because you subscribed to notifications.'
    }
  }
];

// Configuration for the proxy service
const ARCGIS_PROXY_URL = window.ARCGIS_PROXY_URL || 'https://notify.civ.quest';

/**
 * CustomTemplateEditor Component
 *
 * Container for the full custom template editing experience
 * Features Designer mode (drag-and-drop) and HTML mode (raw code)
 *
 * Props:
 * @param {object} customTemplate - Current custom template configuration
 * @param {function} onChange - Called with updated custom template
 * @param {object} notification - Parent notification configuration
 * @param {object} locality - Organization/locality data
 * @param {function} onSendTest - Called to send a test email
 */
export default function CustomTemplateEditor({
  customTemplate = {},
  onChange,
  notification = {},
  locality = {},
  onSendTest
}) {
  // Right panel mode: 'designer' or 'html'
  const [rightPanelMode, setRightPanelMode] = useState('designer');
  const [previewMode, setPreviewMode] = useState('desktop');
  const [showPreviewOverlay, setShowPreviewOverlay] = useState(false);

  const [expandedSections, setExpandedSections] = useState({
    branding: true,
    theme: false,
    statistics: true,
    placeholders: false
  });

  // Live data state
  const [isLoadingLiveData, setIsLoadingLiveData] = useState(false);
  const [liveDataRecords, setLiveDataRecords] = useState([]);
  const [liveDataFields, setLiveDataFields] = useState([]);
  const [liveDataError, setLiveDataError] = useState(null);
  const [liveRecordCount, setLiveRecordCount] = useState(null);
  const [useLiveData, setUseLiveData] = useState(false);

  // Drag and drop state
  const [draggedElement, setDraggedElement] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragCounter = useRef(0);

  // Copied placeholder
  const [copiedPlaceholder, setCopiedPlaceholder] = useState(null);

  // Ensure default values
  const template = {
    html: customTemplate.html || DEFAULT_CUSTOM_TEMPLATE_HTML,
    includeCSV: customTemplate.includeCSV !== false,
    theme: { ...DEFAULT_THEME, ...(customTemplate.theme || {}) },
    branding: { ...DEFAULT_BRANDING, ...(customTemplate.branding || {}) },
    statistics: customTemplate.statistics || [],
    visualElements: customTemplate.visualElements || [],
    ...customTemplate
  };

  // Update handler with defaults
  const handleUpdate = useCallback((updates) => {
    onChange({
      ...template,
      ...updates
    });
  }, [template, onChange]);

  // Theme update handler
  const handleThemeChange = useCallback((theme) => {
    handleUpdate({ theme });
  }, [handleUpdate]);

  // Branding update handler
  const handleBrandingChange = useCallback((branding) => {
    handleUpdate({ branding });
  }, [handleUpdate]);

  // Statistics update handler
  const handleStatisticsChange = useCallback((statistics) => {
    handleUpdate({ statistics });
  }, [handleUpdate]);

  // HTML update handler
  const handleHtmlChange = useCallback((html) => {
    handleUpdate({ html });
  }, [handleUpdate]);

  // CSV toggle handler
  const handleCSVToggle = useCallback((includeCSV) => {
    handleUpdate({ includeCSV });
  }, [handleUpdate]);

  // Section toggle
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Fetch live data from the notification's data source
  const fetchLiveData = useCallback(async () => {
    const endpoint = notification.source?.endpoint;
    if (!endpoint) {
      setLiveDataError('No data source endpoint configured');
      return;
    }

    setIsLoadingLiveData(true);
    setLiveDataError(null);

    try {
      const username = notification.source?.username;
      const password = notification.source?.password;

      // Fetch metadata
      const metadataRes = await fetch(`${ARCGIS_PROXY_URL}/api/arcgis/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceUrl: endpoint,
          ...(username && password ? { username, password } : {})
        })
      });

      if (!metadataRes.ok) throw new Error('Failed to fetch service metadata');

      const metadata = await metadataRes.json();
      const fields = (metadata.fields || []).map(f => f.name);
      setLiveDataFields(fields);

      // Get total record count
      const baseUrl = endpoint.replace(/\/$/, '');
      const countParams = new URLSearchParams({
        where: '1=1',
        returnCountOnly: 'true',
        f: 'json'
      });

      const countRes = await fetch(`${ARCGIS_PROXY_URL}/api/arcgis/proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceUrl: `${baseUrl}/query?${countParams.toString()}`,
          ...(username && password ? { username, password } : {})
        })
      });

      if (countRes.ok) {
        const countData = await countRes.json();
        setLiveRecordCount(countData.count || 0);
      }

      // Get sample records (first 10)
      const queryParams = new URLSearchParams({
        where: '1=1',
        outFields: '*',
        resultRecordCount: '10',
        f: 'json'
      });

      const dataRes = await fetch(`${ARCGIS_PROXY_URL}/api/arcgis/proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceUrl: `${baseUrl}/query?${queryParams.toString()}`,
          ...(username && password ? { username, password } : {})
        })
      });

      if (!dataRes.ok) throw new Error('Failed to fetch sample data');

      const data = await dataRes.json();
      const records = (data.features || []).map(f => f.attributes || {});
      setLiveDataRecords(records);
      setUseLiveData(true);

    } catch (err) {
      console.error('Live data fetch error:', err);
      setLiveDataError(err.message);
    } finally {
      setIsLoadingLiveData(false);
    }
  }, [notification.source]);

  // Auto-fetch live data if endpoint exists
  useEffect(() => {
    if (notification.source?.endpoint && !liveDataRecords.length && !isLoadingLiveData) {
      fetchLiveData();
    }
  }, [notification.source?.endpoint]);

  // Generate sample context with live data if available
  const sampleContext = useMemo(() => {
    const baseContext = generateSampleContext(notification, template, locality, {
      mockRecordCount: useLiveData && liveRecordCount !== null ? liveRecordCount : 42
    });

    // If we have live data, build a real data table
    if (useLiveData && liveDataRecords.length > 0 && liveDataFields.length > 0) {
      const displayFields = notification.source?.displayFields || liveDataFields.slice(0, 3);
      const fieldNames = displayFields.map(f => typeof f === 'string' ? f : f.field);
      const fieldLabels = displayFields.map(f => typeof f === 'string' ? f : (f.label || f.field));

      const tableHtml = `<table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
        <thead>
          <tr>
            ${fieldLabels.map(label => `<th style="text-align: left; padding: 10px 8px; background-color: #f2f2f2; border-bottom: 2px solid #ddd;">${label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${liveDataRecords.slice(0, 10).map(row => `<tr>${fieldNames.map(f => `<td style="padding: 10px 8px; border-bottom: 1px solid #eee;">${row[f] ?? ''}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>`;

      baseContext.dataTable = tableHtml;
      baseContext.recordCount = liveRecordCount !== null ? String(liveRecordCount) : String(liveDataRecords.length);

      if (liveRecordCount > 10) {
        baseContext.moreRecordsMessage = `<p style="font-style: italic; color: #666; margin-top: 15px; font-size: 13px;">Showing first 10 of ${liveRecordCount.toLocaleString()} records. Download the CSV to see all data.</p>`;
      } else {
        baseContext.moreRecordsMessage = '';
      }
    }

    return baseContext;
  }, [notification, template, locality, useLiveData, liveDataRecords, liveDataFields, liveRecordCount]);

  // Process template HTML with context
  const processedHtml = useMemo(() => {
    if (!template.html) return '';

    let html = template.html;
    Object.entries(sampleContext).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      html = html.replace(regex, value);
    });

    return html;
  }, [template.html, sampleContext]);

  // Visual Elements drag handlers
  const handleDragStart = (e, element, sourceIndex = null) => {
    setDraggedElement({ element, sourceIndex });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, targetIndex) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(targetIndex);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current++;
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOverIndex(null);

    if (!draggedElement) return;

    const { element, sourceIndex } = draggedElement;
    const newElements = [...(template.visualElements || [])];

    if (sourceIndex !== null) {
      // Moving existing element
      const [movedElement] = newElements.splice(sourceIndex, 1);
      const adjustedIndex = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex;
      newElements.splice(adjustedIndex, 0, movedElement);
    } else {
      // Adding new element from palette
      const newElement = {
        id: `${element.id}_${Date.now()}`,
        ...element.defaultContent
      };
      newElements.splice(targetIndex, 0, newElement);
    }

    handleUpdate({ visualElements: newElements });
    setDraggedElement(null);
  };

  const handleDropOnCanvas = (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOverIndex(null);

    if (!draggedElement) return;

    const { element, sourceIndex } = draggedElement;

    if (sourceIndex === null) {
      const newElement = {
        id: `${element.id}_${Date.now()}`,
        ...element.defaultContent
      };
      handleUpdate({
        visualElements: [...(template.visualElements || []), newElement]
      });
    }

    setDraggedElement(null);
  };

  const removeElement = (index) => {
    handleUpdate({
      visualElements: (template.visualElements || []).filter((_, i) => i !== index)
    });
  };

  // Convert visual elements to HTML
  const visualElementsToHtml = useCallback(() => {
    const elements = template.visualElements || [];
    if (elements.length === 0) return template.html;

    const theme = template.theme || DEFAULT_THEME;
    let html = `<div style="font-family: {{fontFamily}}; color: {{textColor}}; max-width: 600px; margin: 0 auto;">\n`;

    elements.forEach(el => {
      switch (el.type) {
        case 'header':
          html += `  <!-- Header -->
  <div style="background-color: {{primaryColor}}; padding: 20px; color: white; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">${el.title}</h1>
    <p style="margin: 5px 0 0 0; opacity: 0.9;">${el.subtitle}</p>
  </div>\n`;
          break;
        case 'logo':
          html += `  <!-- Logo -->\n  {{logoHtml}}\n`;
          break;
        case 'text':
          html += `  <div style="padding: 15px 25px;">${el.content}</div>\n`;
          break;
        case 'statistics':
          html += `  <!-- Statistics -->\n  <div style="padding: 15px 25px;">{{statisticsHtml}}</div>\n`;
          break;
        case 'record-count':
          html += `  <p style="font-size: 16px; padding: 0 25px; margin: 20px 0;">${el.template}</p>\n`;
          break;
        case 'date-range':
          html += `  <p style="color: {{mutedTextColor}}; font-size: 13px; padding: 0 25px; margin-bottom: 20px;">${el.template}</p>\n`;
          break;
        case 'datatable':
          html += `  <!-- Data Table -->\n  <div style="padding: 0 25px;">{{dataTable}}</div>\n`;
          break;
        case 'download-button':
          html += `  <!-- Download Button -->\n  <div style="padding: 15px 25px;">{{downloadButton}}</div>\n`;
          break;
        case 'more-records':
          html += `  <div style="padding: 0 25px;">{{moreRecordsMessage}}</div>\n`;
          break;
        case 'divider':
          html += `  <hr style="border: none; border-top: 1px solid {{borderColor}}; margin: 20px 25px;" />\n`;
          break;
        case 'spacer':
          html += `  <div style="height: ${el.height || '20px'};"></div>\n`;
          break;
        case 'footer':
          html += `  <!-- Footer -->
  <div style="margin-top: 30px; padding: 20px 25px; border-top: 1px solid {{borderColor}}; font-size: 12px; color: {{mutedTextColor}};">
    <p>${el.text}</p>
    <p><a href="#" style="color: {{accentColor}};">Manage Preferences</a></p>
  </div>\n`;
          break;
      }
    });

    html += '</div>';
    return html;
  }, [template.visualElements, template.theme]);

  // Sync visual elements to HTML when in designer mode
  useEffect(() => {
    if (rightPanelMode === 'designer' && (template.visualElements || []).length > 0) {
      const generatedHtml = visualElementsToHtml();
      if (generatedHtml !== template.html) {
        handleUpdate({ html: generatedHtml });
      }
    }
  }, [template.visualElements, rightPanelMode]);

  // Get icon component for visual element
  const getElementIcon = (iconName) => {
    const icons = { LayoutTemplate, Type, BarChart3, Columns, Table, Download, FileText, Info };
    return icons[iconName] || FileText;
  };

  // Render visual element for the canvas
  const renderVisualElement = (element, index) => {
    const processContent = (content) => {
      if (typeof content !== 'string') return content;
      return content.replace(/\{\{(\w+)\}\}/g, (match, key) => sampleContext[key] || match);
    };

    return (
      <div
        key={element.id}
        draggable
        onDragStart={(e) => handleDragStart(e, element, index)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, index)}
        className={`group relative border-2 transition-all cursor-move ${
          dragOverIndex === index ? 'border-blue-400 bg-blue-50' : 'border-transparent hover:border-slate-300'
        }`}
      >
        {/* Element Controls */}
        <div className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
          <button
            type="button"
            onClick={() => removeElement(index)}
            className="p-1 bg-red-500 text-white rounded shadow-sm hover:bg-red-600"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <div className="p-1 bg-slate-600 text-white rounded shadow-sm cursor-grab">
            <GripVertical className="w-3 h-3" />
          </div>
        </div>

        {/* Rendered Element */}
        {element.type === 'header' && (
          <div style={{ backgroundColor: template.theme?.primaryColor || '#004E7C', color: 'white', padding: '20px', textAlign: 'left' }}>
            <h1 style={{ margin: 0, fontSize: '24px' }}>{processContent(element.title)}</h1>
            <p style={{ margin: '5px 0 0 0', opacity: 0.9 }}>{processContent(element.subtitle)}</p>
          </div>
        )}

        {element.type === 'logo' && (
          <div style={{ padding: '15px 25px' }} dangerouslySetInnerHTML={{ __html: processContent(element.placeholder) || '<span style="color:#999;font-style:italic;">Logo placeholder</span>' }} />
        )}

        {element.type === 'text' && (
          <div style={{ padding: '15px 25px' }} dangerouslySetInnerHTML={{ __html: processContent(element.content) }} />
        )}

        {element.type === 'statistics' && (
          <div style={{ padding: '15px 25px' }} dangerouslySetInnerHTML={{ __html: processContent(element.placeholder) || '<span style="color:#999;font-style:italic;">Statistics will appear here</span>' }} />
        )}

        {element.type === 'record-count' && (
          <p style={{ fontSize: '16px', padding: '0 25px', margin: '20px 0' }} dangerouslySetInnerHTML={{ __html: processContent(element.template) }} />
        )}

        {element.type === 'date-range' && (
          <p style={{ color: template.theme?.mutedTextColor || '#666', fontSize: '13px', padding: '0 25px', marginBottom: '20px' }} dangerouslySetInnerHTML={{ __html: processContent(element.template) }} />
        )}

        {element.type === 'datatable' && (
          <div style={{ padding: '0 25px' }} dangerouslySetInnerHTML={{ __html: processContent(element.placeholder) }} />
        )}

        {element.type === 'download-button' && template.includeCSV && (
          <div style={{ padding: '15px 25px' }} dangerouslySetInnerHTML={{ __html: processContent(element.placeholder) }} />
        )}

        {element.type === 'download-button' && !template.includeCSV && (
          <div style={{ padding: '15px 25px', opacity: 0.5 }}>
            <span className="text-xs text-slate-500 italic">Download button hidden (CSV disabled)</span>
          </div>
        )}

        {element.type === 'more-records' && (
          <div style={{ padding: '0 25px' }} dangerouslySetInnerHTML={{ __html: processContent(element.placeholder) }} />
        )}

        {element.type === 'divider' && (
          <hr style={{ border: 'none', borderTop: `1px solid ${template.theme?.borderColor || '#ddd'}`, margin: '20px 25px' }} />
        )}

        {element.type === 'spacer' && (
          <div style={{ height: element.height || '20px', backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="text-xs text-slate-400">Spacer ({element.height || '20px'})</span>
          </div>
        )}

        {element.type === 'footer' && (
          <div style={{ marginTop: '30px', padding: '20px 25px', borderTop: `1px solid ${template.theme?.borderColor || '#ddd'}`, fontSize: '12px', color: template.theme?.mutedTextColor || '#666' }}>
            <p>{element.text}</p>
            <p><a href="#" style={{ color: template.theme?.accentColor || '#0077B6' }}>Manage Preferences</a></p>
          </div>
        )}
      </div>
    );
  };

  // Copy placeholder to clipboard
  const copyPlaceholder = async (key) => {
    const placeholder = `{{${key}}}`;
    try {
      await navigator.clipboard.writeText(placeholder);
      setCopiedPlaceholder(key);
      setTimeout(() => setCopiedPlaceholder(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Validate template
  const validationResult = validateCustomTemplate(template, notification);

  // Get available fields for statistics
  const availableFields = notification.source?.displayFields || [];

  return (
    <div className="flex h-full min-h-0">
      {/* Preview Overlay Modal */}
      {showPreviewOverlay && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-[#004E7C]" />
                <div>
                  <h4 className="font-bold text-slate-800">Template Preview</h4>
                  <p className="text-xs text-slate-500">
                    {useLiveData && liveRecordCount !== null
                      ? `Rendered with ${liveRecordCount.toLocaleString()} live records`
                      : 'Rendered with sample data'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-100 rounded p-0.5">
                  <button
                    onClick={() => setPreviewMode('desktop')}
                    className={`p-1.5 rounded transition-colors ${
                      previewMode === 'desktop'
                        ? 'bg-white shadow-sm text-slate-700'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Monitor className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPreviewMode('mobile')}
                    className={`p-1.5 rounded transition-colors ${
                      previewMode === 'mobile'
                        ? 'bg-white shadow-sm text-slate-700'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => setShowPreviewOverlay(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700"
                >
                  <Eye className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-slate-100">
              <div
                className="mx-auto bg-white shadow-lg rounded-lg overflow-hidden transition-all duration-300"
                style={{ maxWidth: previewMode === 'mobile' ? '375px' : '600px' }}
              >
                <div dangerouslySetInnerHTML={{ __html: processedHtml }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Left Panel - Configuration */}
      <div className="w-80 flex flex-col min-h-0 border-r border-slate-200 bg-slate-50 shrink-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Configuration</span>
            {!validationResult.isValid && (
              <span className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="w-3 h-3" />
                {validationResult.errors.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowPreviewOverlay(true)}
            className="flex items-center gap-1.5 px-2 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <Eye className="w-3 h-3" />
            Preview
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          {/* Live Data Connection */}
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                Live Data Preview
              </span>
              {useLiveData && liveRecordCount !== null && (
                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full">
                  Connected
                </span>
              )}
            </div>

            {notification.source?.endpoint ? (
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 truncate">
                  {notification.source.endpoint}
                </p>
                {isLoadingLiveData ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading live data...
                  </div>
                ) : liveDataError ? (
                  <div className="flex items-center gap-2 text-xs text-red-600">
                    <AlertCircle className="w-3 h-3" />
                    {liveDataError}
                  </div>
                ) : useLiveData ? (
                  <div className="bg-green-50 p-2 rounded text-xs text-green-700">
                    {liveRecordCount?.toLocaleString() || liveDataRecords.length} records, {liveDataFields.length} fields
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={fetchLiveData}
                  disabled={isLoadingLiveData}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50 flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingLiveData ? 'animate-spin' : ''}`} />
                  Refresh Data
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                No data source configured in notification settings
              </p>
            )}
          </div>

          {/* CSV Toggle */}
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={template.includeCSV}
                onChange={(e) => handleCSVToggle(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-slate-700 flex items-center gap-1.5">
                <FileDown className="w-3.5 h-3.5 text-slate-500" />
                Include CSV attachment
              </span>
            </label>
          </div>

          {/* Branding Section */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('branding')}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                Branding & Logo
                {template.branding?.logoUrl && (
                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full">Set</span>
                )}
              </span>
              {expandedSections.branding ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {expandedSections.branding && (
              <div className="p-3 border-t border-slate-100">
                <BrandingCustomizer
                  branding={template.branding}
                  onChange={handleBrandingChange}
                  theme={template.theme}
                  compact={true}
                />
              </div>
            )}
          </div>

          {/* Theme Section */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('theme')}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                Theme Colors
                <div className="flex gap-0.5">
                  <div className="w-3 h-3 rounded-sm border border-slate-200" style={{ backgroundColor: template.theme?.primaryColor }} />
                  <div className="w-3 h-3 rounded-sm border border-slate-200" style={{ backgroundColor: template.theme?.accentColor }} />
                </div>
              </span>
              {expandedSections.theme ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {expandedSections.theme && (
              <div className="p-3 border-t border-slate-100">
                <ThemeCustomizer
                  theme={template.theme}
                  onChange={handleThemeChange}
                  onReset={() => handleThemeChange(DEFAULT_THEME)}
                  compact={true}
                />
              </div>
            )}
          </div>

          {/* Statistics Section */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('statistics')}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                Statistics
                {template.statistics.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-[#004E7C] text-white text-[10px] rounded-full">
                    {template.statistics.length}
                  </span>
                )}
              </span>
              {expandedSections.statistics ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {expandedSections.statistics && (
              <div className="p-3 border-t border-slate-100">
                <StatisticsBuilder
                  statistics={template.statistics}
                  availableFields={availableFields}
                  onChange={handleStatisticsChange}
                  compact={true}
                />
              </div>
            )}
          </div>

          {/* Placeholders Reference */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('placeholders')}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                <Code className="w-3.5 h-3.5" />
                Placeholders
              </span>
              {expandedSections.placeholders ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {expandedSections.placeholders && (
              <div className="p-2 border-t border-slate-100 max-h-48 overflow-y-auto">
                {PLACEHOLDER_SECTIONS.slice(0, 4).map(section => (
                  <div key={section.title} className="mb-2">
                    <p className="text-[10px] font-medium text-slate-500 uppercase mb-1">{section.title}</p>
                    <div className="space-y-0.5">
                      {section.placeholders.map(p => (
                        <button
                          key={p.name}
                          onClick={() => copyPlaceholder(p.name)}
                          className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] bg-slate-50 rounded hover:bg-slate-100"
                          title={p.description}
                        >
                          <span className="font-mono text-slate-700">{`{{${p.name}}}`}</span>
                          {copiedPlaceholder === p.name ? (
                            <Check className="w-2.5 h-2.5 text-green-500" />
                          ) : (
                            <Copy className="w-2.5 h-2.5 text-slate-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Designer/HTML Editor */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-100">
        {/* Right Panel Header with Mode Toggle */}
        <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center gap-3">
            {/* Mode Toggle */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setRightPanelMode('designer')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
                  rightPanelMode === 'designer'
                    ? 'bg-white shadow-sm text-slate-800'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <MousePointer2 className="w-3.5 h-3.5" />
                Designer
              </button>
              <button
                onClick={() => setRightPanelMode('html')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
                  rightPanelMode === 'html'
                    ? 'bg-white shadow-sm text-slate-800'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                HTML
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {rightPanelMode === 'designer' && (
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Move className="w-3 h-3" />
                Drag elements to reorder
              </span>
            )}
            {useLiveData && liveRecordCount !== null && (
              <span className="flex items-center gap-1 text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                <Database className="w-3 h-3" />
                Live: {liveRecordCount.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Designer Mode */}
        {rightPanelMode === 'designer' && (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Element Palette */}
            <div className="w-40 border-r border-slate-200 p-2 overflow-y-auto bg-white shrink-0">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2">Elements</h4>

              {/* Structure Elements */}
              <div className="mb-3">
                <h5 className="text-[9px] font-medium text-slate-400 uppercase mb-1">Structure</h5>
                <div className="space-y-1">
                  {VISUAL_ELEMENTS.filter(el => el.category === 'structure').map(el => {
                    const Icon = getElementIcon(el.icon);
                    return (
                      <div
                        key={el.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, el)}
                        className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] cursor-grab hover:border-slate-300 hover:shadow-sm hover:bg-white transition-all"
                      >
                        <Icon className="w-3 h-3 text-slate-500" />
                        {el.name}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Content Elements */}
              <div className="mb-3">
                <h5 className="text-[9px] font-medium text-slate-400 uppercase mb-1">Content</h5>
                <div className="space-y-1">
                  {VISUAL_ELEMENTS.filter(el => el.category === 'content').map(el => {
                    const Icon = getElementIcon(el.icon);
                    return (
                      <div
                        key={el.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, el)}
                        className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] cursor-grab hover:border-slate-300 hover:shadow-sm hover:bg-white transition-all"
                      >
                        <Icon className="w-3 h-3 text-slate-500" />
                        {el.name}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Data Elements */}
              <div>
                <h5 className="text-[9px] font-medium text-slate-400 uppercase mb-1">Data</h5>
                <div className="space-y-1">
                  {VISUAL_ELEMENTS.filter(el => el.category === 'data').map(el => {
                    const Icon = getElementIcon(el.icon);
                    return (
                      <div
                        key={el.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, el)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] cursor-grab hover:border-slate-300 hover:shadow-sm hover:bg-white transition-all ${
                          el.id === 'download-button' && !template.includeCSV ? 'opacity-50' : ''
                        }`}
                      >
                        <Icon className="w-3 h-3 text-slate-500" />
                        <span className="truncate">{el.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Designer Canvas */}
            <div
              className="flex-1 overflow-y-auto p-4"
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              onDrop={handleDropOnCanvas}
            >
              <div className="max-w-xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden min-h-[400px]">
                {(template.visualElements || []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[400px] text-slate-400 border-2 border-dashed border-slate-200 m-4 rounded-lg">
                    <LayoutTemplate className="w-10 h-10 mb-2 opacity-40" />
                    <p className="text-sm font-medium">Drag elements here</p>
                    <p className="text-xs mt-1 text-center px-4">Drop structure, content, and data elements to build your email</p>
                  </div>
                ) : (
                  (template.visualElements || []).map((element, index) => renderVisualElement(element, index))
                )}

                {/* Drop zone at the end */}
                {(template.visualElements || []).length > 0 && (
                  <div
                    onDragOver={(e) => handleDragOver(e, (template.visualElements || []).length)}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, (template.visualElements || []).length)}
                    className={`h-16 border-2 border-dashed m-4 rounded-lg flex items-center justify-center text-[10px] text-slate-400 transition-colors ${
                      dragOverIndex === (template.visualElements || []).length ? 'border-blue-400 bg-blue-50 text-blue-500' : 'border-slate-200'
                    }`}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Drop here to add at end
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* HTML Mode */}
        {rightPanelMode === 'html' && (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* HTML Editor */}
            <div className="flex-1 flex flex-col p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-500">HTML Template</label>
                <span className="text-[10px] text-slate-400">Use inline CSS for email compatibility</span>
              </div>
              <textarea
                value={template.html || ''}
                onChange={(e) => handleHtmlChange(e.target.value)}
                placeholder="<div>Your email HTML here...</div>"
                className="flex-1 w-full px-4 py-3 border rounded-lg text-xs font-mono resize-none bg-slate-900 text-green-400 border-slate-700"
                spellCheck={false}
              />
            </div>

            {/* Live Preview */}
            <div className="w-1/2 border-l border-slate-200 bg-slate-100 flex flex-col">
              <div className="flex items-center justify-between p-2 border-b border-slate-200 bg-white">
                <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  Live Preview
                </span>
                <div className="flex items-center bg-slate-100 rounded p-0.5">
                  <button
                    onClick={() => setPreviewMode('desktop')}
                    className={`p-1 rounded transition-colors ${
                      previewMode === 'desktop' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400'
                    }`}
                  >
                    <Monitor className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setPreviewMode('mobile')}
                    className={`p-1 rounded transition-colors ${
                      previewMode === 'mobile' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400'
                    }`}
                  >
                    <Smartphone className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-3">
                <div
                  className="mx-auto bg-white shadow rounded-lg overflow-hidden transition-all"
                  style={{ maxWidth: previewMode === 'mobile' ? '375px' : '600px' }}
                >
                  <div dangerouslySetInnerHTML={{ __html: processedHtml }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
