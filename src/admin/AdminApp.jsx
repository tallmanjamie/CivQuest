// src/admin/AdminApp.jsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '@shared/services/firebase';
import { PATHS } from '@shared/services/paths';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Header from '@shared/components/Header';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import { Shield, Mail, Lock, Loader2 } from 'lucide-react';

export default function AdminApp() {
  const [user, setUser] = useState(null);
  const [adminInfo, setAdminInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Check admin status from NEW path
        const adminDoc = await getDoc(doc(db, PATHS.admin(currentUser.uid)));
        if (adminDoc.exists()) {
          setAdminInfo(adminDoc.data());
        } else {
          setAdminInfo(null);
        }
      } else {
        setAdminInfo(null);
      }
      
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setError('');
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#E6F0F6] text-[#004E7C] mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Admin Portal</h2>
            <p className="text-slate-500 mt-2">Sign in to access administration tools.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#004E7C] focus:border-transparent"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#004E7C] focus:border-transparent"
                  required
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 bg-[#004E7C] text-white font-semibold rounded-lg hover:bg-[#003B5C] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Logged in but not admin
  if (!adminInfo) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header title="CivQuest Admin" user={user} onSignOut={() => signOut(auth)} />
        <main className="max-w-4xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-800 mb-2">Access Denied</h2>
            <p className="text-red-600">
              You don't have admin privileges. Contact support@civicvanguard.com if you believe this is an error.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-slate-50">
      <Header 
        title="CivQuest Admin" 
        subtitle={adminInfo.role === 'super_admin' ? 'Super Admin' : 'Organization Admin'}
        user={user} 
        onSignOut={() => signOut(auth)} 
      />
      
      <main className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">
            Admin Dashboard
          </h2>
          <p className="text-slate-600 mb-4">
            Coming in Phase 4: Full administration tools.
          </p>
          <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
            <p><strong>Role:</strong> {adminInfo.role}</p>
            {adminInfo.organizationId && (
              <p><strong>Organization:</strong> {adminInfo.organizationId}</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}