import { Link } from '@tanstack/react-router'
import { Hexagon } from '@phosphor-icons/react'
import { Tooltip } from '@cloudflare/kumo'
import SiteLogo from '../SiteLogo'
import { MODULE_RAIL_ITEMS, isActiveModuleRailItem, moduleRailItemClasses } from './moduleRailItems'

/**
 * The narrow strip of Green Hat modules at the far left of the app (Green Hat fork), ported from
 * greenhat_tools' `CoreModuleRail`: one 40px tile per tool, the current one outlined. It sits
 * outside the OS's own sidebar, so switching product is a different gesture from navigating
 * within this one. Desktop only, as in the tools; the phone drawer has no room for a second rail.
 */
export default function ModuleRail() {
  return (
    <aside
      aria-label="Green Hat modules"
      data-testid="module-rail"
      className="flex h-full w-14 shrink-0 flex-col items-center border-r border-kumo-line bg-kumo-recessed px-2 py-3"
    >
      <nav className="flex flex-col items-center gap-2">
        {MODULE_RAIL_ITEMS.map((item) => {
          const active = isActiveModuleRailItem(item)
          const tile = (
            <>
              {item.logo ? (
                <img src={item.logo} alt="" aria-hidden className="h-5 w-5 rounded-sm object-contain" />
              ) : (
                <SiteLogo size={20} className="rounded-sm">
                  <Hexagon size={20} weight="bold" className="text-kumo-brand" />
                </SiteLogo>
              )}
              <span className="sr-only">{item.label}</span>
            </>
          )
          const className = moduleRailItemClasses(active)
          return (
            <Tooltip key={item.id} content={item.label} side="right">
              {active ? (
                <Link
                  to="/"
                  aria-label={item.label}
                  aria-current="page"
                  data-testid={`module-rail-item-${item.id}`}
                  className={className}
                >
                  {tile}
                </Link>
              ) : (
                <a
                  href={item.href}
                  aria-label={item.label}
                  data-testid={`module-rail-item-${item.id}`}
                  className={className}
                >
                  {tile}
                </a>
              )}
            </Tooltip>
          )
        })}
      </nav>
    </aside>
  )
}
