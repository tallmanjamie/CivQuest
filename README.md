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
