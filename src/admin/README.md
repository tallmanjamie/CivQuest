# CivQuest Admin Module - Migration v2

## Overview

This migration consolidates the Notify administration tools into the unified `/admin/` CivQuest application using the **new unified Firestore paths**.

## Key Changes from v1

### 1. Firestore Path Migration

All components now use the unified Firestore paths:

| Legacy Path | New Unified Path |
|-------------|------------------|
| `artifacts/civquest_notifications/configuration/{orgId}` | `organizations/{orgId}` |
| `artifacts/civquest_notifications/users/{uid}` | `users/{uid}` |
| `artifacts/civquest_notifications/org_admins/{email}` | `admins/{uid}` |
| `artifacts/civquest_notifications/invitations/{email}` | `invitations/{email}` |
| `artifacts/civquest_notifications/public/data/logs` | `logs` |
| `artifacts/civquest_notifications/force_queue` | `force_queue` |

### 2. Admin Document Structure Change

The `admins` collection now uses Firebase UID as the document key (instead of email):

```javascript
// Old structure (org_admins/{email})
{
  email: "admin@example.com",
  orgId: "chesapeake",
  disabled: false
}

// New structure (admins/{uid})
{
  email: "admin@example.com",
  role: "super_admin" | "org_admin",
  organizationId: "chesapeake",  // Note: renamed from orgId
  disabled: false
}
```

### 3. ArcGIS Auth Moved to Shared Services

The ArcGIS OAuth utilities are now in `shared/services/arcgis-auth.js` for reuse across modules.

## File Structure

```
src/
├── shared/
│   └── services/
│       ├── index.js              # Service exports
│       ├── paths.js              # Firestore path configuration
│       └── arcgis-auth.js        # ArcGIS OAuth utilities
│
├── admin/
│   ├── AdminApp.jsx              # Main unified admin application
│   ├── index.js                  # Module exports
│   └── components/
│       ├── index.js              # Component exports
│       ├── Archive.jsx           # Notification archive/logs viewer
│       ├── Configuration.jsx     # Notification configuration management
│       ├── NotificationEditor.jsx # Notification editing modal
│       ├── UserManagement.jsx    # User/subscriber management
│       ├── ServiceFinder.jsx     # [STUB] ArcGIS service discovery
│       └── SpatialFilter.jsx     # [STUB] Spatial filtering
│
└── main.jsx                      # Entry point with routing
```

## Navigation Structure

### Super Admin View
- **Notify** (expandable)
  - Subscribers (users management)
  - Configuration (all orgs)
  - Archive (logs)
  - Org Admins (manage org admin users)
- **Atlas** (coming soon)

### Org Admin View
- **Notify** (expandable)
  - Subscribers (org-specific)
  - Notifications (org config)
  - Archive (org logs)
- **Atlas** (coming soon)

## Accent Colors

- Super Admin: `#004E7C` (CivQuest blue)
- Org Admin: `#1E5631` (CivQuest green)

## Paths Helper

The `paths.js` module provides centralized path configuration:

```javascript
import { PATHS } from '../shared/services/paths';

// Usage
collection(db, PATHS.organizations)
collection(db, PATHS.users)
collection(db, PATHS.admins)
collection(db, PATHS.logs)
doc(db, PATHS.organizations, orgId)
doc(db, PATHS.users, uid)
```

## Routing

The `main.jsx` supports both subdomain and path-based routing:

| URL Pattern | Application |
|-------------|-------------|
| `admin.civ.quest` | AdminApp |
| `localhost:5173/admin` | AdminApp |
| `localhost:5173?module=admin` | AdminApp |
| `notify.civ.quest` | NotifyApp |
| Default | NotifyApp |

## Migration Checklist

- [x] Create unified AdminApp with sidebar navigation
- [x] Update all components to use unified Firestore paths
- [x] Migrate ArcGIS auth to shared services
- [x] Support both Super Admin and Org Admin roles
- [x] Update Subscribers (UserManagement) component paths
- [x] Update Configuration component paths
- [x] Update Archive component paths
- [x] Add stubbed Atlas section
- [x] Create stub ServiceFinder component
- [x] Create stub SpatialFilter component
- [ ] Implement ServiceFinder (future)
- [ ] Implement SpatialFilter (future)
- [ ] Implement NotificationWizard (future)
- [ ] Implement Atlas admin tools (Phase 3)

## Dependencies

The admin module requires:
- React 18+
- Firebase (Auth + Firestore)
- Lucide React icons
- Tailwind CSS

## Testing

To test locally:

```bash
npm run dev

# Access admin portal:
# http://localhost:5173/admin
# or
# http://localhost:5173?module=admin
```

## Notes

1. The unified paths assume Phase 0 data migration has been completed
2. Security rules must support both legacy and new paths during transition
3. The `admins` collection now filters by `role === 'org_admin'` for org admin listing
