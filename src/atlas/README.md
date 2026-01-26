# CivQuest Atlas Module

## Overview

The Atlas module is the GIS mapping and property search component of the CivQuest unified platform. It replaces the legacy vanilla JavaScript Portal application with a React-based implementation that integrates with the unified Firestore configuration system.

## Architecture

```
src/atlas/
├── AtlasApp.jsx              # Main application with context provider
├── index.js                  # Module exports
│
├── components/
│   ├── index.js              # Component exports
│   ├── Header.jsx            # Application header with mode switcher
│   ├── ChatView.jsx          # AI-powered conversational search interface
│   ├── MapView.jsx           # ArcGIS WebMap with results layer
│   ├── TableView.jsx         # AG Grid data table with filtering/export
│   ├── LoadingScreen.jsx     # Loading state component
│   ├── ErrorScreen.jsx       # Error state component
│   ├── WelcomeScreen.jsx     # First-time user welcome
│   └── OrgSelector.jsx       # Organization picker
│
└── hooks/
    ├── index.js              # Hook exports
    ├── useAtlasConfig.js     # Firestore config loading & org detection
    └── useArcGISAuth.js      # ArcGIS authentication management
```

## Key Features

### 1. Three View Modes

- **Chat Mode**: AI-powered conversational search using Gemini for natural language query translation
- **Map Mode**: ArcGIS WebMap with results overlay, basemap switching, and feature selection
- **Table Mode**: AG Grid data table with sorting, filtering, column management, and CSV export

### 2. Configuration from Firestore

Configuration is loaded from `organizations/{orgId}.atlasConfig` in Firestore, replacing the static JSON files:

```javascript
// Example atlasConfig structure
{
  ui: {
    title: "Chesapeake CivQuest Property Site",
    headerTitle: "City of Chesapeake",
    headerSubtitle: "CivQuest Property Site",
    headerClass: "bg-sky-700",
    logoLeft: "https://...",
    logoRight: "https://...",
    botAvatar: "https://...",
    themeColor: "sky",
    defaultMode: "map"
  },
  messages: {
    welcomeTitle: "Welcome!",
    welcomeText: "...",
    exampleQuestions: ["306 Cedar Rd", "..."],
    importantNote: "..."
  },
  basemaps: [
    { label: "Community", id: "default", type: "esri" },
    { label: "2025 Aerial", id: "vbmp-2025", type: "arcgis", url: "..." }
  ],
  data: {
    systemPrompt: "...", // Gemini prompt for query translation
    maxRecordCount: 10000,
    timeZoneOffset: -5,
    defaultSort: "SALEDATE DESC",
    maps: [
      {
        name: "Public Map",
        searchPlaceholder: "Ask about properties",
        enabledModes: ["chat", "map", "table"],
        webMap: {
          portalUrl: "https://...",
          itemId: "..."
        },
        endpoint: "https://.../FeatureServer/2",
        autocomplete: [...],
        searchFields: [...],
        tableColumns: [...],
        geocoder: {...}
      }
    ]
  }
}
```

### 3. ArcGIS Authentication

- **Public Access**: Atlas works without login for public maps
- **ArcGIS Sign-In**: Optional authentication for protected maps
- **Token Management**: LocalStorage-based session persistence
- **Multi-Org Support**: Works with any ArcGIS Online organization

### 4. Organization Detection

The organization is detected from:
1. Query parameter: `?org=chesapeake`
2. URL path: `/atlas/chesapeake` or `/chesapeake`
3. Subdomain: `chesapeake.atlas.civ.quest`
4. localStorage: Last used organization

### 5. Shared State via Context

The `AtlasContext` provides:
- Configuration and active map
- Search results and location
- Authentication state
- Mode management
- Cross-view actions (zoom, highlight)

## Usage

### Basic Import

```javascript
import { AtlasApp } from './atlas';

// Or import specific components
import { 
  MapView, 
  TableView, 
  ChatView,
  useAtlasConfig,
  useArcGISAuth 
} from './atlas';
```

### URL Routing

| URL Pattern | Result |
|-------------|--------|
| `atlas.civ.quest` | AtlasApp with org selector |
| `atlas.civ.quest?org=chesapeake` | AtlasApp for Chesapeake |
| `chesapeake.atlas.civ.quest` | AtlasApp for Chesapeake |
| `localhost:5173/atlas` | AtlasApp (dev) |
| `localhost:5173/atlas/chesapeake` | AtlasApp for Chesapeake (dev) |
| `localhost:5173?module=atlas` | AtlasApp (dev) |

### Custom Hooks

```javascript
// Load organization config
const { config, loading, error, orgId, setOrgId } = useAtlasConfig();

// Get active map from config
const { activeMap, activeMapIndex, setActiveMap } = useActiveMap(config);

// ArcGIS authentication
const { user, isAuthenticated, signIn, signOut } = useArcGISAuth();
```

## Dependencies

- **React 18+**: UI framework
- **Firebase/Firestore**: Configuration storage
- **ArcGIS JS API 4.29+**: Map rendering (loaded via CDN)
- **AG Grid Community**: Data table
- **Lucide React**: Icons
- **Tailwind CSS**: Styling

## Migration from Portal

### What Changed

| Portal (Vanilla JS) | Atlas (React) |
|---------------------|---------------|
| `window.CLIENT_CONFIG` | `useAtlasConfig()` hook |
| `window.MapMode` | `<MapView>` component |
| `window.TableMode` | `<TableView>` component |
| Chat in `app.js` | `<ChatView>` component |
| `sign-in.js` | `useArcGISAuth()` hook |
| `*.json` files | Firestore `atlasConfig` |
| EJS template | React components |

### Configuration Migration

Portal JSON configs were migrated to Firestore during Phase 0:

```javascript
// Old: /Portal/chesapeake.json
// New: Firestore organizations/chesapeake.atlasConfig

// The structure is preserved, just stored differently
```

## Integration with CivQuest

Atlas integrates with the unified platform:

1. **Shared Firebase**: Uses the same Firebase project (`civquest-notify`)
2. **Shared Services**: Uses `paths.js`, `firebase.js` from `shared/services/`
3. **Unified Routing**: `main.jsx` routes to Atlas based on URL
4. **Admin Integration**: Admin portal can manage Atlas configs (Phase 4)

## Future Enhancements (Phase 4)

- [ ] Atlas config editor in Admin portal
- [ ] Map layer management UI
- [ ] Tool visibility controls
- [ ] Custom basemap management
- [ ] Analytics dashboard

## Troubleshooting

### Map Not Loading

1. Check that the WebMap ID exists and is accessible
2. Verify ArcGIS auth if the map is protected
3. Check browser console for CORS errors

### Config Not Loading

1. Verify the organization exists in Firestore
2. Check that `atlasConfig` field exists
3. Verify Firestore security rules allow read

### Search Not Working

1. Check that the feature service endpoint is accessible
2. Verify the systemPrompt is configured
3. Check Gemini API key is valid
