// src/atlas/components/ChatView.jsx
// CivQuest Atlas - Chat View Component
// AI-powered conversational property search interface
// Search input has been moved to unified SearchToolbar in AtlasApp
//
// CHANGES:
// - Added session memory for context-aware searches
// - Added metadata viewer for SQL queries and interpretations
// - Added embedded mini-map for search results
// - Improved formatting for desktop efficiency
// - Added help mode for documentation queries

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  HelpCircle,
  MapPin,
  Loader2,
  AlertCircle,
  Lightbulb,
  Map,
  Table2,
  ExternalLink,
  Copy,
  Check,
  Download,
  FileText,
  ChevronDown,
  ChevronUp,
  Code,
  Database,
  Info,
  BookOpen,
  X,
  Image as ImageIcon,
  FileSpreadsheet,
  FileArchive
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';
import { getThemeColors } from '../utils/themeColors';
import { exportFeatureToPDF } from '../utils/FeatureExportService';
import { exportSearchResultsToShapefile } from '../utils/ShapefileExportService';
import ChatMiniMap from './ChatMiniMap';

// Centralized Gemini configuration - update model in one place
import { getGeminiUrl, getGeminiFallbackUrl, GEMINI_QUERY_CONFIG, GEMINI_CONFIG, GEMINI_CREATIVE_CONFIG } from '../../config/geminiConfig';

/**
 * Detect if a query looks like a simple address search
 */
function isSimpleAddressQuery(query) {
  const trimmed = query.trim().toLowerCase();
  const addressPattern = /^\d+\s+[\w\s]+(?:st|street|ave|avenue|ln|lane|rd|road|dr|drive|ct|court|blvd|boulevard|way|pl|place|cir|circle|ter|terrace|pkwy|parkway)?\.?$/i;
  const questionWords = ['what', 'which', 'who', 'how', 'when', 'where', 'show', 'find', 'list', 'get', 'top', 'largest', 'biggest', 'most', 'recent', 'latest', 'sold', 'sale', 'over', 'under', 'between', 'greater', 'less', 'more', 'than'];
  const hasQuestionWord = questionWords.some(word => trimmed.includes(word));

  if (hasQuestionWord) return false;
  if (addressPattern.test(trimmed)) return true;

  const words = trimmed.split(/\s+/);
  if (words.length <= 5 && /^\d+$/.test(words[0])) return true;

  return false;
}

/**
 * Detect if a query looks like a parcel ID
 */
function isParcelIdQuery(query) {
  const trimmed = query.trim();
  return /^[\d\-A-Z]{5,}$/i.test(trimmed) && !/\s/.test(trimmed);
}

/**
 * Detect if a WHERE clause is unrestricted (would return all records)
 * This prevents queries like "1=1", "1 = 1", "'a'='a'", "2=2", etc.
 */
function isUnrestrictedQuery(whereClause) {
  if (!whereClause || typeof whereClause !== 'string') return true;

  const trimmed = whereClause.trim();
  if (!trimmed) return true;

  // Normalize whitespace for comparison
  const normalized = trimmed.replace(/\s+/g, '').toLowerCase();

  // Check for common tautology patterns
  const tautologyPatterns = [
    /^1=1$/,                           // 1=1
    /^'[^']*'='[^']*'$/,               // 'a'='a' or any string equality
    /^"[^"]*"="[^"]*"$/,               // "a"="a"
    /^(\d+)=\1$/,                      // Any number equals itself (2=2, 100=100)
    /^true$/i,                         // true
    /^1$/,                             // just 1
    /^\(1=1\)$/,                       // (1=1)
    /^not\s*false$/i,                  // NOT FALSE
    /^[\d.]+\s*[<>=!]+\s*[\d.]+$/,     // Catch numeric comparisons that are always true
  ];

  for (const pattern of tautologyPatterns) {
    if (pattern.test(normalized)) {
      return true;
    }
  }

  // Check for numeric tautologies like "1=1", "2=2", etc. with spaces
  const numericTautology = /^(\d+)\s*=\s*\1$/;
  if (numericTautology.test(trimmed)) {
    return true;
  }

  // Check for string tautologies with spaces
  const stringTautology = /^'([^']*)'\s*=\s*'\1'$/i;
  if (stringTautology.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Detect if query is a help/documentation question
 */
function isHelpQuery(query, helpModeEnabled) {
  if (helpModeEnabled) return true;
  const helpPatterns = [
    /^help\b/i,
    /\bhow do i\b/i,
    /\bhow to\b/i,
    /\bwhat is\b/i,
    /\bwhat are\b/i,
    /\bcan i\b/i,
    /\bwhere can i\b/i,
    /\btutorial\b/i,
    /\bguide\b/i
  ];
  return helpPatterns.some(p => p.test(query));
}

/**
 * Get center point from ArcGIS geometry
 */
function getGeometryCenter(geometry) {
  if (!geometry) return null;

  if (geometry.x !== undefined && geometry.y !== undefined) {
    return { lat: geometry.y, lng: geometry.x };
  }

  if (geometry.rings && geometry.rings.length > 0) {
    const ring = geometry.rings[0];
    let sumX = 0, sumY = 0;
    for (const point of ring) {
      sumX += point[0];
      sumY += point[1];
    }
    return { lng: sumX / ring.length, lat: sumY / ring.length };
  }

  if (geometry.paths && geometry.paths.length > 0) {
    const path = geometry.paths[0];
    const midIndex = Math.floor(path.length / 2);
    return { lng: path[midIndex][0], lat: path[midIndex][1] };
  }

  return null;
}

/**
 * ChatView Component
 */
const ChatView = forwardRef(function ChatView(props, ref) {
  const {
    config,
    activeMap,
    searchResults,
    updateSearchResults,
    searchLocation,
    setSearchLocation,
    isSearching,
    setIsSearching,
    mode,
    setMode,
    enabledModes,
    mapViewRef,
    // Use shared search history from context
    saveToHistory,
    // Use shared help mode state from context
    helpModeEnabled,
    setHelpModeEnabled,
    // Help panel
    setShowHelpPanel
  } = useAtlas();

  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Processing...');

  // Session memory for context-aware searches
  const [sessionMemory, setSessionMemory] = useState([]);

  // Mobile view state for results
  const [isMobile, setIsMobile] = useState(false);

  const chatContainerRef = useRef(null);
  const messageIdCounterRef = useRef(0);

  const themeColor = config?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);
  const botAvatar = config?.ui?.botAvatar || config?.ui?.logoLeft;

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  /**
   * Get field names from config
   */
  const getFieldNames = useCallback(() => {
    let parcelField = 'PARCELID';
    let addressField = 'PROPERTYADDRESS';

    const searchFields = activeMap?.searchFields || config?.data?.searchFields;
    if (searchFields) {
      const pObj = searchFields.find(f =>
        /PARCEL|GPIN|LRSN|PIN/i.test(f.label) ||
        /PARCEL|GPIN|LRSN|PIN/i.test(f.field)
      );
      if (pObj) parcelField = pObj.field;

      const aObj = searchFields.find(f =>
        /ADDRESS|SITE|SITUS/i.test(f.label) ||
        /ADDRESS|SITUS/i.test(f.field)
      );
      if (aObj) addressField = aObj.field;
    }

    return { parcelField, addressField };
  }, [activeMap?.searchFields, config?.data?.searchFields]);

  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, []);

  const addMessage = useCallback((type, content, metadata = {}) => {
    // Use timestamp + counter to ensure unique IDs even when messages are added in same millisecond
    const uniqueId = `${Date.now()}-${++messageIdCounterRef.current}`;
    setMessages(prev => [...prev, {
      id: uniqueId,
      type,
      content,
      timestamp: new Date().toISOString(),
      ...metadata
    }]);
    setTimeout(scrollToBottom, 100);
  }, [scrollToBottom]);

  /**
   * Add to session memory for context
   */
  const addToSessionMemory = useCallback((query, result, metadata = {}) => {
    setSessionMemory(prev => {
      const newEntry = {
        query,
        result: result?.features?.length || 0,
        timestamp: Date.now(),
        ...metadata
      };
      // Keep last 10 searches for context
      const updated = [...prev, newEntry].slice(-10);
      return updated;
    });
  }, []);

  /**
   * Build context from session memory for AI
   */
  const buildSessionContext = useCallback(() => {
    if (sessionMemory.length === 0) return '';

    const recentSearches = sessionMemory.slice(-5).map(m => {
      let summary = `- "${m.query}"`;
      if (m.result > 0) summary += ` (found ${m.result} results)`;
      if (m.whereClause) summary += ` [SQL: ${m.whereClause.substring(0, 100)}...]`;
      return summary;
    }).join('\n');

    return `\n\nPrevious searches in this session:\n${recentSearches}\n\nConsider the context of previous searches when interpreting the current query, but only if it seems relevant. If the new query is unrelated, treat it independently.`;
  }, [sessionMemory]);

  const callGeminiApi = useCallback(async (prompt, useFallback = false, useCreativeConfig = false) => {
    const url = useFallback ? getGeminiFallbackUrl() : getGeminiUrl();
    const modelName = useFallback ? GEMINI_CONFIG.fallbackModel : GEMINI_CONFIG.model;

    console.log(`[ChatView] Calling Gemini API with model: ${modelName}`);

    // Add timeout to prevent long-running requests (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: useCreativeConfig ? GEMINI_CREATIVE_CONFIG : GEMINI_QUERY_CONFIG
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (data.error) {
        const errorMessage = data.error.message || data.error.status || 'Unknown API error';
        console.error(`[ChatView] Gemini API error (${modelName}):`, data.error);

        if (!useFallback && GEMINI_CONFIG.fallbackModel) {
          console.log('[ChatView] Trying fallback model...');
          return callGeminiApi(prompt, true, useCreativeConfig);
        }

        throw new Error(`Gemini API error: ${errorMessage}`);
      }

      if (!response.ok) {
        const errorText = JSON.stringify(data);
        console.error(`[ChatView] HTTP ${response.status}:`, errorText);

        if (!useFallback && GEMINI_CONFIG.fallbackModel) {
          return callGeminiApi(prompt, true, useCreativeConfig);
        }

        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.error(`[ChatView] Gemini API request timed out (${modelName})`);
        if (!useFallback && GEMINI_CONFIG.fallbackModel) {
          console.log('[ChatView] Trying fallback model after timeout...');
          return callGeminiApi(prompt, true, useCreativeConfig);
        }
        throw new Error('AI request timed out. Please try again.');
      }
      throw err;
    }
  }, []);

  const geocodeAddress = useCallback(async (address) => {
    const geocoderConfig = activeMap?.geocoder || config?.data?.geocoder;
    const geocoderUrl = geocoderConfig?.url ||
      'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';

    console.log('[ChatView] Geocoding address:', address);

    const params = new URLSearchParams({
      f: 'json',
      SingleLine: address,
      outFields: '*',
      outSR: '4326',
      maxLocations: 1
    });

    const response = await fetch(`${geocoderUrl}/findAddressCandidates?${params}`);
    const data = await response.json();

    if (data.error) throw new Error(data.error.message || 'Geocoder error');

    if (data.candidates && data.candidates.length > 0) {
      const result = data.candidates[0];
      return { lat: result.location.y, lng: result.location.x, formatted: result.address };
    }

    throw new Error('ADDRESS_NOT_FOUND');
  }, [activeMap?.geocoder, config?.data?.geocoder]);

  const searchExternalAddressLayer = useCallback(async (address) => {
    const addressSearchConfig = activeMap?.addressSearch || config?.data?.addressSearch;

    if (!addressSearchConfig?.useExternalLayer || !addressSearchConfig?.externalLayer?.endpoint) {
      return null;
    }

    const externalLayer = addressSearchConfig.externalLayer;
    const searchField = externalLayer.searchField || 'FullAdd';
    const searchVal = address.toUpperCase();

    console.log('[ChatView] Searching external address layer:', externalLayer.endpoint);

    const useExactMatch = externalLayer.exactMatch === true;
    const whereClause = useExactMatch
      ? `UPPER(${searchField}) = '${searchVal}'`
      : `UPPER(${searchField}) LIKE '%${searchVal}%'`;

    const params = new URLSearchParams({
      f: 'json',
      where: whereClause,
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
      resultRecordCount: 1
    });

    const response = await fetch(`${externalLayer.endpoint}/query?${params}`);
    const data = await response.json();

    if (!data.features || data.features.length === 0) return null;

    const addressFeature = data.features[0];
    let coords = addressFeature.geometry ? getGeometryCenter(addressFeature.geometry) : null;

    if (!coords) return null;

    const displayField = externalLayer.displayField || searchField;
    return { lat: coords.lat, lng: coords.lng, formatted: addressFeature.attributes[displayField] || address };
  }, [activeMap?.addressSearch, config?.data?.addressSearch]);

  /**
   * Spatial query for parcel - NO BUFFER
   * Only returns the parcel that the point actually intersects with
   * This ensures address searches only return 1 result
   */
  const spatialQueryForParcel = useCallback(async (coords) => {
    const endpoint = activeMap?.endpoint || config?.data?.endpoint;
    if (!endpoint) throw new Error('No endpoint configured');

    console.log('[ChatView] Spatial query at:', coords);

    // FIXED: Only use exact point query, no buffer fallback
    // This ensures address searches return only the parcel containing the address point
    const params = new URLSearchParams({
      f: 'json',
      where: '1=1',
      geometry: `${coords.lng},${coords.lat}`,
      geometryType: 'esriGeometryPoint',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
      inSR: '4326',
      resultRecordCount: 1  // Only return 1 result
    });

    const response = await fetch(`${endpoint}/query?${params}`);
    const data = await response.json();

    console.log('[ChatView] Spatial query result:', data.features?.length || 0, 'features');

    return data;
  }, [activeMap?.endpoint, config?.data?.endpoint]);

  const lookupParcelById = useCallback(async (parcelId) => {
    const endpoint = activeMap?.endpoint || config?.data?.endpoint;
    if (!endpoint) throw new Error('No endpoint configured');

    const { parcelField } = getFieldNames();
    console.log('[ChatView] Looking up parcel by ID:', parcelId, 'field:', parcelField);

    const params = new URLSearchParams({
      f: 'json',
      where: `${parcelField} = '${parcelId}'`,
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326'
    });

    const response = await fetch(`${endpoint}/query?${params}`);
    return response.json();
  }, [activeMap?.endpoint, config?.data?.endpoint, getFieldNames]);

  const executeSqlQuery = useCallback(async (queryParams) => {
    const endpoint = activeMap?.endpoint || config?.data?.endpoint;
    if (!endpoint) throw new Error('No endpoint configured');

    console.log('[ChatView] Executing SQL query:', queryParams);

    const params = new URLSearchParams({
      f: 'json',
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
      where: queryParams.where
    });

    if (queryParams.orderBy) params.set('orderByFields', queryParams.orderBy);
    if (queryParams.limit) params.set('resultRecordCount', String(queryParams.limit));

    const response = await fetch(`${endpoint}/query?${params}`);
    return response.json();
  }, [activeMap?.endpoint, config?.data?.endpoint]);

  /**
   * Handle help queries using documentation
   */
  const handleHelpQuery = useCallback(async (query) => {
    const helpDocs = config?.helpDocumentation || [];

    if (helpDocs.length === 0) {
      return {
        response: "I don't have any help documentation available yet. Please contact your administrator to add help content.",
        media: []
      };
    }

    // Build help context
    const helpContext = helpDocs.map(doc => {
      let content = `Title: ${doc.title}\nContent: ${doc.content}`;
      if (doc.tags) content += `\nTags: ${doc.tags.join(', ')}`;
      return content;
    }).join('\n\n---\n\n');

    const prompt = `You are a helpful assistant for the Atlas property search application. Answer the user's question based on the help documentation below. If there are relevant images or videos in the documentation, mention them in your response.

Help Documentation:
${helpContext}

User Question: ${query}

Provide a clear, helpful answer. If you reference media (images/videos), note them so they can be displayed.`;

    try {
      const data = await callGeminiApi(prompt, false, true);
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'I couldn\'t find information about that topic.';

      // Find relevant media from docs
      const relevantMedia = helpDocs
        .filter(doc => doc.media && doc.media.length > 0)
        .flatMap(doc => doc.media)
        .filter(m => {
          const tags = m.tags || [];
          return tags.some(tag => query.toLowerCase().includes(tag.toLowerCase()));
        })
        .slice(0, 3); // Limit to 3 media items

      return { response: responseText, media: relevantMedia };
    } catch (err) {
      console.error('[ChatView] Help query error:', err);
      return {
        response: 'Sorry, I encountered an error while looking up help information. Please try again.',
        media: []
      };
    }
  }, [config?.helpDocumentation, callGeminiApi]);

  /**
   * Build a description of available search fields for the AI prompt
   */
  const buildAvailableFieldsContext = useCallback(() => {
    const searchFields = activeMap?.searchFields || config?.data?.searchFields;
    if (!searchFields || searchFields.length === 0) {
      return '';
    }

    const fieldDescriptions = searchFields.map(sf => {
      const typeInfo = sf.type ? ` (${sf.type})` : '';
      return `  - ${sf.field}${typeInfo}${sf.label ? `: ${sf.label}` : ''}`;
    }).join('\n');

    return `\n\nAvailable database fields for queries:\n${fieldDescriptions}\n\nUse these exact field names in your WHERE clauses.`;
  }, [activeMap?.searchFields, config?.data?.searchFields]);

  /**
   * Translate natural language query to SQL using AI
   * Uses the configured System Prompt and available search fields
   */
  const translateQueryWithAI = useCallback(async (query) => {
    // Check multiple paths for the system prompt
    // Priority: activeMap.systemPrompt > config.data.systemPrompt
    const systemPrompt = activeMap?.systemPrompt || config?.data?.systemPrompt;

    console.log('[ChatView] translateQueryWithAI called');
    console.log('[ChatView] activeMap?.systemPrompt:', activeMap?.systemPrompt ? 'SET' : 'NOT SET');
    console.log('[ChatView] config?.data?.systemPrompt:', config?.data?.systemPrompt ? 'SET' : 'NOT SET');

    if (!systemPrompt || systemPrompt.trim() === '') {
      console.warn('[ChatView] No system prompt configured - AI translation disabled');
      console.warn('[ChatView] To enable AI query translation, configure the "System Prompt (for AI Query Translation)" in Atlas Admin Settings');
      return null;
    }

    console.log('[ChatView] Using system prompt (first 200 chars):', systemPrompt.substring(0, 200) + '...');

    try {
      // Build session context
      const sessionContext = buildSessionContext();

      // Build available fields context from searchFields configuration
      const fieldsContext = buildAvailableFieldsContext();
      console.log('[ChatView] Available fields context:', fieldsContext || '(none configured)');

      // Build the full prompt with context
      const fullPrompt = `${systemPrompt}${fieldsContext}${sessionContext}

User Query: ${query}

Remember to respond with ONLY a valid JSON object, no additional text or markdown. Include an "interpretation" field explaining how you understood the query.`;

      console.log('[ChatView] Sending query to Gemini AI...');
      const data = await callGeminiApi(fullPrompt);

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('[ChatView] Gemini raw response:', text);

      // Try to extract JSON from the response
      // Handle cases where AI might wrap in markdown code blocks
      let jsonText = text;

      // Remove markdown code blocks if present
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1].trim();
      }

      // Find JSON object in the text
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('[ChatView] Successfully parsed AI response:', parsed);

          // Validate the response has expected fields
          if (parsed.where || parsed.parcelId || parsed.address) {
            return parsed;
          } else {
            console.warn('[ChatView] AI response missing expected fields (where/parcelId/address):', parsed);
            return parsed; // Return anyway, let the caller handle it
          }
        } catch (parseErr) {
          console.error('[ChatView] Failed to parse JSON from AI response:', parseErr);
          console.error('[ChatView] Raw JSON text:', jsonMatch[0]);
          return null;
        }
      }

      console.warn('[ChatView] No JSON found in AI response');
      return null;
    } catch (err) {
      console.error('[ChatView] Gemini AI translation failed:', err);
      return null;
    }
  }, [activeMap?.systemPrompt, config?.data?.systemPrompt, callGeminiApi, buildSessionContext, buildAvailableFieldsContext]);

  const handleSearch = useCallback(async (query) => {
    if (!query?.trim() || isLoading) return;

    const trimmedQuery = query.trim();
    addMessage('user', trimmedQuery);

    // Check for help queries
    if (isHelpQuery(trimmedQuery, helpModeEnabled)) {
      setIsLoading(true);
      setLoadingText('Looking up help information...');

      try {
        const helpResult = await handleHelpQuery(trimmedQuery);
        addMessage('ai', helpResult.response, {
          isHelpResponse: true,
          helpMedia: helpResult.media
        });
      } catch (err) {
        addMessage('error', 'Sorry, I encountered an error looking up help information.');
      } finally {
        setIsLoading(false);
        setIsSearching?.(false);
      }
      return;
    }

    setIsLoading(true);
    setIsSearching?.(true);

    // Metadata for this search
    let searchMetadata = {
      queryType: 'unknown',
      whereClause: null,
      interpretation: null,
      aiResponse: null
    };

    try {
      let results = null;
      let location = null;
      const { parcelField, addressField } = getFieldNames();

      if (isParcelIdQuery(trimmedQuery)) {
        setLoadingText('Looking up parcel...');
        console.log('[ChatView] Detected parcel ID query');
        searchMetadata.queryType = 'parcelId';
        searchMetadata.whereClause = `${parcelField} = '${trimmedQuery}'`;

        results = await lookupParcelById(trimmedQuery);

        if (results.features && results.features.length > 0) {
          const center = getGeometryCenter(results.features[0].geometry);
          if (center) location = { ...center, formatted: `ID: ${trimmedQuery}` };
        }
      }
      else if (isSimpleAddressQuery(trimmedQuery)) {
        setLoadingText('Searching address...');
        console.log('[ChatView] Detected simple address query');
        searchMetadata.queryType = 'address';

        try {
          location = await searchExternalAddressLayer(trimmedQuery);
          console.log('[ChatView] External layer result:', location);
        } catch (e) {
          console.log('[ChatView] External layer search failed:', e);
        }

        if (!location) {
          try {
            location = await geocodeAddress(trimmedQuery);
            console.log('[ChatView] Geocoder result:', location);
          } catch (e) {
            console.log('[ChatView] Geocoding failed:', e);
          }
        }

        if (location) {
          setLoadingText('Finding property...');
          searchMetadata.whereClause = `Spatial query at (${location.lng}, ${location.lat})`;
          results = await spatialQueryForParcel(location);
        } else {
          console.log('[ChatView] Falling back to LIKE search');
          setLoadingText('Searching database...');
          const searchTerm = trimmedQuery.toUpperCase();
          searchMetadata.whereClause = `UPPER(${addressField}) LIKE '%${searchTerm}%'`;
          results = await executeSqlQuery({
            where: searchMetadata.whereClause
          });
        }
      }
      else {
        // Complex query - use AI translation
        setLoadingText('Analyzing your question...');
        console.log('[ChatView] Complex query detected, attempting AI translation');
        searchMetadata.queryType = 'aiTranslation';

        const aiResult = await translateQueryWithAI(trimmedQuery);

        if (aiResult) {
          console.log('[ChatView] AI translation successful:', aiResult);
          searchMetadata.aiResponse = aiResult;
          searchMetadata.interpretation = aiResult.interpretation || aiResult.explanation || null;

          if (aiResult.parcelId) {
            setLoadingText('Looking up parcel...');
            searchMetadata.whereClause = `${parcelField} = '${aiResult.parcelId}'`;
            results = await lookupParcelById(aiResult.parcelId);
          } else if (aiResult.address) {
            setLoadingText('Searching address...');
            searchMetadata.whereClause = `Address lookup: ${aiResult.address}`;
            try {
              location = await searchExternalAddressLayer(aiResult.address);
              if (!location) location = await geocodeAddress(aiResult.address);
              if (location) results = await spatialQueryForParcel(location);
            } catch (e) {
              console.log('[ChatView] Address from AI failed:', e);
            }
          } else if (aiResult.where) {
            // Validate the WHERE clause to prevent unrestricted queries
            if (isUnrestrictedQuery(aiResult.where)) {
              console.warn('[ChatView] Blocked unrestricted query:', aiResult.where);
              throw new Error('Your search is too broad. Please be more specific about what you\'re looking for (e.g., specify an address, owner name, price range, or other criteria).');
            }
            setLoadingText('Searching database...');
            searchMetadata.whereClause = aiResult.where;
            console.log('[ChatView] Executing AI-generated WHERE clause:', aiResult.where);
            results = await executeSqlQuery({
              where: aiResult.where,
              orderBy: aiResult.orderBy || aiResult.orderByFields,
              limit: aiResult.limit || aiResult.resultRecordCount
            });
          } else {
            console.warn('[ChatView] AI response had no actionable fields');
          }
        } else {
          // AI translation failed or not configured
          console.log('[ChatView] AI translation unavailable, falling back to text search');

          // Check if system prompt is configured
          const hasSystemPrompt = activeMap?.systemPrompt || config?.data?.systemPrompt;
          if (!hasSystemPrompt) {
            console.warn('[ChatView] No system prompt configured - complex queries will use basic text matching');
          }
        }

        // Fallback: try LIKE search if no results yet
        if (!results || !results.features || results.features.length === 0) {
          console.log('[ChatView] Falling back to LIKE search');
          setLoadingText('Searching database...');
          const searchTerm = trimmedQuery.toUpperCase();
          searchMetadata.whereClause = `UPPER(${addressField}) LIKE '%${searchTerm}%'`;
          searchMetadata.queryType = 'fallbackLike';
          results = await executeSqlQuery({
            where: searchMetadata.whereClause
          });
        }
      }

      const features = results?.features || [];

      if (results?.error) throw new Error(results.error.message || 'Query failed');

      updateSearchResults({ features });
      if (location) setSearchLocation?.(location);
      saveToHistory(trimmedQuery);

      // Add to session memory
      addToSessionMemory(trimmedQuery, { features }, {
        whereClause: searchMetadata.whereClause,
        queryType: searchMetadata.queryType
      });

      if (features.length === 0) {
        // Use custom no results message from config, or fall back to default
        const defaultNoResultsMessage = 'I couldn\'t find any properties matching your search. Try:\n• Checking the spelling\n• Using a different format (e.g., "306 Cedar Lane" or "306 CEDAR LN")\n• Searching by parcel ID instead';
        const noResultsMessage = config?.messages?.noResultsMessage || defaultNoResultsMessage;
        addMessage('ai', noResultsMessage, {
          searchMetadata,
          showNoResults: true  // Flag to show query details for no results
        });
      } else if (features.length === 1) {
        const feature = features[0];
        const address = feature.attributes?.[addressField] || feature.attributes?.PROPERTYADDRESS || feature.attributes?.ADDRESS || 'Property';
        addMessage('ai', `I found **${address}**. Here are the details:`, {
          feature,
          showDetails: true,
          searchMetadata
        });

        // Zoom to feature and select it to open popup on single result
        if (mapViewRef?.current && enabledModes.includes('map')) {
          if (mapViewRef.current.zoomToFeature) {
            mapViewRef.current.zoomToFeature(feature);
          }
          if (mapViewRef.current.selectFeature) {
            mapViewRef.current.selectFeature(feature);
          }
        }
      } else {
        addMessage('ai', `I found **${features.length}** properties matching your search.`, {
          features,
          showResultActions: true,
          searchMetadata
        });
        if (mapViewRef?.current?.renderResults) mapViewRef.current.renderResults(features);
      }

    } catch (err) {
      console.error('[ChatView] Search error:', err);
      addMessage('error', `Sorry, I encountered an error: ${err.message}. Please try rephrasing your question.`);
    } finally {
      setIsLoading(false);
      setIsSearching?.(false);
    }
  }, [
    isLoading, addMessage, getFieldNames, lookupParcelById, searchExternalAddressLayer,
    geocodeAddress, spatialQueryForParcel, executeSqlQuery, translateQueryWithAI,
    updateSearchResults, setSearchLocation, saveToHistory, mapViewRef, enabledModes, setIsSearching,
    activeMap, config, helpModeEnabled, handleHelpQuery, addToSessionMemory
  ]);

  const handleExampleClick = useCallback((question) => {
    handleSearch(question);
  }, [handleSearch]);

  /**
   * Export search results to CSV
   */
  const exportCSV = useCallback(() => {
    const features = searchResults?.features;
    if (!features || features.length === 0) return;

    const tableColumns = activeMap?.tableColumns || [];
    let columns;
    if (tableColumns.length > 0) {
      columns = tableColumns.map(col => ({
        field: col.field,
        headerName: col.headerName || col.field
      }));
    } else {
      // Auto-generate columns from first feature
      columns = Object.keys(features[0].attributes)
        .filter(k => !k.startsWith('_') && k !== 'OBJECTID' && k !== 'Shape__Area' && k !== 'Shape__Length')
        .map(field => ({ field, headerName: field }));
    }

    // Build CSV content
    const headers = columns.map(col => col.headerName).join(',');
    const rows = features.map(feature =>
      columns.map(col => {
        const value = feature.attributes?.[col.field];
        if (value == null) return '';
        // Escape quotes and wrap in quotes if contains comma or quotes
        const strValue = String(value);
        if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      }).join(',')
    ).join('\n');

    const csvContent = `${headers}\n${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `search-results-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [searchResults, activeMap?.tableColumns]);

  /**
   * Export search results to Shapefile
   */
  const exportShapefile = useCallback(async () => {
    const features = searchResults?.features;
    if (!features || features.length === 0) return;

    try {
      await exportSearchResultsToShapefile({
        features,
        filename: 'search-results',
        onProgress: (status) => {
          console.log('[ChatView] Shapefile export:', status);
        }
      });
    } catch (err) {
      console.error('[ChatView] Shapefile export error:', err);
      addMessage('error', `Export failed: ${err.message}`);
    }
  }, [searchResults?.features, addMessage]);

  /**
   * Export single feature to PDF
   * Uses FeatureExportService for consistent multi-page PDF generation
   */
  const exportPDF = useCallback(async (feature) => {
    if (!feature) return;

    console.log('[ChatView] Starting PDF export for feature:', feature);

    try {
      await exportFeatureToPDF({
        feature,
        atlasConfig: config,
        mapConfig: activeMap,
        mapView: mapViewRef?.current?.view || null,
        onProgress: (status) => {
          console.log('[ChatView] PDF Export:', status);
        }
      });
    } catch (err) {
      console.error('[ChatView] PDF export failed:', err);
      // Could add error handling/notification here
    }
  }, [config, activeMap, mapViewRef]);

  /**
   * Add a location-only message (from geocoder autocomplete)
   * Shows a mini map with the location and an "Open in Map" button
   */
  const addLocationMessage = useCallback((location, address) => {
    addMessage('ai', `📍 **${location.formatted || address}**`, {
      isLocationMessage: true,
      location: {
        lat: location.lat,
        lng: location.lng,
        formatted: location.formatted || address
      }
    });
  }, [addMessage]);

  useImperativeHandle(ref, () => ({ handleSearch, addMessage, addLocationMessage }), [handleSearch, addMessage, addLocationMessage]);

  // Get the search tip text from config (empty = hidden)
  const searchTipText = config?.messages?.searchTip || '';

  // Get important note from config (empty = hidden)
  const importantNote = config?.messages?.importantNote || '';

  // Get example questions
  const exampleQuestions = config?.messages?.exampleQuestions || [];

  // Check if help documentation is available
  const hasHelpDocs = config?.helpDocumentation && config.helpDocumentation.length > 0;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Chat Messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 md:p-6"
      >
        {/* Container for better desktop width management */}
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Welcome Message - ALWAYS VISIBLE */}
          <div className="flex gap-3 md:gap-4">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white border border-slate-200 shadow-md flex-shrink-0 flex items-center justify-center overflow-hidden p-1">
              {botAvatar ? (
                <img src={botAvatar} alt="AI" className="w-full h-full object-contain" />
              ) : (
                <div
                  className="w-full h-full rounded-full flex items-center justify-center"
                  style={{ backgroundColor: colors.bg100 }}
                >
                  <HelpCircle className="w-4 h-4 md:w-5 md:h-5" style={{ color: colors.text600 }} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-2">
                  {config?.messages?.welcomeTitle || 'Welcome!'}
                </h3>
                <p className="text-slate-600 text-sm">
                  {config?.messages?.welcomeText || 'Search for properties using natural language. Try asking questions like the examples below.'}
                </p>
              </div>
            </div>
          </div>

          {/* Example Questions - ALWAYS VISIBLE */}
          {exampleQuestions.length > 0 && (
            <div className="ml-12 md:ml-14 space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {exampleQuestions.map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExampleClick(question)}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                    style={{
                      '--hover-border': colors.border300,
                      '--hover-bg': colors.bg50
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.borderColor = colors.border300;
                      e.target.style.backgroundColor = colors.bg50;
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.borderColor = '';
                      e.target.style.backgroundColor = '';
                    }}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Help Button - opens help panel */}
          <div className="ml-12 md:ml-14">
            <button
              onClick={() => setShowHelpPanel?.(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <BookOpen className="w-4 h-4" />
              Need Help?
            </button>
          </div>

          {/* Important Note / Disclaimer - ALWAYS VISIBLE */}
          {importantNote && (
            <div className="ml-12 md:ml-14 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">{importantNote}</p>
              </div>
            </div>
          )}

          {/* Conversation Messages - appear below the welcome section */}
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              botAvatar={botAvatar}
              colors={colors}
              tableColumns={activeMap?.tableColumns}
              searchFields={activeMap?.searchFields || config?.data?.searchFields}
              themeColor={themeColor}
              isMobile={isMobile}
              enabledModes={enabledModes}
              onExitHelpMode={() => setHelpModeEnabled(false)}
              onViewMap={(features) => {
                // Restore search results from this message before switching to map view
                if (features) {
                  const featureArray = Array.isArray(features) ? features : [features];
                  updateSearchResults({ features: featureArray });
                  // Also render on map immediately
                  if (mapViewRef?.current?.renderResults) {
                    mapViewRef.current.renderResults(featureArray);
                  }
                  // For single result, zoom and select
                  if (featureArray.length === 1 && mapViewRef?.current) {
                    if (mapViewRef.current.zoomToFeature) {
                      mapViewRef.current.zoomToFeature(featureArray[0]);
                    }
                    if (mapViewRef.current.selectFeature) {
                      mapViewRef.current.selectFeature(featureArray[0]);
                    }
                  }
                }
                setMode('map');
              }}
              onViewTable={(features) => {
                // Restore search results from this message before switching to table view
                if (features) {
                  const featureArray = Array.isArray(features) ? features : [features];
                  updateSearchResults({ features: featureArray });
                  // Also render on map to keep in sync
                  if (mapViewRef?.current?.renderResults) {
                    mapViewRef.current.renderResults(featureArray);
                  }
                }
                setMode('table');
              }}
              onExportCSV={exportCSV}
              onExportShapefile={exportShapefile}
              onExportPDF={exportPDF}
              exportOptions={config?.exportOptions?.chatSearchResults || {}}
              onRowClick={(feature) => {
                // Zoom to the clicked feature on the map
                if (feature && mapViewRef?.current) {
                  // Render all features from the message first to keep context
                  if (msg.features && mapViewRef.current.renderResults) {
                    mapViewRef.current.renderResults(msg.features);
                  }
                  // Zoom to and select the specific feature
                  if (mapViewRef.current.zoomToFeature) {
                    mapViewRef.current.zoomToFeature(feature);
                  }
                  if (mapViewRef.current.selectFeature) {
                    mapViewRef.current.selectFeature(feature);
                  }
                }
                // Switch to map mode
                if (enabledModes.includes('map')) {
                  setMode('map');
                }
              }}
              onOpenInMap={(location) => {
                // Zoom to the geocoded location without search results
                if (location && mapViewRef?.current?.zoomToCoordinate) {
                  mapViewRef.current.zoomToCoordinate(location.lat, location.lng, 17);
                }
                // Switch to map mode
                setMode('map');
              }}
            />
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3 md:gap-4">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white border border-slate-200 shadow-md flex-shrink-0 flex items-center justify-center overflow-hidden p-1">
                {botAvatar ? (
                  <img src={botAvatar} alt="AI" className="w-full h-full object-contain" />
                ) : (
                  <div
                    className="w-full h-full rounded-full flex items-center justify-center"
                    style={{ backgroundColor: colors.bg100 }}
                  >
                    <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" style={{ color: colors.text600 }} />
                  </div>
                )}
              </div>
              <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-200 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: colors.text600 }} />
                <span className="text-sm text-slate-500">{loadingText}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tip Footer */}
      {searchTipText && (
        <div className="border-t border-slate-200 bg-white px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-2 text-xs text-slate-500">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <span>{searchTipText}</span>
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * Results Table Component - shows preview of multiple results
 * Uses tableColumns with chatResults: true, displaying headerName instead of field name
 */
function ResultsTable({ features, tableColumns, searchFields, colors, onRowClick }) {
  // Priority: tableColumns with chatResults: true > all tableColumns > auto-generate
  let columns;

  // First, check for tableColumns with chatResults enabled
  const chatResultsColumns = tableColumns?.filter(col => col.chatResults === true) || [];

  if (chatResultsColumns.length > 0) {
    // Use columns marked for chat results (limit to 5 for table preview)
    columns = chatResultsColumns.slice(0, 5).map(col => ({
      field: col.field,
      headerName: col.headerName || col.field
    }));
  } else if (tableColumns && tableColumns.length > 0) {
    // Fall back to all tableColumns if no chatResults columns configured
    columns = tableColumns.slice(0, 5).map(col => ({
      field: col.field,
      headerName: col.headerName || col.field
    }));
  } else if (features?.[0]?.attributes) {
    // Fallback to auto-generated columns
    columns = Object.keys(features[0].attributes)
      .filter(k => !k.startsWith('_') && k !== 'OBJECTID' && k !== 'Shape__Area' && k !== 'Shape__Length')
      .slice(0, 5)
      .map(field => ({ field, headerName: field }));
  } else {
    return null;
  }

  // Handle row click - zoom to feature on map
  const handleRowClick = (feature) => {
    if (onRowClick) {
      onRowClick(feature);
    }
  };

  // Show all rows for multi-result display
  return (
    <div className="overflow-x-auto max-h-64 overflow-y-auto">
      <table className="min-w-full text-xs">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-slate-200">
            {columns.map(col => (
              <th
                key={col.field}
                className="px-2 py-1.5 text-left font-medium text-slate-500 uppercase tracking-wider"
              >
                {col.headerName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {features.map((feature, idx) => (
            <tr
              key={idx}
              className="hover:bg-slate-50 cursor-pointer transition-colors"
              onClick={() => handleRowClick(feature)}
              title="Click to zoom on map"
            >
              {columns.map(col => (
                <td key={col.field} className="px-2 py-1.5 text-slate-700 truncate max-w-[150px]">
                  {feature.attributes?.[col.field] != null ? String(feature.attributes[col.field]) : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-slate-400 mt-2 text-center">
        Showing {features.length} results - click a row to zoom on map
      </p>
    </div>
  );
}

/**
 * Metadata Viewer Component - shows SQL query and interpretation
 */
function MetadataViewer({ metadata, colors }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!metadata || (!metadata.whereClause && !metadata.interpretation)) {
    return null;
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
        <span>Query Details</span>
        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {isExpanded && (
        <div className="mt-2 p-3 bg-slate-50 rounded-lg space-y-2">
          {metadata.interpretation && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
                <HelpCircle className="w-3.5 h-3.5" />
                Interpretation
              </div>
              <p className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-200">
                {metadata.interpretation}
              </p>
            </div>
          )}
          {metadata.whereClause && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
                <Database className="w-3.5 h-3.5" />
                SQL Query
              </div>
              <code className="block text-xs text-slate-700 bg-white p-2 rounded border border-slate-200 font-mono overflow-x-auto">
                WHERE {metadata.whereClause}
              </code>
            </div>
          )}
          <div className="text-xs text-slate-400">
            Query type: {metadata.queryType || 'unknown'}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Help Media Display - shows images/videos from help docs
 */
function HelpMediaDisplay({ media }) {
  if (!media || media.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {media.map((item, idx) => (
        <div key={idx} className="rounded-lg overflow-hidden border border-slate-200">
          {item.type === 'image' ? (
            <div>
              <img
                src={item.url}
                alt={item.title || 'Help image'}
                className="w-full max-h-64 object-contain bg-slate-100"
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
                className="w-full max-h-64"
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
  );
}

/**
 * Message Bubble Component with embedded map support
 */
function MessageBubble({
  message,
  botAvatar,
  colors,
  onViewMap,
  onViewTable,
  onExportCSV,
  onExportShapefile,
  onExportPDF,
  onRowClick,
  onOpenInMap,
  tableColumns,
  searchFields,
  themeColor,
  isMobile,
  enabledModes,
  onExitHelpMode,
  exportOptions = {}  // Export options configuration
}) {
  // Mobile tab state for results with map
  const [activeTab, setActiveTab] = useState('details');
  // Ref for the inset mini map to enable zoom-to-feature
  const miniMapRef = useRef(null);

  // Handle row click - zoom to feature on inset map (not main map)
  const handleRowClickOnInsetMap = useCallback((feature) => {
    if (feature && miniMapRef.current?.zoomToFeature) {
      // Zoom to feature on the inset map
      miniMapRef.current.zoomToFeature(feature);
      // On mobile, switch to map tab to show the zoomed feature
      if (isMobile) {
        setActiveTab('map');
      }
    }
  }, [isMobile]);

  if (message.type === 'user') {
    return (
      <div className="flex justify-end">
        <div
          className="text-white p-4 rounded-2xl rounded-tr-none shadow-sm max-w-[85%] md:max-w-[70%]"
          style={{ backgroundColor: colors.bg600 }}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  if (message.type === 'error') {
    return (
      <div className="flex gap-3 md:gap-4">
        <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-red-100 border border-red-200 flex-shrink-0 flex items-center justify-center">
          <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-red-600" />
        </div>
        <div className="bg-red-50 p-4 rounded-2xl rounded-tl-none shadow-sm border border-red-200 max-w-[85%] md:max-w-[70%]">
          <p className="text-sm text-red-800">{message.content}</p>
        </div>
      </div>
    );
  }

  // Check if this is a help response
  if (message.isHelpResponse) {
    return (
      <div className="flex gap-3 md:gap-4">
        <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white border border-slate-200 shadow-md flex-shrink-0 flex items-center justify-center overflow-hidden p-1">
          {botAvatar ? (
            <img src={botAvatar} alt="AI" className="w-full h-full object-contain" />
          ) : (
            <div
              className="w-full h-full rounded-full flex items-center justify-center"
              style={{ backgroundColor: colors.bg100 }}
            >
              <BookOpen className="w-4 h-4 md:w-5 md:h-5" style={{ color: colors.text600 }} />
            </div>
          )}
        </div>
        <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-200 max-w-[85%] md:max-w-[80%]">
          <div className="text-sm text-slate-700 prose prose-sm" dangerouslySetInnerHTML={{
            __html: message.content
              .replace(/\n/g, '<br>')
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          }} />

          {/* Help media */}
          <HelpMediaDisplay media={message.helpMedia} />

          {/* Exit Help Mode button */}
          {onExitHelpMode && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <button
                onClick={onExitHelpMode}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition"
              >
                <X className="w-4 h-4" />
                Exit Help Mode
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Check if this is a location message (from geocoder autocomplete)
  if (message.isLocationMessage && message.location) {
    // Create a point feature for the mini map
    const locationFeature = {
      geometry: {
        x: message.location.lng,
        y: message.location.lat,
        spatialReference: { wkid: 4326 }
      },
      attributes: {
        address: message.location.formatted
      }
    };

    return (
      <div className="flex gap-3 md:gap-4">
        <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white border border-slate-200 shadow-md flex-shrink-0 flex items-center justify-center overflow-hidden p-1">
          {botAvatar ? (
            <img src={botAvatar} alt="AI" className="w-full h-full object-contain" />
          ) : (
            <div
              className="w-full h-full rounded-full flex items-center justify-center"
              style={{ backgroundColor: colors.bg100 }}
            >
              <MapPin className="w-4 h-4 md:w-5 md:h-5" style={{ color: colors.text600 }} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 max-w-[85%] md:max-w-[70%]">
          <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-200">
            <div className="text-sm text-slate-700 prose prose-sm" dangerouslySetInnerHTML={{
              __html: message.content
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            }} />

            {/* Mini map showing the location */}
            <div className="mt-3">
              <ChatMiniMap
                features={[locationFeature]}
                themeColor={themeColor}
                height={200}
              />
            </div>

            {/* Open in Map button */}
            {enabledModes?.includes('map') && onOpenInMap && (
              <div className="mt-3">
                <button
                  onClick={() => onOpenInMap(message.location)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition"
                  style={{ backgroundColor: colors.bg50, color: colors.text700 }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = colors.bg100}
                  onMouseLeave={(e) => e.target.style.backgroundColor = colors.bg50}
                >
                  <Map className="w-4 h-4" />
                  Open in Map
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Check if this message has features to show on map
  const hasFeatures = message.features || message.feature;
  const featureArray = message.features || (message.feature ? [message.feature] : []);
  const showMap = hasFeatures && enabledModes?.includes('map');

  return (
    <div className="flex gap-3 md:gap-4">
      <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white border border-slate-200 shadow-md flex-shrink-0 flex items-center justify-center overflow-hidden p-1">
        {botAvatar ? (
          <img src={botAvatar} alt="AI" className="w-full h-full object-contain" />
        ) : (
          <div
            className="w-full h-full rounded-full flex items-center justify-center"
            style={{ backgroundColor: colors.bg100 }}
          >
            <HelpCircle className="w-4 h-4 md:w-5 md:h-5" style={{ color: colors.text600 }} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 max-w-[85%] md:max-w-none">
        <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-200">
          <div className="text-sm text-slate-700 prose prose-sm" dangerouslySetInnerHTML={{
            __html: message.content
              .replace(/\n/g, '<br>')
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          }} />

          {/* Single result: show details with map */}
          {message.showDetails && message.feature && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              {/* Mobile: Tabs for Details/Map */}
              {isMobile && showMap ? (
                <>
                  <div className="flex border-b border-slate-200 mb-3">
                    <button
                      onClick={() => setActiveTab('details')}
                      className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'details'
                          ? 'border-b-2 text-slate-800'
                          : 'text-slate-500'
                      }`}
                      style={activeTab === 'details' ? { borderColor: colors.bg600 } : {}}
                    >
                      Details
                    </button>
                    <button
                      onClick={() => setActiveTab('map')}
                      className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'map'
                          ? 'border-b-2 text-slate-800'
                          : 'text-slate-500'
                      }`}
                      style={activeTab === 'map' ? { borderColor: colors.bg600 } : {}}
                    >
                      Map
                    </button>
                  </div>
                  {activeTab === 'details' ? (
                    <FeatureDetails feature={message.feature} colors={colors} tableColumns={tableColumns} searchFields={searchFields} />
                  ) : (
                    <ChatMiniMap
                      features={[message.feature]}
                      themeColor={themeColor}
                      height={200}
                    />
                  )}
                </>
              ) : (
                /* Desktop: Side by side layout - map matches details height */
                <div className={`${showMap ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}`}>
                  <div>
                    <FeatureDetails feature={message.feature} colors={colors} tableColumns={tableColumns} searchFields={searchFields} />
                  </div>
                  {showMap && (
                    <div className="min-h-[200px]">
                      <ChatMiniMap
                        features={[message.feature]}
                        themeColor={themeColor}
                        height="100%"
                        onViewInMap={null}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="mt-3 flex gap-2 flex-wrap">
                <button
                  onClick={() => onViewMap(message.feature)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition"
                  style={{ backgroundColor: colors.bg50, color: colors.text700 }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = colors.bg100}
                  onMouseLeave={(e) => e.target.style.backgroundColor = colors.bg50}
                >
                  <Map className="w-4 h-4" />
                  View in Map
                </button>
                {exportOptions.pdf !== false && (
                  <button
                    onClick={() => onExportPDF?.(message.feature)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition"
                    style={{ backgroundColor: colors.bg50, color: colors.text700 }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = colors.bg100}
                    onMouseLeave={(e) => e.target.style.backgroundColor = colors.bg50}
                  >
                    <FileText className="w-4 h-4" />
                    Export PDF
                  </button>
                )}
              </div>

              {/* Metadata viewer */}
              {message.searchMetadata && (
                <MetadataViewer metadata={message.searchMetadata} colors={colors} />
              )}
            </div>
          )}

          {/* Multiple results: show table preview with map */}
          {message.showResultActions && message.features && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              {/* Mobile: Tabs for Details/Map */}
              {isMobile && showMap ? (
                <>
                  <div className="flex border-b border-slate-200 mb-3">
                    <button
                      onClick={() => setActiveTab('details')}
                      className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'details'
                          ? 'border-b-2 text-slate-800'
                          : 'text-slate-500'
                      }`}
                      style={activeTab === 'details' ? { borderColor: colors.bg600 } : {}}
                    >
                      Results
                    </button>
                    <button
                      onClick={() => setActiveTab('map')}
                      className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'map'
                          ? 'border-b-2 text-slate-800'
                          : 'text-slate-500'
                      }`}
                      style={activeTab === 'map' ? { borderColor: colors.bg600 } : {}}
                    >
                      Map
                    </button>
                  </div>
                  {activeTab === 'details' ? (
                    <ResultsTable features={message.features} tableColumns={tableColumns} searchFields={searchFields} colors={colors} onRowClick={handleRowClickOnInsetMap} />
                  ) : (
                    <ChatMiniMap
                      ref={miniMapRef}
                      features={message.features}
                      themeColor={themeColor}
                      height={200}
                    />
                  )}
                </>
              ) : (
                /* Desktop: Side by side layout - table 3/4, map 1/4 */
                <div className={`${showMap ? 'grid grid-cols-1 md:grid-cols-4 gap-4' : ''}`}>
                  <div className={showMap ? 'md:col-span-3' : ''}>
                    <ResultsTable features={message.features} tableColumns={tableColumns} searchFields={searchFields} colors={colors} onRowClick={handleRowClickOnInsetMap} />
                  </div>
                  {showMap && (
                    <div className="min-h-[200px] md:col-span-1">
                      <ChatMiniMap
                        ref={miniMapRef}
                        features={message.features}
                        themeColor={themeColor}
                        height="100%"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="mt-3 flex gap-2 flex-wrap">
                <button
                  onClick={() => onViewMap(message.features)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition"
                  style={{ backgroundColor: colors.bg50, color: colors.text700 }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = colors.bg100}
                  onMouseLeave={(e) => e.target.style.backgroundColor = colors.bg50}
                >
                  <Map className="w-4 h-4" />
                  View on Map
                </button>
                <button
                  onClick={() => onViewTable(message.features)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition"
                  style={{ backgroundColor: colors.bg50, color: colors.text700 }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = colors.bg100}
                  onMouseLeave={(e) => e.target.style.backgroundColor = colors.bg50}
                >
                  <Table2 className="w-4 h-4" />
                  View in Table
                </button>
                {exportOptions.csv !== false && (
                  <button
                    onClick={onExportCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition"
                    style={{ backgroundColor: colors.bg50, color: colors.text700 }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = colors.bg100}
                    onMouseLeave={(e) => e.target.style.backgroundColor = colors.bg50}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Export CSV
                  </button>
                )}
                {exportOptions.shp !== false && (
                  <button
                    onClick={onExportShapefile}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition"
                    style={{ backgroundColor: colors.bg50, color: colors.text700 }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = colors.bg100}
                    onMouseLeave={(e) => e.target.style.backgroundColor = colors.bg50}
                  >
                    <FileArchive className="w-4 h-4" />
                    Export Shapefile
                  </button>
                )}
              </div>

              {/* Metadata viewer */}
              {message.searchMetadata && (
                <MetadataViewer metadata={message.searchMetadata} colors={colors} />
              )}
            </div>
          )}

          {/* No results: show query details */}
          {message.showNoResults && message.searchMetadata && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <MetadataViewer metadata={message.searchMetadata} colors={colors} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Feature Details Component - uses tableColumns with chatResults: true, displaying headerName instead of field name
 */
function FeatureDetails({ feature, colors, tableColumns, searchFields }) {
  const attrs = feature.attributes || {};

  // Priority: tableColumns with chatResults: true > all tableColumns > auto-generated
  let displayFields;

  // First, check for tableColumns with chatResults enabled
  const chatResultsColumns = tableColumns?.filter(col => col.chatResults === true) || [];

  if (chatResultsColumns.length > 0) {
    // Use columns marked for chat results
    displayFields = chatResultsColumns
      .filter(col => attrs[col.field] != null)
      .map(col => ({
        key: col.field,
        label: col.headerName || col.field,
        value: attrs[col.field]
      }));
  } else if (tableColumns && tableColumns.length > 0) {
    // Fall back to all tableColumns if no chatResults columns configured
    displayFields = tableColumns
      .filter(col => attrs[col.field] != null)
      .map(col => ({
        key: col.field,
        label: col.headerName || col.field,
        value: attrs[col.field]
      }));
  } else {
    // Fallback to auto-generated from attributes
    displayFields = Object.entries(attrs)
      .filter(([k, v]) => !k.startsWith('_') && v != null && k !== 'OBJECTID' && k !== 'Shape__Area' && k !== 'Shape__Length')
      .slice(0, 8)
      .map(([key, value]) => ({
        key,
        label: key.replace(/_/g, ' '),
        value
      }));
  }

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      {displayFields.map(({ key, label, value }) => (
        <div key={key}>
          <dt className="text-xs font-medium text-slate-500 uppercase">{label}</dt>
          <dd className="text-slate-800">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default ChatView;
