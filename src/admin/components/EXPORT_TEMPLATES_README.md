# Map Export Template System

This module provides a comprehensive map export template configuration system for Atlas at both the organizational and map levels.

## Overview

The export template system allows:
- **Organization Admins**: Create and manage export templates with a visual drag-and-drop editor
- **Map Admins**: Select which templates are available for each individual map

## Components

### 1. ExportTemplateEditor.jsx

Visual drag-and-drop template designer modal.

**Features:**
- Page size presets (Letter, Legal, Tabloid, A4, A3) in both orientations
- Custom page dimensions
- Drag-and-drop element placement
- Resize handles for all elements
- Element property editing
- Real-time preview with zoom controls
- Grid overlay for precise positioning

**Element Types:**
| Type | Description | Required | Properties |
|------|-------------|----------|------------|
| `map` | Main map image area | Yes | Position, size |
| `title` | Text title block | No | Text, font size, color, background, alignment |
| `text` | Custom text/description | No | Text, font size, color, background, alignment |
| `logo` | Organization logo | No | Source (org-logo), alt text |
| `image` | Custom image URL | No | URL, alt text |
| `legend` | Map legend | No | Title, show title toggle |
| `scalebar` | Scale bar | No | Style, units (feet/meters/miles/km) |
| `northArrow` | North arrow/compass | No | Style |

**Usage:**
```jsx
import { ExportTemplateEditor } from './admin/components';

<ExportTemplateEditor
  data={existingTemplate}  // null for new template
  orgData={orgData}
  onClose={() => setEditing(false)}
  onSave={handleSave}
  accentColor="#004E7C"
/>
```

### 2. ExportTemplateConfiguration.jsx

Organization-level template management component.

**Features:**
- List all templates with expand/collapse details
- Create from blank or starter templates
- Edit, duplicate, delete templates
- Enable/disable templates without deleting
- Visual template summary

**Starter Templates Included:**
- Standard Landscape (classic layout with sidebar legend)
- Standard Portrait (bottom legend)
- Map Only (full page with minimal overlays)
- Presentation Style (prominent title and logo areas)

**Usage:**
```jsx
import { ExportTemplateConfiguration } from './admin/components';

<ExportTemplateConfiguration
  templates={atlasConfig.exportTemplates || []}
  orgData={orgData}
  onUpdate={(templates) => saveTemplates(templates)}
  addToast={addToast}
  confirm={confirm}
  accentColor="#004E7C"
/>
```

### 3. MapExportSettings.jsx

Map-level template selection component.

**Features:**
- Checkbox list of available templates
- Select all / clear all
- Visual indicators for selection state
- Warning when no templates selected (export disabled)
- Compact display variant for lists

**Usage:**
```jsx
import { MapExportSettings, MapExportSettingsCompact } from './admin/components';

// Full selection UI
<MapExportSettings
  availableTemplates={orgTemplates}
  selectedTemplateIds={mapConfig.exportTemplates}
  onChange={(ids) => updateMap({ exportTemplates: ids })}
  accentColor="#004E7C"
/>

// Compact display for cards/lists
<MapExportSettingsCompact
  availableTemplates={orgTemplates}
  selectedTemplateIds={mapConfig.exportTemplates}
/>
```

## Data Structure

### Template Schema

```javascript
{
  id: "template-1234567890",
  name: "Standard Landscape",
  pageSize: "letter-landscape",  // or 'custom'
  customWidth: 11,               // inches, only if pageSize is 'custom'
  customHeight: 8.5,             // inches, only if pageSize is 'custom'
  backgroundColor: "#ffffff",
  enabled: true,
  createdAt: "2024-01-15T10:30:00Z",
  updatedAt: "2024-01-20T14:45:00Z",
  elements: [
    {
      id: "map-1",
      type: "map",
      x: 2,           // percentage of page width (0-100)
      y: 12,          // percentage of page height (0-100)
      width: 65,      // percentage of page width
      height: 75,     // percentage of page height
      locked: false,
      visible: true
    },
    {
      id: "title-1",
      type: "title",
      x: 0,
      y: 0,
      width: 100,
      height: 10,
      locked: false,
      visible: true,
      content: {
        text: "Map Title",
        fontSize: 24,
        fontWeight: "bold",
        align: "center",
        backgroundColor: "#1e293b",
        color: "#ffffff"
      }
    },
    // ... more elements
  ]
}
```

### Storage Location

Templates are stored in the organization's Atlas configuration:

```
organizations/{orgId}: {
  atlasConfig: {
    // ... existing atlas config
    exportTemplates: [ /* array of templates */ ]
  },
  atlasConfigDraft: {
    // ... draft config (if unpublished changes)
    exportTemplates: [ /* array of templates */ ]
  }
}
```

### Map-Level Template Selection

Each map stores the IDs of templates it can use:

```javascript
// In map configuration
{
  name: "Property Map",
  access: "public",
  // ... other map settings
  exportTemplates: ["template-123", "template-456"]  // Selected template IDs
}
```

## Integration with AtlasAdminSection

### Navigation Items

For org_admin role, the Atlas section now includes an "Export Templates" tab:

```javascript
import { getAtlasNavItems } from './admin/components';

const navItems = getAtlasNavItems('org_admin');
// Returns:
// [
//   { id: 'maps', label: 'Maps', icon: Layers },
//   { id: 'export-templates', label: 'Export Templates', icon: Printer },
//   { id: 'users', label: 'Users', icon: Users },
//   { id: 'preview', label: 'Preview', icon: Eye }
// ]
```

### AtlasAdminSection Update

The updated AtlasAdminSection handles the `export-templates` tab:

```jsx
// In AtlasAdminSection.jsx
case 'export-templates':
  return (
    <ExportTemplateConfiguration
      templates={workingConfig?.exportTemplates || []}
      orgData={orgData}
      onUpdate={handleUpdateExportTemplates}
      addToast={addToast}
      confirm={confirm}
      accentColor={accentColor}
    />
  );
```

## Integration with MapEditor

Add an "Export" section to MapEditor to allow selecting templates:

```jsx
// 1. Import the component
import MapExportSettings from './MapExportSettings';
import { Printer } from 'lucide-react';

// 2. Add to sections
const sections = [
  // ... existing sections
  { id: 'export', label: 'Export', icon: Printer }
];

// 3. Add exportTemplates to state
const [mapConfig, setMapConfig] = useState(() => ({
  // ... existing fields
  exportTemplates: data?.exportTemplates || [],
}));

// 4. Add section render
case 'export':
  const availableTemplates = 
    orgData?.atlasConfigDraft?.exportTemplates || 
    orgData?.atlasConfig?.exportTemplates || 
    [];
  
  return (
    <MapExportSettings
      availableTemplates={availableTemplates}
      selectedTemplateIds={mapConfig.exportTemplates}
      onChange={(ids) => updateConfig({ exportTemplates: ids })}
      accentColor={accentColor}
    />
  );
```

## Usage Flow

### Organization Admin: Creating Templates

1. Navigate to Atlas → Export Templates
2. Click "New Template" or "From Template"
3. Use the visual editor to:
   - Set page size and orientation
   - Add/remove elements
   - Position and resize elements
   - Configure element properties
4. Save the template
5. Templates are automatically saved to the organization's atlas config

### Map Admin: Selecting Templates

1. Navigate to Atlas → Maps
2. Edit a map configuration
3. Go to the "Export" tab
4. Check the templates to make available
5. Save the map configuration

### End User: Exporting Maps

1. Open a map in Atlas
2. Click the Export button
3. Select from available templates (those selected by map admin)
4. Configure export options (format, quality)
5. Download the export

## CSS Export (for Runtime)

When generating exports at runtime, the system converts the template to CSS:

```javascript
function templateToCSS(template) {
  const { width, height } = getPageDimensions(template);
  
  let css = `
    .export-layout-container {
      width: ${width}in;
      height: ${height}in;
      background: ${template.backgroundColor};
      position: relative;
    }
  `;
  
  template.elements.forEach(element => {
    if (!element.visible) return;
    
    css += `
      .export-element-${element.id} {
        position: absolute;
        left: ${element.x}%;
        top: ${element.y}%;
        width: ${element.width}%;
        height: ${element.height}%;
      }
    `;
  });
  
  return css;
}
```

## File Structure

```
src/admin/components/
├── ExportTemplateEditor.jsx      # Visual template designer
├── ExportTemplateConfiguration.jsx # Template list management
├── MapExportSettings.jsx         # Map-level template selection
├── AtlasAdminSection.jsx         # Updated with export-templates tab
├── MapEditor.jsx                 # Updated with export section
└── index.js                      # Updated exports
```

## Migration Checklist

- [x] Create ExportTemplateEditor component
- [x] Create ExportTemplateConfiguration component
- [x] Create MapExportSettings component
- [x] Update AtlasAdminSection with export-templates tab
- [x] Update getAtlasNavItems to include Export Templates
- [x] Document integration with MapEditor
- [x] Update component exports in index.js
- [ ] Add template selection to MapEditor.jsx
- [ ] Implement runtime export generation using templates
- [ ] Test with super_admin role
- [ ] Test with org_admin role

## Dependencies

The export template components require:
- React 18+
- Lucide React icons
- Tailwind CSS

No additional dependencies needed beyond what's already in the project.
