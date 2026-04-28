// Category color utilities

// Default color palette for categories
export const categoryColorPalette = [
  '#818cf8', // Indigo
  '#34d399', // Emerald
  '#fbbf24', // Amber
  '#f87171', // Red
  '#60a5fa', // Blue
  '#a78bfa', // Violet
  '#fb923c', // Orange
  '#4ade80', // Green
]

/**
 * Get a color from the palette based on index (for new categories)
 */
export function getDefaultCategoryColor(index: number): string {
  return categoryColorPalette[index % categoryColorPalette.length]
}

/**
 * Calculate relative luminance of a hex color
 * Returns value between 0 (darkest) and 1 (lightest)
 */
export function getLuminance(hexColor: string): number {
  // Remove # if present
  const hex = hexColor.replace('#', '')
  
  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255
  
  // Simple luminance calculation
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/**
 * Determine if text should be light or dark based on background color
 */
export function getTextColorClass(bgColor: string | undefined | null): string {
  if (!bgColor) return 'category-pill--light'
  
  const luminance = getLuminance(bgColor)
  return luminance > 0.5 ? 'category-pill--light' : 'category-pill--dark'
}

/**
 * Get style object for a category pill with the given color
 */
export function getCategoryPillStyle(color: string | undefined | null): React.CSSProperties {
  return {
    backgroundColor: color || '#e0e7ff',
  }
}
