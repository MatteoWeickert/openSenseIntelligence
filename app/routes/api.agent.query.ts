import { z } from 'zod'
import { StandardResponse } from '~/lib/responses'
import { validateFilters, type FilterParams } from '~/lib/map-filter-params'

const RequestSchema = z.object({
	query: z.string().min(3).max(500),
	language: z.enum(['en', 'de']).default('en'),
	history: z
		.array(z.object({ role: z.string(), content: z.string() }))
		.optional(),
	session_id: z.string().uuid().optional(),
})

type MapAction = {
	type: 'flyTo'
	longitude: number
	latitude: number
	zoom: number
}

export type AgentStep = {
	agent: string
	summary: string
}

export type AgentResponse = {
	answer: string
	filters: FilterParams
	mapActions: MapAction[]
	resultDeviceIds: string[]
	agentUsed: string
	steps?: AgentStep[]
	confidence?: number
	sessionId?: string
}

const MOCK_RESPONSE: AgentResponse = {
	answer: 'Found active outdoor devices in Germany reporting temperature data.',
	filters: { status: ['active'], exposure: ['outdoor'] },
	mapActions: [{ type: 'flyTo', longitude: 10.45, latitude: 51.16, zoom: 5 }],
	resultDeviceIds: [],
	agentUsed: 'mock',
	steps: [],
	confidence: 1.0,
}

export const action = async ({ request }: { request: Request }) => {
	if (request.method !== 'POST') {
		return StandardResponse.methodNotAllowed('POST only')
	}

	let body: unknown
	try {
		body = await request.json()
	} catch {
		return StandardResponse.badRequest('Invalid JSON body')
	}

	const parsed = RequestSchema.safeParse(body)
	if (!parsed.success) {
		return StandardResponse.badRequest(parsed.error.message)
	}

	const { query, language, history, session_id } = parsed.data
	const agentApiUrl = process.env.AGENT_API_URL

	if (!agentApiUrl) {
		return StandardResponse.ok(MOCK_RESPONSE)
	}

	const requestId = crypto.randomUUID()
	const t0 = performance.now()

	try {
		const upstream = await fetch(`${agentApiUrl}/query`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Request-Id': requestId,
			},
			body: JSON.stringify({ query, language, history, session_id }),
			signal: AbortSignal.timeout(30_000),
		})

		const durationMs = Math.round(performance.now() - t0)

		if (!upstream.ok) {
			console.error(
				`[api.agent.query] request_id=${requestId} upstream=${upstream.status} duration_ms=${durationMs}`,
			)
			return StandardResponse.internalServerError('Agent service returned an error')
		}

		const data = (await upstream.json()) as {
			answer: string
			filters: unknown
			mapActions: MapAction[]
			resultDeviceIds: string[]
			agentUsed: string
			steps?: AgentStep[]
			confidence?: number
			requestId?: string
			sessionId?: string
		}

		const response: AgentResponse = {
			answer: data.answer ?? '',
			filters: validateFilters(data.filters),
			mapActions: Array.isArray(data.mapActions) ? data.mapActions : [],
			resultDeviceIds: Array.isArray(data.resultDeviceIds) ? data.resultDeviceIds : [],
			agentUsed: data.agentUsed ?? 'unknown',
			steps: Array.isArray(data.steps) ? data.steps : [],
			confidence: typeof data.confidence === 'number' ? data.confidence : undefined,
			sessionId: data.sessionId,
		}

		const upstreamRequestId = data.requestId ?? requestId
		console.log(
			`[api.agent.query] request_id=${upstreamRequestId} agent_used=${response.agentUsed} duration_ms=${durationMs} status=ok`,
		)

		return Response.json(response, {
			status: 200,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'X-Request-Id': upstreamRequestId,
			},
		})
	} catch (err) {
		const durationMs = Math.round(performance.now() - t0)
		if (err instanceof Error && err.name === 'TimeoutError') {
			console.error(
				`[api.agent.query] request_id=${requestId} timeout duration_ms=${durationMs}`,
			)
			return StandardResponse.internalServerError('Agent service timed out')
		}
		console.error(
			`[api.agent.query] request_id=${requestId} fetch_error duration_ms=${durationMs}`,
			err,
		)
		return StandardResponse.internalServerError('Failed to reach agent service')
	}
}
