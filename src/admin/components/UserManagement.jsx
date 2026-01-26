import React, { useState, useEffect, useMemo } from 'react';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  addDoc,
  deleteField
} from "firebase/firestore";
import { fetchSignInMethodsForEmail } from "firebase/auth";
import { 
  Users as UsersIcon, 
  Search, 
  Edit2, 
  Check, 
  X, 
  Plus, 
  Trash2, 
  Save, 
  Loader2,
  Building2,
  Clock,
  Ban,
  AlertTriangle,
  Lock,
  PauseCircle,
  Send,
  Mail,
  Zap,
  RefreshCw,
  UserX,
  CheckCircle,
  AlertOctagon,
  Shield,
  Eraser
} from 'lucide-react';
import { PATHS } from '../../shared/services/paths';

/**
 * Shared Users/Subscribers Management Component
 * 
 * This component provides a unified user management interface for two different admin roles:
 * - 'admin': System admins who can manage all users across all organizations
 * - 'org_admin': Organization admins who can only manage subscribers for their organization
 * 
 * Props:
 * @param {object} db - Firestore database instance
 * @param {object} auth - Firebase Auth instance (required for admin audit feature)
 * @param {string} role - 'admin' | 'org_admin'
 * @param {string} [orgId] - Required for 'org_admin' role: the org ID to filter by
 * @param {object} [orgData] - Required for 'org_admin' role: the org configuration
 * @param {function} addToast - Toast notification function
 * @param {function} confirm - Confirmation dialog function
 * @param {string} [accentColor] - Theme accent color (default: '#004E7C')
 */
export default function UserManagement({ 
  db,
  auth,
  role = 'admin',
  orgId = null,
  orgData = null,
  addToast,
  confirm,
  accentColor = '#004E7C'
}) {
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [availableOptions, setAvailableOptions] = useState([]);
  const [optionsMap, setOptionsMap] = useState({});

  // Fetch data based on role
  useEffect(() => {
    fetchData();
  }, [role, orgId]);

  // Fetch notification configs
  useEffect(() => {
    if (role === 'org_admin' && orgData?.notifications) {
      // For org admin, use org-specific notifications
      const options = [];
      const map = {};
      
      orgData.notifications.forEach(notif => {
        const key = `${orgId}_${notif.id}`;
        const obj = { 
          key, 
          label: notif.name, 
          organization: orgData.name, 
          access: notif.access || 'public', 
          paused: notif.paused || false, 
          orgId, 
          notifId: notif.id 
        };
        options.push(obj);
        map[key] = obj;
      });
      
      setAvailableOptions(options);
      setOptionsMap(map);
    } else if (role === 'admin') {
      // For admin, fetch all organizations
      fetchAllConfigs();
    }
  }, [role, orgId, orgData]);

  const fetchAllConfigs = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, PATHS.organizations));
      const options = [];
      const map = {};
      
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.notifications) {
          data.notifications.forEach(notif => {
            const key = `${docSnap.id}_${notif.id}`;
            const obj = { 
              key, 
              label: notif.name, 
              organization: data.name, 
              access: notif.access || 'public', 
              paused: notif.paused || false, 
              orgId: docSnap.id, 
              notifId: notif.id 
            };
            options.push(obj);
            map[key] = obj;
          });
        }
      });
      setAvailableOptions(options);
      setOptionsMap(map);
    } catch (e) {
      console.error("Error fetching configs for options", e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const unsubUsers = onSnapshot(collection(db, PATHS.users), (snapshot) => {
        const allUsers = snapshot.docs.map(docSnap => ({
          uid: docSnap.id,
          isRegistered: true,
          ...docSnap.data()
        }));
        
        if (role === 'org_admin' && orgId) {
          // Filter to only users with subscriptions to this org
          const orgUsers = allUsers.filter(user => {
            if (!user.subscriptions) return false;
            return Object.keys(user.subscriptions).some(key => key.startsWith(`${orgId}_`) && user.subscriptions[key]);
          });
          setUsers(orgUsers);
        } else {
          setUsers(allUsers);
        }
      }, (error) => {
        console.error("Error fetching users:", error);
      });

      const unsubInvites = onSnapshot(collection(db, PATHS.invitations), (snapshot) => {
        const allInvites = snapshot.docs.map(docSnap => ({
          uid: docSnap.id, 
          isRegistered: false,
          isInvite: true,
          ...docSnap.data()
        }));
        
        if (role === 'org_admin' && orgId) {
          // Filter to only invites for this org
          const orgInvites = allInvites.filter(inv => inv.orgId === orgId);
          setInvites(orgInvites);
        } else {
          setInvites(allInvites);
        }
      }, (error) => {
        console.error("Error fetching invites:", error);
      });

      setLoading(false);
      return () => { unsubUsers(); unsubInvites(); };
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  // Combine users and invites into a single list
  const combinedList = useMemo(() => {
    const map = new Map();
    users.forEach(u => {
      if(u.email) map.set(u.email.toLowerCase(), u);
      else map.set(u.uid, u);
    });
    invites.forEach(inv => {
      const email = inv.email.toLowerCase();
      if (!map.has(email)) {
        map.set(email, inv);
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.email || "").localeCompare(b.email || ""));
  }, [users, invites]);

  const handleSaveSubscriptions = async (userId, newSubs) => {
    try {
      const userRef = doc(db, PATHS.users, userId);
      await updateDoc(userRef, { subscriptions: newSubs });
      setEditingUser(null);
      addToast("Subscriptions updated", "success");
    } catch (error) {
      console.error("Failed to save:", error);
      addToast("Failed to save changes", "error");
    }
  };

  const handleSendInvite = async (data) => {
    try {
      const inviteRef = doc(db, PATHS.invitations, data.email.toLowerCase());
      await setDoc(inviteRef, {
        email: data.email,
        subscriptions: data.subscriptions,
        orgId: data.orgId,
        orgName: data.orgName,
        notifName: data.notifName,
        notifCount: data.notifCount || 1,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setShowInviteModal(false);
      addToast(`Invitation queued for ${data.email} (${data.notifCount} feed${data.notifCount !== 1 ? 's' : ''})`, "success");
    } catch (err) {
      console.error(err);
      addToast("Failed to send invite", "error");
    }
  };

  const resendInvite = async (invite) => {
    try {
      const inviteRef = doc(db, PATHS.invitations, invite.uid);
      await updateDoc(inviteRef, { status: 'pending', sentAt: null });
      addToast("Invite queued for resending", "success");
    } catch (err) {
      addToast("Error resending: " + err.message, "error");
    }
  };

  const deleteInvite = (invite) => {
    confirm({
      title: "Delete Invitation",
      message: `Are you sure you want to delete the invitation for ${invite.email}?`,
      destructive: true,
      confirmLabel: "Delete",
      onConfirm: async () => {
        try {
          const inviteRef = doc(db, PATHS.invitations, invite.uid);
          await deleteDoc(inviteRef);
          addToast("Invitation deleted", "success");
        } catch (err) {
          addToast("Error deleting invitation: " + err.message, "error");
        }
      }
    });
  };

  // Only admin can enable/disable users
  const initiateToggleStatus = (user) => {
    if (role !== 'admin') return;
    
    const type = user.disabled ? 'enable' : 'disable';
    
    confirm({
      title: user.disabled ? 'Enable Account' : 'Disable Account',
      message: `Are you sure you want to ${type} ${user.email}? ${type === 'disable' ? 'This will pause all notifications.' : ''}`,
      destructive: type === 'disable',
      confirmLabel: user.disabled ? 'Enable' : 'Disable',
      onConfirm: async () => {
        try {
          const userRef = doc(db, PATHS.users, user.uid);
          if (type === 'disable') {
            await updateDoc(userRef, { disabled: true, subscriptions: {} });
          } else {
            await updateDoc(userRef, { disabled: false });
          }
          addToast(`User ${type}d successfully`, "success");
        } catch (err) {
          console.error(`Error toggling user:`, err);
          addToast(`Failed to update user`, "error");
        }
      }
    });
  };

  const filteredUsers = combinedList.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.uid.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (value) => {
    if (!value) return 'N/A';
    if (value.seconds) return new Date(value.seconds * 1000).toLocaleString();
    if (value instanceof Date) return value.toLocaleString();
    if (typeof value === 'string') {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d.toLocaleString();
    }
    return 'Invalid Date';
  };

  // Get org-specific subscriptions for org_admin view
  const getOrgSubscriptions = (user) => {
    if (role !== 'org_admin' || !user.subscriptions) return user.subscriptions || {};
    const orgSubs = {};
    Object.entries(user.subscriptions).forEach(([key, value]) => { 
      if (key.startsWith(`${orgId}_`)) orgSubs[key] = value; 
    });
    return orgSubs;
  };

  // Calculate valid keys for the audit (admin only)
  const validSubscriptionKeys = useMemo(() => {
    return new Set(availableOptions.map(o => o.key));
  }, [availableOptions]);

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {role === 'admin' ? 'User Registry' : 'Subscribers'}
          </h2>
          <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
            <UsersIcon className="w-3 h-3" /> 
            {role === 'admin' 
              ? 'Unique Users & Invites' 
              : `Users subscribed to ${orgData?.name} notifications`}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search email..." 
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 outline-none"
              style={{ '--tw-ring-color': accentColor }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* Audit Button - Admin only */}
          {role === 'admin' && (
            <button 
              onClick={() => setShowAuditModal(true)}
              className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-2"
              title="Verify all users against Firebase Auth"
            >
              <RefreshCw className="w-4 h-4" /> Sync Registry
            </button>
          )}

          <button 
            onClick={() => setShowInviteModal(true)}
            className="text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: accentColor }}
          >
            <Send className="w-4 h-4" /> Invite User
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
            <tr>
              <th className="px-6 py-3">Email / User ID</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Last Activity</th>
              <th className="px-6 py-3">{role === 'admin' ? 'Active Subscriptions' : 'Subscriptions'}</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">Loading users...</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                {role === 'admin' ? 'No users found.' : 'No subscribers found.'}
              </td></tr>
            ) : (
              filteredUsers.map(user => {
                const displaySubs = getOrgSubscriptions(user);
                return (
                  <tr key={user.uid} className={`hover:bg-slate-50 transition-colors ${user.disabled ? 'bg-red-50/50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{user.email || "No Email"}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{user.uid}</div>
                    </td>
                    <td className="px-6 py-4">
                      {user.isInvite ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-700 uppercase">
                          <Mail className="w-3 h-3" /> Invited
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold uppercase ${user.disabled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {user.disabled ? <Ban className="w-3 h-3"/> : <Check className="w-3 h-3"/>}
                          {user.disabled ? 'Disabled' : 'Active'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {user.isInvite ? formatDate(user.createdAt) : formatDate(user.lastLogin)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.isInvite ? (
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0"></span>
                          <span className="text-xs text-slate-700">
                            <strong>Invite:</strong> {role === 'admin' ? `${user.orgName} - ${user.notifName}` : user.notifName}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {Object.entries(displaySubs).map(([key, isActive]) => {
                            if (!isActive) return null;
                            const info = optionsMap[key];
                            return (
                              <div key={key} className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${info?.paused ? 'bg-orange-500' : 'bg-green-500'}`}></span>
                                <span className="text-xs text-slate-700 flex items-center gap-1">
                                  {info ? (
                                    <>
                                      {role === 'admin' && <strong>{info.organization}:</strong>} {info.label}
                                      {info.access === 'private' && <Lock className="w-3 h-3 text-slate-400" />}
                                      {info.paused && <PauseCircle className="w-3 h-3 text-orange-500" />}
                                    </>
                                  ) : (
                                    <span className="font-mono text-slate-500">{key}</span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                          {(!displaySubs || Object.values(displaySubs).every(v => !v)) && (
                            <span className="text-slate-400 italic text-xs">No active subscriptions</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {user.isInvite ? (
                          <>
                            <button 
                              onClick={() => resendInvite(user)}
                              className="font-medium text-xs flex items-center gap-1 hover:opacity-80"
                              style={{ color: accentColor }}
                              title="Resend Invitation Email"
                            >
                              <Send className="w-3 h-3" /> Resend
                            </button>
                            <button 
                              onClick={() => deleteInvite(user)}
                              className="text-red-500 hover:text-red-700 font-medium text-xs flex items-center gap-1"
                              title="Delete Invitation"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => setEditingUser(user)}
                              className="font-medium text-sm flex items-center gap-1 hover:opacity-80"
                              style={{ color: accentColor }}
                              title="Edit Subscriptions"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            
                            {/* Enable/Disable - Admin only */}
                            {role === 'admin' && (
                              <button 
                                onClick={() => initiateToggleStatus(user)}
                                className={`font-medium text-sm flex items-center gap-1 ${user.disabled ? 'text-green-600 hover:text-green-700' : 'text-red-400 hover:text-red-600'}`}
                                title={user.disabled ? "Enable User" : "Disable User"}
                              >
                                {user.disabled ? <Check className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <UserEditModal 
          user={editingUser} 
          availableOptions={availableOptions}
          role={role}
          orgId={orgId}
          db={db}
          addToast={addToast}
          confirm={confirm}
          accentColor={accentColor}
          onClose={() => setEditingUser(null)} 
          onSave={handleSaveSubscriptions} 
        />
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteUserModal 
          availableOptions={availableOptions}
          role={role}
          accentColor={accentColor}
          onClose={() => setShowInviteModal(false)}
          onSend={handleSendInvite}
        />
      )}

      {/* Audit Modal - Admin only */}
      {showAuditModal && role === 'admin' && (
        <UserAuditModal 
          db={db}
          auth={auth}
          users={users.filter(u => u.isRegistered)} 
          validKeys={validSubscriptionKeys}
          addToast={addToast}
          confirm={confirm}
          onClose={() => setShowAuditModal(false)} 
        />
      )}
    </div>
  );
}

// --- User Edit Modal ---
function UserEditModal({ user, availableOptions, role, orgId, db, addToast, confirm, accentColor, onClose, onSave }) {
  const [subs, setSubs] = useState(user.subscriptions || {});
  const [newKey, setNewKey] = useState('');
  const [sendingKey, setSendingKey] = useState(null);

  const toggleSub = (key) => {
    setSubs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const addManualSub = () => {
    if (!newKey) return;
    setSubs(prev => ({ ...prev, [newKey]: true }));
    setNewKey('');
  };

  const handleForceSend = (key) => {
    confirm({
      title: "Force Send Notification",
      message: `Force push this notification to ${user.email}?\n\nThis will bypass the schedule and send immediate data.`,
      confirmLabel: "Send Now",
      onConfirm: async () => {
        setSendingKey(key);
        try {
          const option = availableOptions.find(o => o.key === key);
          if (!option) throw new Error("Config not found");

          await addDoc(collection(db, PATHS.forceQueue), {
            type: 'single_user',
            targetEmail: user.email,
            orgId: option.orgId,
            notifId: option.notifId,
            status: 'pending',
            createdAt: serverTimestamp(),
            createdBy: role === 'admin' ? 'admin_ui' : 'org_admin_ui'
          });
          addToast(`Request queued for ${user.email}`, "success");
        } catch (err) {
          addToast("Error queuing request: " + err.message, "error");
        } finally {
          setSendingKey(null);
        }
      }
    });
  };

  // Group options by organization (for admin view)
  const groupedOptions = availableOptions.reduce((acc, opt) => {
    if (!acc[opt.organization]) acc[opt.organization] = [];
    acc[opt.organization].push(opt);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800">Manage Subscriptions</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-3">User</label>
            <p className="font-medium text-lg">{user.email}</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-3">Available Notifications</label>
            
            {Object.keys(groupedOptions).length === 0 ? (
              <p className="text-sm text-slate-400 italic mb-4">No configured notifications found.</p>
            ) : role === 'admin' ? (
              // Admin view: grouped by organization
              <div className="space-y-4">
                {Object.entries(groupedOptions).map(([orgName, options]) => (
                  <div key={orgName} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex items-center gap-2">
                      <Building2 className="w-3 h-3 text-slate-500" />
                      <span className="text-xs font-bold text-slate-700">{orgName}</span>
                    </div>
                    <div className="p-2">
                      {options.map(opt => (
                        <div key={opt.key} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded">
                          <span className="text-sm text-slate-700 flex items-center gap-2">
                            {opt.label}
                            {opt.access === 'private' && <Lock className="w-3 h-3 text-slate-400" />}
                            {opt.paused && <PauseCircle className="w-3 h-3 text-orange-500" />}
                          </span>
                          <div className="flex items-center gap-2">
                            {subs[opt.key] && (
                              <button 
                                onClick={() => handleForceSend(opt.key)}
                                disabled={sendingKey === opt.key}
                                className="p-1.5 text-slate-400 hover:bg-white rounded transition-colors"
                                style={{ ':hover': { color: accentColor } }}
                                title="Force send notification to this user now"
                              >
                                {sendingKey === opt.key ? <Loader2 className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4 fill-slate-200" />}
                              </button>
                            )}
                            <button 
                              onClick={() => toggleSub(opt.key)}
                              className={`w-10 h-6 rounded-full transition-colors relative ${subs[opt.key] ? '' : 'bg-slate-300'}`}
                              style={{ backgroundColor: subs[opt.key] ? accentColor : undefined }}
                            >
                              <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${subs[opt.key] ? 'translate-x-4' : ''}`} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Org admin view: flat list
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="p-2">
                  {availableOptions.map(opt => (
                    <div key={opt.key} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded">
                      <span className="text-sm text-slate-700 flex items-center gap-2">
                        {opt.label}
                        {opt.access === 'private' && <Lock className="w-3 h-3 text-slate-400" />}
                        {opt.paused && <PauseCircle className="w-3 h-3 text-orange-500" />}
                      </span>
                      <div className="flex items-center gap-2">
                        {subs[opt.key] && (
                          <button 
                            onClick={() => handleForceSend(opt.key)}
                            disabled={sendingKey === opt.key}
                            className="p-1.5 text-slate-400 hover:bg-white rounded transition-colors"
                            title="Force send notification to this user now"
                          >
                            {sendingKey === opt.key ? <Loader2 className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4 fill-slate-200" />}
                          </button>
                        )}
                        <button 
                          onClick={() => toggleSub(opt.key)}
                          className={`w-10 h-6 rounded-full transition-colors relative ${subs[opt.key] ? '' : 'bg-slate-300'}`}
                          style={{ backgroundColor: subs[opt.key] ? accentColor : undefined }}
                        >
                          <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${subs[opt.key] ? 'translate-x-4' : ''}`} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Manual subscription key input - Admin only */}
          {role === 'admin' && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mt-4">
              <label className="text-xs font-semibold text-slate-500 block mb-2">Manually Add Subscription Key (Advanced)</label>
              <div className="flex gap-2">
                <input 
                  value={newKey} 
                  onChange={e => setNewKey(e.target.value)} 
                  className="flex-1 px-3 py-1.5 text-sm border rounded" 
                  placeholder="org_id_notif_id" 
                />
                <button onClick={addManualSub} className="px-3 py-1.5 bg-white border border-slate-300 rounded">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 mt-auto">
          <button onClick={onClose} className="px-4 py-2 text-slate-600">Cancel</button>
          <button 
            onClick={() => onSave(user.uid, subs)} 
            className="px-4 py-2 text-white rounded-lg flex items-center gap-2"
            style={{ backgroundColor: accentColor }}
          >
            <Save className="w-4 h-4" /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Invite User Modal ---
function InviteUserModal({ availableOptions, role, accentColor, onClose, onSend }) {
  const [email, setEmail] = useState('');
  const [selectedKeys, setSelectedKeys] = useState([]);

  // Group options by organization (for admin view)
  const groupedOptions = availableOptions.reduce((acc, opt) => {
    if (!acc[opt.organization]) acc[opt.organization] = { orgId: opt.orgId, items: [] };
    acc[opt.organization].items.push(opt);
    return acc;
  }, {});

  const toggleKey = (key) => {
    setSelectedKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const selectAllInOrg = (orgName) => {
    const orgKeys = groupedOptions[orgName].items.map(opt => opt.key);
    const allSelected = orgKeys.every(k => selectedKeys.includes(k));
    if (allSelected) {
      setSelectedKeys(prev => prev.filter(k => !orgKeys.includes(k)));
    } else {
      setSelectedKeys(prev => [...new Set([...prev, ...orgKeys])]);
    }
  };

  const selectAll = () => {
    const allKeys = availableOptions.map(opt => opt.key);
    const allSelected = allKeys.every(k => selectedKeys.includes(k));
    if (allSelected) {
      setSelectedKeys([]);
    } else {
      setSelectedKeys(allKeys);
    }
  };

  const handleSubmit = () => {
    if (!email || selectedKeys.length === 0) return;
    
    const subscriptions = {};
    const selectedOptions = selectedKeys.map(key => availableOptions.find(o => o.key === key)).filter(Boolean);
    
    selectedOptions.forEach(opt => {
      subscriptions[opt.key] = true;
    });

    const firstOpt = selectedOptions[0];
    const orgNames = [...new Set(selectedOptions.map(o => o.organization))];
    const notifNames = selectedOptions.map(o => o.label);
    
    onSend({
      email,
      subscriptions,
      orgId: firstOpt.orgId,
      orgName: orgNames.join(', '),
      notifName: notifNames.length > 2 ? `${notifNames.length} feeds` : notifNames.join(', '),
      notifCount: selectedKeys.length
    });
  };

  const allSelected = availableOptions.length > 0 && availableOptions.every(opt => selectedKeys.includes(opt.key));
  const someSelected = availableOptions.some(opt => selectedKeys.includes(opt.key));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">Invite New User</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
        </div>
        
        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input 
              type="email" 
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none"
              style={{ '--tw-ring-color': accentColor }}
              placeholder="user@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Select Notification Feeds</label>
            <p className="text-xs text-slate-500 mb-3">
              Choose one or more feeds. The user will be automatically subscribed when they sign up.
            </p>
            
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              {role === 'admin' ? (
                // Admin view: grouped by organization
                Object.entries(groupedOptions).map(([orgName, orgData]) => {
                  const orgKeys = orgData.items.map(opt => opt.key);
                  const orgAllSelected = orgKeys.every(k => selectedKeys.includes(k));
                  const orgSomeSelected = orgKeys.some(k => selectedKeys.includes(k));
                  
                  return (
                    <div key={orgName} className="border-b border-slate-100 last:border-b-0">
                      <div 
                        className="bg-slate-50 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-100"
                        onClick={() => selectAllInOrg(orgName)}
                      >
                        <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          {orgName}
                        </span>
                        <div 
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center`}
                          style={{ 
                            backgroundColor: orgAllSelected ? accentColor : orgSomeSelected ? `${accentColor}33` : undefined,
                            borderColor: orgAllSelected || orgSomeSelected ? accentColor : '#d1d5db'
                          }}
                        >
                          {orgAllSelected && <Check className="w-3 h-3 text-white" />}
                          {orgSomeSelected && !orgAllSelected && <div className="w-2 h-0.5" style={{ backgroundColor: accentColor }} />}
                        </div>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {orgData.items.map(opt => (
                          <div 
                            key={opt.key}
                            className="px-3 py-2 pl-9 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                            onClick={() => toggleKey(opt.key)}
                          >
                            <span className="text-sm text-slate-600 flex items-center gap-2">
                              {opt.label}
                              {opt.access === 'private' && <Lock className="w-3 h-3 text-amber-500" />}
                            </span>
                            <div 
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center`}
                              style={{ 
                                backgroundColor: selectedKeys.includes(opt.key) ? accentColor : undefined,
                                borderColor: selectedKeys.includes(opt.key) ? accentColor : '#d1d5db'
                              }}
                            >
                              {selectedKeys.includes(opt.key) && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                // Org admin view: flat list with select all
                <>
                  <div 
                    className="bg-slate-50 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-100 border-b border-slate-100"
                    onClick={selectAll}
                  >
                    <span className="text-sm font-medium text-slate-700">Select All</span>
                    <div 
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center`}
                      style={{ 
                        backgroundColor: allSelected ? accentColor : someSelected ? `${accentColor}33` : undefined,
                        borderColor: allSelected || someSelected ? accentColor : '#d1d5db'
                      }}
                    >
                      {allSelected && <Check className="w-3 h-3 text-white" />}
                      {someSelected && !allSelected && <div className="w-2 h-0.5" style={{ backgroundColor: accentColor }} />}
                    </div>
                  </div>
                  
                  <div className="divide-y divide-slate-50">
                    {availableOptions.map(opt => (
                      <div 
                        key={opt.key}
                        className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                        onClick={() => toggleKey(opt.key)}
                      >
                        <span className="text-sm text-slate-600 flex items-center gap-2">
                          {opt.label}
                          {opt.access === 'private' && <Lock className="w-3 h-3 text-amber-500" />}
                        </span>
                        <div 
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center`}
                          style={{ 
                            backgroundColor: selectedKeys.includes(opt.key) ? accentColor : undefined,
                            borderColor: selectedKeys.includes(opt.key) ? accentColor : '#d1d5db'
                          }}
                        >
                          {selectedKeys.includes(opt.key) && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            
            {selectedKeys.length > 0 && (
              <p className="text-xs mt-2 font-medium" style={{ color: accentColor }}>
                {selectedKeys.length} feed{selectedKeys.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!email || selectedKeys.length === 0}
            className="px-4 py-2 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            <Send className="w-4 h-4" /> Send Invite
          </button>
        </div>
      </div>
    </div>
  );
}

// --- User Audit Modal (Admin only) ---
function UserAuditModal({ db, auth, users, validKeys, addToast, confirm, onClose }) {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [orphans, setOrphans] = useState([]); 
  const [staleSubs, setStaleSubs] = useState([]);
  const [completed, setCompleted] = useState(false);
  const [auditError, setAuditError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [cleaningStale, setCleaningStale] = useState(false);

  const startScan = async () => {
    setScanning(true);
    setOrphans([]);
    setStaleSubs([]);
    setCompleted(false);
    setAuditError(null);
    
    let foundOrphans = [];
    let foundStale = [];
    let count = 0;
    const total = users.length;
    setProgress({ current: 0, total });

    try {
      if (auth.currentUser && auth.currentUser.email) {
        const selfCheck = await fetchSignInMethodsForEmail(auth, auth.currentUser.email);
        if (selfCheck.length === 0) {
          throw new Error("Self-check failed. 'Email Enumeration Protection' is likely enabled in Firebase Console.");
        }
      }
    } catch (err) {
      setAuditError(err.message);
      setScanning(false);
      addToast("Audit initialization failed", "error");
      return;
    }

    for (const user of users) {
      count++;
      setProgress({ current: count, total });
      
      if (user.email) {
        try {
          const methods = await fetchSignInMethodsForEmail(auth, user.email);
          if (methods.length === 0) {
            foundOrphans.push(user);
          }
        } catch (err) {
          console.warn(`Check failed for ${user.email}`, err);
        }
      }

      if (user.subscriptions && validKeys) {
        const userSubs = Object.keys(user.subscriptions);
        const invalid = userSubs.filter(k => !validKeys.has(k));
        
        if (invalid.length > 0) {
          foundStale.push({
            uid: user.uid,
            email: user.email,
            keys: invalid
          });
        }
      }

      await new Promise(r => setTimeout(r, 50)); 
    }

    setOrphans(foundOrphans);
    setStaleSubs(foundStale);
    setScanning(false);
    setCompleted(true);
  };

  const deleteOrphans = () => {
    confirm({
      title: "Delete Orphaned Records",
      message: `Permanently delete ${orphans.length} orphaned records from the registry?`,
      destructive: true,
      confirmLabel: "Delete All",
      onConfirm: async () => {
        setDeleting(true);
        try {
          const batch = writeBatch(db);
          orphans.forEach(u => {
            const ref = doc(db, PATHS.users, u.uid);
            batch.delete(ref);
          });
          await batch.commit();
          addToast("Registry cleaned successfully", "success");
          setOrphans([]); 
        } catch (err) {
          addToast("Error deleting records: " + err.message, "error");
        } finally {
          setDeleting(false);
        }
      }
    });
  };

  const cleanStaleSubscriptions = () => {
    confirm({
      title: "Clean Invalid Subscriptions",
      message: `Remove ${staleSubs.reduce((acc, curr) => acc + curr.keys.length, 0)} invalid subscription entries across ${staleSubs.length} users?`,
      destructive: true,
      confirmLabel: "Clean All",
      onConfirm: async () => {
        setCleaningStale(true);
        try {
          const batch = writeBatch(db);
          staleSubs.forEach(u => {
            const userRef = doc(db, PATHS.users, u.uid);
            const updates = {};
            u.keys.forEach(k => {
              updates[`subscriptions.${k}`] = deleteField();
            });
            batch.update(userRef, updates);
          });
          await batch.commit();
          addToast("Stale subscriptions removed", "success");
          setStaleSubs([]);
        } catch (err) {
          addToast("Error cleaning subscriptions: " + err.message, "error");
        } finally {
          setCleaningStale(false);
        }
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <RefreshCw className={`w-5 h-5 ${scanning ? 'animate-spin text-[#004E7C]' : ''}`} />
            Audit User Registry
          </h3>
          {!scanning && <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>}
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto">
          {!scanning && !completed && !auditError && (
            <div className="text-center py-4">
              <Shield className="w-12 h-12 text-[#004E7C] mx-auto mb-4" />
              <p className="text-slate-600 mb-6">
                This tool will scan <strong>{users.length}</strong> user records in your registry.
                It checks for:
              </p>
              <ul className="text-sm text-slate-600 text-left list-disc pl-10 mb-6 space-y-1">
                <li>Users that no longer exist in Firebase Authentication</li>
                <li>Subscriptions to notifications that have been deleted</li>
              </ul>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-left text-xs text-amber-800 mb-6">
                <strong className="flex items-center gap-1 mb-1"><AlertTriangle className="w-3 h-3"/> Warning</strong>
                Only run this if you have manually deleted users or notifications and want to clean up the leftovers.
              </div>
              <button 
                onClick={startScan}
                className="w-full py-3 bg-[#004E7C] text-white rounded-lg font-bold hover:bg-[#003B5C] transition-colors"
              >
                Start Scan
              </button>
            </div>
          )}

          {scanning && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 text-[#004E7C] animate-spin mx-auto mb-4" />
              <h4 className="font-bold text-slate-800 mb-2">Scanning Registry...</h4>
              <p className="text-slate-500 text-sm mb-4">Checking {progress.current} of {progress.total}</p>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-[#004E7C] h-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {auditError && (
            <div className="text-center py-6">
              <div className="bg-red-100 p-3 rounded-full w-fit mx-auto mb-4">
                <AlertOctagon className="w-8 h-8 text-red-600" />
              </div>
              <h4 className="font-bold text-red-700 mb-2">Audit Failed</h4>
              <p className="text-sm text-slate-600 mb-6">{auditError}</p>
              <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">Close</button>
            </div>
          )}

          {completed && !auditError && (
            <div className="space-y-6">
              <div className="flex items-center justify-center gap-2 text-green-600 font-bold text-lg">
                <CheckCircle className="w-6 h-6" /> Scan Complete
              </div>
              
              {orphans.length === 0 && staleSubs.length === 0 ? (
                <div className="text-center text-slate-500 py-4 bg-slate-50 rounded-lg border border-slate-100">
                  No issues found. Your registry is in sync.
                </div>
              ) : null}

              {orphans.length > 0 && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-red-50 p-3 rounded-lg border border-red-100">
                    <div>
                      <p className="font-bold text-red-700 text-sm">Orphaned Accounts ({orphans.length})</p>
                      <p className="text-xs text-red-600">Users in registry but NOT in Auth</p>
                    </div>
                    <button 
                      onClick={deleteOrphans}
                      disabled={deleting}
                      className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 flex items-center gap-2"
                    >
                      {deleting ? <Loader2 className="w-3 h-3 animate-spin"/> : <UserX className="w-3 h-3" />}
                      Delete All
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-xs text-left">
                      <tbody className="divide-y divide-slate-100">
                        {orphans.map(u => (
                          <tr key={u.uid} className="hover:bg-red-50">
                            <td className="p-2 text-slate-700">{u.email}</td>
                            <td className="p-2 text-slate-400 font-mono text-[10px]">{u.uid}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {staleSubs.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex justify-between items-center bg-amber-50 p-3 rounded-lg border border-amber-100">
                    <div>
                      <p className="font-bold text-amber-700 text-sm">Invalid Subscriptions ({staleSubs.length} Users)</p>
                      <p className="text-xs text-amber-600">Subscriptions to deleted notifications</p>
                    </div>
                    <button 
                      onClick={cleanStaleSubscriptions}
                      disabled={cleaningStale}
                      className="px-3 py-1.5 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700 flex items-center gap-2"
                    >
                      {cleaningStale ? <Loader2 className="w-3 h-3 animate-spin"/> : <Eraser className="w-3 h-3" />}
                      Clean All
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-xs text-left">
                      <tbody className="divide-y divide-slate-100">
                        {staleSubs.map(u => (
                          <tr key={u.uid} className="hover:bg-amber-50">
                            <td className="p-2 text-slate-700 w-1/2 truncate">{u.email}</td>
                            <td className="p-2 text-slate-500 text-[10px]">
                              {u.keys.map(k => (
                                <span key={k} className="inline-block bg-white border border-slate-200 rounded px-1 mr-1 mb-1">
                                  {k}
                                </span>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 mt-auto">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}