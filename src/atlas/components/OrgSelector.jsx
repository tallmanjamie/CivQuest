// src/atlas/components/OrgSelector.jsx
// Organization selector component for Atlas
// Allows users to select which organization's Atlas to view

import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../shared/services/firebase';
import { PATHS } from '../../shared/services/paths';
import { 
  Building2, 
  Search, 
  Loader2, 
  MapPin, 
  X,
  ChevronRight
} from 'lucide-react';

/**
 * OrgSelector Component
 * Shows a list of available organizations with Atlas configurations
 */
export default function OrgSelector({ onSelect, onCancel = null, currentOrg = null }) {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load organizations with atlasConfig
  useEffect(() => {
    async function loadOrganizations() {
      try {
        const snapshot = await getDocs(collection(db, PATHS.organizations));
        const orgs = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(org => org.atlasConfig) // Only orgs with Atlas config
          .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
        
        setOrganizations(orgs);
        setLoading(false);
      } catch (err) {
        console.error('[OrgSelector] Failed to load organizations:', err);
        setError('Failed to load organizations');
        setLoading(false);
      }
    }

    loadOrganizations();
  }, []);

  // Filter organizations by search query
  const filteredOrgs = organizations.filter(org => {
    const query = searchQuery.toLowerCase();
    const name = (org.name || org.id || '').toLowerCase();
    const title = (org.atlasConfig?.ui?.title || '').toLowerCase();
    return name.includes(query) || title.includes(query);
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-sky-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading organizations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Error</h1>
          <p className="text-slate-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-slate-100">
      {/* Header */}
      <div className="bg-sky-700 text-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">CivQuest Atlas</h1>
              <p className="text-sky-100">Select an organization to explore their property data</p>
            </div>
            {onCancel && (
              <button
                onClick={onCancel}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-4xl mx-auto px-4 -mt-6">
        <div className="bg-white rounded-xl shadow-lg p-2">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search organizations..."
              className="w-full pl-12 pr-4 py-3 rounded-lg border-0 focus:ring-2 focus:ring-sky-500 text-slate-700"
              autoFocus
            />
          </div>
        </div>
      </div>

      {/* Organization List */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {filteredOrgs.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">
              {searchQuery 
                ? 'No organizations found matching your search' 
                : 'No organizations available'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredOrgs.map((org) => {
              const atlasConfig = org.atlasConfig || {};
              const ui = atlasConfig.ui || {};
              const isCurrentOrg = org.id === currentOrg;

              return (
                <button
                  key={org.id}
                  onClick={() => onSelect(org.id)}
                  className={`text-left bg-white rounded-xl shadow-sm border-2 p-4 hover:shadow-md hover:border-sky-300 transition-all group ${
                    isCurrentOrg ? 'border-sky-500 bg-sky-50' : 'border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Logo */}
                    <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {ui.logoLeft ? (
                        <img 
                          src={ui.logoLeft} 
                          alt={org.name || org.id} 
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-slate-400" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800 truncate">
                        {ui.headerTitle || org.name || org.id}
                      </h3>
                      <p className="text-sm text-slate-500 truncate">
                        {ui.headerSubtitle || ui.title || ''}
                      </p>
                      
                      {/* Map count */}
                      {atlasConfig.data?.maps?.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                          <MapPin className="w-3 h-3" />
                          <span>{atlasConfig.data.maps.length} map{atlasConfig.data.maps.length !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-sky-500 transition-colors flex-shrink-0 mt-4" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-4xl mx-auto px-4 pb-8 text-center">
        <p className="text-xs text-slate-400">
          Powered by CivQuest • 
          <a href="https://www.civicvanguard.com" target="_blank" rel="noopener" className="hover:text-sky-600 ml-1">
            Civic Vanguard
          </a>
        </p>
      </div>
    </div>
  );
}
