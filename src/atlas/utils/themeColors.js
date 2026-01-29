// src/atlas/utils/themeColors.js
// Theme color utility for Atlas
// Converts Tailwind color names to actual CSS values
// Also supports custom hex codes (e.g., '#004E7C')
//
// This is needed because Tailwind purges dynamic class names like `bg-${color}-600`

/**
 * Color palette mapping Tailwind color names to actual hex/rgb values
 * These match Tailwind's default color palette
 */
export const COLOR_PALETTE = {
  sky: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },
  blue: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  indigo: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
  },
  purple: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
    800: '#6b21a8',
    900: '#581c87',
  },
  emerald: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
  },
  green: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  teal: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a',
  },
  amber: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  orange: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316',
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
  },
  rose: {
    50: '#fff1f2',
    100: '#ffe4e6',
    200: '#fecdd3',
    300: '#fda4af',
    400: '#fb7185',
    500: '#f43f5e',
    600: '#e11d48',
    700: '#be123c',
    800: '#9f1239',
    900: '#881337',
  },
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
};

/**
 * Check if a string is a valid hex color
 * @param {string} color - Color string to check
 * @returns {boolean} True if valid hex color
 */
export function isHexColor(color) {
  if (!color || typeof color !== 'string') return false;
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Convert hex color to RGB array
 * @param {string} hex - Hex color (e.g., '#0284c7')
 * @returns {number[]} RGB array [r, g, b]
 */
export function hexToRgbArray(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ];
  }
  return [14, 165, 233]; // Default sky-500
}

/**
 * Adjust a hex color's brightness
 * @param {string} hex - Base hex color
 * @param {number} percent - Positive = lighter, negative = darker
 * @returns {string} Adjusted hex color
 */
function adjustBrightness(hex, percent) {
  const [r, g, b] = hexToRgbArray(hex);
  
  const adjust = (val) => {
    const adjusted = Math.round(val + (percent > 0 ? (255 - val) : val) * (percent / 100));
    return Math.max(0, Math.min(255, adjusted));
  };
  
  const toHex = (val) => val.toString(16).padStart(2, '0');
  
  return `#${toHex(adjust(r))}${toHex(adjust(g))}${toHex(adjust(b))}`;
}

/**
 * Generate a color palette from a single hex color
 * @param {string} hex - Base hex color (will be used as 500/600)
 * @returns {object} Color palette object with shades 50-900
 */
function generatePaletteFromHex(hex) {
  return {
    50: adjustBrightness(hex, 90),
    100: adjustBrightness(hex, 80),
    200: adjustBrightness(hex, 60),
    300: adjustBrightness(hex, 40),
    400: adjustBrightness(hex, 20),
    500: hex,
    600: adjustBrightness(hex, -10),
    700: adjustBrightness(hex, -25),
    800: adjustBrightness(hex, -40),
    900: adjustBrightness(hex, -55),
  };
}

/**
 * Get a specific color shade
 * @param {string} colorName - Tailwind color name (e.g., 'sky', 'blue') or hex code
 * @param {number|string} shade - Color shade (50, 100, 200, ..., 900)
 * @returns {string} Hex color value
 */
export function getColor(colorName, shade = 500) {
  // If it's a hex color, generate palette from it
  if (isHexColor(colorName)) {
    const palette = generatePaletteFromHex(colorName);
    return palette[shade] || colorName;
  }
  
  const palette = COLOR_PALETTE[colorName] || COLOR_PALETTE.sky;
  return palette[shade] || palette[500];
}

/**
 * Get theme colors object for a given theme color name or hex code
 * @param {string} themeColor - Tailwind color name or hex code
 * @returns {object} Object with common color shades as CSS values
 */
export function getThemeColors(themeColor = 'sky') {
  let palette;
  
  // If it's a hex color, generate a palette from it
  if (isHexColor(themeColor)) {
    palette = generatePaletteFromHex(themeColor);
  } else {
    palette = COLOR_PALETTE[themeColor] || COLOR_PALETTE.sky;
  }
  
  return {
    // Background colors
    bg50: palette[50],
    bg100: palette[100],
    bg200: palette[200],
    bg500: palette[500],
    bg600: palette[600],
    bg700: palette[700],
    
    // Text colors
    text500: palette[500],
    text600: palette[600],
    text700: palette[700],
    
    // Border colors
    border200: palette[200],
    border300: palette[300],
    border500: palette[500],
    
    // For RGB values (useful for rgba())
    rgb500: hexToRgbString(palette[500]),
    rgb600: hexToRgbString(palette[600]),
  };
}

/**
 * Convert hex color to RGB string
 * @param {string} hex - Hex color (e.g., '#0284c7')
 * @returns {string} RGB values as "r, g, b"
 */
function hexToRgbString(hex) {
  const [r, g, b] = hexToRgbArray(hex);
  return `${r}, ${g}, ${b}`;
}

/**
 * Generate inline style object for themed components
 * @param {string} themeColor - Tailwind color name or hex code
 * @param {string} variant - Style variant ('primary', 'secondary', 'outline', 'ghost')
 * @returns {object} CSS style object
 */
export function getThemedStyles(themeColor = 'sky', variant = 'primary') {
  const colors = getThemeColors(themeColor);
  
  switch (variant) {
    case 'primary':
      return {
        backgroundColor: colors.bg600,
        color: '#ffffff',
        borderColor: colors.bg600,
      };
    case 'secondary':
      return {
        backgroundColor: colors.bg100,
        color: colors.text700,
        borderColor: colors.border200,
      };
    case 'outline':
      return {
        backgroundColor: 'transparent',
        color: colors.text600,
        borderColor: colors.border500,
      };
    case 'ghost':
      return {
        backgroundColor: 'transparent',
        color: colors.text600,
      };
    case 'header':
      return {
        backgroundColor: colors.bg700,
        color: '#ffffff',
      };
    default:
      return {};
  }
}

/**
 * Get CSS custom properties for theming
 * Can be applied to a container element to cascade theme colors down
 * @param {string} themeColor - Tailwind color name or hex code
 * @returns {object} CSS custom properties object
 */
export function getThemeCssVars(themeColor = 'sky') {
  const colors = getThemeColors(themeColor);
  
  return {
    '--theme-50': colors.bg50,
    '--theme-100': colors.bg100,
    '--theme-200': colors.bg200,
    '--theme-500': colors.bg500,
    '--theme-600': colors.bg600,
    '--theme-700': colors.bg700,
    '--theme-rgb-500': colors.rgb500,
    '--theme-rgb-600': colors.rgb600,
  };
}

export default {
  COLOR_PALETTE,
  isHexColor,
  hexToRgbArray,
  getColor,
  getThemeColors,
  getThemedStyles,
  getThemeCssVars,
};
