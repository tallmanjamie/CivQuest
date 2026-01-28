# Atlas Administrative Configuration

This module provides administrative configuration capabilities for Atlas at both the Super Admin and Org Admin levels, following the same patterns established by the Notify configuration.

## Overview

The Atlas admin configuration allows administrators to:
- Configure overall Atlas settings (UI, messages, basemaps)
- Manage individual map configurations
- Configure search fields, table columns, and geocoding
- **Manage user access to Atlas** (separate from Notify subscriptions)
- **Draft/Publish workflow** - changes are saved as drafts until explicitly published
- Preview Atlas as end users see it (live or draft)

## Components

### 1. AtlasConfiguration.jsx

The main configuration component that handles atlas config for both admin roles.

**Features:**
- Super Admin: View/edit atlas config for all organizations
- Org Admin: View/edit atlas config for their organization only
- **Draft/Publish workflow**: All changes saved as draft until published
- Initialize atlas for organizations that don't have it configured
- Uninitialize atlas (only when no maps exist)
- Add, edit, duplicate, and delete maps
- Visual indicators for unpublished changes

**Usage:**
```jsx
import { AtlasConfiguration } from './admin/components';

<AtlasConfiguration
  db={db}
  role="admin" // or "org_admin"
  orgId={orgId} // required for org_admin
  orgData={orgData} // required for org_admin
  addToast={addToast}
  confirm={confirm}
  accentColor="#004E7C"
  AtlasSettingsModal={AtlasSettingsEditor}
  MapEditModal={MapEditor}
/>
```

### 2. AtlasSettingsEditor.jsx

Modal for editing overall Atlas settings:
- **UI Settings**: Title, header, theme color, logos, default mode
- **Messages**: Welcome title/text, example questions, important notes
- **Basemaps**: Configure available basemap options
- **Advanced**: System prompt, record limits, timezone

**Usage:**
```jsx
import { AtlasSettingsEditor } from './admin/components';

<AtlasSettingsEditor
  data={atlasConfig}
  onClose={() => setEditing(false)}
  onSave={handleSave}
  accentColor="#004E7C"
/>
```

### 3. MapEditor.jsx

Modal for editing individual map configurations:
- **Basic Settings**: Name, access level, enabled modes
- **Data Source**: WebMap ID, feature service endpoint
- **Search**: Autocomplete fields, search fields
- **Table**: Column configuration with sorting/filtering
- **Geocoder**: Enable/configure geocoding service

**Usage:**
```jsx
import { MapEditor } from './admin/components';

<MapEditor
  data={mapConfig}
  onClose={() => setEditing(false)}
  onSave={handleSave}
  accentColor="#004E7C"
  onOpenServiceFinder={handleOpenServiceFinder}
/>
```

### 4. AtlasUserManagement.jsx

Component for managing user access to Atlas. Uses the same user store as Notify but tracks Atlas access separately.

**Features:**
- Grant/revoke Atlas access for users
- Search and filter users
- Export users to CSV
- Track who granted access and when
- Super Admin: View users across all organizations
- Org Admin: Manage users for their organization

**Usage:**
```jsx
import { AtlasUserManagement } from './admin/components';

<AtlasUserManagement
  db={db}
  role="admin" // or "org_admin"
  orgId={orgId}
  orgData={orgData}
  addToast={addToast}
  confirm={confirm}
  accentColor="#004E7C"
  adminEmail="admin@example.com"
/>
```

### 5. AtlasAdminSection.jsx

Integration component for AdminApp that handles tab routing.

**Usage:**
```jsx
import AtlasAdminSection, { getAtlasNavItems } from './admin/components/AtlasAdminSection';

// Get nav items
const atlasItems = getAtlasNavItems(role);

// Render section
<AtlasAdminSection
  db={db}
  role={role}
  activeTab={activeTab}
  orgId={orgId}
  orgData={orgData}
  addToast={addToast}
  confirm={confirm}
  accentColor={accentColor}
  adminEmail={user.email}
/>
```

## Data Structure

### Draft/Publish Workflow

Atlas configuration uses a draft/publish workflow to prevent accidental changes from going live immediately:

```
organizations/{orgId}: {
  atlasConfig: { ... },       // LIVE - what Atlas app uses
  atlasConfigDraft: { ... }   // DRAFT - what admin is editing
}
```

**Workflow:**
1. When an admin makes changes, they are saved to `atlasConfigDraft`
2. The admin can preview their draft changes before publishing
3. When ready, the admin clicks "Publish" to copy draft → live
4. The admin can also "Discard" to remove the draft and revert to live

**Benefits:**
- Prevents accidental changes from affecting users
- Allows reviewing changes before they go live
- Multiple changes can be batched into a single publish
- Easy rollback by discarding draft

### Atlas Configuration Structure

Stored at `organizations/{orgId}.atlasConfig` (live) and `organizations/{orgId}.atlasConfigDraft` (draft):

```javascript
{
  // UI Configuration
  ui: {
    title: "CivQuest Atlas",
    headerTitle: "City Name",
    headerSubtitle: "Property Search",
    headerClass: "bg-sky-700",
    logoLeft: "https://...",
    logoRight: "https://...",
    botAvatar: "https://...",
    themeColor: "sky", // sky, blue, indigo, emerald, etc.
    defaultMode: "chat" // chat, map, or table
  },
  
  // Welcome Messages
  messages: {
    welcomeTitle: "Welcome!",
    welcomeText: "Search for properties...",
    exampleQuestions: ["123 Main St", "Parcel 12345"],
    importantNote: "Disclaimer text..."
  },
  
  // Basemap Options
  basemaps: [
    { label: "Default", id: "default", type: "esri" },
    { label: "Aerial", id: "aerial", type: "arcgis", url: "https://..." }
  ],
  
  // Data Configuration
  data: {
    systemPrompt: "AI prompt for chat mode...",
    maxRecordCount: 10000,
    timeZoneOffset: -5,
    defaultSort: "FIELD_NAME DESC",
    
    // Individual Maps
    maps: [
      {
        name: "Public Map",
        searchPlaceholder: "Search...",
        enabledModes: ["chat", "map", "table"],
        defaultMode: "chat",
        access: "public", // or "private"
        
        // WebMap (optional)
        webMap: {
          portalUrl: "https://www.arcgis.com",
          itemId: "abc123..."
        },
        
        // Feature Service Endpoint
        endpoint: "https://services.arcgis.com/.../FeatureServer/0",
        
        // Autocomplete - Pattern-based suggestions in the search bar
        // Each autocomplete field can specify:
        // - type: unique identifier (e.g., "parcel", "address")
        // - field: feature service field to query
        // - label: display label shown in dropdown
        // - icon: emoji or icon character (e.g., "🆔", "🏠")
        // - pattern: regex to match user input (e.g., "(\\d{5,})$" for 5+ digits)
        // - description: help text describing what this matches
        // - maxSuggestions: max number of suggestions to show (default: 10)
        autocomplete: [
          {
            type: "parcel",
            field: "PARCELID",
            label: "Parcel ID",
            icon: "🆔",
            pattern: "(\\d{5,})$",
            description: "Matches 5+ digit parcel IDs",
            maxSuggestions: 10
          },
          {
            type: "address",
            field: "PROPERTYADDRESS",
            label: "Address",
            icon: "🏠",
            pattern: "\\b(\\d{1,5}\\s+[a-zA-Z0-9\\s.\\-\\']*)$",
            description: "Matches street addresses",
            maxSuggestions: 10
          }
        ],
        
        // Search Fields
        searchFields: [
          { field: "GPIN", label: "Parcel ID", type: "text" },
          { field: "OWNER", label: "Owner Name", type: "text" }
        ],
        
        // Table Columns
        tableColumns: [
          { field: "ADDRESS", headerName: "Address", width: 200, sortable: true, filter: true },
          { field: "OWNER", headerName: "Owner", width: 150, sortable: true, filter: true }
        ],
        
        // Geocoder
        geocoder: {
          enabled: true,
          url: "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer"
        }
      }
    ]
  }
}
```

### User Atlas Access

Stored at `users/{userId}.atlasAccess`:

```javascript
{
  email: "user@example.com",
  
  // Notify subscriptions (existing)
  subscriptions: { ... },
  
  // Atlas access by organization
  atlasAccess: {
    "chesapeake": {
      enabled: true,
      grantedAt: Timestamp,
      grantedBy: "admin@example.com",
      maps: null  // null = all maps, or array of specific map names
    },
    "virginia_beach": {
      enabled: false,
      revokedAt: Timestamp,
      revokedBy: "admin@example.com"
    }
  }
}
```

## Navigation Structure

### Super Admin
- **Atlas → Configuration**: Manage atlas for all organizations
- **Atlas → Users**: View/manage Atlas users across all orgs
- **Atlas → Preview**: Preview guidance

### Org Admin
- **Atlas → Maps**: Manage maps for their organization
- **Atlas → Users**: Manage Atlas users for their org
- **Atlas → Preview**: Open Atlas preview

## Integration with AdminApp

### Update Sidebar Navigation

```jsx
// In Sidebar component
const atlasItems = role === 'super_admin' 
  ? [
      { id: 'configuration', label: 'Configuration', icon: Settings },
      { id: 'users', label: 'Users', icon: Users },
      { id: 'preview', label: 'Preview', icon: Eye }
    ]
  : [
      { id: 'maps', label: 'Maps', icon: Layers },
      { id: 'users', label: 'Users', icon: Users },
      { id: 'preview', label: 'Preview', icon: Eye }
    ];
```

### Update Content Rendering

```jsx
// In renderContent function
if (activeSection === 'atlas') {
  return (
    <AtlasAdminSection
      db={db}
      role={role}
      activeTab={activeTab}
      orgId={orgId}
      orgData={orgData}
      addToast={addToast}
      confirm={confirm}
      accentColor={accentColor}
      adminEmail={user.email}
    />
  );
}
```

## Feature Comparison: Notify vs Atlas Admin

| Feature | Notify | Atlas |
|---------|--------|-------|
| Overall Settings | Organization name | UI, messages, basemaps |
| Items | Notifications | Maps |
| Item Editor | NotificationEditor | MapEditor |
| Item Properties | Schedule, source, fields | WebMap, endpoint, columns |
| **Users** | Subscribers | Atlas Users |
| User Access | Subscriptions per notification | Access per organization |
| **Save Workflow** | Direct save | Draft → Publish |
| **Preview** | Archive/logs | Live or Draft preview |
| Wizard | NotificationWizard | - (future) |

## Styling

The components use the same accent colors as the rest of the admin app:
- Super Admin: `#004E7C` (CivQuest blue)
- Org Admin: `#1E5631` (CivQuest green)

## File Structure

```
src/admin/components/
├── index.js                    # Component exports
├── AtlasConfiguration.jsx      # Main atlas config component
├── AtlasSettingsEditor.jsx     # Settings modal
├── MapEditor.jsx               # Map configuration modal
├── AtlasUserManagement.jsx     # User access management
├── AtlasAdminSection.jsx       # Integration component
└── ... (other components)
```

## Migration Checklist

- [x] Create AtlasConfiguration component
- [x] Create AtlasSettingsEditor modal
- [x] Create MapEditor modal
- [x] Create AtlasUserManagement component
- [x] Create AtlasAdminSection integration
- [x] Update component exports
- [x] Update AdminApp sidebar with Users tab
- [x] Update AdminApp content rendering
- [x] Add uninitialize Atlas option
- [x] Implement draft/publish workflow
- [x] Add draft preview functionality
- [ ] Test with super_admin role
- [ ] Test with org_admin role
- [ ] Add ServiceFinder integration for map sources
- [ ] Implement draft config loading in Atlas app (`?preview=draft`)
- [ ] Add Atlas Wizard (future enhancement)
