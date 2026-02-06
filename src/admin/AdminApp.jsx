// src/admin/AdminApp.jsx
// Unified CivQuest Admin Application
// Uses unified Firestore paths (organizations/, users/, admins/)

import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { initializeApp } from "firebase/app";
import LicenseManagement from './components/LicenseManagement';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  setDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  serverTimestamp,
  getDoc,
  query,
  where
} from "firebase/firestore";
import {
  Shield,
  Users,
  Settings,
  LogOut,
  Search,
  Edit2,
  Check,
  X,
  Plus,
  Trash2,
  Save,
  Loader2,
  Building2,
  Bell,
  Clock,
  Ban,
  History,
  AlertTriangle,
  CheckCircle,
  AlertOctagon,
  Info,
  ChevronRight,
  ChevronDown,
  Map,
  Eye,
  EyeOff,
  UserPlus,
  Globe,
  Wand2,
  PanelLeftClose,
  PanelLeft,
  Layers,
  Printer,
  BookOpen,
  Puzzle,
  MapPin,
  LayoutDashboard,
  Activity,
  BarChart3,
  ExternalLink,
  MessageSquare,
  Sparkles,
  ArrowRightLeft
} from 'lucide-react';

// Import admin components
import NotificationEditModal from './components/NotificationEditor';
import Archive from './components/Archive';
import UserManagementPanel from './components/UserManagement';
import ConfigurationPanel from './components/NotifyConfiguration';
import NotificationWizard from './components/NotificationWizard';
import AtlasAdminSection from './components/AtlasAdminSection';
import SystemHelpEditor from './components/SystemHelpEditor';
import IntegrationsManagement from './components/IntegrationsManagement';
import GlobalExportTemplateLibrary from './components/GlobalExportTemplateLibrary';
import AISettingsEditor from './components/AISettingsEditor';
import ESRISettingsEditor from './components/ESRISettingsEditor';
import FirebaseCleanup from './components/FirebaseCleanup';

// Import shared services
import { PATHS } from '../shared/services/paths';
import {
  subscribeToIntegrations,
  AVAILABLE_INTEGRATIONS
} from '../shared/services/integrations';

// Import theme utilities for Atlas theming
import { getThemeColors } from '../atlas/utils/themeColors';

// Import ArcGIS OAuth services
import {
  initiateArcGISLogin,
  getOAuthRedirectUri,
  parseOAuthCallback,
  clearOAuthParams,
  verifyOAuthState,
  completeArcGISOAuth,
  generateDeterministicPassword,
  getOAuthMode
} from '../shared/services/arcgis-auth';
import { getESRISettings } from '../shared/services/systemConfig';

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyBPiMgjC3dOGCbw3h5gDLXZdsOo-lHI_YY",
  authDomain: "civquest-notify.firebaseapp.com",
  projectId: "civquest-notify",
  storageBucket: "civquest-notify.firebasestorage.app",
  messagingSenderId: "126930260374",
  appId: "1:126930260374:web:30571ee0ec9068399c0db7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- UI CONTEXT & PROVIDER ---
const UIContext = createContext();

function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    destructive: false,
    requireTypedConfirmation: '', // Text user must type to confirm
    typedValue: '', // What user has typed
    onConfirm: () => {},
    onCancel: () => {}
  });

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const confirm = useCallback(({ title, message, confirmLabel = 'Confirm', destructive = false, requireTypedConfirmation = '', onConfirm }) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      confirmLabel,
      destructive,
      requireTypedConfirmation,
      typedValue: '',
      onConfirm: () => {
        onConfirm();
        setConfirmState(prev => ({ ...prev, isOpen: false, typedValue: '' }));
      },
      onCancel: () => setConfirmState(prev => ({ ...prev, isOpen: false, typedValue: '' }))
    });
  }, []);

  const getToastIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error': return <AlertOctagon className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <UIContext.Provider value={{ addToast, confirm }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className="bg-white rounded-lg shadow-lg border border-slate-200 p-4 flex items-center gap-3 animate-in slide-in-from-right duration-300"
          >
            {getToastIcon(toast.type)}
            <span className="text-sm text-slate-700">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Confirmation Dialog */}
      {confirmState.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">{confirmState.title}</h3>
            <p className="text-slate-600 mb-4">{confirmState.message}</p>

            {/* Typed confirmation input */}
            {confirmState.requireTypedConfirmation && (
              <div className="mb-6">
                <label className="block text-sm text-slate-600 mb-2">
                  Type <span className="font-semibold text-slate-800">"{confirmState.requireTypedConfirmation}"</span> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmState.typedValue}
                  onChange={(e) => setConfirmState(prev => ({ ...prev, typedValue: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Type the name here..."
                  autoFocus
                />
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={confirmState.onCancel}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmState.onConfirm}
                disabled={confirmState.requireTypedConfirmation && confirmState.typedValue !== confirmState.requireTypedConfirmation}
                className={`px-4 py-2 text-white rounded-lg font-medium ${
                  confirmState.destructive
                    ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed'
                    : 'bg-[#004E7C] hover:bg-[#003B5C] disabled:bg-slate-300 disabled:cursor-not-allowed'
                }`}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  );
}

const useUI = () => useContext(UIContext);

// --- ADMIN CONTEXT ---
const AdminContext = createContext();

function AdminProvider({ children, role, orgId, orgData, isNewAccount, clearNewAccountFlag }) {
  return (
    <AdminContext.Provider value={{ role, orgId, orgData, isNewAccount, clearNewAccountFlag }}>
      {children}
    </AdminContext.Provider>
  );
}

const useAdmin = () => useContext(AdminContext);

// --- MAIN APP WRAPPER ---
export default function AdminAppWrapper({ loginMode = 'org_admin' }) {
  return (
    <UIProvider>
      <AdminApp loginMode={loginMode} />
    </UIProvider>
  );
}

// --- MAIN ADMIN APP ---
function AdminApp({ loginMode = 'org_admin' }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminRole, setAdminRole] = useState(null);
  const [orgAdminData, setOrgAdminData] = useState(null);
  const [orgConfig, setOrgConfig] = useState(null);
  const [accessError, setAccessError] = useState(null);
  const [isNewAccount, setIsNewAccount] = useState(false);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          let adminDoc = await getDoc(doc(db, PATHS.admins, currentUser.uid));

          // If admin doc not found and a signup is in progress, wait and retry
          // This handles the race condition where onAuthStateChanged fires
          // before the signup flow finishes creating Firestore documents
          if (!adminDoc.exists() && sessionStorage.getItem('civquest_signup_pending')) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            adminDoc = await getDoc(doc(db, PATHS.admins, currentUser.uid));
          }

          if (adminDoc.exists()) {
            const adminData = adminDoc.data();

            // Check for new account flag from signup flow
            if (sessionStorage.getItem('civquest_new_account')) {
              sessionStorage.removeItem('civquest_new_account');
              setIsNewAccount(true);
            }

            if (adminData.role === 'super_admin') {
              setAdminRole('super_admin');
              setLoading(false);
              return;
            }

            if (adminData.role === 'org_admin') {
              setAdminRole('org_admin');
              setOrgAdminData(adminData);
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          console.error("Error checking admin role:", e);
        }

        setAccessError("You don't have admin privileges.");
      }

      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Real-time listener for org config (org_admin only)
  useEffect(() => {
    if (adminRole !== 'org_admin' || !orgAdminData?.organizationId) return;
    
    const unsubscribe = onSnapshot(
      doc(db, PATHS.organizations, orgAdminData.organizationId),
      (docSnap) => {
        if (docSnap.exists()) {
          setOrgConfig({ id: docSnap.id, ...docSnap.data() });
        }
      },
      (error) => {
        console.error("Error listening to org config:", error);
      }
    );
    
    return () => unsubscribe();
  }, [adminRole, orgAdminData?.organizationId]);

  const clearNewAccountFlag = () => setIsNewAccount(false);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#004E7C]" />
      </div>
    );
  }

  if (!user) {
    return <AdminLogin loginMode={loginMode} />;
  }

  if (accessError) {
    return <AccessDenied error={accessError} onSignOut={() => signOut(auth)} />;
  }

  if (adminRole === 'super_admin') {
    return (
      <AdminProvider role="super_admin">
        <SuperAdminDashboard user={user} />
      </AdminProvider>
    );
  }

  if (adminRole === 'org_admin') {
    // Wait for orgConfig to load from the real-time listener
    if (!orgConfig) {
      return (
        <div className="h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-8 h-8 animate-spin text-[#1E5631]" />
        </div>
      );
    }
    
    return (
      <AdminProvider 
        role="org_admin" 
        orgId={orgAdminData.organizationId} 
        orgData={orgConfig}
        isNewAccount={isNewAccount}
        clearNewAccountFlag={clearNewAccountFlag}
      >
        <OrgAdminDashboard user={user} orgConfig={orgConfig} />
      </AdminProvider>
    );
  }

  return <AccessDenied error="Unable to determine admin role." onSignOut={() => signOut(auth)} />;
}

// --- ADMIN LOGIN ---
// loginMode: 'org_admin' = ESRI only, 'super_admin' = email/password only
function AdminLogin({ loginMode = 'org_admin' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [arcgisLoading, setArcgisLoading] = useState(false);
  const [view, setView] = useState('login'); // 'login' | 'signup'
  const [signupInProgress, setSignupInProgress] = useState(false);

  // Handle ArcGIS OAuth callback on mount (only for org_admin mode)
  useEffect(() => {
    if (loginMode !== 'org_admin') return;

    const handleOAuthCallback = async () => {
      const { code, state, error: oauthError, errorDescription } = parseOAuthCallback();

      // If there's an OAuth error, display it
      if (oauthError) {
        setError(errorDescription || oauthError);
        clearOAuthParams();
        return;
      }

      // If no code, nothing to process
      if (!code) return;

      // Verify state for CSRF protection
      if (!verifyOAuthState(state)) {
        setError('Invalid OAuth state. Please try again.');
        clearOAuthParams();
        return;
      }

      // Determine if this is a signup or signin flow
      const oauthMode = getOAuthMode();
      const isSignup = oauthMode === 'signup';

      if (isSignup) {
        setView('signup');
        setSignupInProgress(true);
      }

      setArcgisLoading(true);
      setError(null);

      try {
        const redirectUri = getOAuthRedirectUri();
        const oauthResult = await completeArcGISOAuth(code, redirectUri);
        const { user: arcgisUser, org: arcgisOrg } = oauthResult;

        // Use the ArcGIS email, or construct one from username if email not available
        const userEmail = arcgisUser.email || `${arcgisUser.username}@arcgis.local`;

        if (isSignup) {
          // --- SIGNUP FLOW ---

          // Verify the user belongs to an ArcGIS organization
          if (!arcgisUser.orgId || !arcgisOrg) {
            throw new Error(
              'Your ArcGIS account must belong to an organization to sign up. Personal accounts cannot create an organization.'
            );
          }

          // Check if an org with this ArcGIS orgId already exists in CivQuest
          const orgQuery = query(
            collection(db, PATHS.organizations),
            where('arcgisOrgId', '==', arcgisUser.orgId)
          );
          const existingOrgs = await getDocs(orgQuery);

          if (!existingOrgs.empty) {
            throw new Error(
              'Your ArcGIS organization already has a CivQuest account. Please contact your organization administrator for access, or sign in if you already have an account.'
            );
          }

          // Check if this email is already registered as an admin
          const adminQuery = query(
            collection(db, PATHS.admins),
            where('email', '==', userEmail.toLowerCase())
          );
          const existingAdmins = await getDocs(adminQuery);

          if (!existingAdmins.empty) {
            throw new Error(
              'An admin account with this email already exists. Please sign in instead.'
            );
          }

          // Generate deterministic password
          const deterministicPassword = await generateDeterministicPassword(
            arcgisUser.username,
            arcgisUser.email || arcgisUser.orgId || arcgisUser.username
          );

          // Generate a URL-friendly org ID from the ArcGIS org
          const orgName = arcgisOrg.name || 'New Organization';
          let orgId = (arcgisOrg.urlKey || orgName)
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 50);

          // Ensure org ID uniqueness
          const existingOrgDoc = await getDoc(doc(db, PATHS.organization(orgId)));
          if (existingOrgDoc.exists()) {
            orgId = `${orgId}-${Date.now().toString(36)}`;
          }

          // Signal to AdminApp that signup is in progress (for race condition handling)
          sessionStorage.setItem('civquest_signup_pending', 'true');

          // Create Firebase auth account
          let cred;
          try {
            cred = await createUserWithEmailAndPassword(auth, userEmail, deterministicPassword);
          } catch (createError) {
            sessionStorage.removeItem('civquest_signup_pending');
            if (createError.code === 'auth/email-already-in-use') {
              throw new Error(
                'An account with this email already exists. Please sign in instead.'
              );
            }
            throw createError;
          }

          // Create all Firestore documents in parallel
          await Promise.all([
            // User document
            setDoc(doc(db, PATHS.user(cred.user.uid)), {
              email: userEmail.toLowerCase(),
              displayName: arcgisUser.fullName || arcgisUser.username,
              arcgisUsername: arcgisUser.username,
              arcgisOrgId: arcgisUser.orgId,
              createdAt: serverTimestamp(),
              createdVia: 'arcgis_oauth_signup',
              subscriptions: {},
              disabled: false,
              suspended: false
            }),
            // Organization document
            setDoc(doc(db, PATHS.organization(orgId)), {
              name: orgName,
              arcgisOrgId: arcgisUser.orgId,
              arcgisOrgName: arcgisOrg.name,
              arcgisUrlKey: arcgisOrg.urlKey || null,
              notifications: [],
              createdAt: serverTimestamp(),
              createdVia: 'arcgis_signup',
              createdBy: cred.user.uid
            }),
            // Admin document
            setDoc(doc(db, PATHS.admin(cred.user.uid)), {
              email: userEmail.toLowerCase(),
              role: 'org_admin',
              organizationId: orgId,
              createdAt: serverTimestamp()
            })
          ]);

          // Signup complete - clear pending flag and set new account flag
          sessionStorage.removeItem('civquest_signup_pending');
          sessionStorage.setItem('civquest_new_account', 'true');

        } else {
          // --- SIGNIN FLOW (existing behavior) ---

          // Generate a deterministic password for this ArcGIS user
          const deterministicPassword = await generateDeterministicPassword(
            arcgisUser.username,
            arcgisUser.email || arcgisUser.orgId || arcgisUser.username
          );

          // Try to sign in first (existing user)
          try {
            await signInWithEmailAndPassword(auth, userEmail, deterministicPassword);
          } catch (signInError) {
            // If user doesn't exist, create them
            if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential') {
              try {
                const cred = await createUserWithEmailAndPassword(auth, userEmail, deterministicPassword);

                // Create user document
                await setDoc(doc(db, PATHS.user(cred.user.uid)), {
                  email: userEmail.toLowerCase(),
                  displayName: arcgisUser.fullName || arcgisUser.username,
                  arcgisUsername: arcgisUser.username,
                  arcgisOrgId: arcgisUser.orgId || null,
                  createdAt: serverTimestamp(),
                  createdVia: 'arcgis_oauth_admin',
                  subscriptions: {},
                  disabled: false,
                  suspended: false
                }, { merge: true });
              } catch (createError) {
                throw createError;
              }
            } else {
              throw signInError;
            }
          }
        }

        // Clear OAuth params from URL
        clearOAuthParams();

      } catch (err) {
        console.error('ArcGIS OAuth error:', err);
        setError(err.message || 'Failed to complete ArcGIS authentication. Please try again.');
        clearOAuthParams();
        sessionStorage.removeItem('civquest_signup_pending');
      } finally {
        setArcgisLoading(false);
        setSignupInProgress(false);
      }
    };

    handleOAuthCallback();
  }, [loginMode]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleArcGISLogin = async () => {
    // Fetch admin-configured ESRI client ID
    let esriClientId = null;
    try {
      const esriSettings = await getESRISettings();
      esriClientId = esriSettings?.clientId || null;
    } catch (err) {
      console.warn('Could not fetch ESRI settings, using default client ID:', err);
    }

    const redirectUri = getOAuthRedirectUri();
    initiateArcGISLogin(redirectUri, 'signin', esriClientId);
  };

  const handleArcGISSignup = async () => {
    let esriClientId = null;
    try {
      const esriSettings = await getESRISettings();
      esriClientId = esriSettings?.clientId || null;
    } catch (err) {
      console.warn('Could not fetch ESRI settings, using default client ID:', err);
    }

    const redirectUri = getOAuthRedirectUri();
    initiateArcGISLogin(redirectUri, 'signup', esriClientId);
  };

  // Show loading state while processing OAuth callback
  if (arcgisLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-sky-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center border border-slate-100">
          <img
            src="https://geoplan.nyc3.digitaloceanspaces.com/CivQuest/CVG_Logo_Medium.jpg"
            alt="CivQuest"
            className="w-16 h-16 rounded-xl shadow-lg mx-auto mb-6 object-contain"
          />
          <Loader2 className="w-10 h-10 animate-spin text-[#0079C1] mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-800">
            {signupInProgress ? 'Creating your account...' : 'Signing in with ArcGIS...'}
          </h2>
          <p className="text-slate-500 mt-2">
            {signupInProgress
              ? 'Setting up your organization. This may take a moment.'
              : 'Please wait while we verify your account.'}
          </p>
        </div>
      </div>
    );
  }

  // Super Admin Login - Email/Password only
  if (loginMode === 'super_admin') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Shield className="w-8 h-8 text-[#004E7C]" />
            <h1 className="text-2xl font-bold text-slate-800">Super Admin</h1>
          </div>

          <p className="text-sm text-slate-500 text-center mb-6">
            Sign in with your administrator credentials
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004E7C]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004E7C]"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#004E7C] text-white rounded-lg font-medium hover:bg-[#003B5C] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              Sign In
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200 text-center">
            <a
              href="/admin"
              className="text-sm text-slate-500 hover:text-[#004E7C] transition-colors"
            >
              Organization Admin Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Org Admin - Signup view
  if (loginMode === 'org_admin' && view === 'signup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-sky-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-slate-100">
          {/* CivQuest Logo */}
          <div className="flex flex-col items-center mb-8">
            <img
              src="https://geoplan.nyc3.digitaloceanspaces.com/CivQuest/CVG_Logo_Medium.jpg"
              alt="CivQuest"
              className="w-20 h-20 rounded-xl shadow-lg mb-4 object-contain"
            />
            <h1 className="text-2xl font-bold text-slate-800">Create Your Account</h1>
            <p className="text-sm text-slate-500 mt-1">Sign up to manage your organization on CivQuest</p>
          </div>

          {/* ArcGIS Sign Up Button */}
          <div className="mb-6">
            <button
              type="button"
              onClick={handleArcGISSignup}
              disabled={loading || arcgisLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-[#0079C1] text-white rounded-xl font-medium hover:bg-[#006699] transition-all hover:shadow-lg disabled:opacity-50"
            >
              <Globe className="w-5 h-5" />
              Sign up with ArcGIS
            </button>
          </div>

          {/* Info box */}
          <div className="bg-sky-50 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-medium text-sky-800 mb-2">What happens when you sign up:</h3>
            <ul className="text-xs text-sky-700 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-1 h-1 rounded-full bg-sky-500 mt-1.5"></span>
                Your name and email are imported from your ArcGIS account
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-1 h-1 rounded-full bg-sky-500 mt-1.5"></span>
                A new CivQuest organization is created based on your ArcGIS organization
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-1 h-1 rounded-full bg-sky-500 mt-1.5"></span>
                You become the administrator of that organization
              </li>
            </ul>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-600 mb-4">
              Already have an account?{' '}
              <button
                onClick={() => { setView('login'); setError(null); }}
                className="text-[#0079C1] hover:underline font-medium"
              >
                Sign in
              </button>
            </p>
            <p className="text-xs text-slate-400">
              Powered by <a href="https://www.civicvanguard.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 hover:underline">Civic Vanguard</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Org Admin Login - ESRI/ArcGIS or Email/Password
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-sky-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-slate-100">
        {/* CivQuest Logo */}
        <div className="flex flex-col items-center mb-8">
          <img
            src="https://geoplan.nyc3.digitaloceanspaces.com/CivQuest/CVG_Logo_Medium.jpg"
            alt="CivQuest"
            className="w-20 h-20 rounded-xl shadow-lg mb-4 object-contain"
          />
          <h1 className="text-2xl font-bold text-slate-800">CivQuest Admin Portal</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to manage your organization</p>
        </div>

        {/* ArcGIS Sign In Button */}
        <div className="mb-6">
          <button
            type="button"
            onClick={handleArcGISLogin}
            disabled={loading || arcgisLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-[#0079C1] text-white rounded-xl font-medium hover:bg-[#006699] transition-all hover:shadow-lg disabled:opacity-50"
          >
            <Globe className="w-5 h-5" />
            Sign in with ArcGIS
          </button>
          <p className="text-xs text-slate-500 text-center mt-3">
            Use your ArcGIS Online account to access the admin portal
          </p>
        </div>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-slate-500">or sign in with email</span>
          </div>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0079C1] focus:border-transparent transition-all"
              placeholder="admin@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0079C1] focus:border-transparent transition-all"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || arcgisLoading}
            className="w-full py-3 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            Sign In
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-sm text-slate-600 mb-4">
            Don't have an account?{' '}
            <button
              onClick={() => { setView('signup'); setError(null); }}
              className="text-[#0079C1] hover:underline font-medium"
            >
              Sign up
            </button>
          </p>
          <p className="text-xs text-slate-400">
            Powered by <a href="https://www.civicvanguard.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 hover:underline">Civic Vanguard</a>
          </p>
        </div>
      </div>
    </div>
  );
}

// --- ACCESS DENIED ---
function AccessDenied({ error, onSignOut }) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h1>
        <p className="text-slate-600 mb-6">{error}</p>
        <button
          onClick={onSignOut}
          className="px-6 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

// --- SIDEBAR NAVIGATION ---
function Sidebar({
  role,
  activeSection,
  activeTab,
  onNavigate,
  collapsed,
  onToggleCollapse,
  atlasThemeColor,
  // Super admin org view props
  isSuperAdmin = false,
  organizations = [],
  viewingOrgId = null,
  onViewOrg = null,
  onExitOrgView = null
}) {
  const [expandedSections, setExpandedSections] = useState({ notify: true, atlas: true, system: role === 'super_admin' });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const notifyItems = role === 'super_admin'
    ? [
        { id: 'subscribers', label: 'Subscribers', icon: Users },
        { id: 'configuration', label: 'Configuration', icon: Settings },
        { id: 'archive', label: 'Archive', icon: History },
      ]
    : [
        { id: 'subscribers', label: 'Subscribers', icon: Users },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'archive', label: 'Archive', icon: History },
      ];

  // Atlas navigation items based on role
  const atlasItems = role === 'super_admin'
    ? [
        { id: 'users', label: 'Users', icon: Users },
        { id: 'configuration', label: 'Configuration', icon: Settings },
        { id: 'export-templates', label: 'Export Templates', icon: Printer },
      ]
    : [
        { id: 'users', label: 'Users', icon: Users },
        { id: 'maps', label: 'Settings', icon: Settings },
        { id: 'export-templates', label: 'Export Templates', icon: Printer },
        { id: 'integrations', label: 'Integrations', icon: Puzzle },
        { id: 'preview', label: 'Preview', icon: Eye },
      ];

  // System-level items (super_admin only)
  const systemItems = [
    { id: 'organizations', label: 'Organizations', icon: Building2 },
    { id: 'integrations', label: 'Integrations', icon: Puzzle },
    { id: 'licensing', label: 'Licensing', icon: Shield },
    { id: 'globalhelp', label: 'Global Help', icon: BookOpen },
    { id: 'globaltemplates', label: 'Global Templates', icon: Printer },
    { id: 'orgadmins', label: 'Admins', icon: UserPlus },
    { id: 'ai', label: 'AI', icon: Sparkles },
    { id: 'esri', label: 'ESRI', icon: Globe },
    { id: 'cleanup', label: 'Data Cleanup', icon: Trash2 },
  ];

  // Use Atlas theme color for org_admin when available, otherwise fall back to defaults
  const getAccentColors = () => {
    if (role === 'super_admin') {
      return { accent: '#004E7C', accentLight: '#E6F0F6' };
    }
    // For org_admin, use Atlas theme if configured
    if (atlasThemeColor) {
      const themeColors = getThemeColors(atlasThemeColor);
      return { accent: themeColors.bg700, accentLight: themeColors.bg100 };
    }
    // Default org_admin colors
    return { accent: '#1E5631', accentLight: '#E8F5E9' };
  };
  const { accent: accentColor, accentLight: accentColorLight } = getAccentColors();

  return (
    <aside 
      className={`
        bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-64'}
      `}
    >
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" style={{ color: accentColor }} />
            <span className="font-bold text-slate-800">Admin</span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </button>
      </div>

      {/* Super Admin View Switcher */}
      {isSuperAdmin && !collapsed && (
        <div className="p-3 border-b border-slate-200">
          <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
            View As
          </label>
          <select
            value={viewingOrgId || 'super_admin'}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'super_admin') {
                onExitOrgView?.();
              } else {
                onViewOrg?.(value);
              }
            }}
            className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004E7C] bg-white"
          >
            <option value="super_admin">Super Admin (All Orgs)</option>
            <optgroup label="Organization Admin View">
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </optgroup>
          </select>
          {viewingOrgId && (
            <button
              onClick={onExitOrgView}
              className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-[#004E7C] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Exit Org View
            </button>
          )}
        </div>
      )}

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {/* Dashboard Section (Org Admin only) */}
        {role === 'org_admin' && (
          <div className="mb-2">
            <button
              onClick={() => onNavigate('dashboard', 'home')}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
                ${activeSection === 'dashboard'
                  ? 'text-white font-medium'
                  : 'text-slate-700 hover:bg-slate-100'
                }
              `}
              style={activeSection === 'dashboard' ? { backgroundColor: accentColor } : {}}
            >
              <LayoutDashboard className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="flex-1 text-left font-medium">Dashboard</span>}
            </button>
          </div>
        )}

        {/* Notify Section */}
        <div className="mb-2">
          <button
            onClick={() => !collapsed && toggleSection('notify')}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
              ${activeSection === 'notify' 
                ? 'text-white font-medium' 
                : 'text-slate-700 hover:bg-slate-100'
              }
            `}
            style={activeSection === 'notify' ? { backgroundColor: accentColor } : {}}
          >
            <Bell className="w-5 h-5 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left font-medium">Notify</span>
                {expandedSections.notify ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </>
            )}
          </button>
          
          {!collapsed && expandedSections.notify && (
            <div className="mt-1 ml-3 pl-3 border-l-2 border-slate-200 space-y-1">
              {notifyItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => onNavigate('notify', item.id)}
                  disabled={item.disabled}
                  className={`
                    w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all
                    ${activeSection === 'notify' && activeTab === item.id
                      ? 'font-medium'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }
                    ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  style={activeSection === 'notify' && activeTab === item.id 
                    ? { backgroundColor: accentColorLight, color: accentColor } 
                    : {}
                  }
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Atlas Section */}
        <div className="mb-2">
          <button
            onClick={() => !collapsed && toggleSection('atlas')}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
              ${activeSection === 'atlas' 
                ? 'text-white font-medium' 
                : 'text-slate-700 hover:bg-slate-100'
              }
            `}
            style={activeSection === 'atlas' ? { backgroundColor: accentColor } : {}}
          >
            <Map className="w-5 h-5 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left font-medium">Atlas</span>
                {expandedSections.atlas ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </>
            )}
          </button>
          
          {!collapsed && expandedSections.atlas && (
            <div className="mt-1 ml-3 pl-3 border-l-2 border-slate-200 space-y-1">
              {atlasItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => onNavigate('atlas', item.id)}
                  disabled={item.disabled}
                  className={`
                    w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all
                    ${activeSection === 'atlas' && activeTab === item.id
                      ? 'font-medium'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }
                    ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  style={activeSection === 'atlas' && activeTab === item.id 
                    ? { backgroundColor: accentColorLight, color: accentColor } 
                    : {}
                  }
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* System Section (Super Admin only) */}
        {role === 'super_admin' && (
          <div className="mb-2">
            <button
              onClick={() => !collapsed && toggleSection('system')}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
                ${activeSection === 'system' 
                  ? 'text-white font-medium' 
                  : 'text-slate-700 hover:bg-slate-100'
                }
              `}
              style={activeSection === 'system' ? { backgroundColor: accentColor } : {}}
            >
              <Shield className="w-5 h-5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left font-medium">System</span>
                  {expandedSections.system ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </>
              )}
            </button>
            
            {!collapsed && expandedSections.system && (
              <div className="mt-1 ml-3 pl-3 border-l-2 border-slate-200 space-y-1">
                {systemItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => onNavigate('system', item.id)}
                    disabled={item.disabled}
                    className={`
                      w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all
                      ${activeSection === 'system' && activeTab === item.id
                        ? 'font-medium'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }
                      ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    style={activeSection === 'system' && activeTab === item.id 
                      ? { backgroundColor: accentColorLight, color: accentColor } 
                      : {}
                    }
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      {!collapsed && (
        <div className="p-4 border-t border-slate-200">
          <div className="text-xs text-slate-400">
            CivQuest Admin v2.0
          </div>
        </div>
      )}
    </aside>
  );
}

// --- HEADER COMPONENT ---
function AdminHeader({ user, title, subtitle, accentColor, atlasThemeColor, logoUrl, onSignOut }) {
  // Calculate header background color (darker shade)
  const getHeaderBgColor = () => {
    // Super admin uses dark blue
    if (accentColor === '#004E7C') {
      return '#002A4D';
    }
    // If Atlas theme is configured, use its darker shade
    if (atlasThemeColor) {
      return getThemeColors(atlasThemeColor).bg700;
    }
    // Default org admin dark green
    return '#164524';
  };

  // Use atlas logo if available, otherwise default CivQuest logo
  const displayLogo = logoUrl || "https://geoplan.nyc3.digitaloceanspaces.com/CivQuest/CVG_Logo_Medium.jpg";

  return (
    <header
      className="text-white px-6 py-4 flex items-center justify-between shadow-md"
      style={{ backgroundColor: getHeaderBgColor() }}
    >
      <div className="flex items-center gap-3">
        <img
          src={displayLogo}
          alt="Logo"
          className="h-10 w-auto object-contain rounded bg-white p-0.5"
        />
        <div>
          <h1 className="font-bold text-xl tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs opacity-80">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm opacity-80">{user.email}</span>
        <button
          onClick={onSignOut}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          title="Sign Out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}

// --- SUPER ADMIN DASHBOARD ---
function SuperAdminDashboard({ user }) {
  const [activeSection, setActiveSection] = useState('notify');
  const [activeTab, setActiveTab] = useState('subscribers');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { addToast, confirm } = useUI();

  // Organization view mode state
  const [organizations, setOrganizations] = useState([]);
  const [viewingOrgId, setViewingOrgId] = useState(null);
  const [viewingOrgData, setViewingOrgData] = useState(null);
  const [showWizard, setShowWizard] = useState(false);

  // Fetch organizations for the view switcher
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, PATHS.organizations), (snapshot) => {
      const orgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrganizations(orgs.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    });
    return () => unsubscribe();
  }, []);

  // When viewing org changes, fetch its data
  useEffect(() => {
    if (!viewingOrgId) {
      setViewingOrgData(null);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, PATHS.organizations, viewingOrgId),
      (docSnap) => {
        if (docSnap.exists()) {
          setViewingOrgData({ id: docSnap.id, ...docSnap.data() });
        }
      }
    );
    return () => unsubscribe();
  }, [viewingOrgId]);

  const handleNavigate = (section, tab) => {
    setActiveSection(section);
    setActiveTab(tab);
  };

  const handleViewOrg = (orgId) => {
    setViewingOrgId(orgId);
    // Reset to org admin default view
    setActiveSection('dashboard');
    setActiveTab('home');
  };

  const handleExitOrgView = () => {
    setViewingOrgId(null);
    setViewingOrgData(null);
    // Reset to super admin default view
    setActiveSection('notify');
    setActiveTab('subscribers');
  };

  // Get Atlas theme color for org view
  const atlasThemeColor = viewingOrgData?.atlasConfig?.ui?.themeColor || null;
  const orgAccentColor = atlasThemeColor
    ? getThemeColors(atlasThemeColor).bg700
    : '#1E5631';

  // Render content for org view mode (when super admin is viewing a specific org)
  const renderOrgViewContent = () => {
    if (!viewingOrgData) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      );
    }

    if (activeSection === 'dashboard') {
      return (
        <OrgAdminDashboardHome
          orgId={viewingOrgId}
          orgData={viewingOrgData}
          accentColor={orgAccentColor}
          onNavigate={handleNavigate}
        />
      );
    }

    if (activeSection === 'notify') {
      switch (activeTab) {
        case 'subscribers':
          return (
            <UserManagementPanel
              db={db}
              auth={null}
              role="org_admin"
              orgId={viewingOrgId}
              orgData={viewingOrgData}
              addToast={addToast}
              confirm={confirm}
              accentColor={orgAccentColor}
            />
          );
        case 'notifications':
          return (
            <ConfigurationPanel
              db={db}
              role="org_admin"
              orgId={viewingOrgId}
              orgData={viewingOrgData}
              addToast={addToast}
              confirm={confirm}
              accentColor={orgAccentColor}
              NotificationEditModal={NotificationEditModal}
              onOpenWizard={() => setShowWizard(true)}
            />
          );
        case 'archive':
          return (
            <Archive
              db={db}
              role="org_admin"
              orgId={viewingOrgId}
              orgData={viewingOrgData}
              addToast={addToast}
              accentColor={orgAccentColor}
            />
          );
        default:
          return null;
      }
    }

    if (activeSection === 'atlas') {
      return (
        <AtlasAdminSection
          db={db}
          role="org_admin"
          activeTab={activeTab}
          orgId={viewingOrgId}
          orgData={viewingOrgData}
          addToast={addToast}
          confirm={confirm}
          accentColor={orgAccentColor}
          adminEmail={user?.email}
        />
      );
    }

    return null;
  };

  const renderContent = () => {
    // If viewing a specific org, render org-admin-like content
    if (viewingOrgId) {
      return renderOrgViewContent();
    }

    // Normal super-admin content
    if (activeSection === 'notify') {
      switch (activeTab) {
        case 'subscribers':
          return (
            <UserManagementPanel
              db={db}
              auth={auth}
              role="admin"
              addToast={addToast}
              confirm={confirm}
              accentColor="#004E7C"
            />
          );
        case 'configuration':
          return (
            <ConfigurationPanel
              db={db}
              role="admin"
              addToast={addToast}
              confirm={confirm}
              accentColor="#004E7C"
              NotificationEditModal={NotificationEditModal}
            />
          );
        case 'archive':
          return (
            <Archive
              db={db}
              role="admin"
              addToast={addToast}
              accentColor="#004E7C"
            />
          );
        default:
          return null;
      }
    }

    if (activeSection === 'atlas') {
      return (
        <AtlasAdminSection
          db={db}
          role="super_admin"
          activeTab={activeTab}
          orgId={null}
          orgData={null}
          addToast={addToast}
          confirm={confirm}
          accentColor="#004E7C"
          adminEmail={user?.email}
        />
      );
    }

    if (activeSection === 'system') {
      switch (activeTab) {
        case 'organizations':
          return <OrganizationManagement />;
        case 'integrations':
          return (
            <IntegrationsManagement
              db={db}
              addToast={addToast}
              confirm={confirm}
              adminEmail={user.email}
              accentColor="#004E7C"
            />
          );
        case 'orgadmins':
          return <OrgAdminManagement />;
        case 'globalhelp':
          return (
            <SystemHelpEditor
              db={db}
              addToast={addToast}
              confirm={confirm}
              adminEmail={user.email}
              accentColor="#004E7C"
            />
          );
        case 'licensing':
          return (
            <LicenseManagement
              db={db}
              addToast={addToast}
              confirm={confirm}
              adminEmail={user.email}
              accentColor="#004E7C"
            />
          );
        case 'globaltemplates':
          return (
            <GlobalExportTemplateLibrary
              db={db}
              addToast={addToast}
              confirm={confirm}
              adminEmail={user.email}
              accentColor="#004E7C"
            />
          );
        case 'ai':
          return (
            <AISettingsEditor
              db={db}
              addToast={addToast}
              confirm={confirm}
              adminEmail={user.email}
              accentColor="#004E7C"
            />
          );
        case 'esri':
          return (
            <ESRISettingsEditor
              db={db}
              addToast={addToast}
              confirm={confirm}
              adminEmail={user.email}
              accentColor="#004E7C"
            />
          );
        case 'cleanup':
          return (
            <FirebaseCleanup
              db={db}
              addToast={addToast}
              confirm={confirm}
              accentColor="#004E7C"
            />
          );
        default:
          return null;
      }
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AdminHeader
        user={user}
        title={viewingOrgId && viewingOrgData ? viewingOrgData.name : "CivQuest Admin"}
        subtitle={viewingOrgId ? "Viewing as Organization Admin" : "System Administrator"}
        accentColor={viewingOrgId ? orgAccentColor : "#004E7C"}
        atlasThemeColor={viewingOrgId ? atlasThemeColor : null}
        logoUrl={viewingOrgData?.atlasConfig?.ui?.logoLeft}
        onSignOut={() => signOut(auth)}
      />

      <div className="flex-1 flex">
        <Sidebar
          role={viewingOrgId ? "org_admin" : "super_admin"}
          activeSection={activeSection}
          activeTab={activeTab}
          onNavigate={handleNavigate}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          atlasThemeColor={viewingOrgId ? atlasThemeColor : null}
          // Super admin org view props
          isSuperAdmin={true}
          organizations={organizations}
          viewingOrgId={viewingOrgId}
          onViewOrg={handleViewOrg}
          onExitOrgView={handleExitOrgView}
        />

        <main className="flex-1 p-8 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Notification Wizard Modal for org view */}
      {showWizard && viewingOrgId && viewingOrgData && (
        <NotificationWizard
          isOpen={showWizard}
          onClose={() => setShowWizard(false)}
          db={db}
          orgId={viewingOrgId}
          orgData={viewingOrgData}
          addToast={addToast}
          userEmail={user?.email}
          onNotificationsCreated={() => setShowWizard(false)}
          accentColor={orgAccentColor}
        />
      )}
    </div>
  );
}

// --- ORG ADMIN DASHBOARD HOME ---
function OrgAdminDashboardHome({ orgId, orgData, accentColor, onNavigate }) {
  const [stats, setStats] = useState({
    subscribers: 0,
    notifications: 0,
    maps: 0,
    atlasUsers: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    if (!orgId) return;

    // Use real-time listener on users collection to match UserManagement and AtlasUserManagement counts
    const unsubscribe = onSnapshot(
      collection(db, PATHS.users),
      (snapshot) => {
        const users = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Count subscribers - users with any active subscription to this org
        // Matches UserManagement.jsx countOrgSubscribers() logic
        const subscriberCount = users.filter(user => {
          if (!user.subscriptions) return false;
          return Object.entries(user.subscriptions).some(([key, value]) =>
            key.startsWith(`${orgId}_`) && value === true
          );
        }).length;

        // Count atlas users - users with atlas access who are not suspended
        // Matches AtlasUserManagement.jsx getAtlasUserCount() logic
        const atlasUserCount = users.filter(user =>
          user.atlasAccess?.[orgId]?.enabled === true && !user.suspended
        ).length;

        // Count notifications from orgData
        const notificationCount = orgData?.notifications?.length || 0;

        // Count maps - check both live config and draft config
        const mapsCount = orgData?.atlasConfig?.data?.maps?.length || orgData?.atlasConfigDraft?.data?.maps?.length || 0;

        setStats({
          subscribers: subscriberCount,
          notifications: notificationCount,
          maps: mapsCount,
          atlasUsers: atlasUserCount
        });
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching dashboard stats:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [orgId, orgData]);

  const statCards = [
    {
      label: 'Subscribers',
      value: stats.subscribers,
      icon: Users,
      color: 'bg-blue-500',
      onClick: () => onNavigate('notify', 'subscribers')
    },
    {
      label: 'Notifications',
      value: stats.notifications,
      icon: Bell,
      color: 'bg-amber-500',
      onClick: () => onNavigate('notify', 'notifications')
    },
    {
      label: 'Atlas Maps',
      value: stats.maps,
      icon: Layers,
      color: 'bg-emerald-500',
      onClick: () => onNavigate('atlas', 'maps')
    },
    {
      label: 'Atlas Users',
      value: stats.atlasUsers,
      icon: Users,
      color: 'bg-purple-500',
      onClick: () => onNavigate('atlas', 'users')
    }
  ];

  const quickActions = [
    {
      label: 'Manage Subscribers',
      description: 'View and manage notification subscribers',
      icon: Users,
      onClick: () => onNavigate('notify', 'subscribers')
    },
    {
      label: 'Configure Notifications',
      description: 'Set up and edit notification rules',
      icon: Bell,
      onClick: () => onNavigate('notify', 'notifications')
    },
    {
      label: 'Manage Atlas Maps',
      description: 'Configure map layers and data sources',
      icon: Layers,
      onClick: () => onNavigate('atlas', 'maps')
    },
    {
      label: 'Preview Atlas',
      description: 'Preview your atlas configuration',
      icon: Eye,
      onClick: () => onNavigate('atlas', 'preview')
    }
  ];

  // Get atlas preview URL
  const atlasPreviewUrl = orgId ? `/${orgId}` : null;
  const hasDraft = !!orgData?.atlasConfigDraft;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-600 mt-1">
          Welcome to your CivQuest admin dashboard
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <button
            key={index}
            onClick={stat.onClick}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow text-left group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">
                  {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  ) : (
                    stat.value
                  )}
                </p>
              </div>
              <div className={`${stat.color} p-3 rounded-xl text-white group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-all text-left group flex items-center gap-4"
            >
              <div
                className="p-3 rounded-xl text-white group-hover:scale-110 transition-transform"
                style={{ backgroundColor: accentColor }}
              >
                <action.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-slate-800 group-hover:text-slate-900">
                  {action.label}
                </p>
                <p className="text-sm text-slate-500">{action.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 ml-auto group-hover:translate-x-1 transition-transform" />
            </button>
          ))}
        </div>
      </div>

      {/* Atlas Status & Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Atlas Configuration Status */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Map className="w-5 h-5" style={{ color: accentColor }} />
            Atlas Configuration
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Title</span>
              <span className="font-medium text-slate-800">
                {orgData?.atlasConfig?.ui?.title || 'Not configured'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Theme</span>
              <span className="font-medium text-slate-800 capitalize">
                {orgData?.atlasConfig?.ui?.themeColor || 'Default'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Maps Configured</span>
              <span className="font-medium text-slate-800">{stats.maps}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-600">Draft Changes</span>
              <span className={`font-medium ${hasDraft ? 'text-amber-600' : 'text-emerald-600'}`}>
                {hasDraft ? 'Unpublished changes' : 'Up to date'}
              </span>
            </div>

            {atlasPreviewUrl && (
              <div className="pt-2 flex gap-2">
                <a
                  href={atlasPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  <Globe className="w-4 h-4" />
                  View Live Atlas
                  <ExternalLink className="w-4 h-4" />
                </a>
                {hasDraft && (
                  <a
                    href={`${atlasPreviewUrl}?preview=draft`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-100 text-amber-700 rounded-lg font-medium hover:bg-amber-200 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Preview Draft
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Getting Started / Help */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5" style={{ color: accentColor }} />
            Getting Started
          </h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm font-medium flex-shrink-0">
                1
              </div>
              <div>
                <p className="font-medium text-slate-800">Configure Your Atlas</p>
                <p className="text-sm text-slate-500">Set up your map title, theme colors, and logo</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm font-medium flex-shrink-0">
                2
              </div>
              <div>
                <p className="font-medium text-slate-800">Add Map Layers</p>
                <p className="text-sm text-slate-500">Connect your ArcGIS data sources and configure layers</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm font-medium flex-shrink-0">
                3
              </div>
              <div>
                <p className="font-medium text-slate-800">Set Up Notifications</p>
                <p className="text-sm text-slate-500">Create notification rules to alert subscribers</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm font-medium flex-shrink-0">
                4
              </div>
              <div>
                <p className="font-medium text-slate-800">Preview & Publish</p>
                <p className="text-sm text-slate-500">Preview your changes and publish when ready</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- ORG ADMIN DASHBOARD ---
function OrgAdminDashboard({ user, orgConfig }) {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [activeTab, setActiveTab] = useState('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const { addToast, confirm } = useUI();
  const { orgId, orgData, isNewAccount, clearNewAccountFlag } = useAdmin();

  // Get Atlas theme color if configured, use it for the admin panel accent
  const atlasThemeColor = orgData?.atlasConfig?.ui?.themeColor || null;
  const accentColor = atlasThemeColor
    ? getThemeColors(atlasThemeColor).bg700
    : '#1E5631';

  const handleNavigate = (section, tab) => {
    setActiveSection(section);
    setActiveTab(tab);
  };

  // Callback when wizard creates notifications - refresh org data
  const handleNotificationsCreated = (newNotifications) => {
    console.log('Created notifications:', newNotifications);
    setShowWizard(false);
    // The Configuration component will auto-refresh via onSnapshot
  };

  const renderContent = () => {
    if (activeSection === 'dashboard') {
      return (
        <OrgAdminDashboardHome
          orgId={orgId}
          orgData={orgData}
          accentColor={accentColor}
          onNavigate={handleNavigate}
        />
      );
    }

    if (activeSection === 'notify') {
      switch (activeTab) {
        case 'subscribers':
          return (
            <UserManagementPanel
              db={db}
              auth={null}
              role="org_admin"
              orgId={orgId}
              orgData={orgData}
              addToast={addToast}
              confirm={confirm}
              accentColor={accentColor}
            />
          );
        case 'notifications':
          return (
            <ConfigurationPanel
              db={db}
              role="org_admin"
              orgId={orgId}
              orgData={orgData}
              addToast={addToast}
              confirm={confirm}
              accentColor={accentColor}
              NotificationEditModal={NotificationEditModal}
              onOpenWizard={() => setShowWizard(true)}
            />
          );
        case 'archive':
          return (
            <Archive
              db={db}
              role="org_admin"
              orgId={orgId}
              orgData={orgData}
              addToast={addToast}
              accentColor={accentColor}
            />
          );
        default:
          return null;
      }
    }

    if (activeSection === 'atlas') {
      return (
        <AtlasAdminSection
          db={db}
          role="org_admin"
          activeTab={activeTab}
          orgId={orgId}
          orgData={orgData}
          addToast={addToast}
          confirm={confirm}
          accentColor={accentColor}
          adminEmail={user?.email}
        />
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AdminHeader
        user={user}
        title={orgConfig.name}
        subtitle="Organization Admin"
        accentColor={accentColor}
        atlasThemeColor={atlasThemeColor}
        logoUrl={orgData?.atlasConfig?.ui?.logoLeft}
        onSignOut={() => signOut(auth)}
      />

      <div className="flex-1 flex">
        <Sidebar
          role="org_admin"
          activeSection={activeSection}
          activeTab={activeTab}
          onNavigate={handleNavigate}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          atlasThemeColor={atlasThemeColor}
        />

        <main className="flex-1 p-8 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Notification Wizard Modal */}
      {showWizard && (
        <NotificationWizard
          isOpen={showWizard}
          onClose={() => setShowWizard(false)}
          db={db}
          orgId={orgId}
          orgData={orgData}
          addToast={addToast}
          userEmail={user?.email}
          onNotificationsCreated={handleNotificationsCreated}
          accentColor={accentColor}
        />
      )}
    </div>
  );
}

// --- ORGANIZATION MANAGEMENT (for Super Admin) ---
function OrganizationManagement() {
  const { addToast, confirm } = useUI();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(null); // org object or null
  const [showIntegrationsModal, setShowIntegrationsModal] = useState(null); // org object or null
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, PATHS.organizations), (snapshot) => {
      const orgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrganizations(orgs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredOrgs = organizations.filter(org =>
    org.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateOrg = async (id, name) => {
    try {
      await setDoc(doc(db, PATHS.organizations, id), {
        name,
        timezone: "America/New_York",
        notifications: [],
        createdAt: serverTimestamp()
      });
      addToast(`Organization "${name}" created`, 'success');
      setShowAddModal(false);
    } catch (err) {
      addToast(`Error creating organization: ${err.message}`, 'error');
    }
  };

  const handleRenameOrg = async (org, newName, newId) => {
    if (!newName || newName.trim() === '') {
      addToast('Organization name cannot be empty', 'error');
      return;
    }

    if (!newId || newId.trim() === '') {
      addToast('Organization ID cannot be empty', 'error');
      return;
    }

    const nameChanged = newName !== org.name;
    const idChanged = newId !== org.id;

    if (!nameChanged && !idChanged) {
      setShowRenameModal(null);
      return;
    }

    const notificationCount = org.notifications?.length || 0;
    const mapCount = org.atlasConfig?.data?.maps?.length || 0;
    const hasNotifications = notificationCount > 0;
    const hasMaps = mapCount > 0;

    // Different confirmation messages based on what's changing
    let message = '';
    let destructive = false;

    if (idChanged) {
      destructive = true;
      message = `⚠️ BREAKING CHANGE: You are changing the organization ID from "${org.id}" to "${newId}".\n\n`;
      message += `This will:\n`;
      message += `• Break ALL existing notification subscription links\n`;
      message += `• Change ALL Atlas URLs\n`;
      message += `• Require users to get new links\n\n`;
      if (hasNotifications) {
        message += `This organization has ${notificationCount} notification${notificationCount > 1 ? 's' : ''} that will be affected.\n`;
      }
      if (hasMaps) {
        message += `This organization has ${mapCount} Atlas map${mapCount > 1 ? 's' : ''} that will be affected.\n`;
      }
      message += `\nAre you absolutely sure you want to proceed?`;
    } else if (nameChanged) {
      message = `Are you sure you want to rename "${org.name}" to "${newName}"?`;
      if (hasNotifications || hasMaps) {
        message += `\n\nNote: This organization has ${notificationCount} notification${notificationCount !== 1 ? 's' : ''} and ${mapCount} map${mapCount !== 1 ? 's' : ''}. URLs will remain unchanged.`;
      }
    }

    confirm({
      title: idChanged ? '⚠️ Change Organization ID' : 'Rename Organization',
      message,
      confirmLabel: idChanged ? 'Yes, Change ID' : 'Rename',
      destructive,
      onConfirm: async () => {
        try {
          if (idChanged) {
            // ID is changing - need to create new doc, migrate users, delete old doc
            const oldOrgRef = doc(db, PATHS.organizations, org.id);
            const newOrgRef = doc(db, PATHS.organizations, newId);

            // 1. Create new organization document with all data
            const newOrgData = { ...org };
            delete newOrgData.id; // Remove the id field (it's the doc ID)
            newOrgData.name = newName.trim();
            newOrgData.updatedAt = serverTimestamp();
            newOrgData.previousId = org.id; // Track the old ID for reference
            
            await setDoc(newOrgRef, newOrgData);

            // 2. Update all users with subscriptions or atlasAccess for this org
            const usersSnapshot = await getDocs(collection(db, PATHS.users));
            const updatePromises = [];

            usersSnapshot.docs.forEach(userDoc => {
              const userData = userDoc.data();
              const updates = {};
              let needsUpdate = false;

              // Check subscriptions
              if (userData.subscriptions && userData.subscriptions[org.id]) {
                updates[`subscriptions.${newId}`] = userData.subscriptions[org.id];
                updates[`subscriptions.${org.id}`] = deleteField();
                needsUpdate = true;
              }

              // Check atlasAccess
              if (userData.atlasAccess && userData.atlasAccess[org.id]) {
                updates[`atlasAccess.${newId}`] = userData.atlasAccess[org.id];
                updates[`atlasAccess.${org.id}`] = deleteField();
                needsUpdate = true;
              }

              if (needsUpdate) {
                updatePromises.push(updateDoc(doc(db, PATHS.users, userDoc.id), updates));
              }
            });

            // Wait for all user updates
            if (updatePromises.length > 0) {
              await Promise.all(updatePromises);
            }

            // 3. Delete the old organization document
            await deleteDoc(oldOrgRef);

            addToast(`Organization ID changed to "${newId}" and ${updatePromises.length} user${updatePromises.length !== 1 ? 's' : ''} updated`, 'success');
          } else {
            // Only name is changing - simple update
            const orgRef = doc(db, PATHS.organizations, org.id);
            await updateDoc(orgRef, { 
              name: newName.trim(),
              updatedAt: serverTimestamp()
            });
            addToast(`Organization renamed to "${newName}"`, 'success');
          }
          
          setShowRenameModal(null);
        } catch (err) {
          addToast(`Error updating organization: ${err.message}`, 'error');
        }
      }
    });
  };

  const handleDeleteOrg = (org) => {
    // Check if org has notifications
    const notificationCount = org.notifications?.length || 0;
    
    if (notificationCount > 0) {
      addToast(`Cannot delete "${org.name}" - it has ${notificationCount} notification${notificationCount > 1 ? 's' : ''}. Delete the notifications first.`, 'error');
      return;
    }

    // Check if org has atlas maps
    const mapCount = org.atlasConfig?.data?.maps?.length || 0;
    if (mapCount > 0) {
      addToast(`Cannot delete "${org.name}" - it has ${mapCount} Atlas map${mapCount > 1 ? 's' : ''}. Uninitialize Atlas first.`, 'error');
      return;
    }
    
    confirm({
      title: 'Delete Organization',
      message: `Are you sure you want to delete "${org.name}"? This action cannot be undone.`,
      destructive: true,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, PATHS.organizations, org.id));
          addToast('Organization deleted', 'success');
        } catch (err) {
          addToast(`Error deleting organization: ${err.message}`, 'error');
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Organizations</h2>
          <p className="text-slate-500 text-sm">Manage organizations across all CivQuest modules.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#004E7C] text-white rounded-lg hover:bg-[#003B5C] font-medium"
        >
          <Plus className="w-4 h-4" /> Add Organization
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search organizations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004E7C]"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrgs.map(org => {
            const hasNotifications = (org.notifications?.length || 0) > 0;
            const hasMaps = (org.atlasConfig?.data?.maps?.length || 0) > 0;
            const canDelete = !hasNotifications && !hasMaps;
            return (
            <div key={org.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-slate-800">{org.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">{org.id}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowIntegrationsModal(org)}
                    className="p-1.5 rounded text-slate-400 hover:text-purple-600 hover:bg-purple-50"
                    title="Configure Integrations"
                  >
                    <Puzzle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowRenameModal(org)}
                    className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                    title="Rename Organization"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteOrg(org)}
                    className={`p-1.5 rounded ${
                      canDelete
                        ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                        : 'text-slate-300 cursor-not-allowed'
                    }`}
                    title={canDelete ? 'Delete Organization' : 'Delete notifications and maps first'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <div className="flex items-center gap-1">
                  <Bell className="w-4 h-4 text-slate-400" />
                  <span>{org.notifications?.length || 0} notifications</span>
                </div>
                <div className="flex items-center gap-1">
                  <Map className="w-4 h-4 text-slate-400" />
                  <span>{org.atlasConfig?.data?.maps?.length || 0} maps</span>
                </div>
              </div>
              
              {org.arcgisAccount?.username && (
                <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                  <Globe className="w-3 h-3" />
                  <span>ArcGIS linked: {org.arcgisAccount.username}</span>
                </div>
              )}
            </div>
            );
          })}
          
          {filteredOrgs.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500">
              No organizations found.
            </div>
          )}
        </div>
      )}

      {/* Add Organization Modal */}
      {showAddModal && (
        <AddOrganizationModal
          onClose={() => setShowAddModal(false)}
          onSave={handleCreateOrg}
          existingIds={organizations.map(o => o.id)}
        />
      )}

      {/* Rename Organization Modal */}
      {showRenameModal && (
        <RenameOrganizationModal
          org={showRenameModal}
          onClose={() => setShowRenameModal(null)}
          onSave={(newName, newId) => handleRenameOrg(showRenameModal, newName, newId)}
          existingIds={organizations.filter(o => o.id !== showRenameModal.id).map(o => o.id)}
        />
      )}

      {/* Organization Integrations Modal */}
      {showIntegrationsModal && (
        <OrgIntegrationsModal
          db={db}
          org={showIntegrationsModal}
          onClose={() => setShowIntegrationsModal(null)}
          addToast={addToast}
          accentColor="#004E7C"
        />
      )}
    </div>
  );
}

// --- ORGANIZATION INTEGRATIONS MODAL (for Super Admin) ---
function OrgIntegrationsModal({ db, org, onClose, addToast, accentColor = '#004E7C' }) {
  const [systemIntegrations, setSystemIntegrations] = useState([]);
  const [orgIntegrations, setOrgIntegrations] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [configValues, setConfigValues] = useState({});
  const [hasChanges, setHasChanges] = useState({});

  // Subscribe to system integrations
  useEffect(() => {
    const unsubscribe = subscribeToIntegrations((data) => {
      // Filter to only integrations assigned to this org and enabled
      const orgAssigned = data.filter(
        i => i.enabled && i.organizations?.includes(org.id)
      );
      setSystemIntegrations(orgAssigned);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [org.id]);

  // Subscribe to org-level integration config
  useEffect(() => {
    if (!db || !org.id) return;

    const orgRef = doc(db, PATHS.organizations, org.id);
    const unsubscribe = onSnapshot(orgRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const integrations = data.integrations || {};
        setOrgIntegrations(integrations);
        // Initialize config values from saved data
        setConfigValues(integrations);
      }
    });
    return () => unsubscribe();
  }, [db, org.id]);

  const getIntegrationDefinition = (type) => {
    return AVAILABLE_INTEGRATIONS[type] || null;
  };

  const handleFieldChange = (integrationTypeKey, field, value) => {
    setConfigValues(prev => ({
      ...prev,
      [integrationTypeKey]: {
        ...(prev[integrationTypeKey] || {}),
        [field]: value
      }
    }));
    setHasChanges(prev => ({
      ...prev,
      [integrationTypeKey]: true
    }));
  };

  const handleSaveConfig = async (integrationTypeKey) => {
    if (!db || !org.id) {
      addToast?.('Unable to save: missing database connection', 'error');
      return;
    }

    try {
      setSaving(prev => ({ ...prev, [integrationTypeKey]: true }));

      const orgRef = doc(db, PATHS.organizations, org.id);
      await updateDoc(orgRef, {
        [`integrations.${integrationTypeKey}`]: configValues[integrationTypeKey] || {},
        updatedAt: serverTimestamp()
      });

      setHasChanges(prev => ({ ...prev, [integrationTypeKey]: false }));
      addToast?.('Integration configuration saved', 'success');
    } catch (error) {
      console.error('Error saving integration config:', error);
      addToast?.('Failed to save configuration', 'error');
    } finally {
      setSaving(prev => ({ ...prev, [integrationTypeKey]: false }));
    }
  };

  const isConfigured = (integrationTypeKey) => {
    // Nearmap doesn't require credentials - it's always configured
    if (integrationTypeKey === 'nearmap') {
      return true;
    }
    const config = configValues[integrationTypeKey];
    return config?.apiKey && config.apiKey.trim() !== '';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <Puzzle className="w-5 h-5" style={{ color: accentColor }} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Organization Integrations</h3>
              <p className="text-sm text-slate-500">{org.name}</p>
            </div>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
            </div>
          ) : systemIntegrations.length === 0 ? (
            <div className="text-center py-12">
              <Puzzle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No Integrations Assigned</h3>
              <p className="text-slate-500 mb-4">
                This organization does not have any integrations assigned yet.
              </p>
              <p className="text-sm text-slate-400">
                Go to <strong>System &gt; Integrations</strong> to assign integrations to this organization.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-800">Configure Integration Settings</p>
                    <p className="text-blue-700 mt-1">
                      As a super admin, you can configure integration credentials for this organization.
                      These settings will be used by the organization's Atlas application.
                    </p>
                  </div>
                </div>
              </div>

              {systemIntegrations.map(integration => {
                const definition = getIntegrationDefinition(integration.type);
                const config = configValues[integration.type] || {};
                const configured = isConfigured(integration.type);
                const changed = hasChanges[integration.type];
                const isSaving = saving[integration.type];

                return (
                  <div
                    key={integration.id}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                  >
                    {/* Integration Header */}
                    <div className="p-4 border-b border-slate-100">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${accentColor}15` }}
                        >
                          {integration.type === 'nearmap' ? (
                            <MapPin className="w-5 h-5" style={{ color: accentColor }} />
                          ) : (
                            <Eye className="w-5 h-5" style={{ color: accentColor }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-slate-800">{integration.name}</h4>
                            {configured ? (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                <CheckCircle className="w-3 h-3" />
                                Configured
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                <AlertTriangle className="w-3 h-3" />
                                Setup Required
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">
                            {definition?.description || 'Integration'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Configuration Fields */}
                    <div className="p-4 space-y-4 bg-slate-50">
                      {integration.type === 'pictometry' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              <div className="flex items-center gap-2">
                                <Settings className="w-4 h-4 text-slate-400" />
                                EagleView API Key
                              </div>
                            </label>
                            <input
                              type="text"
                              value={config?.apiKey || ''}
                              onChange={(e) => handleFieldChange(integration.type, 'apiKey', e.target.value)}
                              placeholder="e.g., 3f513db9-95ae-4df3-b64b-b26267b95cce"
                              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent font-mono text-sm"
                              style={{ '--tw-ring-color': accentColor }}
                            />
                            <p className="text-xs text-slate-500 mt-1">
                              The API key must be configured for use with the domain where Atlas is deployed.
                            </p>
                          </div>
                        </>
                      )}

                      {/* Nearmap - No credentials required */}
                      {integration.type === 'nearmap' && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm">
                              <p className="font-medium text-green-800 mb-1">No Credentials Required</p>
                              <p className="text-green-700">
                                Nearmap authentication is handled directly in the embedded viewer.
                                This integration only requires configuring the popup window size.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Generic config schema fields for future integrations */}
                      {integration.type !== 'pictometry' && integration.type !== 'nearmap' && definition?.configSchema && (
                        Object.entries(definition.configSchema).map(([fieldKey, fieldDef]) => (
                          <div key={fieldKey}>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              {fieldDef.label}
                              {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            <input
                              type={fieldDef.type === 'password' ? 'password' : 'text'}
                              value={config?.[fieldKey] || ''}
                              onChange={(e) => handleFieldChange(integration.type, fieldKey, e.target.value)}
                              placeholder={fieldDef.placeholder || ''}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2"
                              style={{ '--tw-ring-color': accentColor }}
                            />
                            {fieldDef.description && (
                              <p className="text-xs text-slate-500 mt-1">{fieldDef.description}</p>
                            )}
                          </div>
                        ))
                      )}

                      {/* Save Button */}
                      <div className="flex items-center justify-between pt-2">
                        <div className="text-sm text-slate-500">
                          {changed ? (
                            <span className="text-amber-600 font-medium">Unsaved changes</span>
                          ) : integration.type === 'nearmap' ? (
                            <span className="text-green-600">Ready to use</span>
                          ) : configured ? (
                            <span className="text-green-600">Configuration saved</span>
                          ) : (
                            <span>Enter credentials to configure</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleSaveConfig(integration.type)}
                          disabled={isSaving || !changed}
                          className="px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2 transition-colors"
                          style={{ backgroundColor: changed ? accentColor : '#94a3b8' }}
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4" />
                              Save
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// --- ADD ORGANIZATION MODAL ---
function AddOrganizationModal({ onClose, onSave, existingIds }) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [idError, setIdError] = useState('');

  const handleIdChange = (value) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    setId(sanitized);
    if (existingIds.includes(sanitized)) {
      setIdError('This ID already exists');
    } else {
      setIdError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!id || !name || idError) return;
    
    setSaving(true);
    await onSave(id, name);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">Add Organization</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Organization Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., City of Chesapeake"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004E7C]"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Organization ID (System)</label>
            <input
              type="text"
              value={id}
              onChange={(e) => handleIdChange(e.target.value)}
              placeholder="e.g., chesapeake"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004E7C] font-mono text-sm ${
                idError ? 'border-red-300 bg-red-50' : 'border-slate-300'
              }`}
              required
            />
            {idError && <p className="text-red-600 text-xs mt-1">{idError}</p>}
            <p className="text-slate-500 text-xs mt-1">Used in URLs and database. Cannot be changed later.</p>
          </div>
          
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !id || !name || !!idError}
              className="px-4 py-2 bg-[#004E7C] text-white rounded-lg font-medium hover:bg-[#003B5C] disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Organization
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- RENAME ORGANIZATION MODAL ---
function RenameOrganizationModal({ org, onClose, onSave, existingIds = [] }) {
  const [name, setName] = useState(org.name || '');
  const [newId, setNewId] = useState(org.id || '');
  const [idError, setIdError] = useState('');
  
  const hasNotifications = (org.notifications?.length || 0) > 0;
  const hasMaps = (org.atlasConfig?.data?.maps?.length || 0) > 0;
  const hasContent = hasNotifications || hasMaps;
  const isChangingId = newId !== org.id;

  const handleIdChange = (value) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    setNewId(sanitized);
    if (sanitized !== org.id && existingIds.includes(sanitized)) {
      setIdError('This ID already exists');
    } else if (sanitized.length < 2) {
      setIdError('ID must be at least 2 characters');
    } else {
      setIdError('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !newId.trim() || idError) return;
    onSave(name.trim(), newId.trim());
  };

  const hasChanges = name.trim() !== org.name || newId !== org.id;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">Edit Organization</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Organization Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter organization name..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004E7C]"
              autoFocus
              required
            />
          </div>

          {/* ID Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Organization ID
            </label>
            <input
              type="text"
              value={newId}
              onChange={(e) => handleIdChange(e.target.value)}
              placeholder="Enter organization ID..."
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004E7C] font-mono text-sm ${
                idError ? 'border-red-300 bg-red-50' : 'border-slate-300'
              }`}
              required
            />
            {idError && <p className="text-red-600 text-xs mt-1">{idError}</p>}
            <p className="text-slate-500 text-xs mt-1">
              Current ID: <code className="bg-slate-100 px-1 rounded">{org.id}</code>
            </p>
          </div>

          {/* Warning for changing ID */}
          {isChangingId && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-red-800">⚠️ Changing Organization ID is a breaking change!</p>
                  <ul className="mt-2 text-red-700 space-y-1">
                    <li>• <strong>All notification subscription links will break</strong></li>
                    <li>• <strong>All Atlas URLs will change</strong></li>
                    <li>• Users will need new links to subscribe/access</li>
                    <li>• Existing bookmarks will stop working</li>
                  </ul>
                  <p className="mt-2 text-red-700">
                    Old URL: <code className="bg-red-100 px-1 rounded">/notify/{org.id}</code><br/>
                    New URL: <code className="bg-red-100 px-1 rounded">/notify/{newId}</code>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Warning for orgs with content (name change only) */}
          {hasContent && !isChangingId && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800">This organization has existing content:</p>
                  <ul className="mt-1 text-amber-700 space-y-0.5">
                    {hasNotifications && (
                      <li>• {org.notifications.length} notification{org.notifications.length > 1 ? 's' : ''}</li>
                    )}
                    {hasMaps && (
                      <li>• {org.atlasConfig.data.maps.length} Atlas map{org.atlasConfig.data.maps.length > 1 ? 's' : ''}</li>
                    )}
                  </ul>
                  <p className="mt-2 text-amber-700">
                    Renaming will update the display name. URLs remain unchanged.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Info about what changes */}
          <div className="text-xs text-slate-500 space-y-1 bg-slate-50 rounded-lg p-3">
            <p><strong>What will change:</strong></p>
            <ul className="list-disc list-inside space-y-0.5 ml-2">
              <li>Display name in admin dashboards</li>
              <li>Atlas header title (if using organization name)</li>
              <li>Notification email headers</li>
              {isChangingId && (
                <>
                  <li className="text-red-600 font-medium">All URLs containing the organization ID</li>
                  <li className="text-red-600 font-medium">User subscription references</li>
                  <li className="text-red-600 font-medium">User Atlas access references</li>
                </>
              )}
            </ul>
          </div>
          
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!hasChanges || !name.trim() || !newId.trim() || !!idError}
              className={`px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2 ${
                isChangingId 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-[#004E7C] hover:bg-[#003B5C]'
              }`}
            >
              {isChangingId ? 'Change ID & Rename' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- ADMIN MANAGEMENT (for Super Admin) ---
function OrgAdminManagement() {
  const { addToast, confirm } = useUI();
  const [admins, setAdmins] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassigningAdmin, setReassigningAdmin] = useState(null);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all', 'super_admin', 'org_admin'

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const snap = await getDocs(collection(db, PATHS.organizations));
        const orgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOrganizations(orgs);
      } catch (e) {
        console.error("Error fetching organizations:", e);
      }
    };
    fetchOrgs();

    const adminsRef = collection(db, PATHS.admins);
    const unsubscribe = onSnapshot(adminsRef, (snapshot) => {
      const allAdmins = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      setAdmins(allAdmins);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching admins:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getOrgName = (orgId) => {
    const org = organizations.find(o => o.id === orgId);
    return org ? org.name : orgId;
  };

  const filteredAdmins = admins.filter(admin => {
    // Apply role filter
    if (roleFilter !== 'all' && admin.role !== roleFilter) return false;
    // Apply search filter
    const searchLower = searchTerm.toLowerCase();
    return (
      admin.email?.toLowerCase().includes(searchLower) ||
      getOrgName(admin.organizationId)?.toLowerCase().includes(searchLower) ||
      admin.role?.toLowerCase().includes(searchLower)
    );
  });

  const handleAddAdmin = async (email, role, organizationId) => {
    try {
      // Search for existing user by email
      const usersQuery = query(
        collection(db, PATHS.users),
        where('email', '==', email.toLowerCase())
      );
      const usersSnapshot = await getDocs(usersQuery);

      if (usersSnapshot.empty) {
        addToast(`No user found with email ${email}. The user must have an existing CivQuest account.`, 'error');
        return;
      }

      const existingUser = usersSnapshot.docs[0];
      const userId = existingUser.id;

      // Check if user is already an admin
      const existingAdminDoc = await getDoc(doc(db, PATHS.admins, userId));
      if (existingAdminDoc.exists()) {
        addToast(`User ${email} is already an admin.`, 'error');
        return;
      }

      // Create admin document for existing user
      const adminData = {
        email: email.toLowerCase(),
        role,
        disabled: false,
        createdAt: serverTimestamp()
      };

      // Only set organizationId for org_admin
      if (role === 'org_admin') {
        adminData.organizationId = organizationId;
      }

      await setDoc(doc(db, PATHS.admins, userId), adminData);

      const roleLabel = role === 'super_admin' ? 'super admin' : 'organization admin';
      addToast(`${email} has been added as a ${roleLabel}.`, 'success');
      setShowAddModal(false);
    } catch (err) {
      addToast(`Error adding admin: ${err.message}`, 'error');
    }
  };

  const handleToggleDisabled = async (admin) => {
    try {
      await updateDoc(doc(db, PATHS.admins, admin.id), {
        disabled: !admin.disabled
      });
      addToast(`Admin ${admin.disabled ? 'enabled' : 'disabled'}`, 'success');
    } catch (err) {
      addToast(`Error updating admin: ${err.message}`, 'error');
    }
  };

  const handleDeleteAdmin = (admin) => {
    const roleLabel = admin.role === 'super_admin' ? 'Super Admin' : 'Admin';
    confirm({
      title: `Delete ${roleLabel}`,
      message: `Are you sure you want to delete ${admin.email}? This cannot be undone.`,
      destructive: true,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, PATHS.admins, admin.id));
          addToast('Admin deleted', 'success');
        } catch (err) {
          addToast(`Error deleting admin: ${err.message}`, 'error');
        }
      }
    });
  };

  const handleOpenReassign = (admin) => {
    setReassigningAdmin(admin);
    setShowReassignModal(true);
  };

  const handleReassignAdmin = async (newRole, newOrgId) => {
    if (!reassigningAdmin) return;

    try {
      const updateData = { role: newRole };

      if (newRole === 'org_admin') {
        // Org admin requires an organization
        updateData.organizationId = newOrgId;
      } else {
        // Super admin - remove organization association
        updateData.organizationId = deleteField();
      }

      await updateDoc(doc(db, PATHS.admins, reassigningAdmin.id), updateData);

      if (newRole === 'super_admin') {
        addToast(`${reassigningAdmin.email} is now a Super Admin.`, 'success');
      } else {
        const newOrgName = getOrgName(newOrgId);
        addToast(`${reassigningAdmin.email} has been reassigned to ${newOrgName}.`, 'success');
      }
      setShowReassignModal(false);
      setReassigningAdmin(null);
    } catch (err) {
      addToast(`Error reassigning admin: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Admins</h2>
          <p className="text-slate-500 text-sm">Manage super admins and organization admins.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#004E7C] text-white rounded-lg hover:bg-[#003B5C] font-medium"
        >
          <UserPlus className="w-4 h-4" /> Add Admin
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by email, organization, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004E7C]"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004E7C] bg-white"
        >
          <option value="all">All Roles</option>
          <option value="super_admin">Super Admins</option>
          <option value="org_admin">Org Admins</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Email</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Role</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Organization</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Status</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAdmins.map(admin => (
                <tr key={admin.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-800">{admin.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                      admin.role === 'super_admin'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {admin.role === 'super_admin' ? (
                        <>
                          <Shield className="w-3 h-3" />
                          Super Admin
                        </>
                      ) : (
                        <>
                          <Building2 className="w-3 h-3" />
                          Org Admin
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {admin.role === 'super_admin' ? (
                      <span className="text-slate-400 italic">All Organizations</span>
                    ) : (
                      getOrgName(admin.organizationId)
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                      admin.disabled
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {admin.disabled ? <Ban className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                      {admin.disabled ? 'Disabled' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleOpenReassign(admin)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Change role or organization"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleDisabled(admin)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                        title={admin.disabled ? 'Enable' : 'Disable'}
                      >
                        {admin.disabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDeleteAdmin(admin)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAdmins.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No admins found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Admin Modal */}
      {showAddModal && (
        <AddOrgAdminModal
          organizations={organizations}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddAdmin}
        />
      )}

      {/* Reassign Admin Modal */}
      {showReassignModal && reassigningAdmin && (
        <ReassignAdminModal
          admin={reassigningAdmin}
          organizations={organizations}
          currentRole={reassigningAdmin.role}
          currentOrgId={reassigningAdmin.organizationId}
          onClose={() => {
            setShowReassignModal(false);
            setReassigningAdmin(null);
          }}
          onSave={handleReassignAdmin}
        />
      )}
    </div>
  );
}

// --- ADD ADMIN MODAL ---
function AddOrgAdminModal({ organizations, onClose, onSave }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('org_admin');
  const [organizationId, setOrganizationId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    if (role === 'org_admin' && !organizationId) return;

    setSaving(true);
    await onSave(email, role, organizationId);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">Add Admin</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-slate-500 -mt-2 mb-2">
            Add an existing CivQuest user as an admin.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter user's email address"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004E7C]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                if (e.target.value === 'super_admin') {
                  setOrganizationId('');
                }
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004E7C]"
            >
              <option value="org_admin">Organization Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          {role === 'org_admin' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Organization</label>
              <select
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004E7C]"
                required
              >
                <option value="">Select organization...</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          )}

          {role === 'super_admin' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                Super Admins have access to all organizations and system settings.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !email || (role === 'org_admin' && !organizationId)}
              className="px-4 py-2 bg-[#004E7C] text-white rounded-lg font-medium hover:bg-[#003B5C] disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Admin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- REASSIGN ADMIN MODAL ---
function ReassignAdminModal({ admin, organizations, currentRole, currentOrgId, onClose, onSave }) {
  const [newRole, setNewRole] = useState(currentRole);
  const [newOrganizationId, setNewOrganizationId] = useState(currentOrgId || '');
  const [saving, setSaving] = useState(false);

  const currentOrgName = organizations.find(o => o.id === currentOrgId)?.name || currentOrgId;
  const currentRoleLabel = currentRole === 'super_admin' ? 'Super Admin' : 'Organization Admin';

  // Check if any change has been made
  const hasChanges = newRole !== currentRole ||
    (newRole === 'org_admin' && newOrganizationId !== currentOrgId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasChanges) return;
    if (newRole === 'org_admin' && !newOrganizationId) return;

    setSaving(true);
    await onSave(newRole, newOrganizationId);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">Edit Admin</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-slate-500 -mt-2 mb-2">
            Change role or organization for <span className="font-medium text-slate-700">{admin.email}</span>.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Current Role</label>
            <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600">
              {currentRoleLabel}
              {currentRole === 'org_admin' && currentOrgName && ` (${currentOrgName})`}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New Role</label>
            <select
              value={newRole}
              onChange={(e) => {
                setNewRole(e.target.value);
                if (e.target.value === 'super_admin') {
                  setNewOrganizationId('');
                } else if (!newOrganizationId && currentOrgId) {
                  setNewOrganizationId(currentOrgId);
                }
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004E7C]"
            >
              <option value="org_admin">Organization Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          {newRole === 'org_admin' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Organization</label>
              <select
                value={newOrganizationId}
                onChange={(e) => setNewOrganizationId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004E7C]"
                required
              >
                <option value="">Select organization...</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          )}

          {newRole === 'super_admin' && currentRole !== 'super_admin' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                Promoting to Super Admin will give access to all organizations and system settings.
              </p>
            </div>
          )}

          {newRole === 'org_admin' && currentRole === 'super_admin' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700">
                Demoting to Organization Admin will restrict access to only the selected organization.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !hasChanges || (newRole === 'org_admin' && !newOrganizationId)}
              className="px-4 py-2 bg-[#004E7C] text-white rounded-lg font-medium hover:bg-[#003B5C] disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}