// src/admin/components/EmailTemplateConfiguration.jsx
// Email Template management for Notify module
// Super admins can create templates that org admins can use when configuring notifications
//
// Templates provide a design framework for custom emails with rolled-up statistics
// and data visualizations instead of just raw records.

import React, { useState, useEffect } from 'react';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import {
  Mail,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Eye,
  Code,
  FileText,
  LayoutTemplate,
  Sparkles,
  ChevronRight,
  Search,
  X,
  Check
} from 'lucide-react';

/**
 * EmailTemplateConfiguration Component
 *
 * Manages global email templates that can be used by org admins.
 *
 * Props:
 * @param {object} db - Firestore database instance
 * @param {function} addToast - Toast notification function
 * @param {function} confirm - Confirmation dialog function
 * @param {string} accentColor - Theme accent color
 * @param {React.Component} EmailTemplateEditor - The editor modal component
 */
export default function EmailTemplateConfiguration({
  db,
  addToast,
  confirm,
  accentColor = '#004E7C',
  EmailTemplateEditor
}) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch templates from Firestore
  useEffect(() => {
    const templatesRef = collection(db, 'email_templates');
    const unsubscribe = onSnapshot(templatesRef, (snapshot) => {
      const temps = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      // Sort by updatedAt descending, then by name
      temps.sort((a, b) => {
        const aTime = a.updatedAt?.toDate?.() || new Date(0);
        const bTime = b.updatedAt?.toDate?.() || new Date(0);
        return bTime - aTime;
      });
      setTemplates(temps);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [db]);

  // Filter templates by search query
  const filteredTemplates = templates.filter(t =>
    t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Default template structure
  const defaultTemplate = {
    id: '',
    name: 'New Email Template',
    description: 'Custom email template with statistics and data visualization',
    category: 'general',
    html: `<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #004E7C; color: white; padding: 20px; text-align: center;">
    <h1 style="margin: 0;">{{organizationName}}</h1>
    <h2 style="margin: 5px 0 0 0; font-weight: normal; font-size: 18px;">{{notificationName}}</h2>
  </div>

  <div style="padding: 20px; background-color: #f9f9f9;">
    <p style="color: #666; margin: 0;">
      <strong>Period:</strong> {{dateRangeStart}} to {{dateRangeEnd}}
    </p>
    <p style="color: #666; margin: 5px 0 0 0;">
      <strong>Records Found:</strong> {{recordCount}}
    </p>
  </div>

  <div style="padding: 20px;">
    {{emailIntro}}

    {{downloadButton}}

    {{dataTable}}

    {{moreRecordsMessage}}
  </div>

  <div style="padding: 15px; background-color: #f0f0f0; text-align: center; font-size: 12px; color: #666;">
    <p style="margin: 0;">You are receiving this because you subscribed at CivQuest Notify.</p>
  </div>
</div>`,
    placeholders: [
      'organizationName', 'organizationId',
      'notificationName', 'notificationId',
      'recordCount',
      'dateRangeStart', 'dateRangeEnd',
      'dateRangeStartTime', 'dateRangeEndTime',
      'dataTable', 'downloadButton', 'downloadUrl',
      'moreRecordsMessage', 'emailIntro', 'emailZeroStateMessage'
    ],
    isActive: true
  };

  // Create new template
  const handleCreateTemplate = () => {
    const newId = `template_${Date.now()}`;
    setEditingTemplate({
      ...defaultTemplate,
      id: newId,
      isNew: true
    });
  };

  // Edit existing template
  const handleEditTemplate = (template) => {
    setEditingTemplate({ ...template, isNew: false });
  };

  // Duplicate template
  const handleDuplicateTemplate = (template) => {
    const newId = `template_${Date.now()}`;
    setEditingTemplate({
      ...template,
      id: newId,
      name: `${template.name} (Copy)`,
      isNew: true
    });
  };

  // Delete template
  const handleDeleteTemplate = (template) => {
    confirm({
      title: 'Delete Email Template',
      message: `Are you sure you want to delete "${template.name}"? Organizations using this template will fall back to the default email format.`,
      destructive: true,
      confirmLabel: 'Delete',
      requireTypedConfirmation: template.name,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'email_templates', template.id));
          addToast('Template deleted', 'success');
        } catch (err) {
          addToast('Error: ' + err.message, 'error');
        }
      }
    });
  };

  // Save template
  const handleSaveTemplate = async (templateData) => {
    try {
      const docRef = doc(db, 'email_templates', templateData.id);
      await setDoc(docRef, {
        ...templateData,
        updatedAt: serverTimestamp(),
        createdAt: templateData.isNew ? serverTimestamp() : templateData.createdAt
      }, { merge: true });
      setEditingTemplate(null);
      addToast('Template saved', 'success');
    } catch (err) {
      addToast('Error: ' + err.message, 'error');
    }
  };

  // Preview template
  const handlePreviewTemplate = (template) => {
    setPreviewTemplate(template);
  };

  // Get category badge style
  const getCategoryStyle = (category) => {
    const styles = {
      general: { bg: 'bg-slate-100', text: 'text-slate-700' },
      'real-estate': { bg: 'bg-blue-100', text: 'text-blue-700' },
      'public-safety': { bg: 'bg-red-100', text: 'text-red-700' },
      'permits': { bg: 'bg-amber-100', text: 'text-amber-700' },
      'utilities': { bg: 'bg-green-100', text: 'text-green-700' },
      'statistics': { bg: 'bg-purple-100', text: 'text-purple-700' }
    };
    return styles[category] || styles.general;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full"
             style={{ borderColor: accentColor, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Email Templates</h2>
          <p className="text-slate-500 text-sm">
            Create custom email templates with statistics and data visualizations for notifications.
          </p>
        </div>
        <button
          onClick={handleCreateTemplate}
          className="flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium"
          style={{ backgroundColor: accentColor }}
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search templates..."
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2"
          style={{ '--tw-ring-color': accentColor }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Placeholder Reference */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Code className="w-4 h-4 text-slate-500" />
          <h3 className="font-medium text-slate-700">Available Placeholders</h3>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { key: 'organizationName', desc: 'Org name' },
            { key: 'notificationName', desc: 'Notification name' },
            { key: 'recordCount', desc: 'Number of records' },
            { key: 'dateRangeStart', desc: 'Start date' },
            { key: 'dateRangeEnd', desc: 'End date' },
            { key: 'dataTable', desc: 'HTML table of records' },
            { key: 'downloadButton', desc: 'CSV download button' },
            { key: 'downloadUrl', desc: 'Raw CSV URL' },
            { key: 'moreRecordsMessage', desc: 'Showing X of Y' },
            { key: 'emailIntro', desc: 'Custom intro text' },
          ].map(p => (
            <span
              key={p.key}
              className="px-2 py-1 bg-white border border-slate-200 rounded font-mono"
              title={p.desc}
            >
              {`{{${p.key}}}`}
            </span>
          ))}
        </div>
      </div>

      {/* Template List */}
      {filteredTemplates.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
          <LayoutTemplate className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            {searchQuery ? 'No Templates Found' : 'No Email Templates Yet'}
          </h3>
          <p className="text-slate-500 mb-6">
            {searchQuery
              ? 'Try a different search term.'
              : 'Create your first email template to provide custom designs for notifications.'}
          </p>
          {!searchQuery && (
            <button
              onClick={handleCreateTemplate}
              className="px-6 py-2 text-white rounded-lg font-medium"
              style={{ backgroundColor: accentColor }}
            >
              Create First Template
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              accentColor={accentColor}
              getCategoryStyle={getCategoryStyle}
              onEdit={() => handleEditTemplate(template)}
              onDelete={() => handleDeleteTemplate(template)}
              onDuplicate={() => handleDuplicateTemplate(template)}
              onPreview={() => handlePreviewTemplate(template)}
            />
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingTemplate && EmailTemplateEditor && (
        <EmailTemplateEditor
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSave={handleSaveTemplate}
          accentColor={accentColor}
        />
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          accentColor={accentColor}
        />
      )}
    </div>
  );
}

// --- Template Card Component ---
function TemplateCard({
  template,
  accentColor,
  getCategoryStyle,
  onEdit,
  onDelete,
  onDuplicate,
  onPreview
}) {
  const categoryStyle = getCategoryStyle(template.category);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Preview Thumbnail */}
      <div className="h-32 bg-slate-100 border-b border-slate-200 overflow-hidden relative group">
        <div
          className="absolute inset-0 scale-[0.4] origin-top-left"
          style={{ width: '250%', height: '250%' }}
        >
          <div
            dangerouslySetInnerHTML={{
              __html: template.html?.replace(/\{\{(\w+)\}\}/g, (match, key) => {
                // Replace placeholders with sample data for preview
                const samples = {
                  organizationName: 'Sample Organization',
                  notificationName: 'Sample Report',
                  recordCount: '42',
                  dateRangeStart: '01/01/2026',
                  dateRangeEnd: '01/31/2026',
                  emailIntro: '<p>Here is your latest report summary.</p>',
                  downloadButton: '<button style="background:#004E7C;color:white;padding:8px 16px;border:none;border-radius:4px;">Download CSV</button>',
                  dataTable: '<table style="width:100%;border-collapse:collapse;"><tr style="background:#f0f0f0;"><th style="padding:8px;text-align:left;">Field</th><th style="padding:8px;text-align:left;">Value</th></tr><tr><td style="padding:8px;border-bottom:1px solid #ddd;">Sample</td><td style="padding:8px;border-bottom:1px solid #ddd;">Data</td></tr></table>',
                  moreRecordsMessage: '',
                  downloadUrl: '#'
                };
                return samples[key] || match;
              }) || ''
            }}
          />
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <button
            onClick={onPreview}
            className="px-3 py-1.5 bg-white rounded-lg text-sm font-medium flex items-center gap-1.5 shadow-lg"
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="font-semibold text-slate-800 line-clamp-1">{template.name}</h4>
          <span className={`text-xs px-2 py-0.5 rounded-full ${categoryStyle.bg} ${categoryStyle.text}`}>
            {template.category || 'general'}
          </span>
        </div>
        <p className="text-sm text-slate-500 line-clamp-2 mb-3">
          {template.description || 'No description'}
        </p>

        {/* Status */}
        <div className="flex items-center gap-2 mb-3">
          {template.isActive !== false ? (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="w-3 h-3" />
              Active
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <X className="w-3 h-3" />
              Inactive
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 pt-2 border-t border-slate-100">
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            onClick={onDuplicate}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Template Preview Modal ---
function TemplatePreviewModal({ template, onClose, accentColor }) {
  const [sampleData, setSampleData] = useState({
    organizationName: 'Acme Organization',
    notificationName: 'Daily Market Report',
    recordCount: '1686',
    dateRangeStart: '01/01/2026',
    dateRangeEnd: '01/31/2026',
    dateRangeStartTime: '01/01/2026 00:00',
    dateRangeEndTime: '01/31/2026 23:59',
    emailIntro: '<p>Here is your daily market summary with the latest statistics.</p>',
    emailZeroStateMessage: 'No new records found for this period.',
    downloadButton: `<div style="margin: 20px 0;"><a href="#" style="background-color: ${accentColor}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Download Full CSV Report</a></div>`,
    downloadUrl: 'https://example.com/report.csv',
    dataTable: `<table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px;">
      <thead>
        <tr>
          <th style="text-align: left; padding: 8px; background-color: #f2f2f2;">Address</th>
          <th style="text-align: left; padding: 8px; background-color: #f2f2f2;">Price</th>
          <th style="text-align: left; padding: 8px; background-color: #f2f2f2;">Date</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">123 Main St</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">$450,000</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">01/15/2026</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">456 Oak Ave</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">$325,000</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">01/14/2026</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">789 Elm Dr</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">$550,000</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">01/13/2026</td></tr>
      </tbody>
    </table>`,
    moreRecordsMessage: '<p style="font-style: italic; color: #666; margin-top: 10px;">Showing first 3 of 1686 records. Download the CSV to see all data.</p>'
  });

  // Process template HTML with sample data
  const processedHtml = template.html?.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return sampleData[key] || match;
  }) || '<p>No template HTML defined</p>';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Preview: {template.name}</h3>
            <p className="text-sm text-slate-500">Rendered with sample data</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto p-4 bg-slate-100">
          <div className="max-w-2xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
            <div dangerouslySetInnerHTML={{ __html: processedHtml }} />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
