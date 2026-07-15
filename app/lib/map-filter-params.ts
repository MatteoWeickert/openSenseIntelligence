export const FILTER_KEYS = ['status', 'exposure', 'tags', 'phenomenon'] as const
export type FilterKey = typeof FILTER_KEYS[number]
export type FilterParams = Partial<Record<FilterKey, string[]>>

export function serializeFilters(filters: FilterParams, base?: URLSearchParams): URLSearchParams {
	const params = new URLSearchParams(base)
	for (const key of FILTER_KEYS) {
		params.delete(key)
		const values = filters[key]
		if (values?.length) {
			params.set(key, values.join(','))
		}
	}
	return params
}

export function parseFilters(params: URLSearchParams): FilterParams {
	const result: FilterParams = {}
	for (const key of FILTER_KEYS) {
		const values = params
			.getAll(key)
			.flatMap((v) => v.split(','))
			.map((v) => v.trim())
			.filter(Boolean)
		if (values.length) {
			result[key] = values
		}
	}
	return result
}

export function validateFilters(raw: unknown): FilterParams {
	if (typeof raw !== 'object' || raw === null) return {}
	const obj = raw as Record<string, unknown>
	const result: FilterParams = {}
	for (const key of FILTER_KEYS) {
		const value = obj[key]
		if (Array.isArray(value)) {
			const strings = value.filter((v): v is string => typeof v === 'string')
			if (strings.length) result[key] = strings
		}
	}
	return result
}
