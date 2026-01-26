# CivQuest Unified Platform

A monorepo containing the CivQuest suite of applications: Notify, Atlas, and Admin portals.

## Architecture

```
civquest/
├── src/
│   ├── shared/              # Shared code across all modules
│   │   ├── components/      # Reusable UI components
│   │   │   ├── ConfirmDialog.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── LoadingSpinner.jsx
│   │   │   └── Toast.jsx
│   │   ├── services/        # Shared business logic
│   │   │   ├── firebase.js      # Firebase initialization
│   │   │   ├── paths.js         # Firestore path helpers
│   │   │   ├── arcgis-auth.js   # ArcGIS OAuth utilities
│   │   │   ├── email.js         # Brevo email service
│   │   │   ├── organizations.js # Organization CRUD
│   │   │   ├── users.js         # User management
│   │   │   ├── admins.js        # Admin management
│   │   │   └── invitations.js   # Invitation system
│   │   ├── hooks/           # Shared React hooks (TODO)
│   │   └── utils/           # Utility functions (TODO)
│   │
│   ├── notify/              # Notify module
│   │   ├── NotifyApp.jsx    # Main Notify application
│   │   └── components/
│   │       ├── Archive.jsx
│   │       ├── AuthScreen.jsx
│   │       ├── Dashboard.jsx
│   │       ├── SubscriptionsTab.jsx
│   │       └── AccountTab.jsx
│   │
│   ├── admin/               # Admin module (Phase 2b)
│   │   ├── SuperAdminApp.jsx    # System admin portal
│   │   ├── OrgAdminApp.jsx      # Organization admin portal
│   │   └── components/
│   │       ├── NotificationEditor.jsx
│   │       ├── ServiceFinder.jsx
│   │       ├── SpatialFilter.jsx
│   │       ├── UserManagement.jsx
│   │       └── Configuration.jsx
│   │
│   └── atlas/               # Atlas module (Phase 3)
│       └── AtlasApp.jsx     # Atlas application
│
├── index.html               # Entry HTML
├── main.jsx                 # Application entry with routing
├── vite.config.js           # Vite configuration
├── tailwind.config.js       # Tailwind CSS configuration
└── package.json             # Dependencies
```

## Migration Status

### Phase 1: Foundation ✅
- [x] Monorepo structure setup
- [x] Shared services (Firebase, paths, email)
- [x] Shared components (Toast, Header, LoadingSpinner, ConfirmDialog)
- [x] Path aliases configuration

### Phase 2: Notify Migration ✅
- [x] AuthScreen component
- [x] Dashboard component
- [x] SubscriptionsTab component
- [x] AccountTab component
- [x] Archive component
- [x] ArcGIS OAuth integration
- [x] NotifyApp main component

### Phase 2b: Admin Migration (TODO)
- [ ] SuperAdminApp
- [ ] OrgAdminApp
- [ ] NotificationEditor
- [ ] ServiceFinder
- [ ] SpatialFilter
- [ ] UserManagement
- [ ] Configuration

### Phase 3: Atlas Integration (TODO)
- [ ] AtlasApp
- [ ] Map viewer component
- [ ] Atlas-specific services

## Firestore Path Strategy

The codebase uses the **new unified paths**:

| Collection | Path | Description |
|------------|------|-------------|
| Organizations | `organizations/{orgId}` | Organization configuration |
| Users | `users/{uid}` | User accounts and subscriptions |
| Admins | `admins/{uid}` | Admin roles (super_admin, org_admin) |
| Logs | `logs/{logId}` | Notification archive/history |
| Invitations | `invitations/{email}` | User invitations |

Legacy paths under `artifacts/civquest_notifications/` are still accessible but no longer used.

## Development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your API keys

# Start development server
npm run dev

# Build for production
npm run build

# Run logs migration
npm run migrate:logs
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|----------|-------------|
| `VITE_BREVO_API_KEY` | Brevo (Sendinblue) API key for sending emails |

**Note:** Never commit `.env` to git - it's in `.gitignore`.

## Routing

### Subdomain-based (Production)
- `notify.civ.quest` → Notify app
- `atlas.civ.quest` → Atlas app
- `admin.civ.quest` → Admin portal

### Path-based (Development)
- `/` → Notify app (default)
- `/admin` → Super Admin portal
- `/org-admin` → Organization Admin portal

## Environment

Uses existing Firebase project: `civquest-notify`

ArcGIS OAuth Client ID: `SPmTwmqIB2qEz51L`

## Key Features

### Notify Module
- Email/password authentication
- ArcGIS OAuth sign-in/sign-up
- Subscription management
- Notification archive with filters
- Account settings with ArcGIS linking

### Admin Module (Coming)
- User management
- Organization configuration
- Notification editor with ArcGIS service integration
- Spatial filtering

### Atlas Module (Coming)
- Interactive map viewer
- Organization-specific map configurations

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
