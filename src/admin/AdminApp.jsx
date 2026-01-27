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
  Printer
} from 'lucide-react';

// Import admin components
import NotificationEditModal from './components/NotificationEditor';
import Archive from './components/Archive';
import UserManagementPanel from './components/UserManagement';
import ConfigurationPanel from './components/NotifyConfiguration';
import NotificationWizard from './components/NotificationWizard';
import AtlasAdminSection from './components/AtlasAdminSection';

// Import shared services
import { PATHS } from '../shared/services/paths';

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

  const confirm = useCallback(({ title, message, confirmLabel = 'Confirm', destructive = false, onConfirm }) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      confirmLabel,
      destructive,
      onConfirm: () => {
        onConfirm();
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      },
      onCancel: () => setConfirmState(prev => ({ ...prev, isOpen: false }))
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
            <p className="text-slate-600 mb-6">{confirmState.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={confirmState.onCancel}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmState.onConfirm}
                className={`px-4 py-2 text-white rounded-lg font-medium ${
                  confirmState.destructive 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-[#004E7C] hover:bg-[#003B5C]'
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
export default function AdminAppWrapper() {
  return (
    <UIProvider>
      <AdminApp />
    </UIProvider>
  );
}

// --- MAIN ADMIN APP ---
function AdminApp() {
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
          const adminDoc = await getDoc(doc(db, PATHS.admins, currentUser.uid));
          if (adminDoc.exists()) {
            const adminData = adminDoc.data();
            
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
    return <AdminLogin />;
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
function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-[#004E7C]" />
          <h1 className="text-2xl font-bold text-slate-800">Admin Portal</h1>
        </div>
        
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
function Sidebar({ role, activeSection, activeTab, onNavigate, collapsed, onToggleCollapse }) {
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
        { id: 'maps', label: 'Maps', icon: Layers },
        { id: 'export-templates', label: 'Export Templates', icon: Printer },
        { id: 'preview', label: 'Preview', icon: Eye },
      ];

  // System-level items (super_admin only)
  const systemItems = [
    { id: 'organizations', label: 'Organizations', icon: Building2 },
	{ id: 'licensing', label: 'Licensing', icon: Shield },  // <-- Add this line
    { id: 'orgadmins', label: 'Org Admins', icon: UserPlus },
  ];

  const accentColor = role === 'super_admin' ? '#004E7C' : '#1E5631';
  const accentColorLight = role === 'super_admin' ? '#E6F0F6' : '#E8F5E9';

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

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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
function AdminHeader({ user, title, subtitle, accentColor, onSignOut }) {
  return (
    <header 
      className="text-white px-6 py-4 flex items-center justify-between shadow-md"
      style={{ backgroundColor: accentColor === '#1E5631' ? '#164524' : '#002A4D' }}
    >
      <div className="flex items-center gap-3">
        <img 
          src="https://geoplan.nyc3.digitaloceanspaces.com/CivQuest/CVG_Logo_Medium.jpg" 
          alt="CivQuest Logo"
          className="h-10 w-auto object-contain rounded"
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

  const handleNavigate = (section, tab) => {
    setActiveSection(section);
    setActiveTab(tab);
  };

  const renderContent = () => {
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
        case 'orgadmins':
          return <OrgAdminManagement />;
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
        title="CivQuest Admin"
        subtitle="System Administrator"
        accentColor="#004E7C"
        onSignOut={() => signOut(auth)}
      />
      
      <div className="flex-1 flex">
        <Sidebar 
          role="super_admin"
          activeSection={activeSection}
          activeTab={activeTab}
          onNavigate={handleNavigate}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        
        <main className="flex-1 p-8 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}

// --- ORG ADMIN DASHBOARD ---
function OrgAdminDashboard({ user, orgConfig }) {
  const [activeSection, setActiveSection] = useState('notify');
  const [activeTab, setActiveTab] = useState('subscribers');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const { addToast, confirm } = useUI();
  const { orgId, orgData, isNewAccount, clearNewAccountFlag } = useAdmin();

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
              accentColor="#1E5631"
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
              accentColor="#1E5631"
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
              accentColor="#1E5631"
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
          accentColor="#1E5631"
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
        accentColor="#1E5631"
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
          accentColor="#1E5631"
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

// --- ORG ADMIN MANAGEMENT (for Super Admin) ---
function OrgAdminManagement() {
  const { addToast, confirm } = useUI();
  const [orgAdmins, setOrgAdmins] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

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
      const admins = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(admin => admin.role === 'org_admin');
      setOrgAdmins(admins);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching org admins:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getOrgName = (orgId) => {
    const org = organizations.find(o => o.id === orgId);
    return org ? org.name : orgId;
  };

  const filteredAdmins = orgAdmins.filter(admin =>
    admin.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getOrgName(admin.organizationId)?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddAdmin = async (email, organizationId) => {
    try {
      // Create Firebase Auth account
      const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
      const userCredential = await createUserWithEmailAndPassword(auth, email, tempPassword);
      
      // Create admin document
      await setDoc(doc(db, PATHS.admins, userCredential.user.uid), {
        email: email.toLowerCase(),
        role: 'org_admin',
        organizationId,
        disabled: false,
        createdAt: serverTimestamp()
      });
      
      addToast(`Admin ${email} created. Temporary password: ${tempPassword}`, 'success');
      setShowAddModal(false);
    } catch (err) {
      addToast(`Error creating admin: ${err.message}`, 'error');
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
    confirm({
      title: 'Delete Org Admin',
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Organization Admins</h2>
          <p className="text-slate-500 text-sm">Manage admin access for organizations.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#004E7C] text-white rounded-lg hover:bg-[#003B5C] font-medium"
        >
          <UserPlus className="w-4 h-4" /> Add Org Admin
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by email or organization..."
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
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Email</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Organization</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Status</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAdmins.map(admin => (
                <tr key={admin.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-800">{admin.email}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{getOrgName(admin.organizationId)}</td>
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
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No org admins found.
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
    </div>
  );
}

// --- ADD ORG ADMIN MODAL ---
function AddOrgAdminModal({ organizations, onClose, onSave }) {
  const [email, setEmail] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !organizationId) return;
    
    setSaving(true);
    await onSave(email, organizationId);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">Add Organization Admin</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004E7C]"
              required
            />
          </div>
          
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
              disabled={saving || !email || !organizationId}
              className="px-4 py-2 bg-[#004E7C] text-white rounded-lg font-medium hover:bg-[#003B5C] disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Admin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}