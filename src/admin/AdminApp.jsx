// src/admin/AdminApp.jsx
// Unified CivQuest Admin Application
// Uses unified Firestore paths (organizations/, users/, admins/)

import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { initializeApp } from "firebase/app";
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
  PanelLeft
} from 'lucide-react';

// Import admin components
import NotificationEditModal from './components/NotificationEditor';
import Archive from './components/Archive';
import UserManagementPanel from './components/UserManagement';
import ConfigurationPanel from './components/Configuration';

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
    }, 5000);
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const confirm = useCallback(({ title, message, confirmLabel = 'Confirm', destructive = false, onConfirm }) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      confirmLabel,
      destructive,
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
        await onConfirm();
      },
      onCancel: () => setConfirmState(prev => ({ ...prev, isOpen: false }))
    });
  }, []);

  return (
    <UIContext.Provider value={{ addToast, confirm }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`
              pointer-events-auto min-w-[300px] max-w-md p-4 rounded-lg shadow-lg border animate-in slide-in-from-right-full fade-in duration-300
              ${toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 
                toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 
                'bg-white border-slate-200 text-slate-800'}
            `}
          >
            <div className="flex items-start gap-3">
              {toast.type === 'error' ? <AlertOctagon className="w-5 h-5 shrink-0 text-red-600" /> :
               toast.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0 text-green-600" /> :
               <Info className="w-5 h-5 shrink-0 text-[#004E7C]" />}
              
              <div className="flex-1 text-sm font-medium pt-0.5">{toast.message}</div>
              
              <button onClick={() => removeToast(toast.id)} className="text-current opacity-50 hover:opacity-100">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Global Confirmation Dialog */}
      {confirmState.isOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
             <div className="flex flex-col items-center text-center gap-3">
               <div className={`p-3 rounded-full ${confirmState.destructive ? 'bg-red-100 text-red-600' : 'bg-[#004E7C]/10 text-[#004E7C]'}`}>
                 {confirmState.destructive ? <AlertTriangle className="w-8 h-8" /> : <Info className="w-8 h-8" />}
               </div>
               <h3 className="text-xl font-bold text-slate-800">{confirmState.title}</h3>
               <p className="text-slate-600">{confirmState.message}</p>
             </div>
             <div className="flex gap-3 mt-8">
               <button 
                 onClick={confirmState.onCancel}
                 className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
               >
                 Cancel
               </button>
               <button 
                 onClick={confirmState.onConfirm}
                 className={`flex-1 px-4 py-2.5 text-white rounded-lg font-bold transition-colors ${confirmState.destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-[#004E7C] hover:bg-[#003B5C]'}`}
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
  const [adminRole, setAdminRole] = useState(null); // 'super_admin' or 'org_admin'
  const [orgAdminData, setOrgAdminData] = useState(null);
  const [orgConfig, setOrgConfig] = useState(null);
  const [accessError, setAccessError] = useState(null);
  const [isNewAccount, setIsNewAccount] = useState(false);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Check admin role using NEW unified path (admins/{uid})
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
              
              // Fetch org config using NEW unified path (organizations/{orgId})
              if (adminData.organizationId) {
                const configDoc = await getDoc(doc(db, PATHS.organizations, adminData.organizationId));
                if (configDoc.exists()) {
                  setOrgConfig({ id: configDoc.id, ...configDoc.data() });
                }
              }
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

  if (adminRole === 'org_admin' && orgConfig) {
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

// --- SIDEBAR NAVIGATION ---
function Sidebar({ role, activeSection, activeTab, onNavigate, collapsed, onToggleCollapse }) {
  const [expandedSections, setExpandedSections] = useState({ notify: true, atlas: false });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Navigation items based on role
  const notifyItems = role === 'super_admin' 
    ? [
        { id: 'subscribers', label: 'Subscribers', icon: Users },
        { id: 'configuration', label: 'Configuration', icon: Settings },
        { id: 'archive', label: 'Archive', icon: History },
        { id: 'orgadmins', label: 'Org Admins', icon: Building2 },
      ]
    : [
        { id: 'subscribers', label: 'Subscribers', icon: Users },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'archive', label: 'Archive', icon: History },
      ];

  const atlasItems = [
    { id: 'coming-soon', label: 'Coming Soon', icon: Map, disabled: true },
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
      {/* Sidebar Header */}
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

      {/* Navigation */}
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

        {/* Atlas Section (Stub) */}
        <div className="mb-2">
          <button
            onClick={() => !collapsed && toggleSection('atlas')}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
              ${activeSection === 'atlas' 
                ? 'bg-slate-800 text-white font-medium' 
                : 'text-slate-700 hover:bg-slate-100'
              }
            `}
          >
            <Map className="w-5 h-5 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left font-medium">Atlas</span>
                <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">Soon</span>
              </>
            )}
          </button>
          
          {!collapsed && expandedSections.atlas && (
            <div className="mt-1 ml-3 pl-3 border-l-2 border-slate-200 space-y-1">
              {atlasItems.map(item => (
                <button
                  key={item.id}
                  disabled={item.disabled}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 cursor-not-allowed"
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Sidebar Footer */}
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
        case 'orgadmins':
          return <OrgAdminManagement />;
        default:
          return null;
      }
    }
    
    if (activeSection === 'atlas') {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Map className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-600">Atlas Admin</h3>
            <p className="text-slate-500 mt-2">Coming soon in Phase 3</p>
          </div>
        </div>
      );
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
  const { addToast, confirm } = useUI();
  const { orgId, orgData, isNewAccount, clearNewAccountFlag } = useAdmin();

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
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Map className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-600">Atlas Admin</h3>
            <p className="text-slate-500 mt-2">Coming soon in Phase 3</p>
          </div>
        </div>
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
    </div>
  );
}

// --- ORG ADMIN MANAGEMENT (for Super Admin) ---
// Uses NEW unified paths: admins/{uid} and organizations/{orgId}
function OrgAdminManagement() {
  const { addToast, confirm } = useUI();
  const [orgAdmins, setOrgAdmins] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Fetch organizations using NEW path
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

    // Real-time listener for org admins using NEW path
    // Filter to only org_admin role
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

  const handleAddOrgAdmin = async (data) => {
    try {
      // For new unified structure, we need the user's UID
      // Since we're creating by email, we'll use email as a temporary key
      // In production, this should look up or create the Firebase Auth user first
      const adminId = data.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const adminRef = doc(db, PATHS.admins, adminId);
      await setDoc(adminRef, {
        email: data.email.toLowerCase(),
        role: 'org_admin',
        organizationId: data.orgId,
        disabled: false,
        createdAt: serverTimestamp()
      });
      setShowAddModal(false);
      addToast(`${data.email} added as org admin for ${getOrgName(data.orgId)}`, "success");
    } catch (err) {
      addToast("Error adding org admin: " + err.message, "error");
    }
  };

  const handleUpdateOrgAdmin = async (adminId, data) => {
    try {
      const adminRef = doc(db, PATHS.admins, adminId);
      await updateDoc(adminRef, {
        organizationId: data.orgId,
        disabled: data.disabled
      });
      setEditingAdmin(null);
      addToast("Org admin updated", "success");
    } catch (err) {
      addToast("Error updating org admin: " + err.message, "error");
    }
  };

  const handleToggleStatus = (admin) => {
    const newStatus = !admin.disabled;
    confirm({
      title: newStatus ? 'Disable Org Admin' : 'Enable Org Admin',
      message: `Are you sure you want to ${newStatus ? 'disable' : 'enable'} ${admin.email}?`,
      destructive: newStatus,
      confirmLabel: newStatus ? 'Disable' : 'Enable',
      onConfirm: async () => {
        try {
          const adminRef = doc(db, PATHS.admins, admin.id);
          await updateDoc(adminRef, { disabled: newStatus });
          addToast(`Org admin ${newStatus ? 'disabled' : 'enabled'}`, "success");
        } catch (err) {
          addToast("Error updating status: " + err.message, "error");
        }
      }
    });
  };

  const handleDeleteOrgAdmin = (admin) => {
    confirm({
      title: 'Delete Org Admin',
      message: `Are you sure you want to remove ${admin.email} as an org admin? They will no longer be able to access the organization admin portal.`,
      destructive: true,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          const adminRef = doc(db, PATHS.admins, admin.id);
          await deleteDoc(adminRef);
          addToast("Org admin removed", "success");
        } catch (err) {
          addToast("Error removing org admin: " + err.message, "error");
        }
      }
    });
  };

  const filteredAdmins = orgAdmins.filter(admin =>
    admin.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getOrgName(admin.organizationId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (value) => {
    if (!value) return 'N/A';
    if (value.seconds) return new Date(value.seconds * 1000).toLocaleString();
    if (value instanceof Date) return value.toLocaleString();
    return 'Invalid Date';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#004E7C]" /> Organization Admins
          </h2>
          <p className="text-slate-500 text-sm">Manage users who can administer specific organizations.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by email or org..." 
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#004E7C] outline-none"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-[#004E7C] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003B5C] flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Org Admin
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
            <tr>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Organization</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Created</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
            ) : filteredAdmins.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500 italic">No organization admins found.</td></tr>
            ) : (
              filteredAdmins.map(admin => (
                <tr key={admin.id} className={`hover:bg-slate-50 transition-colors ${admin.disabled ? 'bg-red-50/50' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{admin.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-700">{getOrgName(admin.organizationId)}</span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono">{admin.organizationId}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold uppercase ${admin.disabled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {admin.disabled ? <Ban className="w-3 h-3"/> : <Check className="w-3 h-3"/>}
                      {admin.disabled ? 'Disabled' : 'Active'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {formatDate(admin.createdAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setEditingAdmin(admin)}
                        className="p-2 text-slate-500 hover:text-[#004E7C] hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleToggleStatus(admin)}
                        className={`p-2 rounded-lg transition-colors ${admin.disabled ? 'text-green-600 hover:text-green-700 hover:bg-green-50' : 'text-orange-500 hover:text-orange-600 hover:bg-orange-50'}`}
                        title={admin.disabled ? "Enable" : "Disable"}
                      >
                        {admin.disabled ? <Check className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => handleDeleteOrgAdmin(admin)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Org Admin Modal */}
      {showAddModal && (
        <AddOrgAdminModal 
          organizations={organizations}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddOrgAdmin}
        />
      )}

      {/* Edit Org Admin Modal */}
      {editingAdmin && (
        <EditOrgAdminModal 
          admin={editingAdmin}
          organizations={organizations}
          onClose={() => setEditingAdmin(null)}
          onSave={(data) => handleUpdateOrgAdmin(editingAdmin.id, data)}
        />
      )}
    </div>
  );
}

// --- MODALS ---
function AddOrgAdminModal({ organizations, onClose, onSave }) {
  const [email, setEmail] = useState('');
  const [orgId, setOrgId] = useState('');

  const handleSubmit = () => {
    if (!email || !orgId) return;
    onSave({ email, orgId });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg text-slate-800">Add Organization Admin</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input 
              type="email" 
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#004E7C] outline-none"
              placeholder="admin@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1">
              This user must have an existing Firebase Auth account.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assign to Organization</label>
            <select 
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#004E7C] outline-none"
              value={orgId}
              onChange={e => setOrgId(e.target.value)}
            >
              <option value="">-- Select Organization --</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg">
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!email || !orgId}
            className="px-4 py-2 bg-[#004E7C] text-white rounded-lg font-medium hover:bg-[#003B5C] flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Add Admin
          </button>
        </div>
      </div>
    </div>
  );
}

function EditOrgAdminModal({ admin, organizations, onClose, onSave }) {
  const [orgId, setOrgId] = useState(admin.organizationId);
  const [disabled, setDisabled] = useState(admin.disabled || false);

  const handleSubmit = () => {
    onSave({ orgId, disabled });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg text-slate-800">Edit Organization Admin</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input 
              type="email" 
              className="w-full px-3 py-2 border rounded-lg bg-slate-50 text-slate-500"
              value={admin.email}
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Organization</label>
            <select 
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#004E7C] outline-none"
              value={orgId}
              onChange={e => setOrgId(e.target.value)}
            >
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
            <div>
              <p className="font-medium text-sm text-slate-800">Account Status</p>
              <p className="text-xs text-slate-500">Disable to revoke access temporarily.</p>
            </div>
            <button 
              onClick={() => setDisabled(!disabled)}
              className={`w-12 h-7 rounded-full transition-colors relative ${disabled ? 'bg-red-500' : 'bg-green-500'}`}
            >
              <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full transition-transform ${disabled ? '' : 'translate-x-5'}`} />
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg">
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            className="px-4 py-2 bg-[#004E7C] text-white rounded-lg font-medium hover:bg-[#003B5C] flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// --- LOGIN SCREEN ---
function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError("Login failed. Verify you have admin access.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#004E7C]/10 mb-4">
            <Shield className="w-8 h-8 text-[#004E7C]" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">CivQuest Admin</h2>
          <p className="text-slate-500 mt-1">Sign in to access administration tools</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input 
              type="email" 
              placeholder="admin@example.com" 
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#004E7C] focus:border-transparent outline-none"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••" 
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#004E7C] focus:border-transparent outline-none pr-10"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              <AlertOctagon className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#004E7C] text-white py-3 rounded-lg font-semibold hover:bg-[#003B5C] transition-colors flex justify-center items-center gap-2 mt-6"
          >
            {loading && <Loader2 className="animate-spin w-5 h-5" />} 
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

// --- ACCESS DENIED SCREEN ---
function AccessDenied({ error, onSignOut }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
          <Shield className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
        <p className="text-slate-600 mb-6">{error}</p>
        <p className="text-sm text-slate-500 mb-6">
          Contact support@civicvanguard.com if you believe this is an error.
        </p>
        <button 
          onClick={onSignOut}
          className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
