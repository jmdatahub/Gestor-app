import type { Category } from '../services/movementService'

export interface CategorySuggestion {
  category: Category
  score: number
  isStrongMatch: boolean
}

// Normalize text: lowercase, trim, remove diacritics
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

// Levenshtein distance implementation (lightweight)
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null))

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      )
    }
  }

  return matrix[b.length][a.length]
}

export function getCategorySuggestions(
  query: string, 
  categories: Category[], 
  limit: number = 8
): CategorySuggestion[] {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return []

  const suggestions = categories.map(cat => {
    const normalizedName = normalizeText(cat.name)
    let score = 0

    // Exact match
    if (normalizedName === normalizedQuery) {
      score = 1.0
    } 
    // Prefix match (starts with) - HIGHEST PRIORITY for partial typing
    else if (normalizedName.startsWith(normalizedQuery)) {
      // The more chars typed relative to name length, the better
      score = 0.85 + (normalizedQuery.length / normalizedName.length) * 0.15
    }
    // Contains the query anywhere in the name
    else if (normalizedName.includes(normalizedQuery)) {
      score = 0.65 + (normalizedQuery.length / normalizedName.length) * 0.15
    }
    // Check if any word in the name starts with the query
    else {
      const words = normalizedName.split(/\s+/)
      for (const word of words) {
        if (word.startsWith(normalizedQuery)) {
          score = 0.7 + (normalizedQuery.length / word.length) * 0.1
          break
        }
      }
    }
    
    // Fuzzy match (Levenshtein) - only if not matched yet and query is long enough
    if (score === 0 && normalizedQuery.length >= 3) {
      const distance = levenshteinDistance(normalizedQuery, normalizedName)
      const maxLength = Math.max(normalizedQuery.length, normalizedName.length)
      if (maxLength > 0) {
        const similarity = 1 - (distance / maxLength)
        if (similarity > 0.5) {
          score = similarity * 0.5
        }
      }
    }

    return {
      category: cat,
      score,
      isStrongMatch: score >= 0.9
    }
  })

  // Filter by minimum score (very low threshold for short queries)
  const threshold = normalizedQuery.length <= 2 ? 0.15 : 0.3
  
  return suggestions
    .filter(s => s.score >= threshold)
    .sort((a, b) => {
      // Sort by score desc
      if (Math.abs(b.score - a.score) > 0.01) return b.score - a.score
      // Then alphanumeric
      return a.category.name.localeCompare(b.category.name)
    })
    .slice(0, limit)
}

export function isStrongMatch(query: string, categoryName: string): boolean {
  const q = normalizeText(query)
  const c = normalizeText(categoryName)
  return q === c
}
