// src/admin/components/NotifyConfiguration.jsx
// Notification Configuration Management with Initialization UI
// Manages notification rules with initialize/uninitialize workflow similar to Atlas

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  updateDoc, 
  onSnapshot,
  addDoc,
  deleteField
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
  Wand2,
  Bell,
  BellOff,
  ChevronDown,
  ChevronRight,
  PowerOff,
  AlertTriangle,
  Zap,
  Calendar,
  Clock
} from 'lucide-react';
import { PATHS } from '../../shared/services/paths';

/**
 * Notify Configuration Management Component with Initialization UI
 * 
 * This component provides a unified configuration interface for notification management
 * with an initialize/uninitialize workflow similar to Atlas.
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
export default function NotifyConfiguration({ 
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
  const [expandedOrgs, setExpandedOrgs] = useState({});

  // Fetch all organizations for admin role
  useEffect(() => {
    if (role === 'admin') {
      const q = collection(db, PATHS.organizations);
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const orgs = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        setOrganizations(orgs);
        // All orgs collapsed by default for super admin
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      // For org_admin, we use the passed orgData
      setLoading(false);
    }
  }, [db, role]);

  // Check if org has Notify initialized
  const hasNotifyConfig = (org) => {
    return org?.notifyEnabled === true || (org?.notifications && org.notifications.length > 0);
  };

  // Toggle org expansion
  const toggleOrgExpansion = (orgId) => {
    setExpandedOrgs(prev => ({ ...prev, [orgId]: !prev[orgId] }));
  };

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

  // Initialize Notify for an organization
  const handleInitializeNotify = async (targetOrgId, orgName) => {
    confirm({
      title: "Initialize Notify",
      message: `This will enable notifications for "${orgName}". You can then add notification rules to send email alerts to subscribers. Continue?`,
      confirmLabel: "Initialize",
      onConfirm: async () => {
        try {
          const docRef = doc(db, PATHS.organizations, targetOrgId);
          await updateDoc(docRef, { 
            notifyEnabled: true,
            notifications: []
          });
          addToast("Notify initialized successfully", "success");
        } catch (err) {
          addToast("Error initializing: " + err.message, "error");
        }
      }
    });
  };

  // Uninitialize Notify for an organization
  const handleUninitializeNotify = async (targetOrgId, orgName, notificationCount) => {
    if (notificationCount > 0) {
      addToast("Cannot uninitialize Notify while notification rules exist. Delete all rules first.", "error");
      return;
    }

    confirm({
      title: "Uninitialize Notify",
      message: `This will disable notifications for "${orgName}". This action cannot be undone. Continue?`,
      destructive: true,
      confirmLabel: "Uninitialize",
      onConfirm: async () => {
        try {
          const docRef = doc(db, PATHS.organizations, targetOrgId);
          await updateDoc(docRef, { 
            notifyEnabled: deleteField(),
            notifications: deleteField()
          });
          addToast("Notify has been disabled", "success");
        } catch (err) {
          addToast("Error uninitializing: " + err.message, "error");
        }
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
  const handleDeleteNotification = (targetOrgId, notifIndex, notifName, allNotifications) => {
    confirm({
      title: "Delete Notification Rule",
      message: `Are you sure you want to delete "${notifName}"? This action cannot be undone.`,
      destructive: true,
      confirmLabel: "Delete Rule",
      onConfirm: async () => {
        try {
          const notifications = [...allNotifications];
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

  // Force run broadcast
  const handleForceRunBroadcast = (targetOrgId, notifId, notifName) => {
    confirm({
      title: "Run Broadcast?",
      message: `This will immediately send "${notifName}" to all subscribers. Continue?`,
      confirmLabel: "Run Now",
      onConfirm: async () => {
        try {
          await addDoc(collection(db, 'force_queue'), {
            orgId: targetOrgId,
            notificationId: notifId,
            requestedAt: new Date(),
            status: 'pending'
          });
          addToast("Broadcast queued successfully!", "success");
        } catch (err) {
          addToast("Error: " + err.message, "error");
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

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full" 
             style={{ borderColor: accentColor, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  // --- RENDER FOR ADMIN (ALL ORGANIZATIONS) ---
  if (role === 'admin') {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Notification Configuration</h2>
            <p className="text-slate-500 text-sm">Manage notification rules for all organizations.</p>
          </div>
        </div>

        {/* Organization Cards */}
        {organizations.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No organizations found.</p>
            <p className="text-sm mt-1">Create organizations in System → Organizations.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {organizations.map(org => (
              <OrganizationNotifyCard
                key={org.id}
                org={org}
                expanded={expandedOrgs[org.id]}
                onToggle={() => toggleOrgExpansion(org.id)}
                accentColor={accentColor}
                hasNotifyConfig={hasNotifyConfig(org)}
                onInitialize={() => handleInitializeNotify(org.id, org.name)}
                onUninitialize={() => handleUninitializeNotify(org.id, org.name, org.notifications?.length || 0)}
                onForceRun={(notifId, notifName) => handleForceRunBroadcast(org.id, notifId, notifName)}
                onEditNotification={(idx, data) => handleEditNotification(org.id, idx, data, org.notifications)}
                onDeleteNotification={(idx, name) => handleDeleteNotification(org.id, idx, name, org.notifications)}
                onDuplicateNotification={(notif) => handleDuplicateNotification(org.id, notif, org.notifications)}
                onAddNotification={() => handleAddNotification(org.id, org.notifications || [])}
              />
            ))}
          </div>
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

  // --- RENDER FOR ORG ADMIN (SINGLE ORGANIZATION) ---
  const hasConfig = hasNotifyConfig(orgData);
  const notifications = orgData?.notifications || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Notification Configuration</h2>
          <p className="text-slate-500 text-sm">Manage notification rules for {orgData?.name}.</p>
        </div>
        {hasConfig && (
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
              onClick={() => handleAddNotification(orgId, notifications)} 
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors font-medium"
              style={{ backgroundColor: accentColor }}
            >
              <Plus className="w-4 h-4" /> Add Notification
            </button>
          </div>
        )}
      </div>

      {/* Not Initialized State */}
      {!hasConfig ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
          <Bell className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Notify Not Configured</h3>
          <p className="text-slate-500 mb-6">
            Initialize Notify to enable email notification rules for your organization's subscribers.
          </p>
          <button
            onClick={() => handleInitializeNotify(orgId, orgData?.name)}
            className="px-6 py-2 text-white rounded-lg font-medium"
            style={{ backgroundColor: accentColor }}
          >
            Initialize Notify
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Notifications Card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Building2 className="w-5 h-5" style={{ color: accentColor }} />
                  {orgData?.name}
                </h3>
                <p className="text-xs text-slate-400 font-mono">{orgId}</p>
              </div>
              <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="p-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Notification Types</h4>
              {notifications.length > 0 ? (
                <div className="space-y-2">
                  {notifications.map((notif, idx) => (
                    <NotificationRow
                      key={idx}
                      notif={notif}
                      idx={idx}
                      orgId={orgId}
                      accentColor={accentColor}
                      addToast={addToast}
                      onForceRun={() => handleForceRunBroadcast(orgId, notif.id, notif.name)}
                      onEdit={() => handleEditNotification(orgId, idx, notif, notifications)}
                      onDelete={() => handleDeleteNotification(orgId, idx, notif.name, notifications)}
                      onDuplicate={() => handleDuplicateNotification(orgId, notif, notifications)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm">No notification rules configured.</p>
                  <button
                    onClick={() => handleAddNotification(orgId, notifications)}
                    className="mt-3 text-sm font-medium hover:underline"
                    style={{ color: accentColor }}
                  >
                    Add your first notification
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Uninitialize Option - Only shown when no notifications exist */}
          {notifications.length === 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <PowerOff className="w-5 h-5 text-slate-400" />
                  <div>
                    <h4 className="font-medium text-slate-700">Uninitialize Notify</h4>
                    <p className="text-sm text-slate-500">Disable notifications for this organization.</p>
                  </div>
                </div>
                <button
                  onClick={() => handleUninitializeNotify(orgId, orgData?.name, 0)}
                  className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 text-sm font-medium"
                >
                  Uninitialize
                </button>
              </div>
            </div>
          )}
        </div>
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

// --- Organization Notify Card (Admin view) ---
function OrganizationNotifyCard({ 
  org, 
  expanded, 
  onToggle, 
  accentColor, 
  hasNotifyConfig,
  onInitialize,
  onUninitialize,
  onForceRun, 
  onEditNotification, 
  onAddNotification, 
  onDeleteNotification, 
  onDuplicateNotification 
}) {
  const notifications = org.notifications || [];
  const notificationCount = notifications.length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Card Header */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <button className="text-slate-400">
            {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" style={{ color: accentColor }} />
              <h3 className="font-bold text-slate-800">{org.name || org.id}</h3>
            </div>
            <p className="text-xs text-slate-400 font-mono">{org.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasNotifyConfig ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                <Bell className="w-3 h-3" />
                {notificationCount} notification{notificationCount !== 1 ? 's' : ''}
              </span>
            </div>
          ) : (
            <span className="flex items-center gap-1 text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full">
              <BellOff className="w-3 h-3" />
              Not initialized
            </span>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-slate-100">
          {!hasNotifyConfig ? (
            // Not initialized - show initialize button
            <div className="p-8 text-center bg-slate-50">
              <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 mb-4">Notify is not configured for this organization.</p>
              <button
                onClick={(e) => { e.stopPropagation(); onInitialize(); }}
                className="px-4 py-2 text-white rounded-lg font-medium text-sm"
                style={{ backgroundColor: accentColor }}
              >
                Initialize Notify
              </button>
            </div>
          ) : (
            // Initialized - show notifications
            <div className="p-4">
              {notificationCount > 0 ? (
                <div className="space-y-2">
                  {notifications.map((notif, idx) => (
                    <NotificationRow
                      key={idx}
                      notif={notif}
                      idx={idx}
                      orgId={org.id}
                      accentColor={accentColor}
                      onForceRun={() => onForceRun(notif.id, notif.name)}
                      onEdit={() => onEditNotification(idx, notif)}
                      onDelete={() => onDeleteNotification(idx, notif.name)}
                      onDuplicate={() => onDuplicateNotification(notif)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">No notifications configured.</p>
              )}
              
              {/* Actions */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                <button 
                  onClick={(e) => { e.stopPropagation(); onAddNotification(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-dashed border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  <Plus className="w-4 h-4" /> Add Notification
                </button>
                
                {notificationCount === 0 && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onUninitialize(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <PowerOff className="w-4 h-4" /> Uninitialize
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Notification Row ---
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
    const lagText = notif.lag > 0 ? ` (${notif.lag}d lag)` : '';
    if (notif.type === 'monthly') {
      return `Day ${notif.runDay}${lagText}`;
    } else if (notif.type === 'weekly') {
      return `${days[notif.runDay]}${lagText}`;
    } else if (notif.type === 'daily') {
      return `Daily${lagText}`;
    }
    return notif.type;
  };

  const copySubscribeLink = () => {
    const link = `${window.location.origin}/notify/${orgId}/${notif.id}`;
    navigator.clipboard.writeText(link);
    if (addToast) {
      addToast("Link copied!", "success");
    }
  };

  return (
    <div className="group p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {notif.paused ? (
            <PauseCircle className="w-5 h-5 text-orange-500" />
          ) : (
            <Bell className="w-5 h-5" style={{ color: accentColor }} />
          )}
          <span className="font-medium text-slate-700">{notif.name}</span>
          {notif.access === 'private' && (
            <Lock className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={onForceRun}
            className="p-1.5 text-slate-400 hover:bg-white rounded transition-all"
            title="Run Now"
          >
            <Zap className="w-4 h-4" />
          </button>
          <button 
            onClick={copySubscribeLink}
            className="p-1.5 text-slate-400 hover:bg-white rounded transition-all"
            title="Copy Subscribe Link"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          <button 
            onClick={onDuplicate}
            className="p-1.5 text-slate-400 hover:bg-white rounded transition-all"
            title="Duplicate"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button 
            onClick={onEdit}
            className="p-1.5 text-slate-400 hover:bg-white rounded transition-all"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button 
            onClick={onDelete}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded transition-all"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="flex gap-2 pl-7 mt-1">
        <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 uppercase">{notif.type}</span>
        <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-mono">
          {getFrequencyText(notif)}
        </span>
        {notif.access === 'private' && (
          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase font-bold">Private</span>
        )}
        {notif.paused && (
          <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded uppercase font-bold">Paused</span>
        )}
      </div>
    </div>
  );
}
