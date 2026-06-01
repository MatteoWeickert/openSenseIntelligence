import { useState } from 'react'
import Search from '~/components/search'
import FilterPanel from './filter-panel'
import AgentPanel from './agent/agent-panel'
import { DeviceFeatureCollection } from '~/components/search/search-types'
import { cn } from '~/lib/utils'

interface NavBarHandlerProps {
	devices: DeviceFeatureCollection
	searchString: string
}

type ActiveTab = 'filter' | 'ask'

export default function NavbarHandler({
	devices,
	searchString,
}: NavBarHandlerProps) {
	const [activeTab, setActiveTab] = useState<ActiveTab>('filter')
	const isSearching = searchString.trim().length >= 2

	if (isSearching) {
		return <Search devices={devices} searchString={searchString} />
	}

	return (
		<div>
			<div className="mb-2 flex gap-1 border-b border-black/5 pb-2 dark:border-white/10">
				<button
					type="button"
					onClick={() => setActiveTab('filter')}
					className={cn(
						'rounded-md px-3 py-1 text-sm font-medium transition-colors',
						activeTab === 'filter'
							? 'bg-black/8 text-black dark:bg-white/12 dark:text-zinc-100'
							: 'text-zinc-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/8',
					)}
				>
					Filter
				</button>
				<button
					type="button"
					onClick={() => setActiveTab('ask')}
					className={cn(
						'rounded-md px-3 py-1 text-sm font-medium transition-colors',
						activeTab === 'ask'
							? 'bg-black/8 text-black dark:bg-white/12 dark:text-zinc-100'
							: 'text-zinc-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/8',
					)}
				>
					Ask
				</button>
			</div>

			{activeTab === 'filter' ? (
				<FilterPanel />
			) : (
				<AgentPanel />
			)}
		</div>
	)
}
