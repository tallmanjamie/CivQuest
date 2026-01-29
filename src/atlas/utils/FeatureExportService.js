// src/atlas/utils/FeatureExportService.js
// Feature Export Service - Multi-page PDF generation for feature exports
//
// Supports:
// - Feature export templates with custom elements and layout
// - Popup-based fallback when no template is configured
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
 */
export async function exportFeatureToPDF({
  feature,
  atlasConfig,
  mapConfig,
  mapView = null,
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
  const featureLayerId = feature?.sourceLayerId;
  const featureExportTemplateId = mapConfig?.featureExportTemplateId;

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
  const displayFields = getDisplayFields(feature, tableColumns, searchFields);

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

  // Calculate available height for attribute data
  const attributeStartY = attributeElement ? (attributeElement.y / 100 * pageDims.height) : headerMaxY + 0.1;
  const attributeEndY = footerMinY - 0.1;
  const availableHeight = attributeEndY - attributeStartY;

  // Calculate rows per page
  const rowsPerPage = Math.floor((availableHeight - HEADER_HEIGHT) / ROW_HEIGHT);
  const totalPages = Math.ceil(displayFields.length / rowsPerPage);

  console.log(`[FeatureExport] ${displayFields.length} fields, ${rowsPerPage} rows/page, ${totalPages} pages`);

  // Get feature title
  const featureTitle = getFeatureTitle(feature, tableColumns, searchFields);

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

    // Draw attribute data for this page
    const startIndex = (pageNum - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, displayFields.length);
    const pageFields = displayFields.slice(startIndex, endIndex);

    if (attributeElement && pageFields.length > 0) {
      drawAttributeTable(pdf, attributeElement, pageDims, pageFields);
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
          // Add map export page
          await addMapExportPage(pdf, mapExportTemplate, mapScreenshot, featureTitle, logoUrl, atlasConfig);
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
 */
async function addMapExportPage(pdf, mapExportTemplate, mapScreenshot, title, logoUrl, atlasConfig) {
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
        // Simple scale bar placeholder
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.02);
        pdf.line(x, y + height / 2, x + width * 0.8, y + height / 2);

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        pdf.text('Scale', x + width * 0.4, y + height / 2 + 0.15, { align: 'center' });
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
