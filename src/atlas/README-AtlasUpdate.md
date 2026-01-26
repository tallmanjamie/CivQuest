# Atlas Updates - ES Modules & Search Bar Position

## CRITICAL: Fixing the `multipleDefine` Error

The `multipleDefine` error was caused by using the ArcGIS AMD loader (`require()`) which conflicts with React's rendering lifecycle. The solution is to use `@arcgis/core` ES modules instead (the same pattern used in `SpatialFilter.jsx`).

### Step 1: Install @arcgis/core (if not already installed)

```bash
npm install @arcgis/core
```

### Step 2: Remove the ArcGIS CDN script tag from your HTML

Remove this from your `index.html`:
```html
<!-- REMOVE THESE -->
<link rel="stylesheet" href="https://js.arcgis.com/4.28/esri/themes/light/main.css">
<script src="https://js.arcgis.com/4.28/"></script>
```

### Step 3: Import the CSS in your app entry point

In your `main.jsx` or `App.jsx`:
```javascript
import '@arcgis/core/assets/esri/themes/light/main.css';
```

### Step 4: Replace MapView.jsx

Replace `src/atlas/components/MapView.jsx` with the new version that uses ES module imports.

---

## Files Included

| File | Description |
|------|-------------|
| **MapView.jsx** | Updated to use `@arcgis/core` ES modules (fixes multipleDefine error) |
| **AtlasApp.jsx** | Main app with SearchToolbar, reads `config.ui.searchBarPosition` |
| **Header.jsx** | Simplified header (mode toggle moved to SearchToolbar) |
| **ChatView.jsx** | Updated with search moved to toolbar |
| **TableView.jsx** | Updated with search moved to toolbar |
| **AtlasSettingsEditor.jsx** | Admin modal with new searchBarPosition setting |

---

## New Configuration Option: Search Bar Position

The search bar position can be configured in `atlasConfig.ui.searchBarPosition`:
- `'top'` - Search bar appears below the header (default)
- `'bottom'` - Search bar appears below the content area

### In your atlas config:
```javascript
{
  ui: {
    // ... other settings
    searchBarPosition: 'top'  // or 'bottom'
  }
}
```

---

## Update Required: AtlasConfiguration.jsx

To display the search bar position in the admin overview, update the `AtlasOverviewCard` component:

Find this section:
```jsx
<div className="space-y-1 text-sm">
  <p><span className="text-slate-500">Title:</span> {ui.title || '-'}</p>
  <p><span className="text-slate-500">Header:</span> {ui.headerTitle || '-'}</p>
  <p><span className="text-slate-500">Theme:</span> {ui.themeColor || 'sky'}</p>
</div>
```

Add this line:
```jsx
<p><span className="text-slate-500">Search Bar:</span> {ui.searchBarPosition === 'bottom' ? 'Bottom' : 'Top'}</p>
```

---

## Update Required: useAtlasConfig.js (Optional)

Add the default value to `DEFAULT_CONFIG`:

```javascript
const DEFAULT_CONFIG = {
  ui: {
    // ... existing fields
    searchBarPosition: 'top'  // <-- ADD THIS
  },
};
```

---

## File Structure After Update

```
src/atlas/
├── AtlasApp.jsx              # Main app with SearchToolbar
├── components/
│   ├── MapView.jsx           # Uses @arcgis/core ES modules
│   ├── ChatView.jsx
│   ├── TableView.jsx
│   └── Header.jsx
└── hooks/
    └── useAtlasConfig.js

src/admin/components/
├── AtlasSettingsEditor.jsx   # Has searchBarPosition setting
└── AtlasConfiguration.jsx    # Display searchBarPosition
```

---

## Why @arcgis/core ES Modules?

The AMD loader approach (using `require()` from a CDN script tag) has several issues:
1. **multipleDefine errors** - The Dojo AMD loader can't handle React's double-render in development/StrictMode
2. **Module conflicts** - Vite's bundler has its own `require` which can conflict
3. **No tree-shaking** - All modules are loaded, even if unused

The `@arcgis/core` approach:
1. **Native ES modules** - Works seamlessly with React and Vite
2. **Tree-shakeable** - Only imports what you use
3. **TypeScript support** - Full type definitions included
4. **Same pattern as SpatialFilter.jsx** - Consistent with existing code

---

## Troubleshooting

### "Cannot find module '@arcgis/core/...'"
Make sure you've installed the package:
```bash
npm install @arcgis/core
```

### CSS not loading
Add the CSS import to your entry point:
```javascript
import '@arcgis/core/assets/esri/themes/light/main.css';
```

### Still getting multipleDefine?
Make sure you've removed the CDN script tags from index.html:
```html
<!-- These should be REMOVED -->
<link rel="stylesheet" href="https://js.arcgis.com/4.28/...">
<script src="https://js.arcgis.com/4.28/"></script>
```
