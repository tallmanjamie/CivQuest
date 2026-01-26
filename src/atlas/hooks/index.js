// src/atlas/hooks/index.js
// Atlas hooks exports

export { 
  useAtlasConfig, 
  useActiveMap, 
  detectOrganizationId,
  getMapConfig,
  isPreviewDraftMode  // NEW: Check if in draft preview mode
} from './useAtlasConfig';

export { 
  useArcGISAuth 
} from './useArcGISAuth';