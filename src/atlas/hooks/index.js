// src/atlas/hooks/index.js
// Atlas hooks exports
export { 
  useAtlasConfig, 
  useActiveMap, 
  detectOrganizationId,
  getMapConfig,
  isPreviewDraftMode  // Check if in draft preview mode
} from './useAtlasConfig';
export { 
  useArcGISAuth 
} from './useArcGISAuth';
export {
  useExportArea  // Export area visualization hook for map exports
} from './useExportArea';