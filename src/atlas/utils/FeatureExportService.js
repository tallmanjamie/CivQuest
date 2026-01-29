// src/atlas/utils/FeatureExportService.js
// Feature Export Service - Multi-page PDF generation for feature exports
//
// Supports:
// - Feature export templates with custom elements and layout
// - Popup-based export using webmap popup elements with arcade expressions
// - Custom element ordering via customFeatureInfo.export.elements configuration
// - Dynamic page breaks based on content height
// - Optional map export integration at the end
//
// Uses jsPDF for PDF generation

import { jsPDF } from 'jspdf';

// Export DPI for print quality
const EXPORT_DPI = 150;

// Page sizes in inches
const PAGE_DIMENSIONS = {
  'letter-landscape': { width: 11, height: 8.5 },
  'letter-portrait': { width: 8.5, height: 11 },
  'legal-landscape': { width: 14, height: 8.5 },
  'legal-portrait': { width: 8.5, height: 14 },
  'tabloid-landscape': { width: 17, height: 11 },
  'tabloid-portrait': { width: 11, height: 17 },
  'a4-landscape': { width: 11.69, height: 8.27 },
  'a4-portrait': { width: 8.27, height: 11.69 },
  'a3-landscape': { width: 16.54, height: 11.69 },
  'a3-portrait': { width: 11.69, height: 16.54 }
};

// Default margins in inches
const DEFAULT_MARGINS = { top: 0.5, right: 0.5, bottom: 0.75, left: 0.5 };

// Row height in inches for attribute tables
const ROW_HEIGHT = 0.25;
const HEADER_HEIGHT = 0.35;

/**
 * Load an image and return a promise with the Image element
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * Format a date according to the specified format string
 */
function formatDate(format) {
  const now = new Date();
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const day = now.getDate();
  const month = now.getMonth();
  const year = now.getFullYear();

  return format
    .replace('MMMM', months[month])
    .replace('MMM', monthsShort[month])
    .replace('MM', String(month + 1).padStart(2, '0'))
    .replace('DD', String(day).padStart(2, '0'))
    .replace('D', String(day))
    .replace('YYYY', String(year))
    .replace('YY', String(year).slice(-2));
}

/**
 * Get feature title from attributes
 */
function getFeatureTitle(feature, tableColumns, searchFields) {
  const attrs = feature?.attributes || {};

  // Check displayName first
  if (attrs.displayName) return attrs.displayName;

  // Try common field names
  return attrs.title || attrs.TITLE || attrs.name || attrs.NAME ||
         attrs.ADDRESS || attrs.address || attrs.PROPERTYADDRESS ||
         attrs.PARCELID || 'Feature Details';
}

/**
 * Get display fields for a feature
 * Priority: chatResults fields from searchFields > tableColumns > auto-generate from attributes
 */
function getDisplayFields(feature, tableColumns = [], searchFields = []) {
  const attrs = feature?.attributes || {};

  // Check for searchFields with chatResults enabled
  const chatResultsFields = searchFields?.filter(sf => sf.chatResults === true) || [];

  if (chatResultsFields.length > 0) {
    return chatResultsFields
      .filter(sf => attrs[sf.field] != null)
      .map(sf => ({
        field: sf.field,
        label: sf.label || sf.field,
        value: attrs[sf.field]
      }));
  }

  // Fall back to tableColumns
  if (tableColumns && tableColumns.length > 0) {
    return tableColumns
      .filter(col => attrs[col.field] != null)
      .map(col => ({
        field: col.field,
        label: col.headerName || col.field,
        value: attrs[col.field]
      }));
  }

  // Auto-generate from attributes
  return Object.entries(attrs)
    .filter(([k, v]) =>
      !k.startsWith('_') &&
      v != null &&
      k !== 'OBJECTID' &&
      k !== 'Shape__Area' &&
      k !== 'Shape__Length' &&
      k !== 'displayName'
    )
    .map(([key, value]) => ({
      field: key,
      label: key.replace(/_/g, ' '),
      value
    }));
}

/**
 * Extract popup elements from webmap popup template
 * Returns array of popup content elements with their names and types
 * @param {object} feature - The feature with attributes
 * @param {object} sourceLayer - The source layer with popupTemplate
 * @param {object} customFeatureInfo - Custom feature info configuration
 * @returns {Array} Array of popup elements
 */
function getPopupElementsFromWebmap(feature, sourceLayer, customFeatureInfo = null) {
  const popupTemplate = sourceLayer?.popupTemplate || feature?.popupTemplate;

  if (!popupTemplate?.content) {
    return [];
  }

  // Get content array
  const contentArray = Array.isArray(popupTemplate.content)
    ? popupTemplate.content
    : [popupTemplate.content];

  // Extract elements with their identifying info
  const elements = contentArray.map((el, index) => {
    // Get element name for matching
    let name = '';
    if (el.type === 'expression' && el.expressionInfo) {
      name = el.expressionInfo.name || el.expressionInfo.title || `expression_${index}`;
    } else if (el.type === 'fields') {
      name = el.title || 'fields';
    } else if (el.type === 'text') {
      name = el.title || `text_${index}`;
    } else if (el.type === 'attachments') {
      name = 'attachments';
    } else if (el.type === 'media') {
      name = el.title || 'media';
    } else {
      name = el.title || el.type || `element_${index}`;
    }

    return {
      name,
      type: el.type,
      element: el,
      expressionInfo: el.expressionInfo || null,
      index
    };
  });

  // Check if we should filter/order by customFeatureInfo.export.elements
  const featureLayerId = feature?.sourceLayerId || sourceLayer?.id;
  const exportElements = customFeatureInfo?.export?.elements;
  const shouldUseExportOrder = customFeatureInfo?.layerId &&
                               featureLayerId === customFeatureInfo.layerId &&
                               exportElements &&
                               exportElements.length > 0;

  if (shouldUseExportOrder) {
    // Filter and order elements by the export elements configuration
    const orderedElements = [];
    for (const exportElementName of exportElements) {
      // Find matching element by name (case-insensitive partial match)
      const match = elements.find(el =>
        el.name.toLowerCase().includes(exportElementName.toLowerCase()) ||
        exportElementName.toLowerCase().includes(el.name.toLowerCase())
      );
      if (match && !orderedElements.includes(match)) {
        orderedElements.push(match);
      }
    }
    return orderedElements;
  }

  // Return all elements in original order
  return elements;
}

/**
 * Extract field values from an Arcade expression using the feature attributes
 * This is used as a fallback when Arcade evaluation fails
 * @param {string} expression - The Arcade expression
 * @param {object} attributes - The feature attributes
 * @returns {string} Extracted content from the expression
 */
function extractFieldValuesFromExpression(expression, attributes) {
  if (!expression || !attributes) return '';

  const results = [];

  // Match $feature.FIELDNAME or $feature["FIELDNAME"] patterns
  const dotPattern = /\$feature\.(\w+)/gi;
  const bracketPattern = /\$feature\["([^"]+)"\]/gi;
  const bracketPattern2 = /\$feature\['([^']+)'\]/gi;

  let match;
  const seenFields = new Set();

  // Extract dot notation fields
  while ((match = dotPattern.exec(expression)) !== null) {
    const fieldName = match[1];
    if (!seenFields.has(fieldName) && attributes[fieldName] != null) {
      seenFields.add(fieldName);
      results.push(String(attributes[fieldName]));
    }
  }

  // Extract bracket notation fields (double quotes)
  while ((match = bracketPattern.exec(expression)) !== null) {
    const fieldName = match[1];
    if (!seenFields.has(fieldName) && attributes[fieldName] != null) {
      seenFields.add(fieldName);
      results.push(String(attributes[fieldName]));
    }
  }

  // Extract bracket notation fields (single quotes)
  while ((match = bracketPattern2.exec(expression)) !== null) {
    const fieldName = match[1];
    if (!seenFields.has(fieldName) && attributes[fieldName] != null) {
      seenFields.add(fieldName);
      results.push(String(attributes[fieldName]));
    }
  }

  return results.join(' - ');
}

/**
 * Render popup content using ArcGIS Feature widget and capture the HTML
 * This properly evaluates Arcade expressions by using the full ArcGIS context
 * @param {object} feature - The feature with geometry and attributes
 * @param {object} sourceLayer - The source layer with popup template
 * @param {Array} filterElements - Optional array of element names to filter to specific tabs
 * @param {object} mapView - Optional map view for Arcade expression context
 * @returns {Promise<string>} Rendered HTML content
 */
async function renderPopupContentAsHtml(feature, sourceLayer, filterElements = null, mapView = null) {
  try {
    // Import ArcGIS modules dynamically
    const [Feature, Graphic] = await Promise.all([
      import('@arcgis/core/widgets/Feature').then(m => m.default),
      import('@arcgis/core/Graphic').then(m => m.default)
    ]);

    if (!Feature || !Graphic) {
      console.warn('[FeatureExport] Could not load ArcGIS Feature widget modules');
      return '';
    }

    // Create a proper graphic from the feature with geometry type
    let geometry = feature.geometry;
    if (geometry && typeof geometry === 'object' && !geometry.declaredClass) {
      geometry = { ...geometry };
      if (!geometry.type) {
        if (geometry.rings) geometry.type = 'polygon';
        else if (geometry.paths) geometry.type = 'polyline';
        else if (geometry.x !== undefined) geometry.type = 'point';
        else if (geometry.xmin !== undefined) geometry.type = 'extent';
        else if (geometry.points) geometry.type = 'multipoint';
      }
    }

    const graphic = new Graphic({
      geometry,
      attributes: feature.attributes || {},
      layer: sourceLayer
    });

    // Get the popup template
    const originalTemplate = sourceLayer?.popupTemplate || feature?.popupTemplate;
    if (!originalTemplate) {
      return '';
    }

    // Filter content if specific elements requested (for tab-based export)
    if (filterElements && filterElements.length > 0 && originalTemplate.content) {
      const contentArray = Array.isArray(originalTemplate.content)
        ? originalTemplate.content
        : [originalTemplate.content];

      const filteredContent = contentArray.filter(el => {
        const titleText = el.title || el.description || el.text || '';
        const expr = el.expressionInfo?.name || el.expressionInfo?.title || '';
        return filterElements.some(name =>
          titleText.toLowerCase().includes(name.toLowerCase()) ||
          expr.toLowerCase().includes(name.toLowerCase())
        );
      });

      graphic.popupTemplate = {
        title: originalTemplate.title,
        content: filteredContent,
        expressionInfos: originalTemplate.expressionInfos,
        fieldInfos: originalTemplate.fieldInfos
      };
    }

    // Create a temporary off-screen container
    const tempContainer = document.createElement('div');
    tempContainer.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:800px;';
    document.body.appendChild(tempContainer);

    // Create the Feature widget with map context for Arcade expression evaluation
    const featureWidgetOptions = {
      graphic,
      container: tempContainer
    };

    // Add map context if available - this is required for Arcade expressions
    // that use functions like FeatureSetByRelationshipName, FeatureSetByName, etc.
    if (mapView?.map) {
      featureWidgetOptions.map = mapView.map;
    }

    const featureWidget = new Feature(featureWidgetOptions);

    // Wait for the widget to render
    // The Feature widget needs time to evaluate Arcade expressions and render content
    await new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max

      const checkRendered = () => {
        attempts++;
        const content = tempContainer.querySelector('.esri-feature__content-element');
        const hasContent = content && content.innerHTML.trim().length > 0;

        if (hasContent || attempts >= maxAttempts) {
          resolve();
        } else {
          setTimeout(checkRendered, 100);
        }
      };

      setTimeout(checkRendered, 100);
    });

    // Extract the rendered HTML content
    const contentElement = tempContainer.querySelector('.esri-feature__content-element');
    let html = '';

    if (contentElement) {
      html = contentElement.innerHTML;
    } else {
      // Fallback: get all content from the feature widget
      const featureContent = tempContainer.querySelector('.esri-feature');
      if (featureContent) {
        // Remove the title element if present
        const titleEl = featureContent.querySelector('.esri-feature__title');
        if (titleEl) titleEl.remove();
        html = featureContent.innerHTML;
      }
    }

    // Clean up
    featureWidget.destroy();
    tempContainer.remove();

    return html;
  } catch (err) {
    console.warn('[FeatureExport] Error rendering popup content as HTML:', err);
    return '';
  }
}

/**
 * Evaluate arcade expression for a feature (fallback method)
 * Used when Feature widget rendering is not available
 * @param {object} expressionInfo - The expression info from popup template
 * @param {object} feature - The feature with geometry and attributes
 * @param {object} sourceLayer - The source layer
 * @returns {Promise<string>} Evaluated expression result as string
 */
async function evaluateArcadeExpression(expressionInfo, feature, sourceLayer) {
  if (!expressionInfo?.expression) {
    return '';
  }

  // Try to extract field values from the expression as the primary approach
  // This is more reliable than trying to execute complex Arcade expressions
  if (expressionInfo.expression && feature.attributes) {
    const extractedContent = extractFieldValuesFromExpression(
      expressionInfo.expression,
      feature.attributes
    );
    if (extractedContent) {
      return extractedContent;
    }
  }

  return '';
}

/**
 * Get evaluated popup content for export
 * Uses the ArcGIS Feature widget to render Arcade expressions as HTML
 * Then extracts the content organized by popup elements/tabs
 * @param {object} feature - The feature
 * @param {object} sourceLayer - The source layer with popup template
 * @param {object} customFeatureInfo - Custom feature info configuration
 * @param {object} mapView - Optional map view for Arcade expression context
 * @returns {Promise<Array>} Array of evaluated content sections
 */
async function getEvaluatedPopupContent(feature, sourceLayer, customFeatureInfo = null, mapView = null) {
  const popupElements = getPopupElementsFromWebmap(feature, sourceLayer, customFeatureInfo);

  // Helper function to create fallback content from raw attributes
  const createAttributeFallback = () => {
    if (!feature?.attributes) return [];

    const attrs = feature.attributes;
    const lines = [];

    for (const [key, value] of Object.entries(attrs)) {
      if (
        value != null &&
        !key.startsWith('_') &&
        key !== 'OBJECTID' &&
        key !== 'Shape__Area' &&
        key !== 'Shape__Length' &&
        key !== 'displayName' &&
        key !== 'GlobalID'
      ) {
        const label = key.replace(/_/g, ' ');
        lines.push(`<b>${label}:</b> ${formatValue(value)}`);
      }
    }

    if (lines.length > 0) {
      console.log('[FeatureExport] Using fallback attribute content:', lines.length, 'fields');
      return [{
        name: 'Feature Attributes',
        type: 'fields',
        content: lines.join('<br/>'),
        isHtml: true
      }];
    }
    return [];
  };

  // If no popup elements, try to create content from raw attributes
  if (popupElements.length === 0) {
    console.log('[FeatureExport] No popup elements found, trying attribute fallback');
    return createAttributeFallback();
  }

  // Check if we have any Arcade expression elements
  const hasArcadeExpressions = popupElements.some(el => el.type === 'expression');

  // If we have Arcade expressions, use the Feature widget to render them as HTML
  if (hasArcadeExpressions) {
    console.log('[FeatureExport] Using Feature widget to render Arcade expressions as HTML');
    if (!mapView?.map) {
      console.warn('[FeatureExport] No map context available - Arcade expressions may fail to evaluate');
    }

    const evaluatedContent = [];

    // Process each popup element - for expressions, render via Feature widget
    // For other types (text, fields), process directly
    for (const popupEl of popupElements) {
      const section = {
        name: popupEl.name,
        type: popupEl.type,
        content: '',
        isHtml: false
      };

      if (popupEl.type === 'expression') {
        // Use Feature widget to render this specific expression as HTML
        const renderedHtml = await renderPopupContentAsHtml(feature, sourceLayer, [popupEl.name], mapView);

        if (renderedHtml) {
          section.content = renderedHtml;
          section.isHtml = true;
          console.log(`[FeatureExport] Rendered expression "${popupEl.name}" as HTML:`, renderedHtml.length, 'chars');
        } else {
          // Fallback: try to extract field values from expression
          if (popupEl.expressionInfo?.expression && feature.attributes) {
            const extractedContent = extractFieldValuesFromExpression(
              popupEl.expressionInfo.expression,
              feature.attributes
            );
            if (extractedContent) {
              section.content = extractedContent;
              section.isHtml = false;
            }
          }
        }
      } else if (popupEl.type === 'text') {
        // Text content - may have attribute placeholders
        let text = popupEl.element.text || '';
        const attrs = feature.attributes || {};

        // Replace attribute placeholders {FIELD_NAME}
        text = text.replace(/\{([^}]+)\}/g, (match, fieldName) => {
          const value = attrs[fieldName];
          return value != null ? String(value) : '';
        });

        section.content = text;
        section.isHtml = /<[^>]+>/.test(text);
      } else if (popupEl.type === 'fields') {
        // Field list - convert to formatted content
        const fieldInfos = popupEl.element.fieldInfos || [];
        const attrs = feature.attributes || {};
        const lines = [];

        for (const fieldInfo of fieldInfos) {
          const fieldName = fieldInfo.fieldName;
          const label = fieldInfo.label || fieldName;
          const value = attrs[fieldName];
          if (value != null) {
            lines.push(`<b>${label}:</b> ${formatValue(value)}`);
          }
        }

        section.content = lines.join('<br/>');
        section.isHtml = true;
      }

      if (section.content) {
        evaluatedContent.push(section);
      }
    }

    // If we got content, return it
    if (evaluatedContent.length > 0) {
      return evaluatedContent;
    }

    // If individual element rendering failed, try rendering all content at once
    console.log('[FeatureExport] Individual expression rendering returned no content, trying full popup render');
    const fullHtml = await renderPopupContentAsHtml(feature, sourceLayer, null, mapView);
    if (fullHtml) {
      return [{
        name: 'Feature Information',
        type: 'html',
        content: fullHtml,
        isHtml: true
      }];
    }
  }

  // No Arcade expressions or Feature widget rendering failed - process normally
  const evaluatedContent = [];

  for (const popupEl of popupElements) {
    const section = {
      name: popupEl.name,
      type: popupEl.type,
      content: '',
      isHtml: false
    };

    if (popupEl.type === 'text') {
      // Text content - may have attribute placeholders
      let text = popupEl.element.text || '';
      const attrs = feature.attributes || {};

      // Replace attribute placeholders {FIELD_NAME}
      text = text.replace(/\{([^}]+)\}/g, (match, fieldName) => {
        const value = attrs[fieldName];
        return value != null ? String(value) : '';
      });

      section.content = text;
      section.isHtml = /<[^>]+>/.test(text);
    } else if (popupEl.type === 'fields') {
      // Field list - convert to formatted content
      const fieldInfos = popupEl.element.fieldInfos || [];
      const attrs = feature.attributes || {};
      const lines = [];

      for (const fieldInfo of fieldInfos) {
        const fieldName = fieldInfo.fieldName;
        const label = fieldInfo.label || fieldName;
        const value = attrs[fieldName];
        if (value != null) {
          lines.push(`<b>${label}:</b> ${formatValue(value)}`);
        }
      }

      section.content = lines.join('<br/>');
      section.isHtml = true;
    } else if (popupEl.type === 'expression' && popupEl.expressionInfo) {
      // Expression without Feature widget - try simple field extraction
      const result = await evaluateArcadeExpression(popupEl.expressionInfo, feature, sourceLayer);
      section.content = result;
      section.isHtml = /<[^>]+>/.test(result);
    }

    if (section.content) {
      evaluatedContent.push(section);
    }
  }

  // If no content was successfully evaluated, use the attribute fallback
  if (evaluatedContent.length === 0) {
    return createAttributeFallback();
  }

  return evaluatedContent;
}

/**
 * Extract fixed width from HTML content if specified in element styles
 * Looks for width or max-width styles like "width: 600px" or "max-width:600px"
 * Searches both root level and nested elements (tables, divs, etc.)
 * @param {string} htmlContent - HTML string content
 * @returns {number|null} Width in pixels if found, null otherwise
 */
function extractFixedWidthFromHtml(htmlContent) {
  if (!htmlContent) return null;

  // Helper to extract width value from a match
  const extractWidth = (match) => {
    if (match && match[1]) {
      const widthPx = parseFloat(match[1]);
      if (!isNaN(widthPx) && widthPx > 0) {
        return widthPx;
      }
    }
    return null;
  };

  // 1. First try root level (for backward compatibility)
  // Look for width in style attribute of the first/outermost element
  const rootStyleMatch = htmlContent.match(/^[\s]*<[^>]+style\s*=\s*["'][^"']*(?<!max-)width\s*:\s*(\d+(?:\.\d+)?)\s*px[^"']*["']/i);
  let width = extractWidth(rootStyleMatch);
  if (width) return width;

  // Check for max-width at root level
  const rootMaxWidthMatch = htmlContent.match(/^[\s]*<[^>]+style\s*=\s*["'][^"']*max-width\s*:\s*(\d+(?:\.\d+)?)\s*px[^"']*["']/i);
  width = extractWidth(rootMaxWidthMatch);
  if (width) return width;

  // Check for width attribute at root level (e.g., <table width="600">)
  const rootWidthAttrMatch = htmlContent.match(/^[\s]*<[^>]+width\s*=\s*["']?(\d+(?:\.\d+)?)(?:px)?["']?/i);
  width = extractWidth(rootWidthAttrMatch);
  if (width) return width;

  // 2. Search for width/max-width in any element's style (including nested tables)
  // This handles Arcade output where tables have max-width specified
  // Match pattern: style="...max-width: 500px..." or style="...width: 400px..."
  const allMaxWidthMatches = htmlContent.match(/style\s*=\s*["'][^"']*max-width\s*:\s*(\d+(?:\.\d+)?)\s*px[^"']*["']/gi);
  if (allMaxWidthMatches && allMaxWidthMatches.length > 0) {
    // Extract the value from the first match
    const firstMatch = allMaxWidthMatches[0].match(/max-width\s*:\s*(\d+(?:\.\d+)?)\s*px/i);
    width = extractWidth(firstMatch);
    if (width) return width;
  }

  // Check for explicit width (not max-width) in any element
  const allWidthMatches = htmlContent.match(/style\s*=\s*["'][^"']*(?<![a-z-])width\s*:\s*(\d+(?:\.\d+)?)\s*px[^"']*["']/gi);
  if (allWidthMatches && allWidthMatches.length > 0) {
    // Extract the value from the first match, ensuring it's not max-width
    for (const match of allWidthMatches) {
      // Skip if this is a max-width
      if (/max-width/i.test(match)) continue;
      const widthMatch = match.match(/(?<![a-z-])width\s*:\s*(\d+(?:\.\d+)?)\s*px/i);
      width = extractWidth(widthMatch);
      if (width) return width;
    }
  }

  // 3. Check for width attribute on any element (e.g., <table width="600">)
  const allWidthAttrMatches = htmlContent.match(/<[^>]+width\s*=\s*["']?(\d+(?:\.\d+)?)(?:px)?["']?/gi);
  if (allWidthAttrMatches && allWidthAttrMatches.length > 0) {
    const firstMatch = allWidthAttrMatches[0].match(/width\s*=\s*["']?(\d+(?:\.\d+)?)(?:px)?["']?/i);
    width = extractWidth(firstMatch);
    if (width) return width;
  }

  return null;
}

/**
 * Extract tables from HTML content and return structured table data
 * @param {string} htmlContent - HTML string content
 * @returns {{tables: Array, contentWithoutTables: string}} Extracted tables and remaining content
 */
function extractTablesFromHtml(htmlContent) {
  if (!htmlContent) return { tables: [], contentWithoutTables: '' };

  const tables = [];
  let contentWithoutTables = htmlContent;

  // Match table elements
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let match;

  while ((match = tableRegex.exec(htmlContent)) !== null) {
    const tableHtml = match[0];
    const tableContent = match[1];

    // Parse table rows
    const rows = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
      const rowContent = rowMatch[1];
      const cells = [];

      // Parse header cells (th)
      const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
      let thMatch;
      while ((thMatch = thRegex.exec(rowContent)) !== null) {
        cells.push({
          text: stripHtmlTags(thMatch[1]).trim(),
          isHeader: true
        });
      }

      // Parse data cells (td)
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let tdMatch;
      while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
        cells.push({
          text: stripHtmlTags(tdMatch[1]).trim(),
          isHeader: false
        });
      }

      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    if (rows.length > 0) {
      tables.push({
        rows,
        columnCount: Math.max(...rows.map(r => r.length))
      });

      // Mark table location in content for replacement
      contentWithoutTables = contentWithoutTables.replace(tableHtml, '\n[[TABLE_' + (tables.length - 1) + ']]\n');
    }
  }

  return { tables, contentWithoutTables };
}

/**
 * Strip HTML tags from text while preserving meaningful content
 * @param {string} html - HTML string
 * @returns {string} Plain text content
 */
function stripHtmlTags(html) {
  if (!html) return '';

  return html
    // Convert br to newline
    .replace(/<br\s*\/?>/gi, '\n')
    // Remove tags
    .replace(/<[^>]+>/g, '')
    // Decode entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse HTML content and extract text with line breaks
 * Handles common HTML elements and converts to structured text
 * Enhanced to handle Feature widget HTML output (Esri-specific classes, tables, etc.)
 * @param {string} htmlContent - HTML string content
 * @returns {{segments: Array<{text: string, style: object}>, tables: Array, fixedWidthPx: number|null}} Array of text segments with styles, tables, and optional fixed width
 */
function parseHtmlContent(htmlContent) {
  if (!htmlContent) return { segments: [], tables: [], fixedWidthPx: null };

  // Extract any fixed width specified in the HTML (e.g., from arcade output)
  const fixedWidthPx = extractFixedWidthFromHtml(htmlContent);

  // First extract tables to handle them separately
  const { tables, contentWithoutTables } = extractTablesFromHtml(htmlContent);

  const segments = [];

  // Pre-process Esri-specific HTML structures
  let content = contentWithoutTables;

  // Handle Esri field containers - convert to label: value format
  // Pattern: <div class="esri-feature__fields-item">...<span class="esri-feature__field-header">Label</span>...<span class="esri-feature__field-data">Value</span>...</div>
  content = content.replace(
    /<div[^>]*class="[^"]*esri-feature__fields-item[^"]*"[^>]*>[\s\S]*?<span[^>]*class="[^"]*esri-feature__field-header[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span[^>]*class="[^"]*esri-feature__field-data[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/div>/gi,
    '<b>$1:</b> $2\n'
  );

  // Handle headers
  content = content.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '\n[[BOLD_START]]$1[[BOLD_END]]\n');

  // Standard HTML parsing - handle common patterns
  content = content
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    // Handle block-level breaks
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    // Handle list items
    .replace(/<li[^>]*>/gi, '• ');

  // Replace bold tags with markers
  let processedContent = content;
  processedContent = processedContent.replace(/<b[^>]*>|<strong[^>]*>/gi, '[[BOLD_START]]');
  processedContent = processedContent.replace(/<\/b>|<\/strong>/gi, '[[BOLD_END]]');

  // Handle italic/emphasis
  processedContent = processedContent.replace(/<i[^>]*>|<em[^>]*>/gi, '[[ITALIC_START]]');
  processedContent = processedContent.replace(/<\/i>|<\/em>/gi, '[[ITALIC_END]]');

  // Remove remaining HTML tags (but preserve table markers)
  processedContent = processedContent.replace(/<(?!\[\[TABLE_)[^>]+>/g, '');

  // Decode common HTML entities
  processedContent = processedContent
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Clean up multiple consecutive newlines and spaces
  processedContent = processedContent.replace(/\n{3,}/g, '\n\n');
  processedContent = processedContent.replace(/[ \t]{2,}/g, ' ');

  // Remove italic markers for now (treat as normal text)
  processedContent = processedContent.replace(/\[\[ITALIC_START\]\]|\[\[ITALIC_END\]\]/g, '');

  // Split into lines
  const lines = processedContent.split('\n');

  for (const line of lines) {
    // Check for table placeholder
    const tableMatch = line.match(/\[\[TABLE_(\d+)\]\]/);
    if (tableMatch) {
      const tableIndex = parseInt(tableMatch[1], 10);
      segments.push({ text: '', style: { tableIndex } });
      continue;
    }

    if (!line.trim()) {
      segments.push({ text: '', style: { lineBreak: true } });
      continue;
    }

    // Process bold markers within line
    let remaining = line;
    let isBold = false;

    while (remaining.length > 0) {
      const boldStartIdx = remaining.indexOf('[[BOLD_START]]');
      const boldEndIdx = remaining.indexOf('[[BOLD_END]]');

      if (boldStartIdx === -1 && boldEndIdx === -1) {
        // No more markers
        if (remaining.trim()) {
          segments.push({ text: remaining, style: { bold: isBold } });
        }
        break;
      }

      if (boldStartIdx !== -1 && (boldEndIdx === -1 || boldStartIdx < boldEndIdx)) {
        // Bold start comes first
        const before = remaining.substring(0, boldStartIdx);
        if (before.trim()) {
          segments.push({ text: before, style: { bold: isBold } });
        }
        remaining = remaining.substring(boldStartIdx + 14); // length of [[BOLD_START]]
        isBold = true;
      } else if (boldEndIdx !== -1) {
        // Bold end comes first
        const before = remaining.substring(0, boldEndIdx);
        if (before.trim()) {
          segments.push({ text: before, style: { bold: isBold } });
        }
        remaining = remaining.substring(boldEndIdx + 12); // length of [[BOLD_END]]
        isBold = false;
      }
    }

    // Add line break after each line
    segments.push({ text: '', style: { lineBreak: true } });
  }

  return { segments, tables, fixedWidthPx };
}

/**
 * Calculate how many attribute rows can fit on a page
 */
function calculateRowsPerPage(pageDims, margins, headerHeight = 0, footerHeight = 0.5) {
  const availableHeight = pageDims.height - margins.top - margins.bottom - headerHeight - footerHeight;
  // Account for table header row
  const rowsPerPage = Math.floor((availableHeight - HEADER_HEIGHT) / ROW_HEIGHT);
  return Math.max(1, rowsPerPage);
}

/**
 * Create a fallback template from popup elements
 * This is used when no feature export template is configured
 */
function createFallbackTemplate(feature, tableColumns, searchFields) {
  const fields = getDisplayFields(feature, tableColumns, searchFields);
  const title = getFeatureTitle(feature, tableColumns, searchFields);

  return {
    id: 'fallback-template',
    name: 'Feature Export',
    pageSize: 'letter-portrait',
    backgroundColor: '#ffffff',
    elements: [
      {
        id: 'title-1',
        type: 'title',
        x: 0,
        y: 0,
        width: 100,
        height: 8,
        visible: true,
        content: {
          text: title,
          fontSize: 20,
          fontWeight: 'bold',
          align: 'center',
          backgroundColor: '#1e293b',
          color: '#ffffff'
        }
      },
      {
        id: 'date-1',
        type: 'date',
        x: 75,
        y: 2,
        width: 23,
        height: 4,
        visible: true,
        content: {
          format: 'MMMM D, YYYY',
          fontSize: 10,
          align: 'right',
          color: '#ffffff'
        }
      },
      {
        id: 'attributes-1',
        type: 'attributeData',
        x: 2,
        y: 10,
        width: 96,
        height: 80,
        visible: true,
        content: {
          style: 'table',
          showLabels: true,
          fontSize: 11,
          headerColor: '#f1f5f9',
          borderColor: '#e2e8f0'
        }
      },
      {
        id: 'pageNumber-1',
        type: 'pageNumber',
        x: 40,
        y: 95,
        width: 20,
        height: 3,
        visible: true,
        content: {
          format: 'Page {current} of {total}',
          fontSize: 9,
          align: 'center',
          color: '#666666'
        }
      }
    ],
    fields,
    mapExportTemplateId: null
  };
}

// Line height constants for popup content
const POPUP_LINE_HEIGHT = 0.22; // inches per line
const POPUP_SECTION_SPACING = 0.3; // inches between sections
const POPUP_SECTION_HEADER_HEIGHT = 0.35; // inches for section header
const POPUP_TABLE_ROW_HEIGHT = 0.22; // inches per table row
const POPUP_TABLE_HEADER_HEIGHT = 0.25; // inches for table header row

/**
 * Calculate layout for popup content across pages
 * Returns array of page layouts with sections and their starting positions
 * @param {Array} popupContent - Array of evaluated popup content sections
 * @param {number} availableHeight - Available height per page in inches
 * @param {object} pdf - jsPDF instance for text measurement
 * @param {number} contentWidth - Available width for content in inches
 * @returns {Array} Array of page layouts
 */
function calculatePopupContentLayout(popupContent, availableHeight, pdf, contentWidth) {
  const pages = [];
  let currentPage = { sections: [], usedHeight: 0 };

  // Standard web DPI for converting HTML pixel widths to inches
  const WEB_DPI = 96;

  for (const section of popupContent) {
    // Parse content to get text segments, tables, and any fixed width
    const parsed = section.isHtml
      ? parseHtmlContent(section.content)
      : { segments: [{ text: section.content, style: {} }], tables: [], fixedWidthPx: null };

    const { segments, tables, fixedWidthPx } = parsed;

    // Calculate effective width for this section
    // If HTML specifies a fixed width, convert to inches and use it (capped at available width)
    let effectiveWidth = contentWidth;
    let fixedWidthInches = null;
    if (fixedWidthPx && fixedWidthPx > 0) {
      fixedWidthInches = fixedWidthPx / WEB_DPI;
      // Use the HTML-specified width, but don't exceed available content width
      effectiveWidth = Math.min(fixedWidthInches, contentWidth);
    }

    // Calculate height needed for this section
    let sectionHeight = POPUP_SECTION_HEADER_HEIGHT; // Header

    // Calculate text height using effective width
    pdf.setFontSize(10 * 0.75);
    for (const segment of segments) {
      if (segment.style?.lineBreak) {
        sectionHeight += POPUP_LINE_HEIGHT * 0.5; // Half line for breaks
      } else if (segment.style?.tableIndex !== undefined) {
        // Calculate table height
        const table = tables[segment.style.tableIndex];
        if (table) {
          const hasHeader = table.rows.length > 0 && table.rows[0].some(c => c.isHeader);
          sectionHeight += hasHeader ? POPUP_TABLE_HEADER_HEIGHT : 0;
          sectionHeight += table.rows.length * POPUP_TABLE_ROW_HEIGHT;
          sectionHeight += POPUP_LINE_HEIGHT; // Spacing after table
        }
      } else if (segment.text) {
        const lines = pdf.splitTextToSize(segment.text, effectiveWidth - 0.2);
        sectionHeight += lines.length * POPUP_LINE_HEIGHT;
      }
    }

    sectionHeight += POPUP_SECTION_SPACING; // Spacing after section

    // Check if section fits on current page
    if (currentPage.usedHeight + sectionHeight > availableHeight && currentPage.sections.length > 0) {
      // Start new page
      pages.push(currentPage);
      currentPage = { sections: [], usedHeight: 0 };
    }

    // Add section to current page, including the fixed width if specified
    currentPage.sections.push({
      ...section,
      segments,
      tables,
      fixedWidthInches,
      estimatedHeight: sectionHeight
    });
    currentPage.usedHeight += sectionHeight;
  }

  // Add last page if has content
  if (currentPage.sections.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

/**
 * Draw a table in the PDF
 * @param {object} pdf - jsPDF instance
 * @param {object} table - Table data with rows and columnCount
 * @param {number} startX - Starting X position
 * @param {number} startY - Starting Y position
 * @param {number} width - Available width
 * @param {number} scaleRatio - Scale ratio
 * @returns {number} Y position after the table
 */
function drawPdfTable(pdf, table, startX, startY, width, scaleRatio = 1.0) {
  if (!table || !table.rows || table.rows.length === 0) return startY;

  const rowHeight = POPUP_TABLE_ROW_HEIGHT * scaleRatio;
  const headerRowHeight = POPUP_TABLE_HEADER_HEIGHT * scaleRatio;
  const fontSize = 8 * scaleRatio;
  const padding = 0.05;

  // Calculate column widths based on content
  const colCount = table.columnCount;
  const colWidth = (width - 0.2) / colCount;

  let currentY = startY;

  // Draw border color
  pdf.setDrawColor(226, 232, 240); // slate-200
  pdf.setLineWidth(0.01);

  for (let rowIdx = 0; rowIdx < table.rows.length; rowIdx++) {
    const row = table.rows[rowIdx];
    const isHeaderRow = row.some(cell => cell.isHeader);
    const thisRowHeight = isHeaderRow ? headerRowHeight : rowHeight;

    // Draw row background
    if (isHeaderRow) {
      pdf.setFillColor(241, 245, 249); // slate-100
    } else if (rowIdx % 2 === 1) {
      pdf.setFillColor(249, 250, 251); // gray-50
    } else {
      pdf.setFillColor(255, 255, 255); // white
    }
    pdf.rect(startX + 0.1, currentY, width - 0.2, thisRowHeight, 'FD');

    // Draw cells
    pdf.setFontSize(fontSize * 0.75);
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const cell = row[colIdx];
      const cellX = startX + 0.1 + (colIdx * colWidth);

      // Set font style
      if (cell.isHeader) {
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 41, 59); // slate-800
      } else {
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(51, 65, 85); // slate-700
      }

      // Truncate text if needed
      const maxTextWidth = colWidth - (padding * 2);
      let displayText = cell.text || '';
      while (displayText.length > 0 && pdf.getTextWidth(displayText) > maxTextWidth) {
        displayText = displayText.slice(0, -1);
      }
      if (displayText.length < (cell.text || '').length && displayText.length > 3) {
        displayText = displayText.slice(0, -3) + '...';
      }

      // Draw text
      pdf.text(displayText, cellX + padding, currentY + (thisRowHeight / 2) + (fontSize * 0.75) / 72 / 3);

      // Draw vertical cell border (except for last column)
      if (colIdx < row.length - 1) {
        pdf.line(cellX + colWidth, currentY, cellX + colWidth, currentY + thisRowHeight);
      }
    }

    currentY += thisRowHeight;
  }

  return currentY + (POPUP_LINE_HEIGHT * scaleRatio * 0.5); // Add some spacing after table
}

/**
 * Draw popup content sections on PDF
 * @param {object} pdf - jsPDF instance
 * @param {Array} sections - Array of sections to draw on this page
 * @param {number} startX - Starting X position
 * @param {number} startY - Starting Y position
 * @param {number} width - Available width
 * @param {number} maxHeight - Maximum height available
 * @param {number} scaleRatio - Optional scale ratio from customFeatureInfo
 * @returns {number} Final Y position after drawing
 */
function drawPopupContentSections(pdf, sections, startX, startY, width, maxHeight, scaleRatio = 1.0) {
  let currentY = startY;
  const baseFontSize = 10 * scaleRatio;
  const headerFontSize = 11 * scaleRatio;

  for (const section of sections) {
    // Determine effective width for this section's content
    // If HTML specified a fixed width, use it (capped at available width)
    const effectiveWidth = section.fixedWidthInches
      ? Math.min(section.fixedWidthInches, width)
      : width;

    // Draw section header
    pdf.setFontSize(headerFontSize * 0.75);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 41, 59); // slate-800

    // Section header background (always uses full width)
    pdf.setFillColor(241, 245, 249); // slate-100
    pdf.rect(startX, currentY, width, POPUP_SECTION_HEADER_HEIGHT * scaleRatio, 'F');

    // Section name
    pdf.text(section.name, startX + 0.1, currentY + (POPUP_SECTION_HEADER_HEIGHT * scaleRatio) / 2 + (headerFontSize * 0.75) / 72 / 3);
    currentY += POPUP_SECTION_HEADER_HEIGHT * scaleRatio;

    // Draw section content
    pdf.setFontSize(baseFontSize * 0.75);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(51, 65, 85); // slate-700

    const lineHeight = POPUP_LINE_HEIGHT * scaleRatio;
    const contentStartY = currentY + 0.1;
    currentY = contentStartY;

    for (const segment of section.segments) {
      if (currentY > startY + maxHeight) break;

      if (segment.style?.lineBreak) {
        currentY += lineHeight * 0.5;
        continue;
      }

      // Handle table segments (tables use effective width from HTML if specified)
      if (segment.style?.tableIndex !== undefined && section.tables) {
        const table = section.tables[segment.style.tableIndex];
        if (table) {
          currentY = drawPdfTable(pdf, table, startX, currentY, effectiveWidth, scaleRatio);
          continue;
        }
      }

      if (!segment.text) continue;

      // Set font style
      if (segment.style?.bold) {
        pdf.setFont('helvetica', 'bold');
      } else {
        pdf.setFont('helvetica', 'normal');
      }

      // Word wrap and draw text using effective width
      const lines = pdf.splitTextToSize(segment.text.trim(), effectiveWidth - 0.2);
      for (const line of lines) {
        if (currentY > startY + maxHeight) break;
        pdf.text(line, startX + 0.1, currentY + (baseFontSize * 0.75) / 72);
        currentY += lineHeight;
      }
    }

    // Add spacing after section
    currentY += POPUP_SECTION_SPACING * scaleRatio;
  }

  return currentY;
}

/**
 * Capture a map screenshot for the feature
 * Centers on the feature geometry and captures at the specified scale
 */
async function captureFeatureMapScreenshot(mapView, feature, template, exportTemplate) {
  if (!mapView || !feature?.geometry || !exportTemplate) {
    return null;
  }

  try {
    // Import required modules
    const [Extent, Point, Polygon, Polyline] = await Promise.all([
      import('@arcgis/core/geometry/Extent').then(m => m.default),
      import('@arcgis/core/geometry/Point').then(m => m.default),
      import('@arcgis/core/geometry/Polygon').then(m => m.default),
      import('@arcgis/core/geometry/Polyline').then(m => m.default)
    ]);

    // Get the geometry
    let geometry = feature.geometry;

    // Ensure geometry has proper type
    if (geometry && typeof geometry === 'object' && !geometry.declaredClass) {
      if (geometry.rings) {
        geometry = new Polygon({
          rings: geometry.rings,
          spatialReference: geometry.spatialReference || mapView.spatialReference
        });
      } else if (geometry.paths) {
        geometry = new Polyline({
          paths: geometry.paths,
          spatialReference: geometry.spatialReference || mapView.spatialReference
        });
      } else if (geometry.x !== undefined) {
        geometry = new Point({
          x: geometry.x,
          y: geometry.y,
          spatialReference: geometry.spatialReference || mapView.spatialReference
        });
      }
    }

    // Get extent for the feature
    let extent;
    if (geometry.extent) {
      extent = geometry.extent.clone().expand(1.5);
    } else if (geometry.x !== undefined) {
      // Point geometry - create extent around it
      const bufferSize = 500; // meters
      extent = new Extent({
        xmin: geometry.x - bufferSize,
        ymin: geometry.y - bufferSize,
        xmax: geometry.x + bufferSize,
        ymax: geometry.y + bufferSize,
        spatialReference: mapView.spatialReference
      });
    }

    if (!extent) {
      console.warn('[FeatureExport] Could not determine extent for feature');
      return null;
    }

    // Get map element from export template
    const mapElement = exportTemplate.elements?.find(e => e.type === 'map' && e.visible !== false);
    if (!mapElement) {
      console.warn('[FeatureExport] No map element in export template');
      return null;
    }

    // Get page dimensions
    const pageDims = exportTemplate.pageSize === 'custom'
      ? { width: exportTemplate.customWidth || 11, height: exportTemplate.customHeight || 8.5 }
      : PAGE_DIMENSIONS[exportTemplate.pageSize] || PAGE_DIMENSIONS['letter-portrait'];

    // Calculate map size in pixels
    const mapWidthPx = Math.round((mapElement.width / 100) * pageDims.width * EXPORT_DPI);
    const mapHeightPx = Math.round((mapElement.height / 100) * pageDims.height * EXPORT_DPI);

    // Save current view state
    const originalExtent = mapView.extent.clone();

    // Zoom to feature extent
    await mapView.goTo(extent, { animate: false });

    // Wait for tiles to load
    await new Promise(resolve => setTimeout(resolve, 500));

    if (mapView.updating) {
      await new Promise(resolve => {
        const handle = mapView.watch('updating', (updating) => {
          if (!updating) {
            handle.remove();
            resolve();
          }
        });
        setTimeout(() => { handle.remove(); resolve(); }, 5000);
      });
    }

    // Take screenshot
    const screenshot = await mapView.takeScreenshot({
      width: mapWidthPx,
      height: mapHeightPx,
      format: 'png'
    });

    // Restore original view
    await mapView.goTo(originalExtent, { animate: false });

    return screenshot.dataUrl;
  } catch (err) {
    console.error('[FeatureExport] Error capturing map screenshot:', err);
    return null;
  }
}

/**
 * Main export function
 * Generates a multi-page PDF for a feature using the specified template or popup fallback
 * Always uses popup elements from webmap when available
 */
export async function exportFeatureToPDF({
  feature,
  atlasConfig,
  mapConfig,
  mapView = null,
  sourceLayer = null,
  onProgress = () => {}
}) {
  if (!feature) {
    throw new Error('No feature provided for export');
  }

  onProgress('Preparing export...');

  // Get feature export template if configured
  let template = null;
  let useCustomTemplate = false;

  // Check if feature layer matches customFeatureInfo configuration
  const customFeatureInfo = mapConfig?.customFeatureInfo;
  const featureLayerId = feature?.sourceLayerId || sourceLayer?.id;
  const featureExportTemplateId = mapConfig?.featureExportTemplateId;

  // Determine if we should use popup elements from webmap
  // This happens when the layer matches customFeatureInfo.layerId
  const usePopupElements = customFeatureInfo?.layerId &&
                           featureLayerId === customFeatureInfo.layerId &&
                           (sourceLayer?.popupTemplate || feature?.popupTemplate);

  // Use custom template if:
  // 1. A feature export template is configured for the map
  // 2. AND the feature's layer matches the customFeatureInfo layer (or no customFeatureInfo is set)
  if (featureExportTemplateId && atlasConfig?.featureExportTemplates) {
    const configuredTemplate = atlasConfig.featureExportTemplates.find(
      t => t.id === featureExportTemplateId && t.enabled !== false
    );

    if (configuredTemplate) {
      // Check if we should use this template based on layer matching
      const shouldUseTemplate = !customFeatureInfo?.layerId ||
                                featureLayerId === customFeatureInfo.layerId;

      if (shouldUseTemplate) {
        template = configuredTemplate;
        useCustomTemplate = true;
        console.log('[FeatureExport] Using configured template:', template.name);
      }
    }
  }

  // Get display fields for the feature
  const tableColumns = mapConfig?.tableColumns || [];
  const searchFields = mapConfig?.searchFields || [];
  let displayFields = getDisplayFields(feature, tableColumns, searchFields);

  // Get evaluated popup content if using popup elements
  let popupContent = [];
  if (usePopupElements) {
    onProgress('Processing...');
    try {
      popupContent = await getEvaluatedPopupContent(feature, sourceLayer, customFeatureInfo, mapView);
      console.log('[FeatureExport] Got popup content:', popupContent.length, 'sections');
    } catch (err) {
      console.warn('[FeatureExport] Could not evaluate popup content:', err);
    }
  }

  // If no custom template, create fallback from popup elements
  if (!template) {
    template = createFallbackTemplate(feature, tableColumns, searchFields);
    console.log('[FeatureExport] Using fallback popup template');
  }

  // Get page dimensions
  const pageDims = template.pageSize === 'custom'
    ? { width: template.customWidth || 8.5, height: template.customHeight || 11 }
    : PAGE_DIMENSIONS[template.pageSize] || PAGE_DIMENSIONS['letter-portrait'];

  const orientation = pageDims.width > pageDims.height ? 'landscape' : 'portrait';
  const margins = template.margins || DEFAULT_MARGINS;

  // Create PDF
  const pdf = new jsPDF({
    orientation,
    unit: 'in',
    format: [pageDims.width, pageDims.height]
  });

  // Get org logo URL if available
  let logoUrl = atlasConfig?.ui?.logoLeft || null;

  // Calculate layout for attribute data with page breaks
  onProgress('Calculating layout...');

  // Find elements that repeat per page (title, date, pageNumber, logo)
  const headerElements = template.elements.filter(e =>
    e.visible !== false && ['title', 'date', 'logo'].includes(e.type)
  );
  const footerElements = template.elements.filter(e =>
    e.visible !== false && e.type === 'pageNumber'
  );
  const attributeElement = template.elements.find(e =>
    e.visible !== false && e.type === 'attributeData'
  );
  const staticElements = template.elements.filter(e =>
    e.visible !== false && e.type === 'text' && !e.isRepeating
  );

  // Calculate header/footer heights
  const headerMaxY = headerElements.length > 0
    ? Math.max(...headerElements.map(e => (e.y + e.height) / 100 * pageDims.height))
    : margins.top;
  const footerMinY = footerElements.length > 0
    ? Math.min(...footerElements.map(e => e.y / 100 * pageDims.height))
    : pageDims.height - margins.bottom;

  // Calculate available height for content
  const contentStartY = attributeElement ? (attributeElement.y / 100 * pageDims.height) : headerMaxY + 0.1;
  const contentEndY = footerMinY - 0.1;
  const availableHeight = contentEndY - contentStartY;
  const contentWidth = attributeElement
    ? (attributeElement.width / 100 * pageDims.width)
    : pageDims.width - margins.left - margins.right;
  const contentStartX = attributeElement
    ? (attributeElement.x / 100 * pageDims.width)
    : margins.left;

  // Get scale ratio from customFeatureInfo if available
  const scaleRatio = customFeatureInfo?.export?.scaleRatio || 1.0;

  // Get feature title
  const featureTitle = getFeatureTitle(feature, tableColumns, searchFields);

  // Determine page layout based on content type
  let pageLayouts = [];
  let totalPages = 1;

  if (popupContent.length > 0) {
    // Use popup content - calculate layout across pages
    pageLayouts = calculatePopupContentLayout(popupContent, availableHeight, pdf, contentWidth);
    totalPages = pageLayouts.length;
    console.log(`[FeatureExport] Popup content: ${popupContent.length} sections across ${totalPages} pages`);
  } else {
    // Use attribute table - calculate rows per page
    const rowsPerPage = Math.floor((availableHeight - HEADER_HEIGHT) / ROW_HEIGHT);
    totalPages = Math.max(1, Math.ceil(displayFields.length / rowsPerPage));

    // Create page layouts for attribute table
    for (let i = 0; i < totalPages; i++) {
      const startIndex = i * rowsPerPage;
      const endIndex = Math.min(startIndex + rowsPerPage, displayFields.length);
      pageLayouts.push({
        type: 'attributeTable',
        fields: displayFields.slice(startIndex, endIndex)
      });
    }
    console.log(`[FeatureExport] ${displayFields.length} fields, ${rowsPerPage} rows/page, ${totalPages} pages`);
  }

  // Draw each page
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress(`Generating page ${pageNum} of ${totalPages}...`);

    if (pageNum > 1) {
      pdf.addPage([pageDims.width, pageDims.height], orientation);
    }

    // Draw background
    pdf.setFillColor(template.backgroundColor || '#ffffff');
    pdf.rect(0, 0, pageDims.width, pageDims.height, 'F');

    // Draw header elements
    for (const element of headerElements) {
      await drawElement(pdf, element, pageDims, {
        featureTitle,
        logoUrl,
        currentPage: pageNum,
        totalPages
      });
    }

    // Draw static text elements (only on first page unless marked as repeating)
    if (pageNum === 1) {
      for (const element of staticElements) {
        await drawElement(pdf, element, pageDims, {
          featureTitle,
          currentPage: pageNum,
          totalPages
        });
      }
    }

    // Draw content for this page
    const pageLayout = pageLayouts[pageNum - 1];

    if (pageLayout) {
      if (pageLayout.type === 'attributeTable') {
        // Draw attribute table
        if (attributeElement && pageLayout.fields?.length > 0) {
          drawAttributeTable(pdf, attributeElement, pageDims, pageLayout.fields);
        }
      } else if (pageLayout.sections?.length > 0) {
        // Draw popup content sections
        drawPopupContentSections(
          pdf,
          pageLayout.sections,
          contentStartX,
          contentStartY,
          contentWidth,
          availableHeight,
          scaleRatio
        );
      }
    }

    // Draw footer elements
    for (const element of footerElements) {
      await drawElement(pdf, element, pageDims, {
        currentPage: pageNum,
        totalPages,
        featureTitle
      });
    }
  }

  // Check if map export is configured
  if (template.mapExportTemplateId && mapView && atlasConfig?.exportTemplates) {
    const mapExportTemplate = atlasConfig.exportTemplates.find(
      t => t.id === template.mapExportTemplateId && t.enabled !== false
    );

    if (mapExportTemplate) {
      onProgress('Generating map page...');

      try {
        const mapScreenshot = await captureFeatureMapScreenshot(
          mapView,
          feature,
          template,
          mapExportTemplate
        );

        if (mapScreenshot) {
          // Calculate map scale from the map view's current extent
          // The scale is based on the ratio of map units to screen units
          let mapScale = null;
          if (mapView?.extent && mapView?.width) {
            // Calculate feet per inch based on map extent and view dimensions
            // For Web Mercator, extent is in meters, so convert to feet
            const extentWidth = mapView.extent.width; // in map units (meters for Web Mercator)
            const viewWidthInches = mapView.width / 96; // assuming 96 DPI screen
            const metersPerInch = extentWidth / viewWidthInches;
            mapScale = metersPerInch * 3.28084; // convert meters to feet
          }
          // Add map export page with legend and scalebar support
          await addMapExportPage(pdf, mapExportTemplate, mapScreenshot, featureTitle, logoUrl, atlasConfig, mapView, mapScale);
        }
      } catch (err) {
        console.warn('[FeatureExport] Could not generate map page:', err);
      }
    }
  }

  // Save PDF
  onProgress('Saving PDF...');
  const filename = `${featureTitle.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(filename);

  onProgress('Export complete!');
  return { success: true, filename };
}

/**
 * Draw a single element on the PDF
 */
async function drawElement(pdf, element, pageDims, context = {}) {
  const { featureTitle = '', logoUrl = null, currentPage = 1, totalPages = 1 } = context;

  const x = (element.x / 100) * pageDims.width;
  const y = (element.y / 100) * pageDims.height;
  const width = (element.width / 100) * pageDims.width;
  const height = (element.height / 100) * pageDims.height;

  switch (element.type) {
    case 'title': {
      // Background
      if (element.content?.backgroundColor) {
        const bgColor = element.content.backgroundColor;
        pdf.setFillColor(bgColor);
        pdf.rect(x, y, width, height, 'F');
      }

      // Text
      const fontSize = (element.content?.fontSize || 20) * 0.75; // Convert px to pt
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', element.content?.fontWeight === 'bold' ? 'bold' : 'normal');

      const textColor = element.content?.color || '#000000';
      const rgb = hexToRgb(textColor);
      pdf.setTextColor(rgb.r, rgb.g, rgb.b);

      const text = element.content?.text || featureTitle;
      const align = element.content?.align || 'center';
      let textX = x + width / 2;
      if (align === 'left') textX = x + 0.1;
      if (align === 'right') textX = x + width - 0.1;

      pdf.text(text, textX, y + height / 2 + fontSize / 72 / 3, { align });
      break;
    }

    case 'text': {
      // Background
      if (element.content?.backgroundColor && element.content.backgroundColor !== '#ffffff') {
        pdf.setFillColor(element.content.backgroundColor);
        pdf.rect(x, y, width, height, 'F');
      }

      // Text with word wrap
      const fontSize = (element.content?.fontSize || 12) * 0.75;
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', element.content?.fontWeight === 'bold' ? 'bold' : 'normal');

      const textColor = element.content?.color || '#333333';
      const rgb = hexToRgb(textColor);
      pdf.setTextColor(rgb.r, rgb.g, rgb.b);

      const text = element.content?.text || '';
      const lines = pdf.splitTextToSize(text, width - 0.2);
      const lineHeight = fontSize / 72 * 1.3;

      let textY = y + 0.15;
      for (const line of lines) {
        if (textY + lineHeight > y + height) break;
        const align = element.content?.align || 'left';
        let textX = x + 0.1;
        if (align === 'center') textX = x + width / 2;
        if (align === 'right') textX = x + width - 0.1;
        pdf.text(line, textX, textY + fontSize / 72, { align });
        textY += lineHeight;
      }
      break;
    }

    case 'date': {
      const fontSize = (element.content?.fontSize || 10) * 0.75;
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', 'normal');

      const textColor = element.content?.color || '#333333';
      const rgb = hexToRgb(textColor);
      pdf.setTextColor(rgb.r, rgb.g, rgb.b);

      const dateText = formatDate(element.content?.format || 'MMMM D, YYYY');
      const align = element.content?.align || 'right';
      let textX = x + width / 2;
      if (align === 'left') textX = x;
      if (align === 'right') textX = x + width;

      pdf.text(dateText, textX, y + height / 2 + fontSize / 72 / 3, { align });
      break;
    }

    case 'pageNumber': {
      const fontSize = (element.content?.fontSize || 9) * 0.75;
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', 'normal');

      const textColor = element.content?.color || '#666666';
      const rgb = hexToRgb(textColor);
      pdf.setTextColor(rgb.r, rgb.g, rgb.b);

      let pageText = (element.content?.format || 'Page {current} of {total}')
        .replace('{current}', String(currentPage))
        .replace('{total}', String(totalPages));

      const align = element.content?.align || 'center';
      let textX = x + width / 2;
      if (align === 'left') textX = x;
      if (align === 'right') textX = x + width;

      pdf.text(pageText, textX, y + height / 2 + fontSize / 72 / 3, { align });
      break;
    }

    case 'logo': {
      if (logoUrl) {
        try {
          const img = await loadImage(logoUrl);

          // Calculate aspect-fit dimensions
          const imgAspect = img.width / img.height;
          const boxAspect = width / height;
          let drawW, drawH, drawX, drawY;

          if (imgAspect > boxAspect) {
            drawW = width * 0.9;
            drawH = drawW / imgAspect;
            drawX = x + (width - drawW) / 2;
            drawY = y + (height - drawH) / 2;
          } else {
            drawH = height * 0.9;
            drawW = drawH * imgAspect;
            drawX = x + (width - drawW) / 2;
            drawY = y + (height - drawH) / 2;
          }

          pdf.addImage(img, 'PNG', drawX, drawY, drawW, drawH);
        } catch (err) {
          console.warn('[FeatureExport] Could not load logo:', err);
        }
      }
      break;
    }
  }
}

/**
 * Draw attribute table on PDF
 */
function drawAttributeTable(pdf, element, pageDims, fields) {
  const x = (element.x / 100) * pageDims.width;
  const y = (element.y / 100) * pageDims.height;
  const width = (element.width / 100) * pageDims.width;

  const content = element.content || {};
  const fontSize = (content.fontSize || 11) * 0.75;
  const headerColor = content.headerColor || '#f1f5f9';
  const borderColor = content.borderColor || '#e2e8f0';
  const style = content.style || 'table';

  // Label column width (35% of total)
  const labelWidth = width * 0.35;
  const valueWidth = width * 0.65;

  let currentY = y;

  // Draw header row
  const headerRgb = hexToRgb(headerColor);
  pdf.setFillColor(headerRgb.r, headerRgb.g, headerRgb.b);
  pdf.rect(x, currentY, width, HEADER_HEIGHT, 'F');

  // Header border
  const borderRgb = hexToRgb(borderColor);
  pdf.setDrawColor(borderRgb.r, borderRgb.g, borderRgb.b);
  pdf.setLineWidth(0.01);
  pdf.rect(x, currentY, width, HEADER_HEIGHT, 'S');

  // Header text
  pdf.setFontSize(fontSize);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(51, 65, 85); // slate-700

  if (style === 'table') {
    pdf.text('Field', x + 0.1, currentY + HEADER_HEIGHT / 2 + fontSize / 72 / 3);
    pdf.text('Value', x + labelWidth + 0.1, currentY + HEADER_HEIGHT / 2 + fontSize / 72 / 3);

    // Vertical divider
    pdf.line(x + labelWidth, currentY, x + labelWidth, currentY + HEADER_HEIGHT);
  } else {
    pdf.text('Attribute Data', x + 0.1, currentY + HEADER_HEIGHT / 2 + fontSize / 72 / 3);
  }

  currentY += HEADER_HEIGHT;

  // Draw data rows
  pdf.setFont('helvetica', 'normal');

  for (const field of fields) {
    // Alternate row background
    const rowIndex = fields.indexOf(field);
    if (rowIndex % 2 === 1) {
      pdf.setFillColor(249, 250, 251); // gray-50
      pdf.rect(x, currentY, width, ROW_HEIGHT, 'F');
    }

    // Row border
    pdf.setDrawColor(borderRgb.r, borderRgb.g, borderRgb.b);
    pdf.rect(x, currentY, width, ROW_HEIGHT, 'S');

    if (style === 'table') {
      // Label cell
      pdf.setTextColor(100, 116, 139); // slate-500
      pdf.setFont('helvetica', 'bold');
      const label = truncateText(pdf, String(field.label), labelWidth - 0.2);
      pdf.text(label, x + 0.1, currentY + ROW_HEIGHT / 2 + fontSize / 72 / 3);

      // Vertical divider
      pdf.line(x + labelWidth, currentY, x + labelWidth, currentY + ROW_HEIGHT);

      // Value cell
      pdf.setTextColor(30, 41, 59); // slate-800
      pdf.setFont('helvetica', 'normal');
      const value = truncateText(pdf, formatValue(field.value), valueWidth - 0.2);
      pdf.text(value, x + labelWidth + 0.1, currentY + ROW_HEIGHT / 2 + fontSize / 72 / 3);
    } else {
      // List style: "Label: Value"
      pdf.setTextColor(100, 116, 139);
      pdf.setFont('helvetica', 'bold');
      const labelText = String(field.label) + ': ';
      pdf.text(labelText, x + 0.1, currentY + ROW_HEIGHT / 2 + fontSize / 72 / 3);

      const labelTextWidth = pdf.getTextWidth(labelText);
      pdf.setTextColor(30, 41, 59);
      pdf.setFont('helvetica', 'normal');
      const value = truncateText(pdf, formatValue(field.value), width - labelTextWidth - 0.3);
      pdf.text(value, x + 0.1 + labelTextWidth, currentY + ROW_HEIGHT / 2 + fontSize / 72 / 3);
    }

    currentY += ROW_HEIGHT;
  }
}

/**
 * Add a map export page to the PDF
 * @param {object} pdf - jsPDF instance
 * @param {object} mapExportTemplate - Export template configuration
 * @param {string} mapScreenshot - Map screenshot data URL
 * @param {string} title - Page title
 * @param {string} logoUrl - Logo URL
 * @param {object} atlasConfig - Atlas configuration
 * @param {object} mapView - ArcGIS MapView instance (for legend/scalebar)
 * @param {number} mapScale - Map scale in feet per inch
 */
async function addMapExportPage(pdf, mapExportTemplate, mapScreenshot, title, logoUrl, atlasConfig, mapView = null, mapScale = null) {
  // Get page dimensions for map export template
  const pageDims = mapExportTemplate.pageSize === 'custom'
    ? { width: mapExportTemplate.customWidth || 11, height: mapExportTemplate.customHeight || 8.5 }
    : PAGE_DIMENSIONS[mapExportTemplate.pageSize] || PAGE_DIMENSIONS['letter-landscape'];

  const orientation = pageDims.width > pageDims.height ? 'landscape' : 'portrait';

  // Add new page
  pdf.addPage([pageDims.width, pageDims.height], orientation);

  // Draw background
  pdf.setFillColor(mapExportTemplate.backgroundColor || '#ffffff');
  pdf.rect(0, 0, pageDims.width, pageDims.height, 'F');

  // Get legend items from map view if available
  const legendItems = mapView ? getLegendItemsFromMapView(mapView) : [];

  // Draw elements from map export template
  for (const element of (mapExportTemplate.elements || [])) {
    if (element.visible === false) continue;

    const x = (element.x / 100) * pageDims.width;
    const y = (element.y / 100) * pageDims.height;
    const width = (element.width / 100) * pageDims.width;
    const height = (element.height / 100) * pageDims.height;

    switch (element.type) {
      case 'map':
        if (mapScreenshot) {
          try {
            const img = await loadImage(mapScreenshot);
            pdf.addImage(img, 'PNG', x, y, width, height);

            // Border
            pdf.setDrawColor(0, 0, 0);
            pdf.setLineWidth(0.01);
            pdf.rect(x, y, width, height, 'S');
          } catch (err) {
            console.warn('[FeatureExport] Could not add map image:', err);
          }
        }
        break;

      case 'title':
        if (element.content?.backgroundColor) {
          pdf.setFillColor(element.content.backgroundColor);
          pdf.rect(x, y, width, height, 'F');
        }

        const titleFontSize = (element.content?.fontSize || 20) * 0.75;
        pdf.setFontSize(titleFontSize);
        pdf.setFont('helvetica', element.content?.fontWeight === 'bold' ? 'bold' : 'normal');

        const titleColor = element.content?.color || '#000000';
        const titleRgb = hexToRgb(titleColor);
        pdf.setTextColor(titleRgb.r, titleRgb.g, titleRgb.b);

        const titleAlign = element.content?.align || 'center';
        let titleX = x + width / 2;
        if (titleAlign === 'left') titleX = x + 0.1;
        if (titleAlign === 'right') titleX = x + width - 0.1;

        pdf.text(title, titleX, y + height / 2 + titleFontSize / 72 / 3, { align: titleAlign });
        break;

      case 'logo':
      case 'image':
        const imgUrl = element.content?.url || logoUrl;
        if (imgUrl) {
          try {
            const img = await loadImage(imgUrl);

            // Aspect-fit
            const imgAspect = img.width / img.height;
            const boxAspect = width / height;
            let drawW, drawH, drawX, drawY;

            if (imgAspect > boxAspect) {
              drawW = width;
              drawH = width / imgAspect;
              drawX = x;
              drawY = y + (height - drawH) / 2;
            } else {
              drawH = height;
              drawW = height * imgAspect;
              drawX = x + (width - drawW) / 2;
              drawY = y;
            }

            pdf.addImage(img, 'PNG', drawX, drawY, drawW, drawH);
          } catch (err) {
            console.warn('[FeatureExport] Could not load image:', err);
          }
        }
        break;

      case 'text':
        if (element.content?.backgroundColor && element.content.backgroundColor !== '#ffffff') {
          pdf.setFillColor(element.content.backgroundColor);
          pdf.rect(x, y, width, height, 'F');
        }

        const textFontSize = (element.content?.fontSize || 12) * 0.75;
        pdf.setFontSize(textFontSize);
        pdf.setFont('helvetica', element.content?.fontWeight === 'bold' ? 'bold' : 'normal');

        const textColor = element.content?.color || '#333333';
        const textRgb = hexToRgb(textColor);
        pdf.setTextColor(textRgb.r, textRgb.g, textRgb.b);

        const text = element.content?.text || '';
        const lines = pdf.splitTextToSize(text, width - 0.2);
        const lineHeight = textFontSize / 72 * 1.3;

        let textY = y + 0.15;
        for (const line of lines) {
          if (textY + lineHeight > y + height) break;
          const textAlign = element.content?.align || 'left';
          let textX = x + 0.1;
          if (textAlign === 'center') textX = x + width / 2;
          if (textAlign === 'right') textX = x + width - 0.1;
          pdf.text(line, textX, textY + textFontSize / 72, { align: textAlign });
          textY += lineHeight;
        }
        break;

      case 'northArrow':
        drawNorthArrow(pdf, x, y, width, height);
        break;

      case 'scalebar':
        drawPdfScaleBar(pdf, x, y, width, height, mapScale, element.content?.units);
        break;

      case 'legend':
        drawPdfLegend(pdf, x, y, width, height, legendItems, element);
        break;
    }
  }
}

/**
 * Draw a north arrow on the PDF
 */
function drawNorthArrow(pdf, x, y, width, height) {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const size = Math.min(width, height) * 0.4;

  // Draw filled arrow (north half)
  pdf.setFillColor(0, 0, 0);
  pdf.triangle(
    centerX, centerY - size,
    centerX + size / 3, centerY + size / 2,
    centerX, centerY,
    'F'
  );

  // Draw outline arrow (south half)
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.01);
  pdf.triangle(
    centerX, centerY - size,
    centerX - size / 3, centerY + size / 2,
    centerX, centerY,
    'FD'
  );

  // Draw "N" label
  pdf.setFontSize(Math.max(10, size * 20));
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 0, 0);
  pdf.text('N', centerX, centerY - size - 0.05, { align: 'center' });
}

/**
 * Draw a scale bar on PDF
 * @param {object} pdf - jsPDF instance
 * @param {number} x - X position in inches
 * @param {number} y - Y position in inches
 * @param {number} width - Width in inches
 * @param {number} height - Height in inches
 * @param {number} scale - Map scale in feet per inch
 * @param {string} units - Units for display ('feet' or 'meters')
 */
function drawPdfScaleBar(pdf, x, y, width, height, scale, units = 'feet') {
  if (!scale || scale <= 0) {
    // No scale available, draw placeholder
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.01);
    pdf.line(x + 0.1, y + height / 2, x + width - 0.1, y + height / 2);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    pdf.text('Scale', x + width / 2, y + height / 2 + 0.12, { align: 'center' });
    return;
  }

  const padding = 0.05;
  const barHeight = Math.min(height * 0.2, 0.08);
  const barY = y + height - padding - barHeight - 0.12;

  // Calculate a nice round number for the scale bar
  const maxWidthInches = width - padding * 2;
  const maxFeet = scale * maxWidthInches;

  // Find a nice round number
  const niceNumbers = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000];
  let scaleFeet = 100;
  for (const n of niceNumbers) {
    if (n <= maxFeet * 0.9) {
      scaleFeet = n;
    } else {
      break;
    }
  }

  // Calculate bar width in inches
  const barWidthInches = scaleFeet / scale;
  const barX = x + padding;

  // Draw alternating black/white segments
  const segments = 4;
  const segWidth = barWidthInches / segments;

  for (let i = 0; i < segments; i++) {
    if (i % 2 === 0) {
      pdf.setFillColor(0, 0, 0);
    } else {
      pdf.setFillColor(255, 255, 255);
    }
    pdf.rect(barX + i * segWidth, barY, segWidth, barHeight, 'F');
  }

  // Draw border around entire bar
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.005);
  pdf.rect(barX, barY, barWidthInches, barHeight, 'S');

  // Draw end ticks
  pdf.line(barX, barY - 0.02, barX, barY + barHeight + 0.02);
  pdf.line(barX + barWidthInches, barY - 0.02, barX + barWidthInches, barY + barHeight + 0.02);

  // Draw label
  pdf.setFillColor(0, 0, 0);
  pdf.setTextColor(0, 0, 0);
  const fontSize = Math.min(height * 0.25, 8);
  pdf.setFontSize(fontSize);
  pdf.setFont('helvetica', 'normal');

  let label = '';
  if (units === 'feet' || units === 'ft') {
    label = scaleFeet >= 5280 ? `${(scaleFeet / 5280).toFixed(1)} miles` : `${scaleFeet.toLocaleString()} feet`;
  } else if (units === 'meters' || units === 'm') {
    const meters = scaleFeet * 0.3048;
    label = meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
  } else {
    label = `${scaleFeet.toLocaleString()} ft`;
  }

  pdf.text(label, barX + barWidthInches / 2, barY + barHeight + 0.08, { align: 'center' });

  // Draw 0 label
  pdf.text('0', barX, barY + barHeight + 0.08, { align: 'left' });
}

/**
 * Get legend items from a map view
 * @param {object} mapView - ArcGIS MapView instance
 * @returns {Array} Array of legend items with label and symbol info
 */
function getLegendItemsFromMapView(mapView) {
  if (!mapView?.map) return [];

  const items = [];

  // Get basemap layer IDs to exclude them from the legend
  const basemapLayerIds = new Set();
  if (mapView.map.basemap) {
    mapView.map.basemap.baseLayers?.forEach(layer => {
      basemapLayerIds.add(layer.id);
    });
    mapView.map.basemap.referenceLayers?.forEach(layer => {
      basemapLayerIds.add(layer.id);
    });
  }

  // Helper function to convert ArcGIS color to hex
  const colorToHex = (color) => {
    if (!color) return '#888888';
    if (color.r !== undefined) {
      const r = color.r.toString(16).padStart(2, '0');
      const g = color.g.toString(16).padStart(2, '0');
      const b = color.b.toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
    if (Array.isArray(color)) {
      const [r, g, b] = color;
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    if (typeof color === 'string') return color;
    return '#888888';
  };

  // Helper function to extract symbol info
  const extractSymbolInfo = (symbol) => {
    if (!symbol) return null;
    const symbolType = symbol.type || '';
    const isLine = symbolType.includes('line') || symbolType === 'simple-line' || symbolType === 'esriSLS';

    let symbolColor = symbol.color;
    let outlineColor = null;
    let hasTransparentFill = false;

    if (!isLine && symbol.outline?.color) {
      const fillColor = symbol.color;
      if (!fillColor ||
          (Array.isArray(fillColor) && (fillColor.length < 4 || fillColor[3] < 0.1)) ||
          (fillColor?.a !== undefined && fillColor.a < 0.1)) {
        hasTransparentFill = true;
        outlineColor = colorToHex(symbol.outline.color);
      }
    }

    return {
      type: isLine ? 'line' : 'fill',
      color: hasTransparentFill ? null : colorToHex(symbolColor),
      outlineColor: outlineColor,
      hasTransparentFill: hasTransparentFill
    };
  };

  mapView.map.allLayers.forEach(layer => {
    if (!layer.visible || layer.listMode === 'hide') return;
    if (layer.type === 'graphics' || layer.id.startsWith('atlas-')) return;
    if (layer.id === 'export-area-layer') return;
    if (!layer.title) return;
    if (basemapLayerIds.has(layer.id)) return;

    const renderer = layer.renderer;

    if (!renderer) {
      items.push({ label: layer.title, symbol: null });
      return;
    }

    if (renderer.type === 'simple' || renderer.symbol) {
      items.push({
        label: layer.title,
        symbol: extractSymbolInfo(renderer.symbol)
      });
    } else if (renderer.type === 'unique-value' && renderer.uniqueValueInfos) {
      items.push({
        label: layer.title,
        symbol: extractSymbolInfo(renderer.defaultSymbol),
        isHeader: true
      });
      renderer.uniqueValueInfos.forEach(info => {
        items.push({
          label: info.label || info.value || 'Value',
          symbol: extractSymbolInfo(info.symbol),
          isSubItem: true
        });
      });
    } else if (renderer.type === 'class-breaks' && renderer.classBreakInfos) {
      items.push({
        label: layer.title,
        symbol: extractSymbolInfo(renderer.defaultSymbol),
        isHeader: true
      });
      renderer.classBreakInfos.forEach(info => {
        items.push({
          label: info.label || `${info.minValue} - ${info.maxValue}`,
          symbol: extractSymbolInfo(info.symbol),
          isSubItem: true
        });
      });
    } else {
      items.push({ label: layer.title, symbol: null });
    }
  });

  return items;
}

/**
 * Draw legend on PDF
 * @param {object} pdf - jsPDF instance
 * @param {number} x - X position in inches
 * @param {number} y - Y position in inches
 * @param {number} width - Width in inches
 * @param {number} height - Height in inches
 * @param {Array} legendItems - Array of legend items
 * @param {object} element - Element configuration with content options
 */
function drawPdfLegend(pdf, x, y, width, height, legendItems, element) {
  if (!legendItems || legendItems.length === 0) return;

  const showTitle = element?.content?.showTitle !== false;
  const padding = 0.1;
  const titleHeight = showTitle ? 0.25 : 0;
  const itemHeight = 0.2;
  const symbolSize = 0.12;
  const symbolGap = 0.08;

  // Background
  pdf.setFillColor(255, 255, 255);
  pdf.rect(x, y, width, height, 'F');

  // Border
  pdf.setDrawColor(153, 153, 153);
  pdf.setLineWidth(0.005);
  pdf.rect(x, y, width, height, 'S');

  let currentY = y + padding;

  // Title
  if (showTitle) {
    pdf.setFillColor(0, 0, 0);
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text(element?.content?.title || 'Legend', x + padding, currentY + 0.1);
    currentY += titleHeight;
  }

  // Calculate how many items fit
  const availableHeight = height - padding * 2 - titleHeight;
  const maxItems = Math.floor(availableHeight / itemHeight);

  // Draw legend items
  const itemsToDraw = legendItems.slice(0, maxItems);

  for (const item of itemsToDraw) {
    if (currentY + itemHeight > y + height - padding) break;

    const itemX = x + padding + (item.isSubItem ? 0.1 : 0);
    const actualSymbolSize = item.isSubItem ? symbolSize * 0.8 : symbolSize;
    const symbolY = currentY + (itemHeight - actualSymbolSize) / 2;

    // Set font
    if (item.isHeader) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
    } else {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
    }

    // Draw symbol
    if (item.symbol && !item.isHeader) {
      if (item.symbol.type === 'line') {
        const lineColor = hexToRgb(item.symbol.color || '#888888');
        pdf.setDrawColor(lineColor.r, lineColor.g, lineColor.b);
        pdf.setLineWidth(0.015);
        const lineY = currentY + itemHeight / 2;
        pdf.line(itemX, lineY, itemX + actualSymbolSize, lineY);
      } else if (item.symbol.hasTransparentFill && item.symbol.outlineColor) {
        const outlineRgb = hexToRgb(item.symbol.outlineColor);
        pdf.setDrawColor(outlineRgb.r, outlineRgb.g, outlineRgb.b);
        pdf.setLineWidth(0.01);
        pdf.rect(itemX, symbolY, actualSymbolSize, actualSymbolSize, 'S');
      } else if (item.symbol.color) {
        const fillRgb = hexToRgb(item.symbol.color);
        pdf.setFillColor(fillRgb.r, fillRgb.g, fillRgb.b);
        pdf.rect(itemX, symbolY, actualSymbolSize, actualSymbolSize, 'F');
        pdf.setDrawColor(51, 51, 51);
        pdf.setLineWidth(0.003);
        pdf.rect(itemX, symbolY, actualSymbolSize, actualSymbolSize, 'S');
      } else {
        pdf.setFillColor(204, 204, 204);
        pdf.rect(itemX, symbolY, actualSymbolSize, actualSymbolSize, 'F');
        pdf.setDrawColor(153, 153, 153);
        pdf.setLineWidth(0.003);
        pdf.rect(itemX, symbolY, actualSymbolSize, actualSymbolSize, 'S');
      }
    } else if (!item.isHeader) {
      // Default gray square
      pdf.setFillColor(204, 204, 204);
      pdf.rect(itemX, symbolY, actualSymbolSize, actualSymbolSize, 'F');
      pdf.setDrawColor(153, 153, 153);
      pdf.setLineWidth(0.003);
      pdf.rect(itemX, symbolY, actualSymbolSize, actualSymbolSize, 'S');
    }

    // Draw label
    pdf.setTextColor(item.isHeader ? 0 : 51, item.isHeader ? 0 : 51, item.isHeader ? 0 : 51);
    const labelX = item.isHeader && !item.symbol ? itemX : itemX + actualSymbolSize + symbolGap;
    pdf.text(item.label, labelX, currentY + itemHeight / 2 + 0.02);

    currentY += itemHeight;
  }
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

/**
 * Format a value for display
 */
function formatValue(value) {
  if (value == null) return '';
  if (typeof value === 'number') {
    // Format numbers with commas
    return value.toLocaleString();
  }
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  return String(value);
}

/**
 * Truncate text to fit within a given width
 */
function truncateText(pdf, text, maxWidth) {
  if (!text) return '';

  const textWidth = pdf.getTextWidth(text);
  if (textWidth <= maxWidth) return text;

  // Binary search for the right length
  let low = 0;
  let high = text.length;

  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    const truncated = text.substring(0, mid) + '...';
    if (pdf.getTextWidth(truncated) <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return low > 0 ? text.substring(0, low) + '...' : text.substring(0, 3) + '...';
}

export default {
  exportFeatureToPDF
};
