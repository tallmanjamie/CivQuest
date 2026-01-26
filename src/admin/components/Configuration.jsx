import React, { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  updateDoc, 
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  addDoc
} from "firebase/firestore";
import { 
  Plus, 
  Trash2, 
  Edit2,
  Lock,
  PauseCircle,
  ExternalLink,
  Play,
  Copy,
  Building2,
  X,
  Wand2
} from 'lucide-react';
import { PATHS } from '../../shared/services/paths';

/**
 * Shared Configuration Management Component
 * 
 * This component provides a unified configuration interface for two different admin roles:
 * - 'admin': System admins who can manage all organizations and their notifications
 * - 'org_admin': Organization admins who can only manage notifications for their organization
 * 
 * Props:
 * @param {object} db - Firestore database instance
 * @param {string} role - 'admin' | 'org_admin'
 * @param {string} [orgId] - Required for 'org_admin' role: the org ID
 * @param {object} [orgData] - Required for 'org_admin' role: the org configuration
 * @param {function} addToast - Toast notification function
 * @param {function} confirm - Confirmation dialog function
 * @param {string} [accentColor] - Theme accent color (default: '#004E7C')
 * @param {React.Component} NotificationEditModal - The modal component for editing notifications
 * @param {function} [onOpenWizard] - Callback to open the Notification Wizard (org_admin only)
 */
export default function Configuration({ 
  db,
  role = 'admin',
  orgId = null,
  orgData = null,
  addToast,
  confirm,
  accentColor = '#004E7C',
  NotificationEditModal,
  onOpenWizard
}) {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingNotification, setEditingNotification] = useState(null);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);

  // Fetch all organizations for admin role
  useEffect(() => {
    if (role === 'admin') {
      const q = collection(db, PATHS.organizations);
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const orgs = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        setOrganizations(orgs);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      // For org_admin, we use the passed orgData
      setLoading(false);
    }
  }, [db, role]);

  // Default notification template
  const defaultNotifTemplate = {
    id: "new_notification",
    name: "New Notification",
    type: "monthly",
    access: "public",
    paused: false,
    runDay: 1,
    lag: 0,
    sendEmpty: false,
    emailZeroStateMessage: "",
    method: "email",
    description: "Description of the new alert.",
    emailIntro: "",
    source: {
      type: "arcgis_rest",
      url: "",
      dateField: "",
      definitionQuery: "",
      queryConfig: { mode: 'none', rules: [] },
      displayFields: []
    }
  };

  // Admin: Delete organization
  const deleteOrganization = (id) => {
    if (role !== 'admin') return;
    
    confirm({
      title: "Delete Organization",
      message: "Are you sure? This will delete the configuration and all associated notification rules.",
      destructive: true,
      confirmLabel: "Delete",
      onConfirm: async () => {
        await deleteDoc(doc(db, PATHS.organizations, id));
        addToast("Organization deleted", "success");
      }
    });
  };

  // Update notification
  const handleUpdateNotification = async (targetOrgId, updatedNotifications) => {
    const docRef = doc(db, PATHS.organizations, targetOrgId);
    await updateDoc(docRef, { notifications: updatedNotifications });
    setEditingNotification(null);
    addToast("Notification rules updated", "success");
  };

  // Delete notification
  const handleDeleteNotification = (targetOrgId, notifIndex, notifName) => {
    confirm({
      title: "Delete Notification Rule",
      message: `Are you sure you want to delete "${notifName}"? This action cannot be undone.`,
      destructive: true,
      confirmLabel: "Delete Rule",
      onConfirm: async () => {
        try {
          let notifications;
          if (role === 'admin') {
            const org = organizations.find(o => o.id === targetOrgId);
            if (!org) throw new Error("Organization not found");
            notifications = [...org.notifications];
          } else {
            notifications = [...(orgData.notifications || [])];
          }
          
          notifications.splice(notifIndex, 1);
          const docRef = doc(db, PATHS.organizations, targetOrgId);
          await updateDoc(docRef, { notifications });
          addToast("Notification rule deleted", "success");
        } catch (err) {
          addToast("Error deleting rule: " + err.message, "error");
        }
      }
    });
  };

  // Admin: Create organization
  const handleSaveOrganization = async (id, name) => {
    if (role !== 'admin') return;
    
    await setDoc(doc(db, PATHS.organizations, id), {
      name: name,
      timezone: "America/New_York",
      notifications: []
    });
    setIsCreatingOrg(false);
    addToast("Organization created", "success");
  };

  // Force run broadcast
  const handleForceRunBroadcast = (targetOrgId, notifId, notifName) => {
    confirm({
      title: "Run Broadcast?",
      message: `Confirm Force Run: ${notifName}?\n\nThis will send a notification to ALL subscribers immediately, regardless of schedule.`,
      destructive: false,
      confirmLabel: "Run Broadcast",
      onConfirm: async () => {
        try {
          await addDoc(collection(db, PATHS.forceQueue), {
            type: 'broadcast',
            orgId: targetOrgId,
            notifId: notifId,
            status: 'pending',
            createdAt: serverTimestamp(),
            createdBy: role === 'admin' ? 'admin_ui' : 'org_admin_ui'
          });
          addToast("Broadcast run queued successfully", "success");
        } catch (err) {
          addToast("Error queuing broadcast: " + err.message, "error");
        }
      }
    });
  };

  // Duplicate notification
  const handleDuplicateNotification = (targetOrgId, notif, allNotifications) => {
    const duplicatedNotif = {
      ...notif,
      id: `${notif.id}_copy_${Date.now()}`,
      name: `${notif.name} (Copy)`,
      source: {
        ...notif.source,
        displayFields: notif.source?.displayFields ? [...notif.source.displayFields] : [],
        queryConfig: notif.source?.queryConfig 
          ? { ...notif.source.queryConfig, rules: [...(notif.source.queryConfig.rules || [])] } 
          : { mode: 'none', rules: [] }
      }
    };
    setEditingNotification({ 
      orgId: targetOrgId, 
      notificationIndex: -1, 
      data: duplicatedNotif, 
      allNotifications 
    });
  };

  // Add new notification
  const handleAddNotification = (targetOrgId, allNotifications) => {
    setEditingNotification({ 
      orgId: targetOrgId, 
      notificationIndex: -1, 
      data: {...defaultNotifTemplate, id: `notif_${Date.now()}`}, 
      allNotifications 
    });
  };

  // Edit existing notification
  const handleEditNotification = (targetOrgId, idx, data, allNotifications) => {
    setEditingNotification({ 
      orgId: targetOrgId, 
      notificationIndex: idx, 
      data, 
      allNotifications 
    });
  };

  // Save notification (from modal)
  const handleSaveNotification = (newData) => {
    let updated = [...(editingNotification.allNotifications || [])];
    if (editingNotification.notificationIndex === -1) {
      updated.push(newData);
    } else {
      updated[editingNotification.notificationIndex] = newData;
    }
    handleUpdateNotification(editingNotification.orgId, updated);
  };

  // Render for admin role (multiple organizations)
  if (role === 'admin') {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800">System Configuration</h2>
            <p className="text-slate-500 text-sm">Manage organizations and their notification rules.</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsCreatingOrg(true)} 
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors font-medium"
              style={{ backgroundColor: accentColor }}
            >
              <Plus className="w-4 h-4" /> Add Organization
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading ? <p>Loading config...</p> : organizations.map(org => (
            <OrganizationCard 
              key={org.id} 
              organization={org}
              role={role}
              accentColor={accentColor}
              addToast={addToast}
              onDelete={() => deleteOrganization(org.id)} 
              onForceRun={(notifId, notifName) => handleForceRunBroadcast(org.id, notifId, notifName)}
              onEditNotification={(idx, data) => handleEditNotification(org.id, idx, data, org.notifications)}
              onDeleteNotification={(idx, name) => handleDeleteNotification(org.id, idx, name)}
              onDuplicateNotification={(notif) => handleDuplicateNotification(org.id, notif, org.notifications)}
              onAddNotification={() => handleAddNotification(org.id, org.notifications)}
            />
          ))}
        </div>

        {isCreatingOrg && (
          <OrganizationCreateModal 
            accentColor={accentColor}
            onClose={() => setIsCreatingOrg(false)}
            onSave={handleSaveOrganization}
          />
        )}

        {editingNotification && NotificationEditModal && (
          <NotificationEditModal 
            data={editingNotification.data}
            onClose={() => setEditingNotification(null)}
            onSave={handleSaveNotification}
          />
        )}
      </div>
    );
  }

  // Render for org_admin role (single organization)
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Notification Configuration</h2>
          <p className="text-slate-500 text-sm">Manage notification rules for {orgData?.name}.</p>
        </div>
        <div className="flex gap-2">
          {onOpenWizard && (
            <button 
              onClick={onOpenWizard}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors font-medium"
              style={{ backgroundColor: accentColor }}
            >
              <Wand2 className="w-4 h-4" /> Notification Wizard
            </button>
          )}
          <button 
            onClick={() => handleAddNotification(orgId, orgData?.notifications || [])} 
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors font-medium"
            style={{ backgroundColor: accentColor }}
          >
            <Plus className="w-4 h-4" /> Add Notification
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-5 h-5" style={{ color: accentColor }} />
              {orgData?.name}
            </h3>
            <p className="text-xs text-slate-400 font-mono">{orgId}</p>
          </div>
        </div>
        <div className="p-4">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Notification Types</h4>
          {orgData?.notifications && orgData.notifications.length > 0 ? (
            <div className="space-y-2">
              {orgData.notifications.map((notif, idx) => (
                <NotificationRow
                  key={idx}
                  notif={notif}
                  idx={idx}
                  orgId={orgId}
                  accentColor={accentColor}
                  addToast={addToast}
                  onForceRun={() => handleForceRunBroadcast(orgId, notif.id, notif.name)}
                  onEdit={() => handleEditNotification(orgId, idx, notif, orgData.notifications)}
                  onDelete={() => handleDeleteNotification(orgId, idx, notif.name)}
                  onDuplicate={() => handleDuplicateNotification(orgId, notif, orgData.notifications)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">No notifications configured.</p>
          )}
        </div>
      </div>

      {editingNotification && NotificationEditModal && (
        <NotificationEditModal 
          data={editingNotification.data}
          onClose={() => setEditingNotification(null)}
          onSave={handleSaveNotification}
        />
      )}
    </div>
  );
}

// --- Organization Card (Admin view) ---
function OrganizationCard({ 
  organization, 
  role,
  accentColor,
  addToast,
  onDelete, 
  onEditNotification, 
  onAddNotification, 
  onForceRun, 
  onDeleteNotification, 
  onDuplicateNotification 
}) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const getFrequencyText = (notif) => {
    const lagText = notif.lag > 0 ? ` (Lag: ${notif.lag}d)` : '';
    if (notif.type === 'daily') return `Daily${lagText}`;
    if (notif.type === 'weekly') return `Weekly (${days[parseInt(notif.runDay)] || 'Sun'})${lagText}`;
    if (notif.type === 'hours') return `Every ${notif.runDay} Hours`;
    if (notif.type === 'minutes') return `Every ${notif.runDay} Minutes`;
    return `Monthly (${notif.runDay})${lagText}`;
  };

  const copySignUpUrl = async (notif) => {
    const url = `https://notify.civ.quest/?organization=${organization.id}&notification=${notif.id}`;
    try {
      await navigator.clipboard.writeText(url);
      addToast("Sign-up URL copied to clipboard!", "success");
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      addToast("Sign-up URL copied to clipboard!", "success");
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div>
          <h3 className="font-bold text-slate-800">{organization.name}</h3>
          <p className="text-xs text-slate-400 font-mono">{organization.id}</p>
        </div>
        {role === 'admin' && (
          <button onClick={onDelete} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      
      <div className="p-4 flex-1">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Notification Types</h4>
        {organization.notifications && organization.notifications.length > 0 ? (
          <div className="space-y-2">
            {organization.notifications.map((notif, idx) => (
              <div 
                key={idx} 
                className={`group relative flex flex-col gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-opacity-50 transition-all ${notif.paused ? 'opacity-75 bg-slate-100' : ''}`}
                style={{ '--hover-border-color': accentColor }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <div 
                      className={`p-1.5 rounded h-fit ${notif.paused ? 'bg-slate-200 text-slate-400' : ''}`}
                      style={{ 
                        backgroundColor: notif.paused ? undefined : `${accentColor}20`,
                        color: notif.paused ? undefined : accentColor 
                      }}
                    >
                      <MailIcon className="w-3 h-3" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-slate-800 flex items-center gap-2">
                        {notif.name}
                        {notif.access === 'private' && <Lock className="w-3 h-3 text-slate-400" />}
                        {notif.paused && (
                          <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 rounded font-bold uppercase flex items-center gap-1">
                            <PauseCircle className="w-3 h-3"/> Paused
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 line-clamp-1">{notif.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => copySignUpUrl(notif)}
                      className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-white rounded transition-all"
                      title="Copy Sign-up URL"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onForceRun(notif.id, notif.name)}
                      className="p-1.5 text-slate-400 hover:bg-white rounded transition-all"
                      style={{ ':hover': { color: accentColor } }}
                      title="Force Run (Broadcast)"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onDuplicateNotification(notif)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded transition-all"
                      title="Duplicate Notification"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onEditNotification(idx, notif)}
                      className="p-1.5 text-slate-400 hover:bg-white rounded transition-all"
                      title="Edit Rule"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onDeleteNotification(idx, notif.name)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded transition-all"
                      title="Delete Rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="flex gap-2 pl-9">
                  <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 uppercase">{notif.type}</span>
                  <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-mono">
                    {getFrequencyText(notif)}
                  </span>
                  {notif.access === 'private' && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase font-bold">Private</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">No notifications configured.</p>
        )}
      </div>
      
      <div className="p-3 border-t border-slate-100 bg-slate-50">
        <button 
          onClick={onAddNotification}
          className="w-full py-2 border border-dashed border-slate-300 text-slate-500 rounded hover:bg-white text-sm transition-all flex items-center justify-center gap-2"
          style={{ ':hover': { borderColor: accentColor, color: accentColor } }}
        >
          <Plus className="w-4 h-4" /> Add Notification Rule
        </button>
      </div>
    </div>
  );
}

// --- Notification Row (Org Admin view) ---
function NotificationRow({ 
  notif, 
  idx, 
  orgId, 
  accentColor, 
  addToast,
  onForceRun, 
  onEdit, 
  onDelete, 
  onDuplicate 
}) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const getFrequencyText = (notif) => {
    const lagText = notif.lag > 0 ? ` (Lag: ${notif.lag}d)` : '';
    if (notif.type === 'daily') return `Daily${lagText}`;
    if (notif.type === 'weekly') return `Weekly (${days[parseInt(notif.runDay)] || 'Sun'})${lagText}`;
    if (notif.type === 'hours') return `Every ${notif.runDay} Hours`;
    if (notif.type === 'minutes') return `Every ${notif.runDay} Minutes`;
    return `Monthly (${notif.runDay})${lagText}`;
  };

  const copySignUpUrl = async () => {
    const url = `https://notify.civ.quest/?organization=${orgId}&notification=${notif.id}`;
    try {
      await navigator.clipboard.writeText(url);
      addToast("Sign-up URL copied to clipboard!", "success");
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      addToast("Sign-up URL copied to clipboard!", "success");
    }
  };

  return (
    <div 
      className={`group relative flex flex-col gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-opacity-50 transition-all ${notif.paused ? 'opacity-75 bg-slate-100' : ''}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex gap-3">
          <div 
            className={`p-1.5 rounded h-fit ${notif.paused ? 'bg-slate-200 text-slate-400' : ''}`}
            style={{ 
              backgroundColor: notif.paused ? undefined : `${accentColor}20`,
              color: notif.paused ? undefined : accentColor 
            }}
          >
            <MailIcon className="w-3 h-3" />
          </div>
          <div>
            <p className="font-medium text-sm text-slate-800 flex items-center gap-2">
              {notif.name}
              {notif.access === 'private' && <Lock className="w-3 h-3 text-slate-400" />}
              {notif.paused && (
                <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 rounded font-bold uppercase flex items-center gap-1">
                  <PauseCircle className="w-3 h-3"/> Paused
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500 line-clamp-1">{notif.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={copySignUpUrl}
            className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-white rounded transition-all"
            title="Copy Sign-up URL"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          <button 
            onClick={onForceRun}
            className="p-1.5 text-slate-400 hover:bg-white rounded transition-all"
            title="Force Run (Broadcast)"
          >
            <Play className="w-4 h-4" />
          </button>
          <button 
            onClick={onDuplicate}
            className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-white rounded transition-all"
            title="Duplicate Notification"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button 
            onClick={onEdit}
            className="p-1.5 text-slate-400 hover:bg-white rounded transition-all"
            title="Edit Rule"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button 
            onClick={onDelete}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded transition-all"
            title="Delete Rule"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="flex gap-2 pl-9">
        <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 uppercase">{notif.type}</span>
        <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-mono">
          {getFrequencyText(notif)}
        </span>
        {notif.access === 'private' && (
          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase font-bold">Private</span>
        )}
      </div>
    </div>
  );
}

// --- Organization Create Modal (Admin only) ---
function OrganizationCreateModal({ accentColor, onClose, onSave }) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg text-slate-800">Add New Organization</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Organization ID (System)</label>
            <input 
              value={id} 
              onChange={e => setId(e.target.value.toLowerCase().replace(/\s+/g, '_'))} 
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': accentColor }}
              placeholder="e.g. org_identifier"
            />
            <p className="text-xs text-slate-500 mt-1">Unique identifier, lowercase, no spaces.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
            <input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': accentColor }}
              placeholder="e.g. Acme Corp"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button 
            disabled={!id || !name}
            onClick={() => onSave(id, name)} 
            className="px-4 py-2 text-white rounded-lg disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            Create Organization
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Mail Icon ---
function MailIcon({ className }) {
  return (
    <svg 
      className={className} 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}