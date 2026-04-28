import { describe, it, expect } from 'vitest'
import {
  movementKindSchema,
  monthlyMovementsSummarySchema,
  createMovementInputSchema,
} from '../schemas/movementSchemas'

describe('movementKindSchema', () => {
  it.each(['income', 'expense', 'investment', 'transfer_in', 'transfer_out'])(
    'accepts kind "%s"',
    (kind) => {
      expect(movementKindSchema.parse(kind)).toBe(kind)
    }
  )

  it('rejects unknown kinds', () => {
    expect(() => movementKindSchema.parse('payday')).toThrow()
  })
})

describe('monthlyMovementsSummarySchema', () => {
  it('accepts a numeric summary', () => {
    const data = { income: 100, expense: 40, balance: 60 }
    expect(monthlyMovementsSummarySchema.parse(data)).toEqual(data)
  })

  it('rejects non-numeric values', () => {
    expect(() => monthlyMovementsSummarySchema.parse({ income: '100', expense: 40, balance: 60 })).toThrow()
  })

  it('rejects missing fields', () => {
    expect(() => monthlyMovementsSummarySchema.parse({ income: 100, expense: 40 })).toThrow()
  })
})

describe('createMovementInputSchema', () => {
  const validInput = {
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    account_id: '550e8400-e29b-41d4-a716-446655440001',
    kind: 'expense',
    amount: 12.5,
    date: '2026-04-25',
  }

  it('accepts a minimal valid input', () => {
    expect(createMovementInputSchema.parse(validInput)).toMatchObject(validInput)
  })

  it('rejects negative or zero amount', () => {
    expect(() => createMovementInputSchema.parse({ ...validInput, amount: 0 })).toThrow()
    expect(() => createMovementInputSchema.parse({ ...validInput, amount: -5 })).toThrow()
  })

  it('rejects non-uuid user_id', () => {
    expect(() => createMovementInputSchema.parse({ ...validInput, user_id: 'not-a-uuid' })).toThrow()
  })

  it('rejects unsupported kinds at create time (transfer_in is read-only)', () => {
    expect(() => createMovementInputSchema.parse({ ...validInput, kind: 'transfer_in' })).toThrow()
  })
})
