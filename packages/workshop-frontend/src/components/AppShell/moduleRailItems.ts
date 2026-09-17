// The module rail's contents (Green Hat fork): the same list greenhat_tools shows in its
// `CoreModuleRail`, with the OS itself at the top and every other entry pointing at the tool's
// home on tools.greenhatsec.com. Kept as data so the rail component stays a plain list and a test
// can check the links without rendering logos.

/** Where Green Hat's other tools live. */
export const GREENHAT_TOOLS_ORIGIN = 'https://tools.greenhatsec.com'

export type ModuleRailItem = {
  id: string
  label: string
  href: string
  /** Path of the tile's logo under `public/`; null for the OS, which uses the deployment's own. */
  logo: string | null
}

export const MODULE_RAIL_ITEMS: ModuleRailItem[] = [
  { id: 'os', label: 'GreenhatOS', href: '/', logo: null },
  { id: 'daisy-notes', label: 'Daisy Notes', href: `${GREENHAT_TOOLS_ORIGIN}/daisy-notes`, logo: '/modules/daisy-notes.svg' },
  { id: 'exponential', label: 'Exponential', href: `${GREENHAT_TOOLS_ORIGIN}/exponential`, logo: '/modules/exponential.png' },
  { id: 'greenbooks', label: 'GreenBooks', href: `${GREENHAT_TOOLS_ORIGIN}/greenbooks`, logo: '/modules/greenbooks.png' },
  { id: 'greenspot', label: 'GreenSpot', href: `${GREENHAT_TOOLS_ORIGIN}/greenspot`, logo: '/modules/greenspot.png' },
  // Greentype ships as its own app; greenhat_tools' rail links there once its cutover flag is
  // set, and the in-app module answers the same path in the meantime.
  { id: 'greentype', label: 'Greentype', href: `${GREENHAT_TOOLS_ORIGIN}/greentype`, logo: '/modules/greentype.svg' },
]

/**
 * Whether a rail item is the one the viewer is in. Mirrors greenhat_tools: an absolute href belongs
 * to another deployment and is never active here, and the OS entry is active on every OS page.
 */
export function isActiveModuleRailItem(item: ModuleRailItem): boolean {
  return !/^https?:\/\//i.test(item.href)
}

/** The tile classes, in Kumo tokens so the rail follows the OS theme rather than the tools' mint. */
export function moduleRailItemClasses(active: boolean): string {
  return [
    'group flex h-10 w-10 items-center justify-center rounded-xl border transition-colors',
    active
      ? 'border-kumo-ring bg-kumo-fill shadow-sm'
      : 'border-transparent hover:border-kumo-line hover:bg-kumo-tint',
  ].join(' ')
}
