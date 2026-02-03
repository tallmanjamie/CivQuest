// src/admin/components/EmailTemplateEditor.jsx
// Modal editor for creating and editing email templates
// Provides live preview, placeholder documentation, and template categories
//
// Templates support custom HTML with {{placeholders}} for dynamic content
// Now includes visual drag-and-drop builder and feature service connection
// Right panel has Designer mode (drag-and-drop) and HTML mode (raw code)

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Save,
  Eye,
  EyeOff,
  Code,
  FileText,
  Info,
  Copy,
  Check,
  Sparkles,
  LayoutTemplate,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Database,
  Search,
  Loader2,
  GripVertical,
  Type,
  Image,
  Table,
  Download,
  BarChart3,
  Columns,
  Trash2,
  Plus,
  Settings,
  Palette,
  FileDown,
  ToggleLeft,
  ToggleRight,
  Layers,
  Monitor,
  Smartphone,
  RefreshCw,
  MousePointer2,
  Move
} from 'lucide-react';
import ServiceFinder from './ServiceFinder';

// Available placeholder documentation
const PLACEHOLDERS = [
  { key: 'organizationName', desc: 'Name of the organization', example: 'One South Realty' },
  { key: 'organizationId', desc: 'ID of the organization', example: 'one_south_realty' },
  { key: 'notificationName', desc: 'Name of the notification', example: 'Daily Market Report' },
  { key: 'notificationId', desc: 'ID of the notification', example: 'daily_market_report' },
  { key: 'recordCount', desc: 'Number of records found', example: '1686' },
  { key: 'dateRangeStart', desc: 'Start date (MM/DD/YYYY)', example: '01/01/2026' },
  { key: 'dateRangeEnd', desc: 'End date (MM/DD/YYYY)', example: '01/31/2026' },
  { key: 'dateRangeStartTime', desc: 'Start date with time', example: '01/01/2026 00:00' },
  { key: 'dateRangeEndTime', desc: 'End date with time', example: '01/31/2026 23:59' },
  { key: 'dataTable', desc: 'Pre-built HTML table of records (first 10)', example: '<table>...</table>' },
  { key: 'downloadButton', desc: 'Pre-built download button HTML', example: '<a href="#">Download</a>' },
  { key: 'downloadUrl', desc: 'Raw URL to CSV download', example: 'https://storage.googleapis.com/...' },
  { key: 'moreRecordsMessage', desc: 'Message if more records exist', example: 'Showing first 10 of 100 records' },
  { key: 'emailIntro', desc: 'Custom intro text from notification config', example: 'Here is your report...' },
  { key: 'emailZeroStateMessage', desc: 'Message when no records found', example: 'No records match your criteria' }
];

// Template categories
const CATEGORIES = [
  { id: 'general', label: 'General', desc: 'Generic notification template' },
  { id: 'real-estate', label: 'Real Estate', desc: 'Property and market reports' },
  { id: 'public-safety', label: 'Public Safety', desc: 'Incident and safety alerts' },
  { id: 'permits', label: 'Permits & Planning', desc: 'Permit and development notifications' },
  { id: 'utilities', label: 'Utilities', desc: 'Service and utility updates' },
  { id: 'statistics', label: 'Statistics', desc: 'Data summaries and analytics' }
];

// Starter templates
const STARTER_TEMPLATES = {
  basic: {
    name: 'Basic',
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #004E7C; color: white; padding: 20px; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">{{organizationName}}</h1>
    <h2 style="margin: 5px 0 0 0; font-weight: normal; font-size: 16px;">{{notificationName}}</h2>
  </div>

  <div style="padding: 20px;">
    <p style="color: #666; margin: 0 0 15px 0;">
      <strong>Period:</strong> {{dateRangeStart}} to {{dateRangeEnd}}<br>
      <strong>Records:</strong> {{recordCount}}
    </p>

    {{emailIntro}}

    {{downloadButton}}

    {{dataTable}}

    {{moreRecordsMessage}}
  </div>

  <div style="padding: 15px; background-color: #f5f5f5; text-align: center; font-size: 12px; color: #888;">
    You are receiving this because you subscribed at CivQuest Notify.
  </div>
</div>`
  },
  statistics: {
    name: 'Statistics Report',
    html: `<div style="font-family: Georgia, serif; max-width: 650px; margin: 0 auto; background-color: #ffffff;">
  <!-- Header -->
  <div style="background-color: #1a1a2e; color: white; padding: 25px; text-align: center;">
    <h1 style="margin: 0; font-size: 28px; letter-spacing: 1px;">{{notificationName}}</h1>
    <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.8;">{{organizationName}} | {{dateRangeEnd}}</p>
  </div>

  <!-- Statistics Grid -->
  <div style="padding: 20px; background-color: #f8f9fa;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="width: 50%; padding: 10px; text-align: center; vertical-align: top;">
          <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase;">Total Records</p>
            <p style="margin: 5px 0 0 0; font-size: 36px; font-weight: bold; color: #004E7C;">{{recordCount}}</p>
          </div>
        </td>
        <td style="width: 50%; padding: 10px; text-align: center; vertical-align: top;">
          <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase;">Reporting Period</p>
            <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #333;">{{dateRangeStart}} - {{dateRangeEnd}}</p>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Content Section -->
  <div style="padding: 25px;">
    <h2 style="margin: 0 0 15px 0; font-size: 20px; color: #333; border-bottom: 2px solid #004E7C; padding-bottom: 10px;">Summary</h2>

    {{emailIntro}}

    {{downloadButton}}

    <h3 style="margin: 25px 0 15px 0; font-size: 16px; color: #666;">Recent Records</h3>
    {{dataTable}}

    {{moreRecordsMessage}}
  </div>

  <!-- Footer -->
  <div style="padding: 20px; background-color: #1a1a2e; text-align: center;">
    <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.6);">
      Delivered by CivQuest Notify | {{organizationName}}
    </p>
  </div>
</div>`
  },
  marketReport: {
    name: 'Market Report',
    html: `<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0;">
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #004E7C 0%, #002d4a 100%); color: white; padding: 20px;">
    <table style="width: 100%;">
      <tr>
        <td style="vertical-align: middle;">
          <p style="margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8;">Daily Market Report</p>
          <h1 style="margin: 5px 0 0 0; font-size: 24px;">{{organizationName}}</h1>
        </td>
        <td style="text-align: right; vertical-align: middle;">
          <p style="margin: 0; font-size: 14px; opacity: 0.9;">{{dateRangeEnd}}</p>
        </td>
      </tr>
    </table>
  </div>

  <!-- Key Metrics -->
  <div style="padding: 20px; background-color: #f5f7fa;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="width: 33%; padding: 15px; text-align: center; background: white; border-radius: 8px 0 0 8px;">
          <p style="margin: 0; color: #666; font-size: 11px; text-transform: uppercase;">New Listings</p>
          <p style="margin: 5px 0 0 0; font-size: 28px; font-weight: bold; color: #004E7C;">{{recordCount}}</p>
        </td>
        <td style="width: 33%; padding: 15px; text-align: center; background: white; border-left: 1px solid #eee; border-right: 1px solid #eee;">
          <p style="margin: 0; color: #666; font-size: 11px; text-transform: uppercase;">Period</p>
          <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold; color: #333;">{{dateRangeStart}}</p>
          <p style="margin: 2px 0 0 0; font-size: 14px; font-weight: bold; color: #333;">{{dateRangeEnd}}</p>
        </td>
        <td style="width: 33%; padding: 15px; text-align: center; background: white; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; color: #666; font-size: 11px; text-transform: uppercase;">Status</p>
          <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold; color: #27ae60;">Active</p>
        </td>
      </tr>
    </table>
  </div>

  <!-- Content -->
  <div style="padding: 25px;">
    {{emailIntro}}

    <div style="margin: 20px 0;">
      {{downloadButton}}
    </div>

    <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">
      Latest Entries
    </h3>

    {{dataTable}}

    {{moreRecordsMessage}}
  </div>

  <!-- Footer -->
  <div style="padding: 15px 25px; background-color: #f5f7fa; border-top: 1px solid #e0e0e0;">
    <table style="width: 100%;">
      <tr>
        <td style="font-size: 11px; color: #888;">
          {{organizationName}} | Powered by CivQuest Notify
        </td>
        <td style="text-align: right; font-size: 11px; color: #888;">
          Report ID: {{notificationId}}
        </td>
      </tr>
    </table>
  </div>
</div>`
  },
  minimal: {
    name: 'Minimal',
    html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <div style="padding: 30px 20px; border-bottom: 3px solid #004E7C;">
    <h1 style="margin: 0; font-size: 22px; font-weight: 600;">{{notificationName}}</h1>
    <p style="margin: 8px 0 0 0; font-size: 14px; color: #666;">{{organizationName}} &bull; {{dateRangeStart}} - {{dateRangeEnd}}</p>
  </div>

  <div style="padding: 30px 20px;">
    <p style="margin: 0 0 20px 0; font-size: 32px; font-weight: 700; color: #004E7C;">{{recordCount}} <span style="font-size: 16px; font-weight: 400; color: #666;">records</span></p>

    {{emailIntro}}

    {{downloadButton}}

    {{dataTable}}

    {{moreRecordsMessage}}
  </div>

  <div style="padding: 20px; background: #f9f9f9; font-size: 12px; color: #888; text-align: center;">
    CivQuest Notify
  </div>
</div>`
  }
};

// Visual Builder Element Types
const VISUAL_ELEMENTS = [
  {
    id: 'header',
    name: 'Header',
    icon: 'LayoutTemplate',
    category: 'structure',
    defaultContent: {
      type: 'header',
      bgColor: '#004E7C',
      textColor: '#ffffff',
      title: '{{organizationName}}',
      subtitle: '{{notificationName}}',
      padding: '20px'
    }
  },
  {
    id: 'text',
    name: 'Text Block',
    icon: 'Type',
    category: 'content',
    defaultContent: {
      type: 'text',
      content: '{{emailIntro}}',
      fontSize: '14px',
      color: '#444444',
      padding: '15px 20px'
    }
  },
  {
    id: 'statistic',
    name: 'Statistic Card',
    icon: 'BarChart3',
    category: 'content',
    defaultContent: {
      type: 'statistic',
      label: 'Total Records',
      value: '{{recordCount}}',
      bgColor: '#f8f9fa',
      valueColor: '#004E7C',
      labelColor: '#666666'
    }
  },
  {
    id: 'statistics-row',
    name: 'Statistics Row',
    icon: 'Columns',
    category: 'content',
    defaultContent: {
      type: 'statistics-row',
      stats: [
        { label: 'Records', value: '{{recordCount}}' },
        { label: 'Period', value: '{{dateRangeStart}} - {{dateRangeEnd}}' }
      ],
      bgColor: '#f8f9fa'
    }
  },
  {
    id: 'datatable',
    name: 'Data Table',
    icon: 'Table',
    category: 'data',
    defaultContent: {
      type: 'datatable',
      placeholder: '{{dataTable}}',
      headerBgColor: '#f2f2f2',
      headerTextColor: '#333333',
      borderColor: '#dddddd'
    }
  },
  {
    id: 'download-button',
    name: 'Download Button',
    icon: 'Download',
    category: 'data',
    defaultContent: {
      type: 'download-button',
      text: 'Download Full CSV Report',
      bgColor: '#004E7C',
      textColor: '#ffffff',
      borderRadius: '5px'
    }
  },
  {
    id: 'divider',
    name: 'Divider',
    icon: 'Columns',
    category: 'structure',
    defaultContent: {
      type: 'divider',
      color: '#eeeeee',
      thickness: '1px',
      margin: '20px 0'
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
      bgColor: '#f5f5f5',
      textColor: '#888888',
      text: 'You are receiving this because you subscribed at CivQuest Notify.',
      padding: '15px 20px',
      fontSize: '12px'
    }
  },
  {
    id: 'date-info',
    name: 'Date Info',
    icon: 'Info',
    category: 'content',
    defaultContent: {
      type: 'date-info',
      format: 'Period: {{dateRangeStart}} to {{dateRangeEnd}}',
      color: '#666666',
      fontSize: '14px'
    }
  },
  {
    id: 'more-records',
    name: 'More Records Message',
    icon: 'Info',
    category: 'data',
    defaultContent: {
      type: 'more-records',
      placeholder: '{{moreRecordsMessage}}',
      color: '#666666',
      fontStyle: 'italic'
    }
  }
];

// Configuration for the proxy service
const ARCGIS_PROXY_URL = window.ARCGIS_PROXY_URL || 'https://api.civ.quest';

/**
 * EmailTemplateEditor Component
 *
 * Modal for editing email template HTML with live preview
 * Now includes visual drag-and-drop builder and feature service connection
 *
 * Props:
 * @param {object} template - The template object to edit
 * @param {function} onClose - Called when modal is closed
 * @param {function} onSave - Called with updated template when saved
 * @param {string} accentColor - Theme accent color
 */
export default function EmailTemplateEditor({
  template,
  onClose,
  onSave,
  accentColor = '#004E7C'
}) {
  const [formData, setFormData] = useState({
    ...template,
    html: template.html || STARTER_TEMPLATES.basic.html,
    csvExportEnabled: template.csvExportEnabled !== false, // Default to true
    featureServiceUrl: template.featureServiceUrl || '',
    featureServiceCredentials: template.featureServiceCredentials || { username: '', password: '' },
    visualElements: template.visualElements || []
  });
  const [showPlaceholders, setShowPlaceholders] = useState(true);
  const [copiedPlaceholder, setCopiedPlaceholder] = useState(null);
  const [errors, setErrors] = useState({});

  // Right panel mode: 'designer' (drag-and-drop) or 'html' (raw code)
  const [rightPanelMode, setRightPanelMode] = useState('designer');

  // Preview mode: 'desktop' or 'mobile'
  const [previewMode, setPreviewMode] = useState('desktop');

  // Show preview overlay in designer mode
  const [showPreviewOverlay, setShowPreviewOverlay] = useState(false);

  // Feature Service State
  const [showServiceFinder, setShowServiceFinder] = useState(false);
  const [isLoadingServiceData, setIsLoadingServiceData] = useState(false);
  const [serviceFields, setServiceFields] = useState([]);
  const [sampleServiceData, setSampleServiceData] = useState([]);
  const [serviceError, setServiceError] = useState(null);
  const [liveDataRecordCount, setLiveDataRecordCount] = useState(null);

  // Drag and drop state
  const [draggedElement, setDraggedElement] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [selectedElementIndex, setSelectedElementIndex] = useState(null);
  const dragCounter = useRef(0);

  // Sample data for preview
  const sampleData = {
    organizationName: 'One South Realty',
    organizationId: 'one_south_realty',
    notificationName: 'Daily Market Report',
    notificationId: 'daily_market_report',
    recordCount: '1686',
    dateRangeStart: '01/01/2026',
    dateRangeEnd: '01/31/2026',
    dateRangeStartTime: '01/01/2026 00:00',
    dateRangeEndTime: '01/31/2026 23:59',
    emailIntro: '<p style="margin: 0 0 15px 0; color: #444;">Here is your daily market summary with the latest property listings and statistics for your area.</p>',
    emailZeroStateMessage: 'No new records found for this period.',
    downloadButton: `<div style="margin: 20px 0;"><a href="#" style="display: inline-block; background-color: ${accentColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Download Full CSV Report</a></div>`,
    downloadUrl: 'https://storage.googleapis.com/reports/sample.csv',
    dataTable: `<table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
      <thead>
        <tr>
          <th style="text-align: left; padding: 10px 8px; background-color: #f2f2f2; border-bottom: 2px solid #ddd;">Address</th>
          <th style="text-align: left; padding: 10px 8px; background-color: #f2f2f2; border-bottom: 2px solid #ddd;">Price</th>
          <th style="text-align: left; padding: 10px 8px; background-color: #f2f2f2; border-bottom: 2px solid #ddd;">Date</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">123 Main Street</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">$450,000</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">01/15/2026</td></tr>
        <tr><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">456 Oak Avenue</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">$325,000</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">01/14/2026</td></tr>
        <tr><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">789 Elm Drive</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">$550,000</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">01/13/2026</td></tr>
      </tbody>
    </table>`,
    moreRecordsMessage: '<p style="font-style: italic; color: #666; margin-top: 15px; font-size: 13px;">Showing first 3 of 1686 records. Download the CSV to see all data.</p>'
  };

  // Process template HTML with sample data (including service data if available)
  const getPreviewSampleData = useCallback(() => {
    const base = { ...sampleData };

    // If we have service data, use it for the data table preview
    if (sampleServiceData.length > 0 && serviceFields.length > 0) {
      const displayFields = serviceFields.slice(0, 3); // Show first 3 fields
      const tableHtml = `<table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
        <thead>
          <tr>
            ${displayFields.map(f => `<th style="text-align: left; padding: 10px 8px; background-color: #f2f2f2; border-bottom: 2px solid #ddd;">${f}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${sampleServiceData.slice(0, 5).map(row => `<tr>${displayFields.map(f => `<td style="padding: 10px 8px; border-bottom: 1px solid #eee;">${row[f] ?? ''}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>`;
      base.dataTable = tableHtml;
      // Use actual record count from service if available
      base.recordCount = liveDataRecordCount !== null ? String(liveDataRecordCount) : String(sampleServiceData.length);
      // Update more records message with actual count
      const actualCount = liveDataRecordCount !== null ? liveDataRecordCount : sampleServiceData.length;
      if (actualCount > 5) {
        base.moreRecordsMessage = `<p style="font-style: italic; color: #666; margin-top: 15px; font-size: 13px;">Showing first 5 of ${actualCount} records. Download the CSV to see all data.</p>`;
      } else {
        base.moreRecordsMessage = '';
      }
    }

    return base;
  }, [sampleData, sampleServiceData, serviceFields, liveDataRecordCount]);

  const processedHtml = formData.html?.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const previewData = getPreviewSampleData();
    return previewData[key] || match;
  }) || '';

  // Feature Service Functions
  const handleServiceSelected = (serviceData) => {
    setFormData(prev => ({
      ...prev,
      featureServiceUrl: serviceData.url,
      featureServiceCredentials: {
        username: serviceData.username || '',
        password: serviceData.password || ''
      }
    }));
    setShowServiceFinder(false);

    // Auto-fetch data from the service
    setTimeout(() => {
      fetchServiceData(serviceData.url, serviceData.username, serviceData.password);
    }, 100);
  };

  const fetchServiceData = async (url = formData.featureServiceUrl, username = formData.featureServiceCredentials?.username, password = formData.featureServiceCredentials?.password) => {
    if (!url) return;

    setIsLoadingServiceData(true);
    setServiceError(null);

    try {
      // First, get metadata
      const metadataRes = await fetch(`${ARCGIS_PROXY_URL}/arcgis/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceUrl: url,
          ...(username && password ? { username, password } : {})
        })
      });

      if (!metadataRes.ok) throw new Error('Failed to fetch service metadata');

      const metadata = await metadataRes.json();
      const fields = (metadata.fields || []).map(f => f.name);
      setServiceFields(fields);

      // Get total record count
      const baseUrl = url.replace(/\/$/, '');

      const countRes = await fetch(`${ARCGIS_PROXY_URL}/arcgis/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceUrl: baseUrl,
          where: '1=1',
          returnCountOnly: true,
          f: 'json',
          ...(username && password ? { username, password } : {})
        })
      });

      if (countRes.ok) {
        const countData = await countRes.json();
        setLiveDataRecordCount(countData.count || 0);
      }

      // Then, get sample data (first 10 records)
      const dataRes = await fetch(`${ARCGIS_PROXY_URL}/arcgis/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceUrl: baseUrl,
          where: '1=1',
          outFields: '*',
          resultRecordCount: 10,
          f: 'json',
          ...(username && password ? { username, password } : {})
        })
      });

      if (!dataRes.ok) throw new Error('Failed to fetch sample data');

      const data = await dataRes.json();
      const records = (data.features || []).map(f => f.attributes || {});
      setSampleServiceData(records);

    } catch (err) {
      console.error('Service data fetch error:', err);
      setServiceError(err.message);
    } finally {
      setIsLoadingServiceData(false);
    }
  };

  // Auto-fetch service data on mount if URL exists
  useEffect(() => {
    if (formData.featureServiceUrl) {
      fetchServiceData();
    }
  }, []);

  // Visual Builder Functions
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

    setFormData(prev => {
      const newElements = [...prev.visualElements];

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

      return { ...prev, visualElements: newElements };
    });

    setDraggedElement(null);
  };

  const handleDropOnCanvas = (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOverIndex(null);

    if (!draggedElement) return;

    const { element, sourceIndex } = draggedElement;

    if (sourceIndex === null) {
      // Adding new element at the end
      const newElement = {
        id: `${element.id}_${Date.now()}`,
        ...element.defaultContent
      };
      setFormData(prev => ({
        ...prev,
        visualElements: [...prev.visualElements, newElement]
      }));
    }

    setDraggedElement(null);
  };

  const removeElement = (index) => {
    setFormData(prev => ({
      ...prev,
      visualElements: prev.visualElements.filter((_, i) => i !== index)
    }));
  };

  const updateElement = (index, updates) => {
    setFormData(prev => ({
      ...prev,
      visualElements: prev.visualElements.map((el, i) =>
        i === index ? { ...el, ...updates } : el
      )
    }));
  };

  // Convert visual elements to HTML
  const visualElementsToHtml = useCallback(() => {
    if (formData.visualElements.length === 0) return '';

    const elements = formData.visualElements;
    let html = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">\n';

    elements.forEach(el => {
      switch (el.type) {
        case 'header':
          html += `  <div style="background-color: ${el.bgColor}; color: ${el.textColor}; padding: ${el.padding}; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">${el.title}</h1>
    <h2 style="margin: 5px 0 0 0; font-weight: normal; font-size: 16px;">${el.subtitle}</h2>
  </div>\n`;
          break;
        case 'text':
          html += `  <div style="padding: ${el.padding}; font-size: ${el.fontSize}; color: ${el.color};">${el.content}</div>\n`;
          break;
        case 'statistic':
          html += `  <div style="padding: 20px; background-color: ${el.bgColor}; text-align: center;">
    <p style="margin: 0; font-size: 12px; color: ${el.labelColor}; text-transform: uppercase;">${el.label}</p>
    <p style="margin: 5px 0 0 0; font-size: 36px; font-weight: bold; color: ${el.valueColor};">${el.value}</p>
  </div>\n`;
          break;
        case 'statistics-row':
          html += `  <div style="padding: 20px; background-color: ${el.bgColor};">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        ${el.stats.map(stat => `<td style="width: ${100/el.stats.length}%; padding: 10px; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase;">${stat.label}</p>
          <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #004E7C;">${stat.value}</p>
        </td>`).join('')}
      </tr>
    </table>
  </div>\n`;
          break;
        case 'datatable':
          html += `  <div style="padding: 20px;">${el.placeholder}</div>\n`;
          break;
        case 'download-button':
          if (formData.csvExportEnabled) {
            html += `  <div style="padding: 20px; text-align: center;">
    <a href="{{downloadUrl}}" style="display: inline-block; background-color: ${el.bgColor}; color: ${el.textColor}; padding: 12px 24px; text-decoration: none; border-radius: ${el.borderRadius}; font-weight: bold;">${el.text}</a>
  </div>\n`;
          }
          break;
        case 'divider':
          html += `  <hr style="border: none; border-top: ${el.thickness} solid ${el.color}; margin: ${el.margin};" />\n`;
          break;
        case 'spacer':
          html += `  <div style="height: ${el.height};"></div>\n`;
          break;
        case 'footer':
          html += `  <div style="padding: ${el.padding}; background-color: ${el.bgColor}; text-align: center; font-size: ${el.fontSize}; color: ${el.textColor};">${el.text}</div>\n`;
          break;
        case 'date-info':
          html += `  <p style="margin: 0; padding: 10px 20px; font-size: ${el.fontSize}; color: ${el.color};">${el.format}</p>\n`;
          break;
        case 'more-records':
          html += `  <div style="padding: 10px 20px; font-size: 13px; color: ${el.color}; font-style: ${el.fontStyle};">${el.placeholder}</div>\n`;
          break;
      }
    });

    html += '</div>';
    return html;
  }, [formData.visualElements, formData.csvExportEnabled]);

  // Sync visual elements to HTML when in designer mode
  useEffect(() => {
    if (rightPanelMode === 'designer' && formData.visualElements.length > 0) {
      const generatedHtml = visualElementsToHtml();
      if (generatedHtml) {
        setFormData(prev => ({ ...prev, html: generatedHtml }));
      }
    }
  }, [formData.visualElements, rightPanelMode, visualElementsToHtml]);

  // Handle form changes
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
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

  // Insert placeholder at cursor position in textarea
  const insertPlaceholder = (key) => {
    const textarea = document.getElementById('html-editor');
    if (!textarea) return;

    const placeholder = `{{${key}}}`;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newHtml = formData.html.substring(0, start) + placeholder + formData.html.substring(end);

    handleChange('html', newHtml);

    // Restore cursor position after the inserted placeholder
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 0);
  };

  // Apply starter template
  const applyStarterTemplate = (templateKey) => {
    const starter = STARTER_TEMPLATES[templateKey];
    if (starter) {
      handleChange('html', starter.html);
    }
  };

  // Validate form
  const validate = () => {
    const newErrors = {};
    if (!formData.name?.trim()) {
      newErrors.name = 'Template name is required';
    }
    // Check for HTML content if in HTML mode, or visual elements if in designer mode
    if (rightPanelMode === 'html' && !formData.html?.trim()) {
      newErrors.html = 'Template HTML is required';
    }
    if (rightPanelMode === 'designer' && formData.visualElements.length === 0) {
      newErrors.visual = 'Add at least one element to the template';
    }
    // Also validate that we have some content (either HTML or visual elements)
    if (!formData.html?.trim() && formData.visualElements.length === 0) {
      newErrors.html = 'Template HTML is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = () => {
    if (!validate()) return;
    // Ensure HTML is generated from visual elements before saving if we have visual elements
    if (formData.visualElements.length > 0) {
      const generatedHtml = visualElementsToHtml();
      onSave({ ...formData, html: generatedHtml });
    } else {
      onSave(formData);
    }
  };

  // Render visual element for the canvas
  const renderVisualElement = (element, index) => {
    const previewData = getPreviewSampleData();

    const processContent = (content) => {
      if (typeof content !== 'string') return content;
      return content.replace(/\{\{(\w+)\}\}/g, (match, key) => previewData[key] || match);
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
          <div style={{ backgroundColor: element.bgColor, color: element.textColor, padding: element.padding, textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '24px' }}>{processContent(element.title)}</h1>
            <h2 style={{ margin: '5px 0 0 0', fontWeight: 'normal', fontSize: '16px' }}>{processContent(element.subtitle)}</h2>
          </div>
        )}

        {element.type === 'text' && (
          <div style={{ padding: element.padding, fontSize: element.fontSize, color: element.color }} dangerouslySetInnerHTML={{ __html: processContent(element.content) }} />
        )}

        {element.type === 'statistic' && (
          <div style={{ padding: '20px', backgroundColor: element.bgColor, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '12px', color: element.labelColor, textTransform: 'uppercase' }}>{element.label}</p>
            <p style={{ margin: '5px 0 0 0', fontSize: '36px', fontWeight: 'bold', color: element.valueColor }}>{processContent(element.value)}</p>
          </div>
        )}

        {element.type === 'statistics-row' && (
          <div style={{ padding: '20px', backgroundColor: element.bgColor }}>
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${element.stats.length}, 1fr)` }}>
              {element.stats.map((stat, i) => (
                <div key={i} style={{ textAlign: 'center', padding: '10px' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>{stat.label}</p>
                  <p style={{ margin: '5px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#004E7C' }}>{processContent(stat.value)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {element.type === 'datatable' && (
          <div style={{ padding: '20px' }} dangerouslySetInnerHTML={{ __html: processContent(element.placeholder) }} />
        )}

        {element.type === 'download-button' && formData.csvExportEnabled && (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <a href="#" style={{ display: 'inline-block', backgroundColor: element.bgColor, color: element.textColor, padding: '12px 24px', textDecoration: 'none', borderRadius: element.borderRadius, fontWeight: 'bold' }}>{element.text}</a>
          </div>
        )}

        {element.type === 'download-button' && !formData.csvExportEnabled && (
          <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>
            <span className="text-xs text-slate-500 italic">Download button hidden (CSV export disabled)</span>
          </div>
        )}

        {element.type === 'divider' && (
          <hr style={{ border: 'none', borderTop: `${element.thickness} solid ${element.color}`, margin: element.margin }} />
        )}

        {element.type === 'spacer' && (
          <div style={{ height: element.height, backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="text-xs text-slate-400">Spacer ({element.height})</span>
          </div>
        )}

        {element.type === 'footer' && (
          <div style={{ padding: element.padding, backgroundColor: element.bgColor, textAlign: 'center', fontSize: element.fontSize, color: element.textColor }}>{element.text}</div>
        )}

        {element.type === 'date-info' && (
          <p style={{ margin: 0, padding: '10px 20px', fontSize: element.fontSize, color: element.color }}>{processContent(element.format)}</p>
        )}

        {element.type === 'more-records' && (
          <div style={{ padding: '10px 20px', fontSize: '13px', color: element.color, fontStyle: element.fontStyle }} dangerouslySetInnerHTML={{ __html: processContent(element.placeholder) }} />
        )}
      </div>
    );
  };

  // Get icon component for visual element
  const getElementIcon = (iconName) => {
    const icons = { LayoutTemplate, Type, BarChart3, Columns, Table, Download, FileText, Info };
    return icons[iconName] || FileText;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      {/* Service Finder Modal */}
      {showServiceFinder && (
        <ServiceFinder
          isOpen={showServiceFinder}
          onClose={() => setShowServiceFinder(false)}
          onSelect={handleServiceSelected}
        />
      )}

      {/* Preview Overlay Modal */}
      {showPreviewOverlay && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5" style={{ color: accentColor }} />
                <div>
                  <h4 className="font-bold text-slate-800">Template Preview</h4>
                  <p className="text-xs text-slate-500">
                    {liveDataRecordCount !== null
                      ? `Rendered with ${liveDataRecordCount.toLocaleString()} records from connected service`
                      : 'Rendered with sample data'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Desktop/Mobile Toggle */}
                <div className="flex items-center bg-slate-100 rounded p-0.5">
                  <button
                    onClick={() => setPreviewMode('desktop')}
                    className={`p-1.5 rounded transition-colors ${
                      previewMode === 'desktop'
                        ? 'bg-white shadow-sm text-slate-700'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                    title="Desktop view"
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
                    title="Mobile view"
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => setShowPreviewOverlay(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
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

      <div className="bg-white rounded-xl shadow-xl w-full max-w-7xl h-[95vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <LayoutTemplate className="w-5 h-5" style={{ color: accentColor }} />
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {template.isNew ? 'New Email Template' : 'Edit Email Template'}
              </h3>
              <p className="text-xs text-slate-500">Configure template settings on the left, design your email on the right</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Preview Button */}
            <button
              onClick={() => setShowPreviewOverlay(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* Left Panel - Configuration */}
          <div className="w-80 flex flex-col border-r border-slate-200 bg-slate-50 shrink-0">
            {/* Scrollable Configuration */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Basic Info Section */}
              <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <FileText className="w-4 h-4" style={{ color: accentColor }} />
                  Template Info
                </h4>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Template Name *
                  </label>
                  <input
                    value={formData.name || ''}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Daily Market Report"
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      errors.name ? 'border-red-300 bg-red-50' : 'border-slate-200'
                    }`}
                  />
                  {errors.name && (
                    <p className="text-xs text-red-500 mt-1">{errors.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category || 'general'}
                    onChange={(e) => handleChange('category', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Custom email template for daily market reports"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                    rows={2}
                  />
                </div>
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive !== false}
                      onChange={(e) => handleChange('isActive', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-slate-700">Template is active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.csvExportEnabled !== false}
                      onChange={(e) => handleChange('csvExportEnabled', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-slate-700 flex items-center gap-1.5">
                      <FileDown className="w-4 h-4 text-slate-400" />
                      Include CSV export
                    </span>
                  </label>
                </div>
              </div>

              {/* Starter Templates Section */}
              <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: accentColor }} />
                  Starter Templates
                </h4>
                <p className="text-xs text-slate-500">
                  Start from a pre-built template to save time
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(STARTER_TEMPLATES).map(([key, starter]) => (
                    <button
                      key={key}
                      onClick={() => applyStarterTemplate(key)}
                      className="px-3 py-2 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors text-left"
                    >
                      {starter.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Data Source Section (Collapsible) */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setShowPlaceholders(!showPlaceholders)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2">
                    <Database className="w-4 h-4" style={{ color: accentColor }} />
                    Live Data Preview
                    {sampleServiceData.length > 0 && (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full">
                        Connected
                      </span>
                    )}
                  </span>
                  {showPlaceholders ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                {showPlaceholders && (
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500 pt-3">
                      Connect a feature service to preview with real data.
                    </p>

                    {/* Service URL Display */}
                    <div className="space-y-2">
                      <input
                        value={formData.featureServiceUrl || ''}
                        onChange={(e) => handleChange('featureServiceUrl', e.target.value)}
                        placeholder="No service connected..."
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-slate-50"
                        readOnly
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowServiceFinder(true)}
                          className="flex-1 px-3 py-2 text-white rounded-lg text-xs flex items-center justify-center gap-1.5"
                          style={{ backgroundColor: accentColor }}
                        >
                          <Search className="w-3.5 h-3.5" />
                          Find Service
                        </button>
                        {formData.featureServiceUrl && (
                          <button
                            onClick={() => fetchServiceData()}
                            disabled={isLoadingServiceData}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-xs flex items-center gap-1.5 hover:bg-slate-50"
                          >
                            {isLoadingServiceData ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Service Status */}
                    {isLoadingServiceData && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Loading data...
                      </div>
                    )}

                    {serviceError && (
                      <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {serviceError}
                      </div>
                    )}

                    {sampleServiceData.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-700">
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5" />
                          <span className="font-medium">Connected!</span>
                        </div>
                        <p className="mt-1 text-green-600">
                          {liveDataRecordCount !== null ? liveDataRecordCount.toLocaleString() : sampleServiceData.length} records, {serviceFields.length} fields
                        </p>
                      </div>
                    )}

                    {/* Available Fields Preview */}
                    {serviceFields.length > 0 && (
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Fields:</label>
                        <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto p-2 bg-slate-50 rounded border text-[10px]">
                          {serviceFields.slice(0, 10).map(field => (
                            <span key={field} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono">
                              {field}
                            </span>
                          ))}
                          {serviceFields.length > 10 && (
                            <span className="px-1.5 py-0.5 text-slate-400">+{serviceFields.length - 10}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Placeholders Reference */}
              <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Code className="w-4 h-4" style={{ color: accentColor }} />
                  Available Placeholders
                </h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {PLACEHOLDERS.map(p => (
                    <button
                      key={p.key}
                      onClick={() => {
                        if (rightPanelMode === 'html') {
                          insertPlaceholder(p.key);
                        } else {
                          copyPlaceholder(p.key);
                        }
                      }}
                      className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-left bg-slate-50 rounded transition-colors hover:bg-slate-100 group"
                      title={`${p.desc}\nExample: ${p.example}`}
                    >
                      <span className="font-mono text-slate-700">{`{{${p.key}}}`}</span>
                      {copiedPlaceholder === p.key ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-400 group-hover:text-slate-600" />
                      )}
                    </button>
                  ))}
                </div>
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                      rightPanelMode === 'designer'
                        ? 'bg-white shadow-sm text-slate-800'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <MousePointer2 className="w-4 h-4" />
                    Designer
                  </button>
                  <button
                    onClick={() => setRightPanelMode('html')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                      rightPanelMode === 'html'
                        ? 'bg-white shadow-sm text-slate-800'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Code className="w-4 h-4" />
                    HTML
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {rightPanelMode === 'designer' && (
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Move className="w-3 h-3" />
                    Drag elements to reorder
                  </span>
                )}
                {liveDataRecordCount !== null && (
                  <span className="flex items-center gap-1 text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                    <Database className="w-3 h-3" />
                    Live: {liveDataRecordCount.toLocaleString()} records
                  </span>
                )}
              </div>
            </div>

            {/* Designer Mode */}
            {rightPanelMode === 'designer' && (
              <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* Element Palette */}
                <div className="w-44 border-r border-slate-200 p-3 overflow-y-auto bg-white shrink-0">
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Elements</h4>

                  {/* Structure Elements */}
                  <div className="mb-3">
                    <h5 className="text-[10px] font-medium text-slate-400 uppercase mb-1">Structure</h5>
                    <div className="space-y-1">
                      {VISUAL_ELEMENTS.filter(el => el.category === 'structure').map(el => {
                        const Icon = getElementIcon(el.icon);
                        return (
                          <div
                            key={el.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, el)}
                            className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs cursor-grab hover:border-slate-300 hover:shadow-sm hover:bg-white transition-all"
                          >
                            <Icon className="w-3.5 h-3.5 text-slate-500" />
                            {el.name}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Content Elements */}
                  <div className="mb-3">
                    <h5 className="text-[10px] font-medium text-slate-400 uppercase mb-1">Content</h5>
                    <div className="space-y-1">
                      {VISUAL_ELEMENTS.filter(el => el.category === 'content').map(el => {
                        const Icon = getElementIcon(el.icon);
                        return (
                          <div
                            key={el.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, el)}
                            className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs cursor-grab hover:border-slate-300 hover:shadow-sm hover:bg-white transition-all"
                          >
                            <Icon className="w-3.5 h-3.5 text-slate-500" />
                            {el.name}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Data Elements */}
                  <div>
                    <h5 className="text-[10px] font-medium text-slate-400 uppercase mb-1">Data</h5>
                    <div className="space-y-1">
                      {VISUAL_ELEMENTS.filter(el => el.category === 'data').map(el => {
                        const Icon = getElementIcon(el.icon);
                        return (
                          <div
                            key={el.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, el)}
                            className={`flex items-center gap-2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs cursor-grab hover:border-slate-300 hover:shadow-sm hover:bg-white transition-all ${el.id === 'download-button' && !formData.csvExportEnabled ? 'opacity-50' : ''}`}
                          >
                            <Icon className="w-3.5 h-3.5 text-slate-500" />
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
                  <div className="max-w-xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden min-h-[500px]">
                    {formData.visualElements.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-[500px] text-slate-400 border-2 border-dashed border-slate-200 m-4 rounded-lg">
                        <Layers className="w-12 h-12 mb-3 opacity-40" />
                        <p className="text-sm font-medium">Drag elements here to build your template</p>
                        <p className="text-xs mt-1 text-center px-4">Drop structure, content, and data elements to create your email</p>
                      </div>
                    ) : (
                      formData.visualElements.map((element, index) => renderVisualElement(element, index))
                    )}

                    {/* Drop zone at the end */}
                    {formData.visualElements.length > 0 && (
                      <div
                        onDragOver={(e) => handleDragOver(e, formData.visualElements.length)}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, formData.visualElements.length)}
                        className={`h-20 border-2 border-dashed m-4 rounded-lg flex items-center justify-center text-xs text-slate-400 transition-colors ${
                          dragOverIndex === formData.visualElements.length ? 'border-blue-400 bg-blue-50 text-blue-500' : 'border-slate-200'
                        }`}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Drop here to add at the end
                      </div>
                    )}
                  </div>

                  {errors.visual && (
                    <p className="text-xs text-red-500 mt-2 text-center">{errors.visual}</p>
                  )}
                </div>
              </div>
            )}

            {/* HTML Mode */}
            {rightPanelMode === 'html' && (
              <div className="flex-1 flex flex-col min-h-0 p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-slate-500">
                    HTML Template
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Use inline CSS for email compatibility
                  </span>
                </div>
                <textarea
                  id="html-editor"
                  value={formData.html || ''}
                  onChange={(e) => handleChange('html', e.target.value)}
                  placeholder="<div>Your email HTML here...</div>"
                  className={`flex-1 w-full px-4 py-3 border rounded-lg text-xs font-mono resize-none bg-slate-900 text-green-400 ${
                    errors.html ? 'border-red-300' : 'border-slate-700'
                  }`}
                  spellCheck={false}
                />
                {errors.html && (
                  <p className="text-xs text-red-500 mt-1">{errors.html}</p>
                )}
                {!formData.csvExportEnabled && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-200">
                    <AlertCircle className="w-3 h-3" />
                    CSV export is disabled - download button placeholders will not render
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 flex justify-between items-center shrink-0 bg-white">
          <p className="text-xs text-slate-400">
            Template ID: <code className="font-mono">{formData.id}</code>
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-white rounded-lg text-sm font-medium flex items-center gap-2"
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
