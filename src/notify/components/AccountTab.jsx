// src/notify/components/AccountTab.jsx
import React, { useState } from 'react';
import { auth, db } from '@shared/services/firebase';
import { PATHS } from '@shared/services/paths';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  initiateArcGISLogin, 
  getOAuthRedirectUri 
} from '@shared/services/arcgis-auth';
import { Settings, Ban, Globe, Loader2 } from 'lucide-react';

export default function AccountTab({ user, userData }) {
  const [disabling, setDisabling] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);

  const handleDisableAccount = async () => {
    setDisabling(true);
    try {
      await updateDoc(doc(db, PATHS.user(user.uid)), {
        disabled: true,
        subscriptions: {} 
      });
      await signOut(auth);
    } catch (error) {
      console.error("Disable account error", error);
      alert("Failed to disable account. Please try again.");
      setDisabling(false);
    }
  };

  const hasLinkedArcGIS = userData?.linkedArcGISUsername;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-600" />
          Account Settings
        </h3>
        
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-1">Email Address</p>
            <p className="text-slate-900 font-semibold">{user.email}</p>
          </div>

          {/* Linked ArcGIS Account Section */}
          {hasLinkedArcGIS && (
            <div className="p-4 bg-[#E6F0F6] rounded-lg border border-[#004E7C]/20">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-[#004E7C]/10 rounded-lg">
                  <Globe className="w-5 h-5 text-[#004E7C]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-[#004E7C] font-medium uppercase tracking-wider mb-1">Linked ArcGIS Account</p>
                  <p className="text-slate-900 font-semibold">{userData.linkedArcGISUsername}</p>
                  {userData.arcgisProfile?.fullName && (
                    <p className="text-sm text-slate-600">{userData.arcgisProfile.fullName}</p>
                  )}
                  {userData.arcgisOrganization?.name && (
                    <p className="text-xs text-slate-500 mt-1">
                      Organization: {userData.arcgisOrganization.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Link ArcGIS Account Button (if not linked) */}
          {!hasLinkedArcGIS && (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-slate-900">Link ArcGIS Account</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Connect your ArcGIS account for seamless authentication.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const redirectUri = getOAuthRedirectUri();
                    initiateArcGISLogin(redirectUri, 'signin');
                  }}
                  className="px-4 py-2 bg-[#0079C1] text-white rounded-lg font-medium hover:bg-[#006699] transition-colors flex items-center gap-2"
                >
                  <Globe className="w-4 h-4" />
                  Link Account
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-medium text-slate-900">Pause Feeds</h4>
                <p className="text-sm text-slate-600 mt-1">Temporarily disable your account to stop receiving all updates.</p>
              </div>
              
              {!showDisableConfirm ? (
                <button 
                  onClick={() => setShowDisableConfirm(true)}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-2 shadow-sm shrink-0"
                >
                  <Ban className="w-4 h-4" />
                  Disable Account
                </button>
              ) : (
                <div className="flex items-center gap-3 shrink-0 animate-in fade-in slide-in-from-right-4 duration-200">
                  <span className="text-sm font-medium text-slate-700 hidden sm:inline">Are you sure?</span>
                  <button 
                    onClick={() => setShowDisableConfirm(false)}
                    className="px-3 py-1.5 text-slate-600 hover:text-slate-800 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDisableAccount}
                    disabled={disabling}
                    className="px-4 py-2 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-900 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    {disabling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                    Yes, Pause
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
