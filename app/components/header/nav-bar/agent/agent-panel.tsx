import { useContext, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useMap } from 'react-map-gl/maplibre'
import { Send } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { NavbarContext } from '..'

type AgentFilterParams = {
	status?: string[]
	exposure?: string[]
	tags?: string[]
}

type AgentMapAction = {
	type: 'flyTo'
	longitude: number
	latitude: number
	zoom: number
}

export type AgentResponse = {
	answer: string
	filters: AgentFilterParams
	mapActions: AgentMapAction[]
	resultDeviceIds: string[]
}

function getMockResponse(_query: string): AgentResponse {
	return {
		answer: 'Found active outdoor devices in Germany reporting temperature data.',
		filters: {
			status: ['active'],
			exposure: ['outdoor'],
		},
		mapActions: [{ type: 'flyTo', longitude: 10.45, latitude: 51.16, zoom: 5 }],
		resultDeviceIds: [],
	}
}

export default function AgentPanel() {
	const [query, setQuery] = useState('')
	const [response, setResponse] = useState<AgentResponse | null>(null)
	const [loading, setLoading] = useState(false)
	const [confirmed, setConfirmed] = useState(false)

	const [searchParams, setSearchParams] = useSearchParams()
	const { osem: map } = useMap()
	const { setOpen } = useContext(NavbarContext)

	const handleSubmit = () => {
		if (!query.trim()) return
		setLoading(true)
		setConfirmed(false)
		setTimeout(() => {
			setResponse(getMockResponse(query))
			setLoading(false)
		}, 600)
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			handleSubmit()
		}
	}

	const handleApply = () => {
		if (!response) return

		// Step 1.3 — write filters to URL params (same format as FilterPanel)
		const nextParams = new URLSearchParams(searchParams)
		nextParams.delete('status')
		nextParams.delete('exposure')
		nextParams.delete('tags')

		if (response.filters.status?.length) {
			nextParams.set('status', response.filters.status.join(','))
		}
		if (response.filters.exposure?.length) {
			nextParams.set('exposure', response.filters.exposure.join(','))
		}
		if (response.filters.tags?.length) {
			nextParams.set('tags', response.filters.tags.join(','))
		}

		setSearchParams(nextParams)

		// Step 1.4 — execute map actions
		for (const action of response.mapActions) {
			if (action.type === 'flyTo') {
				map?.flyTo({ center: [action.longitude, action.latitude], zoom: action.zoom })
			} else {
				console.warn('[AgentPanel] Unknown map action:', action)
			}
		}

		// Step 1.5 — brief confirmation then close panel
		setConfirmed(true)
		setTimeout(() => setOpen(false), 300)
	}

	const filterBadges = response
		? [
				...(response.filters.status?.map((v) => ({ label: `status: ${v}`, color: 'blue' })) ?? []),
				...(response.filters.exposure?.map((v) => ({ label: `exposure: ${v}`, color: 'green' })) ?? []),
				...(response.filters.tags?.map((v) => ({ label: `tag: ${v}`, color: 'zinc' })) ?? []),
			]
		: []

	return (
		<div className="py-2 dark:text-zinc-200">
			<div className="flex flex-col gap-2">
				<div className="flex gap-2">
					<textarea
						rows={2}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Ask a question about sensor data…"
						className="flex-1 resize-none rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm focus:border-black/20 focus:outline-none dark:border-white/10 dark:focus:border-white/20"
					/>
					<Button
						className="h-auto self-end rounded-md px-3 py-2"
						onClick={handleSubmit}
						disabled={loading || !query.trim()}
					>
						<Send className="h-4 w-4" />
					</Button>
				</div>

				{loading && (
					<p className="text-sm text-zinc-400 dark:text-zinc-500">Thinking…</p>
				)}

				{confirmed && (
					<p className="text-sm text-green-600 dark:text-green-400">Filters applied!</p>
				)}

				{response && !loading && !confirmed && (
					<div className="flex flex-col gap-3 rounded-md border border-black/5 bg-black/[0.02] p-3 dark:border-white/8 dark:bg-white/[0.03]">
						<p className="text-sm">{response.answer}</p>

						{filterBadges.length > 0 && (
							<div className="flex flex-wrap gap-1.5">
								{filterBadges.map(({ label, color }) => (
									<span
										key={label}
										className={
											color === 'blue'
												? 'rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
												: color === 'green'
													? 'rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300'
													: 'rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
										}
									>
										{label}
									</span>
								))}
							</div>
						)}

						<div className="flex justify-end gap-2 border-t border-black/5 pt-2 dark:border-white/10">
							<Button
								variant="outline"
								className="h-7 rounded-md px-2 text-xs"
								onClick={() => setResponse(null)}
							>
								Reset
							</Button>
							<Button
								className="h-7 rounded-md px-3 text-xs"
								onClick={handleApply}
							>
								Apply Filters
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
