// src/admin/components/SystemHelpEditor.jsx
// Component for super admins to manage global help documentation
// This help is used as the default for all organizations that haven't
// created their own custom help documentation.

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Save,
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  Tag,
  FileImage,
  Video,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Link,
  Type,
  Code
} from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { subscribeToSystemConfig, updateGlobalHelpDocumentation } from '../../shared/services/systemConfig';

/**
 * SystemHelpEditor - Global help documentation management for super admins
 */
export default function SystemHelpEditor({
  db,
  addToast,
  confirm,
  adminEmail,
  accentColor = '#004E7C'
}) {
  const [helpDocs, setHelpDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalDocs, setOriginalDocs] = useState([]);

  // Subscribe to system config for real-time updates
  useEffect(() => {
    const unsubscribe = subscribeToSystemConfig((config) => {
      const docs = config.globalHelpDocumentation || [];
      // Ensure each doc has links array and contentMode for the new structure
      const docsWithDefaults = docs.map(doc => ({
        ...doc,
        links: doc.links || [],
        contentMode: doc.contentMode || 'richText' // Default to rich text mode
      }));
      setHelpDocs(docsWithDefaults);
      setOriginalDocs(JSON.parse(JSON.stringify(docsWithDefaults)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Track changes
  useEffect(() => {
    const docsChanged = JSON.stringify(helpDocs) !== JSON.stringify(originalDocs);
    setHasChanges(docsChanged);
  }, [helpDocs, originalDocs]);

  // Add new help article
  const addHelpDoc = () => {
    setHelpDocs(prev => [...prev, {
      id: `help_${Date.now()}`,
      title: '',
      content: '',
      contentMode: 'richText', // Default to rich text editor
      tags: [],
      media: [],
      links: []
    }]);
  };

  // Update help article
  const updateHelpDoc = (index, field, value) => {
    const updated = [...helpDocs];
    updated[index] = { ...updated[index], [field]: value };
    setHelpDocs(updated);
  };

  // Remove help article
  const removeHelpDoc = (index) => {
    const doc = helpDocs[index];
    confirm({
      title: 'Delete Help Article',
      message: `Are you sure you want to delete "${doc.title || 'Untitled Article'}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => {
        setHelpDocs(prev => prev.filter((_, i) => i !== index));
      }
    });
  };

  // Tag management
  const addTag = (docIndex, tag) => {
    if (!tag.trim()) return;
    const updated = [...helpDocs];
    const currentTags = updated[docIndex].tags || [];
    if (!currentTags.includes(tag.trim())) {
      updated[docIndex] = { ...updated[docIndex], tags: [...currentTags, tag.trim()] };
      setHelpDocs(updated);
    }
  };

  const removeTag = (docIndex, tagIndex) => {
    const updated = [...helpDocs];
    updated[docIndex].tags = updated[docIndex].tags.filter((_, i) => i !== tagIndex);
    setHelpDocs(updated);
  };

  // Media management
  const addMedia = (docIndex) => {
    const updated = [...helpDocs];
    const currentMedia = updated[docIndex].media || [];
    updated[docIndex] = {
      ...updated[docIndex],
      media: [...currentMedia, {
        id: `media_${Date.now()}`,
        type: 'image',
        url: '',
        title: '',
        thumbnail: '',
        tags: []
      }]
    };
    setHelpDocs(updated);
  };

  const updateMedia = (docIndex, mediaIndex, field, value) => {
    const updated = [...helpDocs];
    updated[docIndex].media[mediaIndex] = { ...updated[docIndex].media[mediaIndex], [field]: value };
    setHelpDocs(updated);
  };

  const removeMedia = (docIndex, mediaIndex) => {
    const updated = [...helpDocs];
    updated[docIndex].media = updated[docIndex].media.filter((_, i) => i !== mediaIndex);
    setHelpDocs(updated);
  };

  const addMediaTag = (docIndex, mediaIndex, tag) => {
    if (!tag.trim()) return;
    const updated = [...helpDocs];
    const currentTags = updated[docIndex].media[mediaIndex].tags || [];
    if (!currentTags.includes(tag.trim())) {
      updated[docIndex].media[mediaIndex].tags = [...currentTags, tag.trim()];
      setHelpDocs(updated);
    }
  };

  const removeMediaTag = (docIndex, mediaIndex, tagIndex) => {
    const updated = [...helpDocs];
    updated[docIndex].media[mediaIndex].tags = updated[docIndex].media[mediaIndex].tags.filter((_, i) => i !== tagIndex);
    setHelpDocs(updated);
  };

  // Article link management (external links tied to specific articles)
  const addArticleLink = (docIndex) => {
    const updated = [...helpDocs];
    const currentLinks = updated[docIndex].links || [];
    updated[docIndex] = {
      ...updated[docIndex],
      links: [...currentLinks, {
        id: `link_${Date.now()}`,
        title: '',
        url: '',
        description: ''
      }]
    };
    setHelpDocs(updated);
  };

  const updateArticleLink = (docIndex, linkIndex, field, value) => {
    const updated = [...helpDocs];
    updated[docIndex].links[linkIndex] = { ...updated[docIndex].links[linkIndex], [field]: value };
    setHelpDocs(updated);
  };

  const removeArticleLink = (docIndex, linkIndex) => {
    const updated = [...helpDocs];
    updated[docIndex].links = updated[docIndex].links.filter((_, i) => i !== linkIndex);
    setHelpDocs(updated);
  };

  // Save changes
  const handleSave = async () => {
    setSaving(true);
    try {
      // Clean up empty articles and their empty links
      const cleanedDocs = helpDocs
        .filter(doc => doc.title.trim() || doc.content.trim())
        .map(doc => ({
          ...doc,
          // Clean up empty links within each article
          links: (doc.links || []).filter(link => link.title.trim() && link.url.trim())
        }));

      await updateGlobalHelpDocumentation(cleanedDocs, adminEmail);
      setOriginalDocs(JSON.parse(JSON.stringify(cleanedDocs)));
      setHelpDocs(cleanedDocs);
      addToast('Global help documentation saved successfully', 'success');
    } catch (error) {
      console.error('Error saving global help:', error);
      addToast('Failed to save global help documentation', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Discard changes
  const handleDiscard = () => {
    if (!hasChanges) return;

    confirm({
      title: 'Discard Changes',
      message: 'Are you sure you want to discard all unsaved changes?',
      confirmLabel: 'Discard',
      destructive: true,
      onConfirm: () => {
        setHelpDocs(JSON.parse(JSON.stringify(originalDocs)));
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}15` }}
          >
            <BookOpen className="w-6 h-6" style={{ color: accentColor }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Global Help Documentation</h1>
            <p className="text-sm text-slate-500">
              Manage the default help documentation for all Atlas organizations
            </p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">About Global Help</p>
            <p>
              This help documentation is used as the default for all organizations.
              Organizations can choose to use this global help or create their own custom
              documentation in their Atlas settings.
            </p>
          </div>
        </div>
      </div>

      {/* Help Articles */}
      <div className="space-y-4 mb-6">
        {helpDocs.map((doc, docIdx) => (
          <HelpDocCard
            key={doc.id || docIdx}
            doc={doc}
            docIndex={docIdx}
            onUpdate={updateHelpDoc}
            onRemove={removeHelpDoc}
            onAddTag={addTag}
            onRemoveTag={removeTag}
            onAddMedia={addMedia}
            onUpdateMedia={updateMedia}
            onRemoveMedia={removeMedia}
            onAddMediaTag={addMediaTag}
            onRemoveMediaTag={removeMediaTag}
            onAddLink={addArticleLink}
            onUpdateLink={updateArticleLink}
            onRemoveLink={removeArticleLink}
            accentColor={accentColor}
          />
        ))}

        {helpDocs.length === 0 && (
          <div className="p-8 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 mb-4">
              No global help documentation yet. Add your first help article.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={addHelpDoc}
          className="w-full py-3 border border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-slate-400 hover:text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Help Article
        </button>
      </div>

      {/* Action Buttons */}
      {hasChanges && (
        <div className="sticky bottom-4 flex justify-end gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-lg">
          <button
            type="button"
            onClick={handleDiscard}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
          >
            Discard Changes
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Help Document Card Component
 */
function HelpDocCard({
  doc,
  docIndex,
  onUpdate,
  onRemove,
  onAddTag,
  onRemoveTag,
  onAddMedia,
  onUpdateMedia,
  onRemoveMedia,
  onAddMediaTag,
  onRemoveMediaTag,
  onAddLink,
  onUpdateLink,
  onRemoveLink,
  accentColor
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newTag, setNewTag] = useState('');

  const handleAddTag = () => {
    if (newTag.trim()) {
      onAddTag(docIndex, newTag.trim());
      setNewTag('');
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <div
        className="p-4 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
          <BookOpen className="w-5 h-5" style={{ color: accentColor }} />
          <span className="font-medium text-slate-700">
            {doc.title || 'Untitled Article'}
          </span>
          {doc.tags && doc.tags.length > 0 && (
            <span className="text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
              {doc.tags.length} tags
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(docIndex); }}
          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 border-t border-slate-200">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Article Title
            </label>
            <input
              type="text"
              value={doc.title}
              onChange={(e) => onUpdate(docIndex, 'title', e.target.value)}
              placeholder="e.g., How to Search by Address"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
            />
          </div>

          {/* Content Mode Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Content Editor Mode
            </label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => onUpdate(docIndex, 'contentMode', 'richText')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  doc.contentMode === 'richText' || !doc.contentMode
                    ? 'bg-sky-100 text-sky-800 border-2 border-sky-300'
                    : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200'
                }`}
              >
                <Type className="w-4 h-4" />
                Rich Text Editor
              </button>
              <button
                type="button"
                onClick={() => onUpdate(docIndex, 'contentMode', 'html')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  doc.contentMode === 'html'
                    ? 'bg-sky-100 text-sky-800 border-2 border-sky-300'
                    : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200'
                }`}
              >
                <Code className="w-4 h-4" />
                HTML Code
              </button>
            </div>
          </div>

          {/* Content Editor */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Content
            </label>

            {doc.contentMode === 'html' ? (
              // HTML Code Editor
              <>
                <textarea
                  value={doc.content}
                  onChange={(e) => onUpdate(docIndex, 'content', e.target.value)}
                  placeholder="Write the help content here using HTML tags like <p>, <ul>, <li>, <strong>, <em>, <h3>, <br> for rich formatting."
                  rows={8}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 font-mono text-sm"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Supported tags: &lt;p&gt;, &lt;br&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;li&gt;, &lt;h1&gt;-&lt;h4&gt;, &lt;blockquote&gt;, &lt;a href="..."&gt;
                </p>
              </>
            ) : (
              // Rich Text Editor (ReactQuill)
              <>
                <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                  <ReactQuill
                    value={doc.content || ''}
                    onChange={(content) => onUpdate(docIndex, 'content', content)}
                    placeholder="Write your help content here. Use the toolbar to format text, add headers, lists, links, and more."
                    modules={{
                      toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'color': [] }, { 'background': [] }],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        [{ 'indent': '-1'}, { 'indent': '+1' }],
                        [{ 'align': [] }],
                        ['link'],
                        ['blockquote', 'code-block'],
                        ['clean']
                      ]
                    }}
                    formats={[
                      'header',
                      'bold', 'italic', 'underline', 'strike',
                      'color', 'background',
                      'list', 'bullet', 'indent',
                      'align',
                      'link',
                      'blockquote', 'code-block'
                    ]}
                    className="help-rich-editor"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Use the formatting toolbar to style your content. No HTML knowledge required.
                </p>
              </>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Tags
              <span className="text-xs text-slate-400 font-normal">(helps match queries)</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(doc.tags || []).map((tag, tagIdx) => (
                <span
                  key={tagIdx}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-sky-100 text-sky-800 rounded-full text-sm"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => onRemoveTag(docIndex, tagIdx)}
                    className="hover:text-sky-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add a tag..."
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-sky-100 text-sky-700 rounded-lg text-sm font-medium hover:bg-sky-200 transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Media Section */}
          <div className="pt-4 border-t border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <FileImage className="w-4 h-4" />
              Media (Screenshots & Videos)
            </label>

            {/* Media Items */}
            {(doc.media || []).map((media, mediaIdx) => (
              <MediaCard
                key={media.id || mediaIdx}
                media={media}
                docIndex={docIndex}
                mediaIndex={mediaIdx}
                onUpdate={onUpdateMedia}
                onRemove={onRemoveMedia}
                onAddTag={onAddMediaTag}
                onRemoveTag={onRemoveMediaTag}
              />
            ))}

            <button
              type="button"
              onClick={() => onAddMedia(docIndex)}
              className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Image or Video
            </button>
          </div>

          {/* External Links Section */}
          <div className="pt-4 border-t border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              External Links
              <span className="text-xs text-slate-400 font-normal">(opens in new window)</span>
            </label>

            {/* Link Items */}
            {(doc.links || []).map((link, linkIdx) => (
              <div
                key={link.id || linkIdx}
                className="p-3 bg-slate-50 rounded-lg mb-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Link className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={link.title}
                        onChange={(e) => onUpdateLink(docIndex, linkIdx, 'title', e.target.value)}
                        placeholder="Link Title"
                        className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveLink(docIndex, linkIdx)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) => onUpdateLink(docIndex, linkIdx, 'url', e.target.value)}
                      placeholder="URL (https://...)"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                    />
                    <input
                      type="text"
                      value={link.description || ''}
                      onChange={(e) => onUpdateLink(docIndex, linkIdx, 'description', e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => onAddLink(docIndex)}
              className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add External Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Media Card Component
 */
function MediaCard({
  media,
  docIndex,
  mediaIndex,
  onUpdate,
  onRemove,
  onAddTag,
  onRemoveTag
}) {
  const [newTag, setNewTag] = useState('');

  const handleAddTag = () => {
    if (newTag.trim()) {
      onAddTag(docIndex, mediaIndex, newTag.trim());
      setNewTag('');
    }
  };

  return (
    <div className="p-3 bg-slate-50 rounded-lg mb-3">
      <div className="flex items-start gap-3">
        {/* Media Preview */}
        <div className="w-24 h-16 bg-slate-200 rounded flex-shrink-0 flex items-center justify-center overflow-hidden">
          {media.url ? (
            media.type === 'video' ? (
              <Video className="w-8 h-8 text-slate-400" />
            ) : (
              <img
                src={media.url}
                alt={media.title || 'Media'}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )
          ) : (
            <FileImage className="w-8 h-8 text-slate-400" />
          )}
        </div>

        {/* Media Fields */}
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <select
              value={media.type}
              onChange={(e) => onUpdate(docIndex, mediaIndex, 'type', e.target.value)}
              className="px-2 py-1.5 border border-slate-300 rounded text-sm"
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
            <input
              type="text"
              value={media.title}
              onChange={(e) => onUpdate(docIndex, mediaIndex, 'title', e.target.value)}
              placeholder="Title"
              className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm"
            />
            <button
              type="button"
              onClick={() => onRemove(docIndex, mediaIndex)}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <input
            type="url"
            value={media.url}
            onChange={(e) => onUpdate(docIndex, mediaIndex, 'url', e.target.value)}
            placeholder="URL (https://...)"
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
          />

          {/* Media Tags */}
          <div>
            <div className="flex flex-wrap gap-1 mb-1">
              {(media.tags || []).map((tag, tagIdx) => (
                <span
                  key={tagIdx}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-xs"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => onRemoveTag(docIndex, mediaIndex, tagIdx)}
                    className="hover:text-emerald-600"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add tag for matching..."
                className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs hover:bg-emerald-200 transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
