import { useState } from 'react'
import { Link } from 'react-router'
import { cn } from '~/lib/utils'

type Provider = 'chatgpt' | 'claude' | 'copilot'

export default function McpPage() {
	const [copied, setCopied] = useState(false)
	const [activeProvider, setActiveProvider] = useState<Provider>('chatgpt')

	const serverUrl =
		typeof window !== 'undefined'
			? `${window.location.origin}/mcp`
			: 'https://opensensemap.org/mcp'

	const copyUrl = () => {
		navigator.clipboard.writeText(serverUrl)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	return (
		<main className="min-h-screen bg-white dark:bg-zinc-900">
			{/* Header */}
			<header className="border-b border-gray-100 dark:border-zinc-800">
				<div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
					<Link to="/" className="flex items-center gap-3">
						<img
							src="/img/openSenseMap.png"
							alt="openSenseMap"
							className="h-8 w-auto"
						/>
					</Link>
					<Link
						to="/"
						className="text-sm text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200"
					>
						&larr; Back to Map
					</Link>
				</div>
			</header>

			{/* Hero */}
			<section className="py-20 text-center">
				<div className="mx-auto max-w-3xl px-6">
					<div className="mb-6 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-1.5 text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
						<span className="inline-block h-2 w-2 rounded-full bg-green-500" />
						MCP Server
					</div>
					<h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
						Access Environmental Data with your AI Agent
					</h1>
					<p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-zinc-400">
						Connect openSenseMap to your favorite AI assistant. Search sensor
						boxes, explore real-time measurements, and analyze environmental
						data — all through natural conversation.
					</p>
				</div>
			</section>

			{/* Features */}
			<section className="border-t border-gray-100 bg-gray-50 py-16 dark:border-zinc-800 dark:bg-zinc-800/50">
				<div className="mx-auto max-w-5xl px-6">
					<h2 className="mb-12 text-center text-2xl font-bold text-gray-900 dark:text-white">
						What your AI Agent can do
					</h2>
					<div className="grid gap-8 md:grid-cols-3">
						<FeatureCard
							title="Search Sensor Boxes"
							description="Find environmental sensors by location, phenomenon, or name. Discover thousands of citizen-science devices worldwide."
							icon="🔍"
						/>
						<FeatureCard
							title="Real-Time Measurements"
							description="Get the latest sensor readings — temperature, humidity, air quality, noise levels, and more — from any connected device."
							icon="📊"
						/>
						<FeatureCard
							title="Historical Data & Export"
							description="Access archived measurements, analyze trends over time, and export data in CSV format for further analysis."
							icon="📁"
						/>
					</div>
				</div>
			</section>

			{/* Tools */}
			<section className="border-t border-gray-100 py-16 dark:border-zinc-800">
				<div className="mx-auto max-w-5xl px-6">
					<h2 className="mb-12 text-center text-2xl font-bold text-gray-900 dark:text-white">
						Available Tools
					</h2>
					<div className="grid gap-4 md:grid-cols-2">
						<ToolCard
							name="search_boxes"
							description="Search for senseBoxes by location, name, phenomenon, or other criteria"
						/>
						<ToolCard
							name="get_box_info"
							description="Get detailed information about a specific senseBox including its sensors"
						/>
						<ToolCard
							name="get_sensor_data"
							description="Retrieve current or recent measurements from a sensor"
						/>
						<ToolCard
							name="get_platform_stats"
							description="Get overall platform statistics (total boxes, measurements, etc.)"
						/>
						<ToolCard
							name="archive_get_box_data"
							description="Access historical data for a senseBox from the archive"
						/>
						<ToolCard
							name="archive_get_sensor_data"
							description="Retrieve archived measurements for a specific sensor"
						/>
						<ToolCard
							name="opensensemap_api"
							description="Generic API access to any openSenseMap endpoint"
						/>
						<ToolCard
							name="export_data"
							description="Export measurement data as downloadable CSV files"
						/>
					</div>
				</div>
			</section>

			{/* Connect Section */}
			<section
				id="connect"
				className="border-t border-gray-100 bg-gray-50 py-16 dark:border-zinc-800 dark:bg-zinc-800/50"
			>
				<div className="mx-auto max-w-3xl px-6">
					<h2 className="mb-4 text-center text-2xl font-bold text-gray-900 dark:text-white">
						Connect in Minutes
					</h2>
					<p className="mb-8 text-center text-gray-600 dark:text-zinc-400">
						Add openSenseMap to your favorite AI assistant. Free, no
						authentication required.
					</p>

					{/* Server URL */}
					<div className="mb-8 rounded-xl border border-gray-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
						<label className="mb-2 block text-sm font-medium text-gray-500 dark:text-zinc-400">
							Server URL
						</label>
						<div className="flex items-center gap-2">
							<code className="flex-1 rounded-lg bg-gray-100 px-4 py-2.5 font-mono text-sm text-gray-900 dark:bg-zinc-700 dark:text-zinc-200">
								{serverUrl}
							</code>
							<button
								type="button"
								onClick={copyUrl}
								className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-700"
							>
								{copied ? 'Copied!' : 'Copy'}
							</button>
						</div>
					</div>

					{/* Provider Tabs */}
					<div className="mb-6 flex gap-2 rounded-lg border border-gray-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-800">
						<ProviderTab
							active={activeProvider === 'chatgpt'}
							onClick={() => setActiveProvider('chatgpt')}
							label="ChatGPT"
						/>
						<ProviderTab
							active={activeProvider === 'claude'}
							onClick={() => setActiveProvider('claude')}
							label="Claude"
						/>
						<ProviderTab
							active={activeProvider === 'copilot'}
							onClick={() => setActiveProvider('copilot')}
							label="VS Code Copilot"
						/>
					</div>

					{/* Instructions */}
					<div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
						{activeProvider === 'chatgpt' && <ChatGptInstructions />}
						{activeProvider === 'claude' && <ClaudeInstructions />}
						{activeProvider === 'copilot' && <CopilotInstructions />}
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="border-t border-gray-100 py-8 dark:border-zinc-800">
				<div className="mx-auto max-w-5xl px-6 text-center text-sm text-gray-500 dark:text-zinc-500">
					<p>
						openSenseMap &mdash; open citizen science platform for environmental
						data.
					</p>
					<div className="mt-2 flex justify-center gap-4">
						<Link to="/about" className="hover:text-gray-700 dark:hover:text-zinc-300">
							About
						</Link>
						<Link to="/docs" className="hover:text-gray-700 dark:hover:text-zinc-300">
							API Docs
						</Link>
						<Link to="/imprint" className="hover:text-gray-700 dark:hover:text-zinc-300">
							Imprint
						</Link>
						<Link to="/privacy" className="hover:text-gray-700 dark:hover:text-zinc-300">
							Privacy
						</Link>
					</div>
				</div>
			</footer>
		</main>
	)
}

function FeatureCard({
	title,
	description,
	icon,
}: {
	title: string
	description: string
	icon: string
}) {
	return (
		<div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
			<div className="mb-3 text-3xl">{icon}</div>
			<h3 className="mb-2 font-semibold text-gray-900 dark:text-white">
				{title}
			</h3>
			<p className="text-sm text-gray-600 dark:text-zinc-400">{description}</p>
		</div>
	)
}

function ToolCard({ name, description }: { name: string; description: string }) {
	return (
		<div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
			<code className="mt-0.5 shrink-0 rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/50 dark:text-green-400">
				{name}
			</code>
			<p className="text-sm text-gray-600 dark:text-zinc-400">{description}</p>
		</div>
	)
}

function ProviderTab({
	active,
	onClick,
	label,
}: {
	active: boolean
	onClick: () => void
	label: string
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				'flex-1 rounded-md px-4 py-2 text-sm font-medium transition',
				active
					? 'bg-green-600 text-white shadow-sm'
					: 'text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200',
			)}
		>
			{label}
		</button>
	)
}

function ChatGptInstructions() {
	return (
		<div>
			<h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
				Setup with ChatGPT
			</h3>
			<ol className="space-y-3 text-sm text-gray-700 dark:text-zinc-300">
				<li className="flex gap-3">
					<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-800 dark:bg-green-900/50 dark:text-green-400">
						1
					</span>
					<span>
						In ChatGPT, go to <strong>Settings → Apps & Connectors → Advanced settings</strong> and enable <strong>Developer mode</strong>.
					</span>
				</li>
				<li className="flex gap-3">
					<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-800 dark:bg-green-900/50 dark:text-green-400">
						2
					</span>
					<span>
						Back in Apps & Connectors, click <strong>"Create"</strong>.
					</span>
				</li>
				<li className="flex gap-3">
					<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-800 dark:bg-green-900/50 dark:text-green-400">
						3
					</span>
					<span>
						Paste the server URL above, name it <strong>"openSenseMap"</strong>, and click Create.
					</span>
				</li>
				<li className="flex gap-3">
					<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-800 dark:bg-green-900/50 dark:text-green-400">
						4
					</span>
					<span>
						Enable the connector in a new chat, then try: <em>"Find me air quality sensors near Berlin"</em>
					</span>
				</li>
			</ol>
		</div>
	)
}

function ClaudeInstructions() {
	return (
		<div>
			<h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
				Setup with Claude
			</h3>
			<ol className="space-y-3 text-sm text-gray-700 dark:text-zinc-300">
				<li className="flex gap-3">
					<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-800 dark:bg-green-900/50 dark:text-green-400">
						1
					</span>
					<span>
						Open <strong>Claude Desktop</strong> or go to{' '}
						<strong>claude.ai</strong>.
					</span>
				</li>
				<li className="flex gap-3">
					<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-800 dark:bg-green-900/50 dark:text-green-400">
						2
					</span>
					<span>
						Go to <strong>Settings → Integrations</strong> and click{' '}
						<strong>"Add Integration"</strong>.
					</span>
				</li>
				<li className="flex gap-3">
					<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-800 dark:bg-green-900/50 dark:text-green-400">
						3
					</span>
					<span>
						Paste the server URL above and give it the name{' '}
						<strong>"openSenseMap"</strong>.
					</span>
				</li>
				<li className="flex gap-3">
					<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-800 dark:bg-green-900/50 dark:text-green-400">
						4
					</span>
					<span>
						Start a new conversation and try:{' '}
						<em>"What's the current temperature measured by sensors in Munich?"</em>
					</span>
				</li>
			</ol>
		</div>
	)
}

function CopilotInstructions() {
	return (
		<div>
			<h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
				Setup with VS Code Copilot
			</h3>
			<ol className="space-y-3 text-sm text-gray-700 dark:text-zinc-300">
				<li className="flex gap-3">
					<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-800 dark:bg-green-900/50 dark:text-green-400">
						1
					</span>
					<span>
						Open your VS Code <strong>settings.json</strong> (Ctrl+Shift+P →
						"Preferences: Open User Settings (JSON)").
					</span>
				</li>
				<li className="flex gap-3">
					<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-800 dark:bg-green-900/50 dark:text-green-400">
						2
					</span>
					<span>
						Add the following MCP server configuration:
					</span>
				</li>
				<li className="ml-9">
					<pre className="overflow-x-auto rounded-lg bg-gray-100 p-3 text-xs dark:bg-zinc-700">
						{JSON.stringify(
							{
								'mcp': {
									servers: {
										openSenseMap: {
											type: 'http',
											url: 'https://opensensemap.org/mcp',
										},
									},
								},
							},
							null,
							2,
						)}
					</pre>
				</li>
				<li className="flex gap-3">
					<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-800 dark:bg-green-900/50 dark:text-green-400">
						3
					</span>
					<span>
						Open Copilot Chat (Ctrl+Shift+I) and use Agent mode. The openSenseMap tools will be available automatically.
					</span>
				</li>
				<li className="flex gap-3">
					<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-800 dark:bg-green-900/50 dark:text-green-400">
						4
					</span>
					<span>
						Try: <em>"Search for senseBoxes measuring PM2.5 in Germany"</em>
					</span>
				</li>
			</ol>
		</div>
	)
}
