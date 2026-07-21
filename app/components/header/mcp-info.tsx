import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '~/lib/utils'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '../ui/dialog'

type Provider = 'chatgpt' | 'claude' | 'copilot'

interface McpInfoProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

export default function McpInfo({ open, onOpenChange }: McpInfoProps) {
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
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<span className="inline-block h-2 w-2 rounded-full bg-green-500" />
						MCP Server
					</DialogTitle>
					<DialogDescription>
						Connect openSenseMap to your favorite AI assistant. Search for
						boxes, explore sensor measurements and retrieve archive
						data through natural conversation.
					</DialogDescription>
				</DialogHeader>

				{/* Server URL */}
				<div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
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

				{/* Tools */}
				<div>
					<h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
						Available Tools
					</h3>
					<div className="grid gap-2 sm:grid-cols-2">
						<ToolCard name="search_boxes" description="Search for senseBoxes by location, name, phenomenon, or other criteria" />
						<ToolCard name="get_box_info" description="Get detailed information about a specific senseBox including its sensors" />
						<ToolCard name="get_sensor_data" description="Retrieve current or recent measurements from a sensor" />
						<ToolCard name="get_platform_stats" description="Get overall platform statistics (total boxes, measurements, etc.)" />
						<ToolCard name="archive_get_box_data" description="Access historical data for a senseBox from the archive" />
						<ToolCard name="archive_get_sensor_data" description="Retrieve archived measurements for a specific sensor" />
						<ToolCard name="opensensemap_api" description="Generic API access to any openSenseMap endpoint" />
						<ToolCard name="export_data" description="Export measurement data as downloadable CSV files" />
					</div>
				</div>

				{/* Provider Tabs */}
				<div>
					<h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
						Connect in Minutes
					</h3>
					<div className="mb-4 flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-zinc-700 dark:bg-zinc-800">
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

					<div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
						{activeProvider === 'chatgpt' && <ChatGptInstructions />}
						{activeProvider === 'claude' && <ClaudeInstructions />}
						{activeProvider === 'copilot' && (
							<CopilotInstructions serverUrl={serverUrl} />
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}

function ToolCard({ name, description }: { name: string; description: string }) {
	const [expanded, setExpanded] = useState(false)

	return (
		<button
			type="button"
			onClick={() => setExpanded(!expanded)}
			className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition hover:border-green-300 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-green-700"
		>
			<div className="flex items-center justify-between gap-2">
				<code className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/50 dark:text-green-400">
					{name}
				</code>
				<ChevronDown
					className={cn(
						'h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200',
						expanded && 'rotate-180',
					)}
				/>
			</div>
			{expanded && (
				<p className="mt-2 text-xs text-gray-600 dark:text-zinc-400">
					{description}
				</p>
			)}
		</button>
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
				'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition',
				active
				? 'bg-green-100 text-green-800 shadow-sm dark:bg-green-900/50 dark:text-green-400'
					: 'text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200',
			)}
		>
			{label}
		</button>
	)
}

function Step({
	n,
	children,
}: {
	n: number
	children: React.ReactNode
}) {
	return (
		<li className="flex gap-3">
			<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-800 dark:bg-green-900/50 dark:text-green-400">
				{n}
			</span>
			<span>{children}</span>
		</li>
	)
}

function ChatGptInstructions() {
	return (
		<ol className="space-y-3 text-sm text-gray-700 dark:text-zinc-300">
			<Step n={1}>
				In ChatGPT, go to{' '}
				<strong>Settings </strong> → Plugins → <strong>Developer mode</strong> and activate the toggle. 
			</Step>
			<Step n={2}>
				Back on the landing page on the left side click <strong>Plugins</strong>, and then click <strong>"+"</strong>.
			</Step>
			<Step n={3}>
				Paste the server URL above, name it <strong>"openSenseMap"</strong>, set authentication to <strong>None</strong>,
				and click Create.
			</Step>
			<Step n={4}>
				Enable the connector in a new chat, then try:{' '}
				<em>"Find me air quality sensors near Berlin"</em>
			</Step>
		</ol>
	)
}

function ClaudeInstructions() {
	return (
		<ol className="space-y-3 text-sm text-gray-700 dark:text-zinc-300">
			<Step n={1}>
				Open <strong>Claude Desktop</strong> or go to{' '}
				<strong>claude.ai</strong>.
			</Step>
			<Step n={2}>
				Go to <strong>Settings → Connectors</strong>, click{' '}
				<strong>"Add"</strong> and select <strong>"Add a custom connector"</strong>.
			</Step>
			<Step n={3}>
				Paste the server URL above and give it the name{' '}
				<strong>"openSenseMap"</strong>.
			</Step>
			<Step n={4}>
				Start a new conversation and try:{' '}
				<em>
					"What's the current temperature measured by sensors in Munich?"
				</em>
			</Step>
		</ol>
	)
}

function CopilotInstructions({ serverUrl }: { serverUrl: string }) {
	return (
		<ol className="space-y-3 text-sm text-gray-700 dark:text-zinc-300">
			<Step n={1}>
				Open your VS Code <strong>mcp.json</strong> (Ctrl+Shift+P →
				"MCP: Open User Configuration") for global usage
                or in your directory create a folder <strong>.vscode</strong> and a file <strong>mcp.json</strong> for local usage.
			</Step>
			<Step n={2}>Add the following MCP server configuration in this file:</Step>
			<li className="ml-9">
				<pre className="overflow-x-auto rounded-lg bg-gray-100 p-3 text-xs dark:bg-zinc-700">
					{JSON.stringify(
						{
							servers: {
								opensenseintelligence: {
									type: 'http',
									url: serverUrl,
								},
							},
						},
						null,
						2,
					)}
				</pre>
			</li>
            <Step n={3}>
                Click on the button <strong>"Start"</strong> that appears over the server's name to start the MCP server.
            </Step>
			<Step n={4}>
				Open Copilot Chat (Ctrl+Shift+I) and use Agent mode. The openSenseMap
				tools will be available automatically.
			</Step>
			<Step n={5}>
				Try:{' '}
				<em>"Search for senseBoxes measuring PM2.5 in Germany"</em>
			</Step>
		</ol>
	)
}
