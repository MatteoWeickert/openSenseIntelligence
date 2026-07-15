import { describe, it, expect } from 'vitest'
import { serializeFilters, parseFilters, validateFilters } from './map-filter-params'

describe('serializeFilters', () => {
	it('sets filter keys from FilterParams', () => {
		const params = serializeFilters({ status: ['active'], exposure: ['outdoor'] })
		expect(params.get('status')).toBe('active')
		expect(params.get('exposure')).toBe('outdoor')
		expect(params.get('tags')).toBeNull()
	})

	it('joins multiple values with comma', () => {
		const params = serializeFilters({ status: ['active', 'inactive'] })
		expect(params.get('status')).toBe('active,inactive')
	})

	it('preserves non-filter params from base', () => {
		const base = new URLSearchParams('zoom=5&status=inactive')
		const params = serializeFilters({ status: ['active'] }, base)
		expect(params.get('zoom')).toBe('5')
		expect(params.get('status')).toBe('active')
	})

	it('clears filter keys absent from FilterParams', () => {
		const base = new URLSearchParams('status=active&exposure=outdoor')
		const params = serializeFilters({}, base)
		expect(params.get('status')).toBeNull()
		expect(params.get('exposure')).toBeNull()
	})

	it('returns empty URLSearchParams for empty filters and no base', () => {
		expect(serializeFilters({}).toString()).toBe('')
	})
})

describe('parseFilters', () => {
	it('parses comma-separated values', () => {
		const result = parseFilters(new URLSearchParams('status=active,inactive&exposure=outdoor'))
		expect(result.status).toEqual(['active', 'inactive'])
		expect(result.exposure).toEqual(['outdoor'])
	})

	it('trims whitespace from values', () => {
		const result = parseFilters(new URLSearchParams('status=active%2C+inactive'))
		expect(result.status).toEqual(['active', 'inactive'])
	})

	it('ignores unknown keys', () => {
		const result = parseFilters(new URLSearchParams('status=active&unknown=foo'))
		expect(result.status).toEqual(['active'])
		expect((result as Record<string, unknown>).unknown).toBeUndefined()
	})

	it('returns empty object for empty params', () => {
		expect(parseFilters(new URLSearchParams())).toEqual({})
	})

	it('round-trips through serializeFilters', () => {
		const original = { status: ['active'], exposure: ['outdoor'], tags: ['bike'] }
		const serialized = serializeFilters(original)
		const parsed = parseFilters(serialized)
		expect(parsed).toEqual(original)
	})
})

describe('validateFilters', () => {
	it('accepts valid FilterParams object', () => {
		const result = validateFilters({ status: ['active'], exposure: ['outdoor'] })
		expect(result.status).toEqual(['active'])
		expect(result.exposure).toEqual(['outdoor'])
	})

	it('strips unknown keys', () => {
		const result = validateFilters({ status: ['active'], foo: ['bar'] })
		expect(result.status).toEqual(['active'])
		expect((result as Record<string, unknown>).foo).toBeUndefined()
	})

	it('strips non-string values from arrays', () => {
		const result = validateFilters({ status: ['active', 123, null, true] })
		expect(result.status).toEqual(['active'])
	})

	it('ignores non-array values', () => {
		const result = validateFilters({ status: 'active' })
		expect(result.status).toBeUndefined()
	})

	it('returns empty object for null input', () => {
		expect(validateFilters(null)).toEqual({})
	})

	it('returns empty object for non-object input', () => {
		expect(validateFilters('string')).toEqual({})
		expect(validateFilters(42)).toEqual({})
		expect(validateFilters(undefined)).toEqual({})
	})
})
