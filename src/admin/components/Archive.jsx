import React, { useState, useEffect, useMemo } from 'react';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  deleteDoc,
  onSnapshot,
  writeBatch
} from "firebase/firestore";
import { 
  History, 
  Filter, 
  Download, 
  Eye, 
  X, 
  Trash2, 
  Loader2 
} from 'lucide-react';
import { PATHS } from '../../shared/services/paths';

/**
 * Shared Archive Component
 * 
 * This component provides a unified archive/logs viewer for three different user roles:
 * - 'user': Regular users who can only view archives for feeds they are subscribed to
 * - 'org_admin': Organization admins who can view and manage archives for their organization
 * - 'admin': System admins who can view and manage all archives across all organizations
 * 
 * Props:
 * @param {object} db - Firestore database instance
 * @param {string} role - 'user' | 'org_admin' | 'admin'
 * @param {object} [userSubscriptions] - Required for 'user' role: { subscriptionKey: boolean }
 * @param {array} [availableSubscriptions] - Required for 'user' role: array of org configs
 * @param {string} [orgId] - Required for 'org_admin' role: the org ID to filter by
 * @param {object} [orgData] - Required for 'org_admin' role: the org configuration
 * @param {function} [addToast] - Optional toast notification function (for admin roles)
 * @param {string} [accentColor] - Theme accent color (default: '#004E7C')
 */
export default function Archive({ 
  db,
  role = 'user',
  userSubscriptions = null,
  availableSubscriptions = [],
  orgId = null,
  orgData = null,
  addToast = null,
  accentColor = '#004E7C'
}) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  
  // Admin-specific states
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  
  // Filter States
  const [filterOrg, setFilterOrg] = useState('all');
  const [filterType, setFilterType] = useState('all');

  // Helper to show toast (fallback to console if not provided)
  const showToast = (message, type = 'info') => {
    if (addToast) {
      addToast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  };

  // Fetch organizations for admin role filter dropdown
  useEffect(() => {
    if (role !== 'admin') return;
    
    const fetchConfig = async () => {
      try {
        const snap = await getDocs(collection(db, PATHS.organizations));
        const orgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOrganizations(orgs);
      } catch (e) {
        console.error("Config fetch error:", e);
      }
    };
    fetchConfig();
  }, [db, role]);

  // Fetch logs with real-time listener
  useEffect(() => {
    const logsRef = collection(db, PATHS.logs);
    const unsubscribe = onSnapshot(logsRef, (snapshot) => {
      let fetchedLogs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ref: doc.ref,
          ...data,
          // Fallback for legacy "localityId" / "localityName"
          organizationId: data.organizationId || data.localityId,
          organizationName: data.organizationName || data.localityName,
          runDate: data.runDate?.toDate() || new Date()
        };
      });
      
      // Pre-filter for org_admin role - only their org
      if (role === 'org_admin' && orgId) {
        fetchedLogs = fetchedLogs.filter(log => log.organizationId === orgId);
      }
      
      // Sort by date desc (newest first)
      fetchedLogs.sort((a, b) => b.runDate - a.runDate);
      setLogs(fetchedLogs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching logs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, role, orgId]);

  // Filter Logic
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Role-based mandatory filtering
      if (role === 'user') {
        // Users can only see logs they're subscribed to
        const subscriptionKey = `${log.organizationId}_${log.notificationId}`;
        if (!userSubscriptions || userSubscriptions[subscriptionKey] !== true) {
          return false;
        }
      }
      // org_admin logs are already pre-filtered in useEffect
      
      // UI Filters (for admin and org_admin)
      if (role === 'admin') {
        if (filterOrg !== 'all' && log.organizationId !== filterOrg) return false;
      }
      if (filterType !== 'all' && log.notificationId !== filterType) return false;
      
      return true;
    });
  }, [logs, role, userSubscriptions, filterOrg, filterType]);

  // Available notification types based on current org filter
  const availableTypes = useMemo(() => {
    if (role === 'admin') {
      if (filterOrg === 'all') return [];
      const org = organizations.find(l => l.id === filterOrg);
      return org ? org.notifications || [] : [];
    }
    if (role === 'org_admin') {
      return orgData?.notifications || [];
    }
    // For users, return notifications from the selected org that user is subscribed to
    if (filterOrg === 'all') return [];
    const org = availableSubscriptions.find(l => l.organizationId === filterOrg);
    if (!org) return [];
    return org.items.filter(item => userSubscriptions && userSubscriptions[item.key] === true);
  }, [role, filterOrg, organizations, orgData, availableSubscriptions, userSubscriptions]);

  // For user role: filter organizations to only those with subscriptions
  const subscribedOrganizations = useMemo(() => {
    if (role !== 'user' || !userSubscriptions) return [];
    return availableSubscriptions.filter(org => {
      return org.items.some(item => userSubscriptions[item.key] === true);
    });
  }, [role, availableSubscriptions, userSubscriptions]);

  // Delete single log (admin/org_admin only)
  const executeDeleteSingle = async (logId) => {
    if (role === 'user') return;
    try {
      await deleteDoc(doc(db, PATHS.logs, logId));
      setDeleteConfirmId(null);
      showToast("Log deleted successfully", "success");
    } catch (err) {
      showToast("Error deleting log: " + err.message, "error");
    }
  };

  // Bulk delete (admin/org_admin only)
  const handleBulkDelete = async () => {
    if (role === 'user') return;
    setDeleting(true);
    try {
      const chunks = [];
      const batchSize = 400;
      
      for (let i = 0; i < filteredLogs.length; i += batchSize) {
        chunks.push(filteredLogs.slice(i, i + batchSize));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(log => {
          batch.delete(log.ref);
        });
        await batch.commit();
      }
      
      setBulkDeleteConfirm(false);
      showToast(`Deleted ${filteredLogs.length} logs`, "success");
    } catch (err) {
      console.error("Bulk delete error:", err);
      showToast("Failed to delete all logs", "error");
    } finally {
      setDeleting(false);
    }
  };

  // Determine if user can delete
  const canDelete = role === 'admin' || role === 'org_admin';

  // Get organization display name
  const getOrgDisplayName = () => {
    if (role === 'org_admin' && orgData) return orgData.name;
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className={`text-xl font-bold text-slate-800 flex items-center gap-2`}>
            <History className="w-6 h-6" style={{ color: accentColor }} /> 
            {role === 'user' ? 'Feed Archive' : 'Notification Archive'}
          </h2>
          <p className="text-slate-500 text-sm">
            {role === 'user' && "Only showing archives for feeds you are currently subscribed to."}
            {role === 'org_admin' && `View history of notifications sent for ${getOrgDisplayName()}.`}
            {role === 'admin' && "View and manage history of all generated notifications."}
          </p>
        </div>
        
        {/* Bulk Delete Button (admin/org_admin only) */}
        {canDelete && filteredLogs.length > 0 && (
          <div className="flex items-center gap-2">
            {bulkDeleteConfirm ? (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
                <span className="text-sm font-bold text-red-600">Delete {filteredLogs.length} logs?</span>
                <button 
                  onClick={() => setBulkDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-3 py-1.5 text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleBulkDelete}
                  disabled={deleting}
                  className="px-4 py-1.5 bg-red-600 text-white rounded font-medium hover:bg-red-700 flex items-center gap-2 text-sm"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}
                  Confirm Delete
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setBulkDeleteConfirm(true)}
                className="px-4 py-2 text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete {filteredLogs.length > 0 && filteredLogs.length !== logs.length ? 'Filtered' : 'All'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        {role === 'user' && (
          <>
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-600" />
              Filter Archive
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Organization</label>
                <select 
                  value={filterOrg} 
                  onChange={(e) => { setFilterOrg(e.target.value); setFilterType("all"); }}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 outline-none"
                  style={{ '--tw-ring-color': accentColor }}
                >
                  <option value="all">All Organizations</option>
                  {subscribedOrganizations.map(org => (
                    <option key={org.organizationId} value={org.organizationId}>{org.organizationName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Feed Type</label>
                <select 
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  disabled={filterOrg === "all"}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  style={{ '--tw-ring-color': accentColor }}
                >
                  <option value="all">All Feeds</option>
                  {availableTypes.map(notif => (
                    <option key={notif.id} value={notif.id}>{notif.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {role === 'admin' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Organization</label>
              <select 
                value={filterOrg} 
                onChange={(e) => { setFilterOrg(e.target.value); setFilterType('all'); }}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 outline-none"
                style={{ '--tw-ring-color': accentColor }}
              >
                <option value="all">All Organizations</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Notification Type</label>
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                disabled={filterOrg === "all"}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                style={{ '--tw-ring-color': accentColor }}
              >
                <option value="all">All Notifications</option>
                {availableTypes.map(n => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {role === 'org_admin' && (
          <div className="max-w-xs">
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Notification Type</label>
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 outline-none"
              style={{ '--tw-ring-color': accentColor }}
            >
              <option value="all">All Notifications</option>
              {availableTypes.map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* List/Table View */}
      {role === 'user' ? (
        // Card-style list for regular users
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h3 className="font-semibold text-slate-700">Feed Log ({filteredLogs.length})</h3>
          </div>
          
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400"/></div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 italic">
              {userSubscriptions && Object.keys(userSubscriptions).length > 0 
                ? "No archives found for your subscribed feeds." 
                : "You haven't subscribed to any feeds yet."}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredLogs.map(log => (
                <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 bg-slate-200 text-slate-700 rounded uppercase tracking-wider">
                        {log.organizationName}
                      </span>
                      <span className="text-sm text-slate-400">
                        {log.runDate.toLocaleDateString()} at {log.runDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <h4 className="font-semibold text-slate-900">{log.notificationName}</h4>
                    <p className="text-sm text-slate-500">Found {log.recordCount} records.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {log.csvUrl && (
                      <a 
                        href={log.csvUrl}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                        style={{ ':hover': { color: accentColor } }}
                        title="Download CSV"
                      >
                        <Download className="w-5 h-5" />
                      </a>
                    )}
                    <button 
                      onClick={() => setSelectedLog(log)}
                      className="px-4 py-2 text-white text-sm font-medium rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: accentColor }}
                    >
                      <Eye className="w-4 h-4" />
                      View Email
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Table view for admins
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">{role === 'admin' ? 'Organization / Notification' : 'Notification'}</th>
                <th className="px-6 py-3">Records Found</th>
                <th className="px-6 py-3">CSV</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="5" className="p-8 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto"/></td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-slate-500 italic">No logs found.</td></tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                      {log.runDate.toLocaleDateString()} <span className="text-slate-400 text-xs">{log.runDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{log.notificationName}</div>
                      {role === 'admin' && <div className="text-xs text-slate-500">{log.organizationName}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {log.recordCount} records
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {log.csvUrl ? (
                        <a 
                          href={log.csvUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="hover:underline flex items-center gap-1 text-xs"
                          style={{ color: accentColor }}
                        >
                          <Download className="w-3 h-3" /> Download
                        </a>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {deleteConfirmId === log.id ? (
                        <div className="flex items-center justify-end gap-2 animate-in fade-in slide-in-from-right-2">
                          <button 
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md font-medium"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={() => executeDeleteSingle(log.id)}
                            className="px-3 py-1.5 text-xs text-white bg-red-600 hover:bg-red-700 rounded-md font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => setSelectedLog(log)}
                            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                            style={{ ':hover': { color: accentColor } }}
                            title="View Email Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canDelete && (
                            <button 
                              onClick={() => setDeleteConfirmId(log.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Log"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Email Preview Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800">{selectedLog.notificationName}</h3>
                <p className="text-sm text-slate-500">
                  {role !== 'org_admin' && `${selectedLog.organizationName} • `}
                  {selectedLog.runDate.toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            
            <div className="flex-1 bg-slate-100 p-4 overflow-hidden relative">
              <div className="absolute inset-4 bg-white shadow-sm rounded-lg overflow-hidden">
                <iframe 
                  srcDoc={selectedLog.emailHtml} 
                  className="w-full h-full border-none"
                  title="Email Preview"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-3">
              <button 
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
              >
                Close
              </button>
              {selectedLog.csvUrl && (
                <a 
                  href={selectedLog.csvUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-white font-medium rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: accentColor }}
                >
                  <Download className="w-4 h-4" />
                  Download CSV
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}