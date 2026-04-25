import { describe, it, expect } from 'vitest'
import { applySummaryDelta } from '../hooks/queries/useMovementMutations'

const base = { income: 1000, expense: 400, balance: 600 }

describe('applySummaryDelta', () => {
  it('returns prev unchanged when prev is undefined', () => {
    expect(applySummaryDelta(undefined, 'expense', 50, 1)).toBeUndefined()
  })

  it('adds an expense (sign = +1) to expense and subtracts from balance', () => {
    expect(applySummaryDelta(base, 'expense', 100, 1)).toEqual({
      income: 1000,
      expense: 500,
      balance: 500,
    })
  })

  it('removes an expense (sign = -1) when reverting an optimistic delete', () => {
    expect(applySummaryDelta(base, 'expense', 100, -1)).toEqual({
      income: 1000,
      expense: 300,
      balance: 700,
    })
  })

  it('adds an income (sign = +1) to income and balance', () => {
    expect(applySummaryDelta(base, 'income', 200, 1)).toEqual({
      income: 1200,
      expense: 400,
      balance: 800,
    })
  })

  it('does not touch summary for unknown kinds (e.g. investment)', () => {
    expect(applySummaryDelta(base, 'investment', 500, 1)).toEqual(base)
    expect(applySummaryDelta(base, 'transfer_in', 50, 1)).toEqual(base)
  })

  it('handles fractional amounts without floating-point drift on the simple cases', () => {
    expect(applySummaryDelta(base, 'income', 0.5, 1)).toEqual({
      income: 1000.5,
      expense: 400,
      balance: 600.5,
    })
  })
})
