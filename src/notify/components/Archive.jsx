import React, { useState, useEffect } from 'react';
import { db } from '@shared/services/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { History, Calendar, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import LoadingSpinner from '@shared/components/LoadingSpinner';

export default function Archive({ user }) {
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrg, setExpandedOrg] = useState(null);

  useEffect(() => {
    const fetchArchives = async () => {
      try {
        const archivesRef = collection(db, 'archives');
        const snapshot = await getDocs(archivesRef);
        
        const archiveData = [];
        for (const orgDoc of snapshot.docs) {
          const orgId = orgDoc.id;
          const notificationsRef = collection(db, `archives/${orgId}/notifications`);
          const notifQuery = query(notificationsRef, orderBy('sentAt', 'desc'), limit(10));
          const notifSnapshot = await getDocs(notifQuery);
          
          if (!notifSnapshot.empty) {
            archiveData.push({
              orgId,
              notifications: notifSnapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
              }))
            });
          }
        }
        
        setArchives(archiveData);
      } catch (err) {
        console.error("Failed to fetch archives:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchArchives();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="Loading archives..." />
      </div>
    );
  }

  if (archives.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-800 mb-2">No Archives Yet</h3>
        <p className="text-slate-500">
          Past notifications will appear here once they have been sent.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <History className="w-5 h-5 text-slate-600" />
            Notification Archive
          </h3>
        </div>

        <div className="divide-y divide-slate-100">
          {archives.map(({ orgId, notifications }) => (
            <div key={orgId}>
              <button
                onClick={() => setExpandedOrg(expandedOrg === orgId ? null : orgId)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <span className="font-medium text-slate-800">{orgId}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">{notifications.length} notifications</span>
                  {expandedOrg === orgId ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </button>

              {expandedOrg === orgId && (
                <div className="bg-slate-50 px-6 py-4 space-y-3">
                  {notifications.map(notif => (
                    <div 
                      key={notif.id}
                      className="bg-white p-4 rounded-lg border border-slate-200"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="font-medium text-slate-800">{notif.name || notif.id}</h4>
                          <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                            <Calendar className="w-4 h-4" />
                            {notif.sentAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                          </p>
                        </div>
                        
                        {/* Fixed the conditional rendering logic here */}
                        {notif.viewUrl && (
                          <a
                            href={notif.viewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#004E7C] hover:underline flex items-center gap-1 text-sm"
                          >
                            View <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                      
                      {notif.recordCount !== undefined && (
                        <p className="text-sm text-slate-600 mt-2">
                          {notif.recordCount} records included
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}