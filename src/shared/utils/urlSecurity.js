// src/shared/utils/urlSecurity.js
// Utility functions for ensuring URL security (HTTPS)

/**
 * Ensures a URL uses HTTPS protocol.
 * Upgrades HTTP URLs to HTTPS to prevent mixed content warnings on secure sites.
 *
 * @param {string} url - The URL to check and potentially upgrade
 * @returns {string|null} - The URL with HTTPS protocol, or null if invalid
 */
export function ensureHttps(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return null;
  }

  // If URL starts with http://, upgrade to https://
  if (trimmedUrl.toLowerCase().startsWith('http://')) {
    return 'https://' + trimmedUrl.slice(7);
  }

  // If URL starts with https://, return as-is
  if (trimmedUrl.toLowerCase().startsWith('https://')) {
    return trimmedUrl;
  }

  // If URL has no protocol (starts with // or just domain), prepend https://
  if (trimmedUrl.startsWith('//')) {
    return 'https:' + trimmedUrl;
  }

  // For URLs without any protocol, prepend https://
  // Only if it looks like a valid URL (contains a dot for domain)
  if (trimmedUrl.includes('.') && !trimmedUrl.includes(' ')) {
    return 'https://' + trimmedUrl;
  }

  // Return original if we can't determine the format
  return trimmedUrl;
}

/**
 * Checks if a URL is using HTTP (insecure) protocol.
 *
 * @param {string} url - The URL to check
 * @returns {boolean} - True if the URL uses HTTP protocol
 */
export function isHttpUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  return url.trim().toLowerCase().startsWith('http://');
}

/**
 * Checks if a URL is using HTTPS (secure) protocol.
 *
 * @param {string} url - The URL to check
 * @returns {boolean} - True if the URL uses HTTPS protocol
 */
export function isHttpsUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  return url.trim().toLowerCase().startsWith('https://');
}
