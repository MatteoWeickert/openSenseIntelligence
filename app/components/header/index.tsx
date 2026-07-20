import { Link } from 'react-router'
import Home from './home'
import Menu from './menu'
import NavBar from './nav-bar'
import { topbarSurface } from '~/components/map/topbar-styles'
import { cn } from '~/lib/utils'

interface HeaderProps {
	devices: any
}

export default function Header(props: HeaderProps) {
	return (
		<div className="items-top pointer-events-none fixed z-10 flex h-14 w-full justify-between gap-4 p-2">
			<div className="flex items-center gap-2">
				<Home />
				<Link
					to="/mcp"
					className={cn(
						topbarSurface({ shape: 'pill' }),
						'pointer-events-auto flex items-center gap-1.5 px-3 text-xs font-semibold text-green-700 dark:text-green-400',
					)}
				>
					<span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
					MCP
				</Link>
			</div>
			<NavBar devices={props.devices} />
			<div className="flex gap-2">
				<Menu devices={props.devices} />
			</div>
		</div>
	)
}
