// src/atlas/components/HelpChatPanel.jsx
// CivQuest Atlas - Help Chat Panel Component
// Provides help documentation and AI-powered help chat in a docked panel

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  HelpCircle,
  X,
  Send,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Search,
  ArrowLeft,
  Image as ImageIcon,
  PlayCircle,
  ExternalLink
} from 'lucide-react';
import { getThemeColors } from '../utils/themeColors';

// Centralized Gemini configuration
import { getGeminiUrl, getGeminiFallbackUrl, GEMINI_CONFIG, GEMINI_CREATIVE_CONFIG } from '../../config/geminiConfig';

/**
 * Format help content for display
 * Handles both HTML content and markdown-style formatting
 * @param {string} content - The content to format
 * @returns {string} - HTML-safe content ready for rendering
 */
const formatHelpContent = (content) => {
  if (!content) return '';

  // Check if content already contains HTML tags (block-level elements)
  const hasHtmlTags = /<(p|div|ul|ol|li|h[1-6]|br|table|tr|td|th|blockquote)[^>]*>/i.test(content);

  if (hasHtmlTags) {
    // Content already has HTML, just apply markdown transformations for inline elements
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-slate-200 px-1 rounded text-sm">$1</code>');
  }

  // Plain text or markdown - convert newlines and apply formatting
  return content
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-slate-200 px-1 rounded text-sm">$1</code>');
};

/**
 * HelpChatPanel Component
 * Docked panel for help documentation and AI-powered help chat
 */
export default function HelpChatPanel({
  isOpen,
  onClose,
  config,
  position = 'top' // 'top' or 'bottom' based on search bar position
}) {
  const [view, setView] = useState('chat'); // 'articles' | 'article' | 'chat' - default to chat mode
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);

  const themeColor = config?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);
  const isBottom = position === 'bottom';

  // Get help documentation from config (external links are now within each article)
  const helpDocs = config?.helpDocumentation || [];

  // Filter articles based on search query
  const filteredDocs = searchQuery.trim()
    ? helpDocs.filter(doc =>
        doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : helpDocs;

  // Scroll to bottom of chat
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, []);

  // Add message to chat
  const addMessage = useCallback((type, content, metadata = {}) => {
    setChatMessages(prev => [...prev, {
      id: Date.now(),
      type,
      content,
      timestamp: new Date().toISOString(),
      ...metadata
    }]);
    setTimeout(scrollToBottom, 100);
  }, [scrollToBottom]);

  /**
   * Call Gemini API for help responses
   */
  const callGeminiApi = useCallback(async (prompt, useFallback = false) => {
    const url = useFallback ? getGeminiFallbackUrl() : getGeminiUrl();

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: GEMINI_CREATIVE_CONFIG
      })
    });

    const data = await response.json();

    if (data.error) {
      if (!useFallback && GEMINI_CONFIG.fallbackModel) {
        return callGeminiApi(prompt, true);
      }
      throw new Error(data.error.message || 'API error');
    }

    return data;
  }, []);

  /**
   * Handle help query submission
   */
  const handleSubmit = useCallback(async (query) => {
    if (!query?.trim() || isLoading) return;

    const trimmedQuery = query.trim();
    addMessage('user', trimmedQuery);
    setChatInput('');
    setIsLoading(true);

    try {
      if (helpDocs.length === 0) {
        addMessage('ai', "I don't have any help documentation available yet. Please contact your administrator to add help content.");
        setIsLoading(false);
        return;
      }

      // Build help context
      const helpContext = helpDocs.map(doc => {
        let content = `Title: ${doc.title}\nContent: ${doc.content}`;
        if (doc.tags) content += `\nTags: ${doc.tags.join(', ')}`;
        return content;
      }).join('\n\n---\n\n');

      const prompt = `You are a helpful assistant for the Atlas property search application. Answer the user's question based on the help documentation below. Be concise but thorough. Format your response with markdown for better readability.

Help Documentation:
${helpContext}

User Question: ${trimmedQuery}

Provide a clear, helpful answer. Do not include article references or citations in your response.`;

      const data = await callGeminiApi(prompt);
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text ||
        'I couldn\'t find information about that topic. Try browsing the help articles or rephrasing your question.';

      // Find relevant media from docs
      const relevantMedia = helpDocs
        .filter(doc => doc.media && doc.media.length > 0)
        .flatMap(doc => doc.media)
        .filter(m => {
          const tags = m.tags || [];
          return tags.some(tag => trimmedQuery.toLowerCase().includes(tag.toLowerCase()));
        })
        .slice(0, 2);

      addMessage('ai', responseText, { media: relevantMedia });

    } catch (err) {
      console.error('[HelpChatPanel] Help query error:', err);
      addMessage('ai', 'Sorry, I encountered an error. Please try again or browse the help articles directly.');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, helpDocs, addMessage, callGeminiApi]);

  /**
   * Handle article click
   */
  const handleArticleClick = (article) => {
    setSelectedArticle(article);
    setView('article');
  };

  /**
   * Start chat mode
   */
  const startChat = () => {
    setView('chat');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  /**
   * Go back to articles list
   */
  const goBack = () => {
    if (view === 'article') {
      setSelectedArticle(null);
    }
    setView('articles');
  };

  // Reset view when panel closes
  useEffect(() => {
    if (!isOpen) {
      setView('chat'); // Default to chat mode
      setSelectedArticle(null);
      setSearchQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel - positioned to match AdvancedSearchModal */}
      <div
        className={`absolute ${isBottom ? 'bottom-16 left-3' : 'top-28 left-3'} bg-white rounded-xl shadow-2xl w-[calc(100%-1.5rem)] sm:w-96 max-h-[70vh] flex flex-col animate-in fade-in ${isBottom ? 'slide-in-from-bottom-4' : 'slide-in-from-top-4'} duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-4 py-3 border-b border-slate-100 flex justify-between items-center flex-shrink-0 bg-slate-50 rounded-t-xl"
        >
          <div className="flex items-center gap-2">
            {(view === 'article' || view === 'chat') && (
              <button
                onClick={goBack}
                className="p-1 hover:bg-white/50 rounded text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <HelpCircle className="w-4 h-4" style={{ color: colors.text600 }} />
            <span className="font-semibold text-slate-800 text-sm">
              {view === 'articles' ? 'Help Center' : view === 'article' ? 'Article' : 'Ask a Question'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/50 rounded text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Articles View */}
        {view === 'articles' && (
          <>
            {/* Search Input */}
            <div className="px-3 py-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search help articles..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:bg-white transition"
                  style={{ '--tw-ring-color': colors.bg500 }}
                />
              </div>
            </div>

            {/* Ask Question Button */}
            <div className="px-3 py-2 border-b border-slate-100">
              <button
                onClick={startChat}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.bg600 }}
              >
                <HelpCircle className="w-4 h-4" />
                Ask a Question
              </button>
            </div>

            {/* Articles List */}
            <div className="flex-1 overflow-y-auto">
              {/* Empty state - no content at all */}
              {helpDocs.length === 0 && (
                <div className="p-6 text-center">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm text-slate-500">No help content available</p>
                  <p className="text-xs text-slate-400 mt-1">Contact your administrator to add help content</p>
                </div>
              )}

              {/* Search with no results */}
              {filteredDocs.length === 0 && searchQuery.trim() && (
                <div className="p-6 text-center">
                  <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm text-slate-500">No matching articles</p>
                  <p className="text-xs text-slate-400 mt-1">Try different keywords</p>
                </div>
              )}

              {/* Articles */}
              {filteredDocs.length > 0 && (
                <div className="divide-y divide-slate-50">
                  {filteredDocs.map((doc, idx) => (
                    <button
                      key={doc.id || idx}
                      onClick={() => handleArticleClick(doc)}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 group"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: colors.bg100 }}
                      >
                        <BookOpen className="w-4 h-4" style={{ color: colors.text600 }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{doc.title}</p>
                        {doc.tags && doc.tags.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {doc.tags.slice(0, 3).map((tag, i) => (
                              <span
                                key={i}
                                className="text-xs px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: colors.bg50, color: colors.text600 }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Article Detail View */}
        {view === 'article' && selectedArticle && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-3">{selectedArticle.title}</h3>

              {/* Article Content - Supports HTML formatting */}
              <div
                className="prose prose-sm text-slate-600 mb-4 help-content"
                dangerouslySetInnerHTML={{ __html: formatHelpContent(selectedArticle.content) }}
              />

              {/* Tags */}
              {selectedArticle.tags && selectedArticle.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap mb-4">
                  {selectedArticle.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-1 rounded-full"
                      style={{ backgroundColor: colors.bg100, color: colors.text600 }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Media */}
              {selectedArticle.media && selectedArticle.media.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-700">Related Media</h4>
                  {selectedArticle.media.map((item, idx) => (
                    <div key={idx} className="rounded-lg overflow-hidden border border-slate-200">
                      {item.type === 'image' ? (
                        <div>
                          <img
                            src={item.url}
                            alt={item.title || 'Help image'}
                            className="w-full max-h-48 object-contain bg-slate-100"
                          />
                          {item.title && (
                            <div className="p-2 bg-slate-50 text-xs text-slate-600">
                              {item.title}
                            </div>
                          )}
                        </div>
                      ) : item.type === 'video' ? (
                        <div>
                          <video
                            src={item.url}
                            controls
                            className="w-full max-h-48"
                            poster={item.thumbnail}
                          />
                          {item.title && (
                            <div className="p-2 bg-slate-50 text-xs text-slate-600">
                              {item.title}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {/* External Links */}
              {selectedArticle.links && selectedArticle.links.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-700">External Resources</h4>
                  {selectedArticle.links.map((link, idx) => (
                    <a
                      key={link.id || idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-100">
                        <ExternalLink className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{link.title}</p>
                        {link.description && (
                          <p className="text-xs text-slate-500 truncate">{link.description}</p>
                        )}
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-slate-600 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Ask about this article */}
            <div className="p-3 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => {
                  setChatInput(`Tell me more about "${selectedArticle.title}"`);
                  startChat();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-white border border-slate-200 hover:bg-slate-50"
                style={{ color: colors.text600 }}
              >
                <HelpCircle className="w-4 h-4" />
                Ask a question about this topic
              </button>
            </div>
          </div>
        )}

        {/* Chat View */}
        {view === 'chat' && (
          <>
            {/* Chat Messages */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {chatMessages.length === 0 && (
                <div className="text-center py-8">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                    style={{ backgroundColor: colors.bg100 }}
                  >
                    <HelpCircle className="w-6 h-6" style={{ color: colors.text600 }} />
                  </div>
                  <p className="text-sm text-slate-600 mb-2">How can I help you?</p>
                  <p className="text-xs text-slate-400">
                    Ask any question about using Atlas
                  </p>
                </div>
              )}

              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.type === 'user' ? (
                    <div
                      className="px-3 py-2 rounded-lg max-w-[80%] text-white text-sm"
                      style={{ backgroundColor: colors.bg600 }}
                    >
                      {msg.content}
                    </div>
                  ) : (
                    <div className="max-w-[85%]">
                      <div className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm">
                        <div
                          className="prose prose-sm help-content"
                          dangerouslySetInnerHTML={{
                            __html: formatHelpContent(msg.content)
                          }}
                        />
                      </div>

                      {/* Media attached to response */}
                      {msg.media && msg.media.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {msg.media.map((item, idx) => (
                            <div key={idx} className="rounded-lg overflow-hidden border border-slate-200">
                              {item.type === 'image' ? (
                                <img
                                  src={item.url}
                                  alt={item.title || 'Help image'}
                                  className="w-full max-h-32 object-contain bg-slate-100"
                                />
                              ) : item.type === 'video' && (
                                <div className="relative">
                                  <img
                                    src={item.thumbnail || item.url}
                                    alt={item.title || 'Video'}
                                    className="w-full max-h-32 object-cover bg-slate-100"
                                  />
                                  <PlayCircle className="absolute inset-0 m-auto w-10 h-10 text-white opacity-80" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-lg bg-slate-100 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: colors.text600 }} />
                    <span className="text-sm text-slate-500">Thinking...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-3 border-t border-slate-100 bg-white">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit(chatInput);
                }}
                className="flex gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type your question..."
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:bg-white transition"
                  style={{ '--tw-ring-color': colors.bg500 }}
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isLoading}
                  className="px-3 py-2 rounded-lg transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: colors.bg600 }}
                >
                  <HelpCircle className="w-5 h-5" />
                </button>
              </form>

              {/* Quick browse link */}
              <button
                onClick={goBack}
                className="w-full mt-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                Or browse help articles
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
