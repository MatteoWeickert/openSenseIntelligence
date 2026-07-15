import { useContext, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { useMap } from 'react-map-gl/maplibre'
import { ChevronDown, ChevronRight, Loader2, Send, Undo2 } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { NavbarContext } from '..'
import { serializeFilters, type FilterParams } from '~/lib/map-filter-params'

type AgentMapAction = {
	type: 'flyTo'
	longitude: number
	latitude: number
	zoom: number
}

type AgentStep = {
	agent: string
	summary: string
}

export type AgentResponse = {
	answer: string
	filters: FilterParams
	mapActions: AgentMapAction[]
	resultDeviceIds: string[]
	agentUsed: string
	steps?: AgentStep[]
	confidence?: number
	sessionId?: string
}

export default function AgentPanel() {
	const { t, i18n } = useTranslation('navbar')
	const [query, setQuery] = useState('')
	const [response, setResponse] = useState<AgentResponse | null>(null)
	const [loading, setLoading] = useState(false)
	const [confirmed, setConfirmed] = useState(false)
	const [showUndo, setShowUndo] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [stepsOpen, setStepsOpen] = useState(false)

	const [searchParams, setSearchParams] = useSearchParams()
	const { osem: map } = useMap()
	const { setOpen } = useContext(NavbarContext)

	const sessionIdRef = useRef<string>(crypto.randomUUID())
	const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const prevParamsRef = useRef<URLSearchParams | null>(null)

	const handleSubmit = async (overrideQuery?: string) => {
		const queryToSubmit = overrideQuery ?? query
		if (!queryToSubmit.trim()) return
		setQuery(queryToSubmit)
		setLoading(true)
		setConfirmed(false)
		setShowUndo(false)
		setError(null)
		setResponse(null)
		setStepsOpen(false)
		if (undoTimerRef.current) clearTimeout(undoTimerRef.current)

		try {
			const res = await fetch('/api/agent/query', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					query: queryToSubmit.trim(),
					language: i18n.language === 'de' ? 'de' : 'en',
					session_id: sessionIdRef.current,
				}),
			})

			if (!res.ok) {
				const text = await res.text().catch(() => '')
				throw new Error(`Agent returned ${res.status}${text ? `: ${text}` : ''}`)
			}

			const data = (await res.json()) as AgentResponse
			setResponse(data)
			if ((data.confidence ?? 1) < 0.7) {
				setStepsOpen(true)
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : t('agent.error.generic'),
			)
		} finally {
			setLoading(false)
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			handleSubmit()
		}
	}

	const handleApply = () => {
		if (!response) return

		prevParamsRef.current = new URLSearchParams(searchParams)
		setSearchParams(serializeFilters(response.filters, searchParams))

		for (const action of response.mapActions) {
			if (action.type === 'flyTo') {
				map?.flyTo({ center: [action.longitude, action.latitude], zoom: action.zoom })
			} else {
				console.warn('[AgentPanel] Unknown map action:', action)
			}
		}

		setConfirmed(true)
		setShowUndo(true)

		undoTimerRef.current = setTimeout(() => {
			setShowUndo(false)
			setOpen(false)
		}, 5000)
	}

	const handleUndo = () => {
		if (prevParamsRef.current) {
			setSearchParams(prevParamsRef.current)
			prevParamsRef.current = null
		}
		if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
		setShowUndo(false)
		setConfirmed(false)
	}

	const filterBadges = response
		? [
				...(response.filters.status?.map((v) => ({ label: `status: ${v}`, color: 'blue' })) ?? []),
				...(response.filters.exposure?.map((v) => ({ label: `exposure: ${v}`, color: 'green' })) ?? []),
				...(response.filters.tags?.map((v) => ({ label: `tag: ${v}`, color: 'zinc' })) ?? []),
				...(response.filters.phenomenon?.map((v) => ({ label: `phenomenon: ${v}`, color: 'blue' })) ?? []),
			]
		: []

	const hasApplyContent = Boolean(
		filterBadges.length > 0 || (response?.mapActions?.length ?? 0) > 0,
	)

	const isLowConfidence = (response?.confidence ?? 1) < 0.7
	const hasContent =
		response &&
		(response.answer || filterBadges.length > 0 || response.mapActions.length > 0)

	const suggestions = t('agent.suggestions', { returnObjects: true }) as string[]

	return (
		<div className="py-2 dark:text-zinc-200">
			<div className="flex flex-col gap-2">
				<div className="flex gap-2">
					<textarea
						rows={2}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder={t('agent.input.placeholder')}
						disabled={loading}
						className="flex-1 resize-none rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm focus:border-black/20 focus:outline-none disabled:opacity-50 dark:border-white/10 dark:focus:border-white/20"
					/>
					<Button
						className="h-auto self-end rounded-md px-3 py-2"
						onClick={() => handleSubmit()}
						disabled={loading || !query.trim()}
					>
						{loading ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Send className="h-4 w-4" />
						)}
					</Button>
				</div>

				{!loading && !response && !error && suggestions.length > 0 && (
					<div className="flex flex-wrap gap-1.5">
						{suggestions.map((suggestion) => (
							<button
								key={suggestion}
								type="button"
								onClick={() => handleSubmit(suggestion)}
								className="rounded-full border border-black/10 px-2.5 py-1 text-xs text-zinc-600 hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
							>
								{suggestion}
							</button>
						))}
					</div>
				)}

				{loading && (
					<p className="text-sm text-zinc-400 dark:text-zinc-500">{t('agent.loading')}</p>
				)}

				{confirmed && (
					<div className="flex items-center justify-between">
						<p className="text-sm text-green-600 dark:text-green-400">
							{t('agent.apply.confirmed')}
						</p>
						{showUndo && (
							<Button
								variant="outline"
								className="h-6 rounded px-2 text-xs"
								onClick={handleUndo}
							>
								<Undo2 className="mr-1 h-3 w-3" />
								{t('agent.undo.label')}
							</Button>
						)}
					</div>
				)}

				{error && !loading && (
					<div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/40 dark:bg-red-950/20">
						<p className="text-sm text-red-600 dark:text-red-400">{error}</p>
						<Button
							variant="outline"
							className="ml-3 h-6 rounded px-2 text-xs"
							onClick={() => handleSubmit()}
						>
							{t('agent.error.retry')}
						</Button>
					</div>
				)}

				{response && !loading && !confirmed && (
					<div className="flex max-h-[min(56vh,24rem)] flex-col gap-3 overflow-y-auto rounded-md border border-black/5 bg-black/[0.02] p-3 dark:border-white/8 dark:bg-white/[0.03]">
						{response.answer && (
							<div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&_strong]:font-semibold">
								<ReactMarkdown>{response.answer}</ReactMarkdown>
							</div>
						)}

						{!hasContent && (
							<p className="text-sm text-zinc-400 dark:text-zinc-500">
								{t('agent.empty')}
							</p>
						)}

						{isLowConfidence && (
							<p className="text-xs text-amber-600 dark:text-amber-400">
								{t('agent.lowConfidence')}
							</p>
						)}

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

						{response.steps && response.steps.length > 0 && (
							<div className="border-t border-black/5 pt-2 dark:border-white/10">
								<button
									type="button"
									onClick={() => setStepsOpen((o) => !o)}
									className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
								>
									{stepsOpen ? (
										<ChevronDown className="h-3 w-3" />
									) : (
										<ChevronRight className="h-3 w-3" />
									)}
									{t('agent.steps.label')}
								</button>
								{stepsOpen && (
									<ol className="mt-1.5 flex flex-col gap-1 pl-4">
										{response.steps.map((step, i) => (
											<li key={i} className="text-xs text-zinc-500 dark:text-zinc-400">
												<span className="font-medium text-zinc-600 dark:text-zinc-300">
													{step.agent}:
												</span>{' '}
												{step.summary}
											</li>
										))}
									</ol>
								)}
							</div>
						)}

						<div className="flex justify-end gap-2 border-t border-black/5 pt-2 dark:border-white/10">
							<Button
								variant="outline"
								className="h-7 rounded-md px-2 text-xs"
								onClick={() => setResponse(null)}
							>
								{t('agent.reset.label')}
							</Button>
							{hasApplyContent && (
								<Button
									className="h-7 rounded-md px-3 text-xs"
									onClick={handleApply}
								>
									{t('agent.apply.label')}
								</Button>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
