// src/admin/components/customTemplate/constants.js
// Constants and default values for the custom email template designer

/**
 * Default theme configuration
 */
export const DEFAULT_THEME = {
  primaryColor: '#004E7C',
  secondaryColor: '#f2f2f2',
  accentColor: '#0077B6',
  textColor: '#333333',
  mutedTextColor: '#666666',
  backgroundColor: '#ffffff',
  borderColor: '#dddddd',
  fontFamily: 'Arial, sans-serif',
  fontSize: '14px',
  headerFontSize: '24px',
  subHeaderFontSize: '16px',
  borderRadius: '4px'
};

/**
 * Default custom template starter HTML
 */
export const DEFAULT_CUSTOM_TEMPLATE_HTML = `<div style="font-family: {{fontFamily}}; color: {{textColor}}; max-width: 600px; margin: 0 auto;">
  <!-- Header -->
  <div style="background-color: {{primaryColor}}; padding: 20px; color: white; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">{{organizationName}}</h1>
    <p style="margin: 5px 0 0 0; opacity: 0.9;">{{notificationName}}</p>
  </div>

  <!-- Body -->
  <div style="padding: 25px; border: 1px solid {{borderColor}}; border-top: none; background-color: {{backgroundColor}};">

    <!-- Date Range -->
    <p style="color: {{mutedTextColor}}; font-size: 13px; margin-bottom: 20px;">
      <strong>Reporting Period:</strong> {{dateRangeStart}} - {{dateRangeEnd}}
    </p>

    <!-- Statistics (if configured) -->
    {{statisticsHtml}}

    <!-- Summary -->
    <p style="font-size: 16px; margin: 20px 0;">
      We found <strong>{{recordCount}}</strong> new records matching your subscription.
    </p>

    <!-- Download Button -->
    {{downloadButton}}

    <!-- Data Table -->
    {{dataTable}}

    {{moreRecordsMessage}}

    <!-- Footer -->
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid {{borderColor}}; font-size: 12px; color: {{mutedTextColor}};">
      <p>You are receiving this because you subscribed to notifications.</p>
      <p><a href="#" style="color: {{accentColor}};">Manage Preferences</a></p>
    </div>
  </div>
</div>`;

/**
 * Available statistical operations
 */
export const STAT_OPERATIONS = [
  { value: 'sum', label: 'Sum', description: 'Total of all values', requiresNumeric: true },
  { value: 'mean', label: 'Mean (Average)', description: 'Arithmetic average', requiresNumeric: true },
  { value: 'min', label: 'Minimum', description: 'Smallest value', requiresNumeric: true },
  { value: 'max', label: 'Maximum', description: 'Largest value', requiresNumeric: true },
  { value: 'median', label: 'Median', description: 'Middle value', requiresNumeric: true },
  { value: 'count', label: 'Count', description: 'Number of non-empty values', requiresNumeric: false },
  { value: 'distinct', label: 'Distinct Count', description: 'Number of unique values', requiresNumeric: false },
  { value: 'first', label: 'First', description: 'First value in results', requiresNumeric: false },
  { value: 'last', label: 'Last', description: 'Last value in results', requiresNumeric: false }
];

/**
 * Format type options for statistics and display fields
 */
export const FORMAT_TYPE_OPTIONS = [
  { value: 'auto', label: 'Auto-detect', description: 'Automatically determine formatting' },
  { value: 'text', label: 'Text', description: 'Display as plain text' },
  { value: 'number', label: 'Number', description: 'Numeric with optional decimals' },
  { value: 'currency', label: 'Currency', description: 'Monetary value (e.g., $1,234.56)' },
  { value: 'percent', label: 'Percentage', description: 'Percentage (0.15 → 15%)' },
  { value: 'date', label: 'Date', description: 'Date/time formatting' }
];

/**
 * Currency options
 */
export const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD - US Dollar', symbol: '$' },
  { value: 'EUR', label: 'EUR - Euro', symbol: '€' },
  { value: 'GBP', label: 'GBP - British Pound', symbol: '£' },
  { value: 'CAD', label: 'CAD - Canadian Dollar', symbol: 'CA$' },
  { value: 'AUD', label: 'AUD - Australian Dollar', symbol: 'A$' },
  { value: 'JPY', label: 'JPY - Japanese Yen', symbol: '¥' },
  { value: 'CNY', label: 'CNY - Chinese Yuan', symbol: '¥' },
  { value: 'INR', label: 'INR - Indian Rupee', symbol: '₹' },
  { value: 'MXN', label: 'MXN - Mexican Peso', symbol: 'MX$' },
  { value: 'BRL', label: 'BRL - Brazilian Real', symbol: 'R$' }
];

/**
 * Date format presets
 */
export const DATE_FORMAT_PRESETS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', example: '01/15/2025' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '15/01/2025' },
  { value: 'MMMM D, YYYY', label: 'Full Date', example: 'January 15, 2025' },
  { value: 'MMM D, YYYY', label: 'Abbreviated', example: 'Jan 15, 2025' },
  { value: 'MMMM YYYY', label: 'Month Year', example: 'January 2025' },
  { value: 'MMM YYYY', label: 'Short Month Year', example: 'Jan 2025' },
  { value: 'YYYY-MM-DD', label: 'ISO Format', example: '2025-01-15' },
  { value: 'dddd, MMMM D', label: 'Day and Date', example: 'Wednesday, January 15' }
];

/**
 * Font family options
 */
export const FONT_FAMILY_OPTIONS = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Times New Roman, serif', label: 'Times New Roman' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: 'Trebuchet MS, sans-serif', label: 'Trebuchet MS' },
  { value: 'Courier New, monospace', label: 'Courier New' },
  { value: 'Tahoma, sans-serif', label: 'Tahoma' }
];

/**
 * Font size options
 */
export const FONT_SIZE_OPTIONS = [
  { value: '12px', label: '12px' },
  { value: '13px', label: '13px' },
  { value: '14px', label: '14px' },
  { value: '15px', label: '15px' },
  { value: '16px', label: '16px' },
  { value: '18px', label: '18px' }
];

/**
 * Header font size options
 */
export const HEADER_FONT_SIZE_OPTIONS = [
  { value: '20px', label: '20px' },
  { value: '22px', label: '22px' },
  { value: '24px', label: '24px' },
  { value: '26px', label: '26px' },
  { value: '28px', label: '28px' },
  { value: '30px', label: '30px' }
];

/**
 * Subheader font size options
 */
export const SUBHEADER_FONT_SIZE_OPTIONS = [
  { value: '14px', label: '14px' },
  { value: '15px', label: '15px' },
  { value: '16px', label: '16px' },
  { value: '17px', label: '17px' },
  { value: '18px', label: '18px' },
  { value: '20px', label: '20px' }
];

/**
 * Border radius options
 */
export const BORDER_RADIUS_OPTIONS = [
  { value: '0px', label: '0px (Square)' },
  { value: '2px', label: '2px' },
  { value: '4px', label: '4px' },
  { value: '6px', label: '6px' },
  { value: '8px', label: '8px' },
  { value: '12px', label: '12px' }
];

/**
 * Theme presets for quick selection
 */
export const THEME_PRESETS = [
  {
    name: 'Default Blue',
    theme: {
      primaryColor: '#004E7C',
      secondaryColor: '#f2f2f2',
      accentColor: '#0077B6',
      textColor: '#333333',
      mutedTextColor: '#666666',
      backgroundColor: '#ffffff',
      borderColor: '#dddddd'
    }
  },
  {
    name: 'Forest Green',
    theme: {
      primaryColor: '#2D5A3D',
      secondaryColor: '#E8F5E9',
      accentColor: '#4CAF50',
      textColor: '#1B5E20',
      mutedTextColor: '#558B2F',
      backgroundColor: '#ffffff',
      borderColor: '#C8E6C9'
    }
  },
  {
    name: 'Sunset Orange',
    theme: {
      primaryColor: '#E65100',
      secondaryColor: '#FFF3E0',
      accentColor: '#FF9800',
      textColor: '#BF360C',
      mutedTextColor: '#E65100',
      backgroundColor: '#ffffff',
      borderColor: '#FFCC80'
    }
  },
  {
    name: 'Royal Purple',
    theme: {
      primaryColor: '#4A148C',
      secondaryColor: '#F3E5F5',
      accentColor: '#9C27B0',
      textColor: '#4A148C',
      mutedTextColor: '#7B1FA2',
      backgroundColor: '#ffffff',
      borderColor: '#CE93D8'
    }
  },
  {
    name: 'Slate Gray',
    theme: {
      primaryColor: '#37474F',
      secondaryColor: '#ECEFF1',
      accentColor: '#607D8B',
      textColor: '#263238',
      mutedTextColor: '#546E7A',
      backgroundColor: '#ffffff',
      borderColor: '#B0BEC5'
    }
  }
];

/**
 * Placeholder sections for the reference panel
 */
export const PLACEHOLDER_SECTIONS = [
  {
    title: 'Organization & Notification',
    placeholders: [
      { name: 'organizationName', description: 'Organization display name', example: 'City of Springfield' },
      { name: 'organizationId', description: 'Organization ID', example: 'springfield_mo' },
      { name: 'notificationName', description: 'Notification display name', example: 'New Building Permits' },
      { name: 'notificationId', description: 'Notification ID', example: 'building_permits' }
    ]
  },
  {
    title: 'Record Data',
    placeholders: [
      { name: 'recordCount', description: 'Number of records found', example: '42' },
      { name: 'dataTable', description: 'Pre-built HTML table of first 10 records', example: '<table>...</table>' },
      { name: 'moreRecordsMessage', description: '"Showing X of Y" message if >10 records', example: 'Showing 10 of 42 records' }
    ]
  },
  {
    title: 'Date Range',
    placeholders: [
      { name: 'dateRangeStart', description: 'Start date (MM/DD/YYYY)', example: '01/15/2025' },
      { name: 'dateRangeEnd', description: 'End date (MM/DD/YYYY)', example: '01/31/2025' },
      { name: 'dateRangeStartTime', description: 'Start with time (MM/DD/YYYY HH:mm)', example: '01/15/2025 08:00' },
      { name: 'dateRangeEndTime', description: 'End with time (MM/DD/YYYY HH:mm)', example: '01/31/2025 17:00' }
    ]
  },
  {
    title: 'Downloads',
    placeholders: [
      { name: 'downloadButton', description: 'Pre-styled download button HTML', example: '<a>Download CSV</a>' },
      { name: 'downloadUrl', description: 'Raw CSV download URL', example: 'https://storage.../file.csv' }
    ]
  },
  {
    title: 'Statistics',
    dynamic: true,
    placeholders: [
      { name: 'statisticsHtml', description: 'Pre-built statistics cards display', example: '<div>...</div>' }
    ]
  },
  {
    title: 'Theme Colors',
    placeholders: [
      { name: 'primaryColor', description: 'Primary theme color', example: '#004E7C' },
      { name: 'secondaryColor', description: 'Secondary theme color', example: '#f2f2f2' },
      { name: 'accentColor', description: 'Accent color', example: '#0077B6' },
      { name: 'textColor', description: 'Text color', example: '#333333' },
      { name: 'mutedTextColor', description: 'Muted text color', example: '#666666' },
      { name: 'backgroundColor', description: 'Background color', example: '#ffffff' },
      { name: 'borderColor', description: 'Border color', example: '#dddddd' },
      { name: 'fontFamily', description: 'Font family', example: 'Arial, sans-serif' }
    ]
  },
  {
    title: 'Custom Text',
    placeholders: [
      { name: 'emailIntro', description: 'Custom intro text from basic settings', example: 'Here is your report...' },
      { name: 'emailZeroStateMessage', description: 'Message shown when 0 records found', example: 'No records found' }
    ]
  }
];

/**
 * Decimal places options
 */
export const DECIMAL_OPTIONS = [
  { value: 0, label: '0 (e.g., 1,234)' },
  { value: 1, label: '1 (e.g., 1,234.5)' },
  { value: 2, label: '2 (e.g., 1,234.56)' },
  { value: 3, label: '3 (e.g., 1,234.567)' },
  { value: 4, label: '4 (e.g., 1,234.5678)' }
];

/**
 * Reserved statistic IDs that cannot be used
 */
export const RESERVED_STAT_IDS = [
  'recordCount',
  'organizationName',
  'notificationName',
  'dateRangeStart',
  'dateRangeEnd',
  'dataTable',
  'downloadButton',
  'downloadUrl',
  'moreRecordsMessage',
  'emailIntro',
  'emailZeroStateMessage',
  'statisticsHtml'
];

/**
 * Maximum number of statistics per notification
 */
export const MAX_STATISTICS = 10;
