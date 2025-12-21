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
  limit: number = 6
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
    // Prefix match (starts with)
    else if (normalizedName.startsWith(normalizedQuery)) {
      score = 0.8 + (normalizedQuery.length / normalizedName.length) * 0.1
    }
    // Substring match
    else if (normalizedName.includes(normalizedQuery)) {
      score = 0.6 + (normalizedQuery.length / normalizedName.length) * 0.1
    }
    // Fuzzy match (Levenshtein) - only if not a strong match yet
    else {
      const distance = levenshteinDistance(normalizedQuery, normalizedName)
      const maxLength = Math.max(normalizedQuery.length, normalizedName.length)
      if (maxLength > 0) {
        const similarity = 1 - (distance / maxLength)
        // Bonus for sharing tokens (e.g. "restau" vs "restaurantes") logic already covered partially by prefix/substring, 
        // but for typos this helps.
        if (similarity > 0.4) { // Only consider if reasonably similar
          score = similarity * 0.5 // Penalty for being fuzzy
        }
      }
    }

    return {
      category: cat,
      score,
      isStrongMatch: score >= 0.9
    }
  })

  // Filter by threshold and sort
  return suggestions
    .filter(s => s.score >= 0.4) // Threshold
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
