# CivQuest Unified Platform Architecture

## Executive Summary

This document outlines the target architecture for integrating **Atlas** (GIS mapping tools) into **Notify** (notification system), creating a unified CivQuest platform with three distinct entry points:

| Domain | Purpose | Access Level |
|--------|---------|--------------|
| `notify.civ.quest` | End-user notification subscriptions | Authenticated users (Firebase) |
| `atlas.civ.quest` | GIS mapping & property research tools | **Public** (no login required) |
| `admin.civ.quest` | Organization & system administration | Org Admins + Super Admins |

### Atlas Access Tiers

| Tier | Authentication | Access |
|------|----------------|--------|
| **Public** | None required | Public maps, basic tools |
| **ArcGIS Authenticated** | Linked ArcGIS account | Public maps + protected maps, enhanced tools |

**Terminology Note**: "Atlas" refers to the CivQuest mapping product. "ArcGIS Portal" or "Enterprise Portal" refers to Esri's ArcGIS Enterprise Portal software. These are distinct systems.

---

## Migration Status Overview

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 0 | Firestore Migration | ✅ COMPLETE |
| Phase 1 | Foundation (Monorepo, Shared Services) | ✅ COMPLETE |
| Phase 2 | Notify Migration | ✅ COMPLETE |
| Phase 2b | Admin Migration | ✅ COMPLETE |
| Phase 3 | Atlas Integration | ⏳ NEXT |
| Phase 4 | Admin Portal Enhancement | 📋 PLANNED |
| Phase 5 | Testing & Polish | 📋 PLANNED |

---

## Phase 0: Firestore Migration ✅ COMPLETE

### Migration Strategy: In-Place Data Migration

Rather than creating a new Firebase project, we migrated data **within the existing `civquest-notify` project**:

- ✅ **Keep existing Firebase project** and all authentication
- ✅ **Keep all user accounts** — no re-registration required
- ✅ **Migrate Firestore data** from nested paths to flat collections
- ✅ **Run old and new code in parallel** during transition

### What Was Migrated

| Old Path (Legacy) | New Path (Unified) | Status |
|-------------------|-------------------|--------|
| `artifacts/civquest_notifications/configuration/{orgId}` | `organizations/{orgId}` | ✅ Migrated |
| `artifacts/civquest_notifications/users/{uid}` | `users/{uid}` | ✅ Migrated |
| `artifacts/civquest_notifications/org_admins/{email}` | `admins/{uid}` | ✅ Migrated |
| `artifacts/civquest_notifications/public/data/logs` | `logs` | ✅ Migrated |
| Portal JSON files (chesapeake.json, etc.) | `organizations/{orgId}.atlasConfig` | ✅ Merged |

### Migration Results

```
Organizations migrated: 7
  - chesapeake_va, chesapeake, hampton, charlottesville
  - civic_vanguard_inc_mkprl5rk, goochland_va, orangecounty_va

Users migrated: 16
  - Subscriptions preserved: 39

Admins migrated: 4
  - Super admin: support@civicvanguard.com
  - Org admins: 3
```

### New Firestore Structure

```
firestore/
├── organizations/                    # Unified org configs
│   └── {orgId}/
│       ├── id: string
│       ├── name: string
│       ├── timezone: string
│       ├── notifications: [...]      # From old configuration
│       └── atlasConfig: {...}        # From Portal JSON files
│
├── users/                            # Top-level users
│   └── {uid}/
│       ├── email: string
│       ├── subscriptions: {...}
│       ├── disabled: boolean
│       └── arcgisUsername?: string   # If linked
│
├── admins/                           # Admin roles (UID-keyed)
│   └── {uid}/
│       ├── email: string
│       ├── role: "super_admin" | "org_admin"
│       └── organizationId?: string   # For org_admin only
│
├── logs/                             # Notification archive/history
│   └── {logId}/
│       ├── organizationId: string
│       ├── notificationId: string
│       ├── sentAt: timestamp
│       └── ...
│
├── invitations/                      # User invitations
│   └── {email}/
│       ├── orgId: string
│       ├── createdAt: timestamp
│       └── ...
│
├── force_queue/                      # Manual broadcast triggers
│   └── {queueId}/...
│
└── artifacts/                        # LEGACY: Still intact for reference
    └── civquest_notifications/
        ├── configuration/
        ├── users/
        └── org_admins/
```

---

## Phase 1: Foundation ✅ COMPLETE

### What Was Completed

Phase 1 established the monorepo structure and foundation for the unified platform:

- ✅ **GitHub Repository**: `https://github.com/tallmanjamie/CivQuest`
- ✅ **Monorepo Structure**: Organized `src/` with `shared/`, `notify/`, `atlas/`, `admin/` modules
- ✅ **Vite + React Setup**: Modern build tooling with path aliases
- ✅ **Subdomain Routing**: `main.jsx` routes based on subdomain or `?module=` query param
- ✅ **Shared Services**: Firebase, Firestore paths, organization/user/admin services
- ✅ **Shared Components**: Header, Toast, LoadingSpinner, ConfirmDialog
- ✅ **Module Placeholders**: NotifyApp, AtlasApp, AdminApp entry points

---

## Phase 2: Notify Migration ✅ COMPLETE

### What Was Completed

Phase 2 fully migrated the Notify application to the unified platform:

- ✅ **AuthScreen component** — Email/password and ArcGIS OAuth sign-in/sign-up
- ✅ **Dashboard component** — Main user interface with tabbed navigation
- ✅ **SubscriptionsTab component** — Manage notification subscriptions
- ✅ **AccountTab component** — Account settings and ArcGIS linking
- ✅ **Archive component** — View notification history with filtering
- ✅ **ArcGIS OAuth integration** — Full OAuth flow with account linking
- ✅ **NotifyApp main component** — Complete feature parity with production
- ✅ **Embed mode support** — Query param-based embedding (`?embed=true`)
- ✅ **Deep linking** — Direct subscription via URL params

### Notify Module Structure (Actual)

```
src/notify/
├── NotifyApp.jsx           # Main application with auth, routing, embed support
├── index.js                # Module exports
└── components/
    ├── index.js            # Component exports
    ├── Archive.jsx         # Notification archive viewer (user role)
    ├── AuthScreen.jsx      # Login/signup with ArcGIS OAuth
    ├── Dashboard.jsx       # Main dashboard container
    ├── SubscriptionsTab.jsx # Subscription management
    └── AccountTab.jsx      # Account settings & ArcGIS linking
```

---

## Phase 2b: Admin Migration ✅ COMPLETE

### What Was Completed

Phase 2b migrated all admin functionality to a unified admin portal:

- ✅ **Unified AdminApp** — Single entry point for both Super Admin and Org Admin
- ✅ **Role-based navigation** — Different sidebar menus based on admin role
- ✅ **UserManagement component** — Full user/subscriber management
- ✅ **Configuration component** — Notification configuration management
- ✅ **Archive component** — Admin-level archive viewer with bulk actions
- ✅ **NotificationEditor component** — Full notification rule editor
- ✅ **ServiceFinder component** — ArcGIS service discovery tool
- ✅ **SpatialFilter component** — Geofence drawing with buffer support
- ✅ **NotificationWizard component** — AI-powered notification discovery
- ✅ **Org Admin management** — Super admins can manage org admins

### Admin Module Structure (Actual)

```
src/admin/
├── AdminApp.jsx            # Unified admin with role detection & sidebar
├── index.js                # Module exports
├── README.md               # Admin module documentation
└── components/
    ├── index.js            # Component exports
    ├── Archive.jsx         # Admin archive viewer (multi-org support)
    ├── Configuration.jsx   # Notification configuration management
    ├── NotificationEditor.jsx # Full notification rule editor
    ├── UserManagement.jsx  # User/subscriber management
    ├── ServiceFinder.jsx   # ArcGIS service discovery
    ├── SpatialFilter.jsx   # Geofence drawing with buffer
    └── NotificationWizard.jsx # AI-powered notification setup
```

### Deviations from Original Architecture

| Documented | Actual Implementation | Notes |
|------------|----------------------|-------|
| `SuperAdminApp.jsx` / `OrgAdminApp.jsx` | Single `AdminApp.jsx` | **Simplified**: Unified component handles both roles with conditional rendering |
| ServiceFinder marked as stub | Fully implemented | ServiceFinder is complete, not a stub |
| SpatialFilter marked as stub | Fully implemented | SpatialFilter is complete with buffer support, linked account auth |
| NotificationWizard marked for future | Fully implemented | AI-powered wizard is complete |
| `archives/{orgId}/notifications/` | `logs/{logId}` | **Changed**: Flat logs collection instead of nested archives |

---

## Shared Services ✅ COMPLETE

### Implemented Services

```
src/shared/
├── components/
│   ├── ConfirmDialog.jsx   # Reusable confirmation modal
│   ├── Header.jsx          # App header with logo
│   ├── LoadingSpinner.jsx  # Loading indicator
│   └── Toast.jsx           # Toast notification system
│
└── services/
    ├── index.js            # Service exports
    ├── firebase.js         # Firebase initialization
    ├── paths.js            # Firestore path configuration
    ├── arcgis-auth.js      # ArcGIS OAuth utilities
    ├── email.js            # Brevo email service
    ├── organizations.js    # Organization CRUD
    ├── users.js            # User management
    ├── admins.js           # Admin role management
    └── invitations.js      # Invitation system
```

### Path Configuration (paths.js)

```javascript
export const PATHS = {
  organizations: 'organizations',
  organization: (orgId) => `organizations/${orgId}`,
  users: 'users',
  user: (uid) => `users/${uid}`,
  admins: 'admins',
  admin: (uid) => `admins/${uid}`,
  invitations: 'invitations',
  invitation: (email) => `invitations/${email.toLowerCase()}`,
  logs: 'logs',
  log: (logId) => `logs/${logId}`,
  forceQueue: 'force_queue',
  
  // Legacy paths (for reference/migration support)
  legacy: { /* ... */ }
};
```

---

## Phase 3: Atlas Integration ⏳ NEXT

### Current State

Atlas module exists as a **placeholder**:

```javascript
// src/atlas/AtlasApp.jsx
export default function AtlasApp() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="CivQuest Atlas" subtitle="GIS Mapping Tools" />
      <main className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Atlas Module</h2>
          <p className="text-slate-600">Coming in Phase 3: GIS mapping and property research tools.</p>
        </div>
      </main>
    </div>
  );
}
```

### Phase 3 Tasks

1. **Convert Atlas's vanilla JS to React components:**
   - `app.js` → `AtlasApp.jsx` + hooks
   - `map-mode.js` → `MapView.jsx`
   - `table-mode.js` → `TableView.jsx`
   - `maptools/*.js` → `tools/*.jsx`
2. **Create ArcGIS auth module for Atlas** (localStorage-based)
3. **Replace EJS template with React components**
4. **Load config from Firestore** (`organizations/{orgId}.atlasConfig`)
5. **Implement tool visibility based on ArcGIS auth state**

### Atlas Admin Integration

The admin module already has Atlas stubs in the sidebar navigation:
- Super Admin: "Atlas" section (coming soon)
- Org Admin: "Atlas" section (coming soon)

---

## Phase 4: Admin Portal Enhancement 📋 PLANNED

1. Build Atlas config editor (org admin)
2. Build organization creation wizard (super admin)
3. Implement dashboard analytics
4. Add notification scheduling calendar view
5. Build multi-org notification templates

---

## Phase 5: Testing & Polish 📋 PLANNED

1. End-to-end testing across all three domains
2. Cross-domain navigation testing
3. Performance optimization
4. Documentation and training materials
5. DNS configuration for subdomains
6. Deprecate legacy Firestore paths

---

## Key Technical Decisions

### Why In-Place Migration (not new Firebase project)?
1. **No user disruption**: All 16 users keep their existing accounts
2. **No auth migration complexity**: Firebase Auth accounts stay unchanged
3. **Parallel operation**: Old and new code can run simultaneously
4. **Simpler rollback**: Legacy data remains intact if issues arise
5. **Single project management**: One Firebase project to maintain

### Why Unified AdminApp (not separate SuperAdminApp/OrgAdminApp)?
1. **Code reuse**: Same components with role-based rendering
2. **Simpler routing**: Single `/admin` path handles both roles
3. **Consistent UX**: Same navigation patterns for all admins
4. **Easier maintenance**: One component to update, not two

### Why keep ArcGIS Auth for Atlas (not Firebase)?
1. **Public Access**: Atlas should be accessible without any login
2. **Existing Flow**: Current Portal users already authenticate with ArcGIS
3. **Map Access Control**: ArcGIS-protected maps require ArcGIS tokens anyway
4. **Simplicity**: No need to sync two auth systems for Atlas users

### Why Firebase Auth for Notify/Admin (not ArcGIS)?
1. **Subscription Management**: Notify needs persistent user accounts
2. **Role-Based Access**: Admin portal needs org_admin vs super_admin roles
3. **Existing Investment**: Notify already has mature Firebase auth
4. **Non-GIS Users**: Many Notify subscribers don't have ArcGIS accounts

### Why Convert Atlas to React (not keep vanilla JS)?
1. **Code Sharing**: Reuse components and services across modules
2. **State Management**: React's state model better handles complex UI
3. **Developer Experience**: Single framework, single build process
4. **Future Maintainability**: Easier to find React developers

### Why Firestore for Atlas Config (not keep JSON files)?
1. **Dynamic Updates**: Change config without redeployment
2. **Admin UI**: Org admins can modify their Atlas settings
3. **Multi-tenancy**: Per-organization configs in single database
4. **Audit Trail**: Firestore provides automatic change history

---

## Application Module Structure (Current)

```
src/
├── main.jsx                          # Entry point with subdomain/path routing
├── index.css                         # Global styles (Tailwind)
│
├── shared/                           # Shared utilities
│   ├── components/
│   │   ├── ConfirmDialog.jsx
│   │   ├── Header.jsx
│   │   ├── LoadingSpinner.jsx
│   │   └── Toast.jsx
│   └── services/
│       ├── index.js
│       ├── firebase.js               # Firebase init
│       ├── paths.js                  # Firestore path configuration
│       ├── organizations.js          # Organization CRUD
│       ├── users.js                  # User CRUD
│       ├── admins.js                 # Admin role checks
│       ├── invitations.js            # Invitation management
│       ├── email.js                  # Brevo email service
│       └── arcgis-auth.js            # ArcGIS OAuth utilities
│
├── notify/                           # Notify Module (Firebase Auth) ✅
│   ├── NotifyApp.jsx
│   ├── index.js
│   └── components/
│       ├── index.js
│       ├── Archive.jsx
│       ├── AuthScreen.jsx
│       ├── Dashboard.jsx
│       ├── SubscriptionsTab.jsx
│       └── AccountTab.jsx
│
├── atlas/                            # Atlas Module (ArcGIS Auth) ⏳
│   └── AtlasApp.jsx                  # Placeholder
│
└── admin/                            # Admin Module (Firebase Auth) ✅
    ├── AdminApp.jsx                  # Unified admin (handles both roles)
    ├── index.js
    ├── README.md
    └── components/
        ├── index.js
        ├── Archive.jsx
        ├── Configuration.jsx
        ├── NotificationEditor.jsx
        ├── UserManagement.jsx
        ├── ServiceFinder.jsx
        ├── SpatialFilter.jsx
        └── NotificationWizard.jsx
```

---

## Routing Configuration

### main.jsx Routing Logic

```javascript
// Path-based routing (development and production)
if (path.startsWith('/admin')) → AdminApp
if (path.startsWith('/org-admin')) → AdminApp (legacy redirect)

// Subdomain-based routing (production)
'notify' → NotifyApp
'atlas' → NotifyApp (temporary, Atlas not ready)
'admin' → AdminApp
default → NotifyApp
```

### URL Patterns

| URL Pattern | Application | Notes |
|-------------|-------------|-------|
| `notify.civ.quest` | NotifyApp | Production |
| `atlas.civ.quest` | NotifyApp | Temporary fallback |
| `admin.civ.quest` | AdminApp | Production |
| `localhost:5173/` | NotifyApp | Development default |
| `localhost:5173/admin` | AdminApp | Development |
| `localhost:5173?module=admin` | AdminApp | Development override |
| `localhost:5173?module=atlas` | NotifyApp | Development (placeholder) |

---

## Firestore Security Rules

The deployed rules support **both legacy and new paths** during transition:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper Functions
    function isSuperAdmin() {
      return request.auth != null && 
        exists(/databases/$(database)/documents/admins/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == 'super_admin';
    }
    
    function isNewOrgAdmin(orgId) {
      return request.auth != null && 
        exists(/databases/$(database)/documents/admins/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == 'org_admin' &&
        get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.organizationId == orgId;
    }
    
    // New Paths
    match /organizations/{orgId} {
      allow read: if true;  // Public for Atlas
      allow write: if isSuperAdmin() || isNewOrgAdmin(orgId);
    }
    
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read, write: if isSuperAdmin();
    }
    
    match /admins/{adminId} {
      allow read: if request.auth != null && request.auth.uid == adminId;
      allow read, write: if isSuperAdmin();
    }
    
    match /logs/{logId} {
      allow read: if request.auth != null;
      allow write: if isSuperAdmin();
    }
    
    match /invitations/{email} {
      allow read, write: if isSuperAdmin();
    }
  }
}
```

---

## Environment & Configuration

### Firebase Project
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyBPiMgjC3dOGCbw3h5gDLXZdsOo-lHI_YY",
  authDomain: "civquest-notify.firebaseapp.com",
  projectId: "civquest-notify",
  storageBucket: "civquest-notify.firebasestorage.app",
  messagingSenderId: "126930260374",
  appId: "1:126930260374:web:30571ee0ec9068399c0db7"
};
```

### ArcGIS OAuth
- **Client ID**: `SPmTwmqIB2qEz51L`
- **Proxy URL**: `https://notify.civ.quest`

### Environment Variables
| Variable | Description |
|----------|-------------|
| `VITE_BREVO_API_KEY` | Brevo (Sendinblue) API key for sending emails |

---

## Glossary

| Term | Definition |
|------|------------|
| **Atlas** | CivQuest's GIS mapping product (formerly "Portal" codebase) |
| **ArcGIS Portal** | Esri's ArcGIS Enterprise Portal software |
| **ArcGIS Online (AGOL)** | Esri's cloud-hosted ArcGIS platform at arcgis.com |
| **Notify** | CivQuest's notification subscription product |
| **Organization** | A CivQuest customer (e.g., Chesapeake, Hampton) |
| **Legacy Path** | `artifacts/civquest_notifications/...` (old Firestore structure) |
| **Unified Path** | `organizations/`, `users/`, `admins/`, `logs/` (new Firestore structure) |
| **Super Admin** | System-wide administrator (support@civicvanguard.com) |
| **Org Admin** | Organization-specific administrator |

---

## Next Steps: Phase 3 Decision

With Phases 2 and 2b complete, proceed to **Phase 3: Atlas Integration**.

### Recommended Order: Migrate Existing HTML First

**Rationale:**
1. **User Value First**: Getting the existing Atlas functionality into the unified platform delivers immediate user value
2. **Foundation for Admin**: Atlas admin tools need the Atlas viewer to test against
3. **Shared Components**: Building Atlas will identify additional shared components needed
4. **Incremental Progress**: Can deploy working Atlas before enhancing admin

### Suggested Phase 3 Approach

1. **Week 1-2**: Convert existing vanilla JS Atlas to React
   - Port `app.js` initialization to `AtlasApp.jsx`
   - Create `MapView.jsx` from `map-mode.js`
   - Create `TableView.jsx` from `table-mode.js`
   
2. **Week 3**: Integrate with unified platform
   - Load config from Firestore `atlasConfig`
   - Implement public vs authenticated tool visibility
   - Update routing in `main.jsx`
   
3. **Week 4**: Admin integration
   - Build Atlas config editor in admin portal
   - Add map service management
   - Implement tool visibility controls

---

*Document Version: 3.0*
*Last Updated: January 2025*
*Current Phase: 3 - Atlas Integration (Starting)*
