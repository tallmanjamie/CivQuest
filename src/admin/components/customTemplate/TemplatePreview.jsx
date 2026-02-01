// src/admin/components/customTemplate/TemplatePreview.jsx
// Live preview component for custom email templates

import React, { useState, useMemo } from 'react';
import {
  Eye,
  Monitor,
  Smartphone,
  Send,
  X,
  Loader2,
  RefreshCw,
  Database,
  AlertCircle
} from 'lucide-react';
import { generateSampleContext } from './validation';

/**
 * SendTestModal - Modal for sending test emails
 */
function SendTestModal({ onClose, onSend, isSending }) {
  const [email, setEmail] = useState('');
  const [dataSource, setDataSource] = useState('mock');
  const [includeCSV, setIncludeCSV] = useState(true);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    setError('');
    onSend({ email, useLiveData: dataSource === 'live', includeCSV });
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-slate-800">Send Test Email</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4">
            <p className="text-sm text-slate-600">
              Send a test email to preview how the template will appear in actual email clients.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="admin@example.com"
                className={`w-full px-3 py-2 border rounded text-sm ${
                  error ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`}
              />
              {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">
                Data Source
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="dataSource"
                    value="mock"
                    checked={dataSource === 'mock'}
                    onChange={(e) => setDataSource(e.target.value)}
                    className="rounded-full"
                  />
                  <span className="text-sm text-slate-700">Use mock data (42 sample records)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="dataSource"
                    value="live"
                    checked={dataSource === 'live'}
                    onChange={(e) => setDataSource(e.target.value)}
                    className="rounded-full"
                  />
                  <span className="text-sm text-slate-700">Use live query (fetch current data from ArcGIS)</span>
                </label>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeCSV}
                onChange={(e) => setIncludeCSV(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-slate-700">Include CSV attachment</span>
            </label>
          </div>

          <div className="p-4 border-t flex justify-end gap-2 bg-slate-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded text-sm"
              disabled={isSending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSending}
              className="px-4 py-2 bg-[#004E7C] text-white rounded text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Test
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * TemplatePreview Component
 *
 * Renders a live preview of the custom template with sample data
 *
 * Props:
 * @param {object} template - Custom template configuration
 * @param {object} notification - Parent notification configuration
 * @param {object} locality - Organization/locality data
 * @param {string} mode - Preview mode ('desktop' or 'mobile')
 * @param {function} onModeChange - Called when mode changes
 * @param {function} onSendTest - Called to send a test email
 */
export default function TemplatePreview({
  template = {},
  notification = {},
  locality = {},
  mode = 'desktop',
  onModeChange,
  onSendTest
}) {
  const [showSendModal, setShowSendModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Generate sample context for preview
  const sampleContext = useMemo(() => {
    return generateSampleContext(notification, template, locality, {
      mockRecordCount: 42
    });
  }, [notification, template, locality, refreshKey]);

  // Process template HTML with sample context
  const processedHtml = useMemo(() => {
    if (!template.html) return '';

    let html = template.html;
    // Replace all placeholders with sample values
    Object.entries(sampleContext).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      html = html.replace(regex, value);
    });

    return html;
  }, [template.html, sampleContext]);

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
  };

  const handleSendTest = async (options) => {
    setIsSending(true);
    try {
      await onSendTest?.(options);
      setShowSendModal(false);
    } catch (err) {
      console.error('Send test failed:', err);
    } finally {
      setIsSending(false);
    }
  };

  const previewWidth = mode === 'mobile' ? '375px' : '600px';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-slate-500" />
          <h4 className="text-sm font-medium text-slate-700">Preview</h4>
          <span className="text-xs text-slate-400">
            ({mode === 'mobile' ? '375px' : '600px'})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <div className="flex items-center bg-slate-100 rounded p-0.5">
            <button
              type="button"
              onClick={() => onModeChange?.('desktop')}
              className={`p-1.5 rounded transition-colors ${
                mode === 'desktop'
                  ? 'bg-white shadow-sm text-slate-700'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Desktop view"
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onModeChange?.('mobile')}
              className={`p-1.5 rounded transition-colors ${
                mode === 'mobile'
                  ? 'bg-white shadow-sm text-slate-700'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Mobile view"
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleRefresh}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
            title="Refresh preview"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Send Test Button */}
          {onSendTest && (
            <button
              type="button"
              onClick={() => setShowSendModal(true)}
              className="px-2 py-1 text-xs bg-[#004E7C] text-white rounded hover:bg-[#003d61] flex items-center gap-1"
            >
              <Send className="w-3 h-3" />
              Send Test
            </button>
          )}
        </div>
      </div>

      {/* Sample Data Info */}
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Database className="w-3 h-3" />
          <span>Rendered with sample data</span>
        </div>
        <div className="text-xs text-slate-400">
          Records: {sampleContext.recordCount} | {sampleContext.dateRangeStart} - {sampleContext.dateRangeEnd}
        </div>
      </div>

      {/* Preview Container */}
      <div className="flex-1 overflow-auto bg-slate-100 p-4">
        {!template.html ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <AlertCircle className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm font-medium">No template HTML</p>
            <p className="text-xs mt-1">Add HTML content to see the preview</p>
          </div>
        ) : (
          <div
            className="mx-auto bg-white shadow-lg rounded-lg overflow-hidden transition-all duration-300"
            style={{
              maxWidth: previewWidth,
              minHeight: '400px'
            }}
          >
            {/* Email Preview Frame */}
            <div
              dangerouslySetInnerHTML={{ __html: processedHtml }}
              className="email-preview"
            />
          </div>
        )}
      </div>

      {/* CSV Toggle Notice */}
      {template.includeCSV === false && (
        <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 flex items-center gap-2 text-xs text-amber-700 shrink-0">
          <AlertCircle className="w-4 h-4" />
          <span>CSV export is disabled. Download button will not appear in emails.</span>
        </div>
      )}

      {/* Send Test Modal */}
      {showSendModal && (
        <SendTestModal
          onClose={() => setShowSendModal(false)}
          onSend={handleSendTest}
          isSending={isSending}
        />
      )}
    </div>
  );
}
