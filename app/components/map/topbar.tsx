import { useState } from 'react'
import Home from '../header/home'
import McpInfo from '../header/mcp-info'
import Menu from '../header/menu'
import NavBar from '../header/nav-bar'
import Info from '../header/info'
import LanguageSelector from '../landing/header/language-selector'
import { TooltipProvider } from '../ui/tooltip'
import { topbarSurface } from './topbar-styles'
import { cn } from '~/lib/utils'

interface MapHeaderProps {
	devices: any
	measurementCount: number | undefined
	onHomeClick?: () => void
}

export default function MapHeader({
	devices,
	measurementCount,
	onHomeClick,
}: MapHeaderProps) {
	const [mcpOpen, setMcpOpen] = useState(false)

	return (
		<TooltipProvider>
			<header className="pointer-events-none absolute top-0 left-0 z-20 w-full">
				<div className="pointer-events-auto flex min-h-14 w-full items-start justify-between gap-4 px-3 py-2">
					<div className="flex items-center gap-3">
						<Home
							deviceCount={devices.features.length}
							measurementCount={measurementCount ?? 0}
							onHomeClick={onHomeClick}
						/>
						<button
							type="button"
							onClick={() => setMcpOpen(true)}
							className={cn(
								topbarSurface({ shape: 'pill' }),
								'pointer-events-auto flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm font-medium',
							)}
						>
							<span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
							MCP
						</button>
					</div>

					<div className="flex min-w-0 flex-1 justify-center">
						<NavBar devices={devices} />
					</div>

					<div className="flex shrink-0 items-center gap-4">
						<LanguageSelector />

						<div className="h-7 w-px bg-black/10 dark:bg-white/15" />

						<div className="flex items-center gap-2">
							<Info />
							<Menu devices={devices} />
						</div>
					</div>
				</div>
			</header>
			<McpInfo open={mcpOpen} onOpenChange={setMcpOpen} />
		</TooltipProvider>
	)
}
