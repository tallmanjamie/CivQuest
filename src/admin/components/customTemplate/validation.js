// src/admin/components/customTemplate/validation.js
// Validation utilities for custom email templates

import { RESERVED_STAT_IDS, PLACEHOLDER_SECTIONS } from './constants';

/**
 * Validate a statistic ID
 * @param {string} id - The statistic ID to validate
 * @param {string[]} existingIds - Array of existing statistic IDs
 * @returns {string[]} Array of error messages (empty if valid)
 */
export const validateStatisticId = (id, existingIds = []) => {
  const errors = [];

  if (!id || id.trim() === '') {
    errors.push('ID is required');
    return errors;
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(id)) {
    errors.push('ID must start with a letter and contain only letters, numbers, and underscores');
  }

  if (id.length > 30) {
    errors.push('ID must be 30 characters or less');
  }

  if (existingIds.includes(id)) {
    errors.push('ID must be unique');
  }

  if (RESERVED_STAT_IDS.includes(id)) {
    errors.push('This ID is reserved');
  }

  return errors;
};

/**
 * Validate a hex color value
 * @param {string} color - The color value to validate
 * @returns {string|null} Error message or null if valid
 */
export const validateHexColor = (color) => {
  if (!color) return 'Color is required';
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return 'Must be a valid hex color (e.g., #004E7C)';
  }
  return null;
};

/**
 * Get all valid placeholder names including dynamic statistics
 * @param {object[]} statistics - Array of statistic definitions
 * @returns {string[]} Array of valid placeholder names
 */
export const getValidPlaceholderNames = (statistics = []) => {
  // Get all static placeholders
  const staticPlaceholders = PLACEHOLDER_SECTIONS.flatMap(section =>
    section.placeholders.map(p => p.name)
  );

  // Add dynamic statistic placeholders
  const statPlaceholders = statistics.flatMap(stat => [
    `stat_${stat.id}`,
    `stat_${stat.id}_value`,
    `stat_${stat.id}_label`
  ]);

  return [...staticPlaceholders, ...statPlaceholders];
};

/**
 * Validate HTML template
 * @param {string} html - The HTML template to validate
 * @param {string[]} validPlaceholders - Array of valid placeholder names
 * @returns {{ errors: string[], warnings: string[] }} Validation result
 */
export const validateHTMLTemplate = (html, validPlaceholders = []) => {
  const warnings = [];
  const errors = [];

  if (!html || html.trim() === '') {
    errors.push('Template HTML is required');
    return { errors, warnings };
  }

  // Check for unrecognized placeholders
  const placeholderRegex = /\{\{(\w+)\}\}/g;
  let match;
  while ((match = placeholderRegex.exec(html)) !== null) {
    if (!validPlaceholders.includes(match[1])) {
      warnings.push(`Unrecognized placeholder: {{${match[1]}}}`);
    }
  }

  // Check for basic HTML structure
  if (!html.includes('<div') && !html.includes('<table')) {
    warnings.push('Template should contain basic HTML structure');
  }

  // Check for non-inline styles (problematic for email)
  if (html.includes('<style>') || html.includes('<style ')) {
    warnings.push('Email clients may not support <style> tags. Use inline styles instead.');
  }

  // Check for class attributes (problematic for email)
  if (/class="[^"]*"/.test(html)) {
    warnings.push('Email clients may not support CSS classes. Use inline styles instead.');
  }

  return { errors, warnings };
};

/**
 * Validate a complete custom template configuration
 * @param {object} customTemplate - The custom template configuration
 * @param {object} notification - The parent notification configuration
 * @returns {{ isValid: boolean, errors: string[], warnings: string[] }} Validation result
 */
export const validateCustomTemplate = (customTemplate, notification = {}) => {
  const result = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (!customTemplate) {
    result.isValid = false;
    result.errors.push('Custom template configuration is missing');
    return result;
  }

  // Validate HTML
  const statistics = customTemplate.statistics || [];
  const validPlaceholders = getValidPlaceholderNames(statistics);
  const htmlValidation = validateHTMLTemplate(customTemplate.html, validPlaceholders);
  result.errors.push(...htmlValidation.errors);
  result.warnings.push(...htmlValidation.warnings);

  // Validate statistics
  const statIds = [];
  (customTemplate.statistics || []).forEach((stat, index) => {
    if (!stat.id) {
      result.errors.push(`Statistic ${index + 1}: ID is required`);
    } else {
      const idErrors = validateStatisticId(stat.id, statIds);
      idErrors.forEach(err => result.errors.push(`Statistic "${stat.id}": ${err}`));
      statIds.push(stat.id);
    }

    if (!stat.field) {
      result.errors.push(`Statistic "${stat.id || index + 1}": Field is required`);
    }

    if (!stat.operation) {
      result.errors.push(`Statistic "${stat.id || index + 1}": Operation is required`);
    }

    if (!stat.label) {
      result.warnings.push(`Statistic "${stat.id}": Label is recommended`);
    }
  });

  // Validate theme colors
  const theme = customTemplate.theme || {};
  const colorFields = ['primaryColor', 'secondaryColor', 'accentColor', 'textColor', 'mutedTextColor', 'backgroundColor', 'borderColor'];

  colorFields.forEach(field => {
    if (theme[field]) {
      const colorError = validateHexColor(theme[field]);
      if (colorError) {
        result.errors.push(`Theme ${field}: ${colorError}`);
      }
    }
  });

  result.isValid = result.errors.length === 0;
  return result;
};

/**
 * Generate sample context for preview
 * @param {object} notification - The notification configuration
 * @param {object} customTemplate - The custom template configuration
 * @param {object} locality - The organization/locality data
 * @param {object} options - Additional options
 * @returns {object} Sample context for template rendering
 */
export const generateSampleContext = (notification = {}, customTemplate = {}, locality = {}, options = {}) => {
  const { mockRecordCount = 42 } = options;
  const theme = customTemplate.theme || {};

  // Generate mock statistics values
  const statValues = {};
  (customTemplate.statistics || []).forEach(stat => {
    const mockValue = stat.operation === 'count' ? mockRecordCount :
                      stat.operation === 'sum' ? 1234567 :
                      stat.operation === 'mean' ? 45678.90 :
                      stat.operation === 'min' ? 12000 :
                      stat.operation === 'max' ? 890000 :
                      stat.operation === 'median' ? 156000 :
                      stat.operation === 'distinct' ? 8 :
                      'Sample Value';

    statValues[`stat_${stat.id}`] = formatStatValue(mockValue, stat.format);
    statValues[`stat_${stat.id}_value`] = mockValue;
    statValues[`stat_${stat.id}_label`] = stat.label || stat.id;
  });

  // Generate statistics HTML
  const statisticsHtml = generateStatisticsHtml(customTemplate.statistics || [], statValues, theme);

  return {
    // Organization & Notification
    organizationName: locality.name || 'Sample Organization',
    organizationId: locality.id || 'sample_org',
    notificationName: notification.name || 'Sample Notification',
    notificationId: notification.id || 'sample_notification',

    // Record Data
    recordCount: String(mockRecordCount),
    dataTable: generateSampleDataTable(notification.source?.displayFields || [], theme),
    moreRecordsMessage: mockRecordCount > 10
      ? `<p style="font-style: italic; color: ${theme.mutedTextColor || '#666'}; margin-top: 15px; font-size: 13px;">Showing first 10 of ${mockRecordCount} records. Download the CSV to see all data.</p>`
      : '',

    // Date Range
    dateRangeStart: '01/15/2025',
    dateRangeEnd: '01/31/2025',
    dateRangeStartTime: '01/15/2025 08:00',
    dateRangeEndTime: '01/31/2025 17:00',

    // Downloads
    downloadButton: customTemplate.includeCSV !== false
      ? `<div style="margin: 20px 0;"><a href="#" style="display: inline-block; background-color: ${theme.primaryColor || '#004E7C'}; color: white; padding: 12px 24px; text-decoration: none; border-radius: ${theme.borderRadius || '4px'}; font-weight: bold;">Download Full CSV Report</a></div>`
      : '',
    downloadUrl: 'https://storage.googleapis.com/sample/file.csv',

    // Statistics
    statisticsHtml,
    ...statValues,

    // Theme colors
    primaryColor: theme.primaryColor || '#004E7C',
    secondaryColor: theme.secondaryColor || '#f2f2f2',
    accentColor: theme.accentColor || '#0077B6',
    textColor: theme.textColor || '#333333',
    mutedTextColor: theme.mutedTextColor || '#666666',
    backgroundColor: theme.backgroundColor || '#ffffff',
    borderColor: theme.borderColor || '#dddddd',
    fontFamily: theme.fontFamily || 'Arial, sans-serif',

    // Custom Text
    emailIntro: notification.message?.intro || '<p style="margin: 0 0 15px 0; color: #444;">Here is your notification summary with the latest data.</p>',
    emailZeroStateMessage: notification.emailZeroStateMessage || 'No new records found for this period.'
  };
};

/**
 * Format a statistic value based on format options
 */
function formatStatValue(value, formatOptions = {}) {
  if (value === null || value === undefined) {
    return formatOptions.nullValue || '-';
  }

  const { format = 'auto', decimals, prefix = '', suffix = '', currency = 'USD', locale = 'en-US', thousandsSeparator = true } = formatOptions;

  if (format === 'currency') {
    try {
      const formatted = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: decimals ?? 0,
        maximumFractionDigits: decimals ?? 0
      }).format(value);
      return prefix + formatted + suffix;
    } catch {
      return prefix + '$' + value.toLocaleString(locale) + suffix;
    }
  }

  if (format === 'percent') {
    const percentValue = value * 100;
    return prefix + percentValue.toFixed(decimals ?? 2) + '%' + suffix;
  }

  if (format === 'number' || format === 'auto') {
    if (typeof value === 'number') {
      const formattedNumber = thousandsSeparator
        ? value.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : value.toFixed(decimals);
      return prefix + formattedNumber + suffix;
    }
  }

  return prefix + String(value) + suffix;
}

/**
 * Generate HTML for statistics cards
 */
function generateStatisticsHtml(statistics, statValues, theme) {
  if (!statistics || statistics.length === 0) return '';

  const primaryColor = theme.primaryColor || '#004E7C';
  const secondaryColor = theme.secondaryColor || '#f2f2f2';
  const mutedTextColor = theme.mutedTextColor || '#666666';

  const cards = statistics.map(stat => {
    const value = statValues[`stat_${stat.id}`] || '-';
    const label = stat.label || stat.id;

    return `<td style="width: ${100 / statistics.length}%; padding: 10px; text-align: center; vertical-align: top;">
      <div style="background: white; padding: 15px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <p style="margin: 0; font-size: 11px; color: ${mutedTextColor}; text-transform: uppercase; letter-spacing: 0.5px;">${label}</p>
        <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: bold; color: ${primaryColor};">${value}</p>
      </div>
    </td>`;
  }).join('');

  return `<div style="padding: 15px 0; margin-bottom: 15px;">
    <table style="width: 100%; border-collapse: collapse; background-color: ${secondaryColor}; border-radius: 8px;">
      <tr>${cards}</tr>
    </table>
  </div>`;
}

/**
 * Generate sample data table HTML
 */
function generateSampleDataTable(displayFields, theme) {
  const fields = displayFields.length > 0
    ? displayFields.slice(0, 3)
    : [{ field: 'Address', label: 'Address' }, { field: 'Value', label: 'Value' }, { field: 'Date', label: 'Date' }];

  const secondaryColor = theme.secondaryColor || '#f2f2f2';
  const borderColor = theme.borderColor || '#dddddd';

  const headerCells = fields.map(f => {
    const label = typeof f === 'string' ? f : (f.label || f.field);
    return `<th style="text-align: left; padding: 10px 8px; background-color: ${secondaryColor}; border-bottom: 2px solid ${borderColor};">${label}</th>`;
  }).join('');

  const sampleRows = [
    ['123 Main Street', '$450,000', '01/15/2025'],
    ['456 Oak Avenue', '$325,000', '01/14/2025'],
    ['789 Elm Drive', '$550,000', '01/13/2025']
  ];

  const bodyRows = sampleRows.map(row => {
    const cells = fields.map((_, i) =>
      `<td style="padding: 10px 8px; border-bottom: 1px solid ${borderColor};">${row[i] || '-'}</td>`
    ).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `<table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>`;
}
