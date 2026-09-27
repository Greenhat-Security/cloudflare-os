// @vitest-environment jsdom
/* eslint-disable react/react-in-jsx-scope */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { TooltipProvider } from '@cloudflare/kumo'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>{children}</a>
  ),
}))

import ModuleRail from './ModuleRail'
import { GREENHAT_TOOLS_ORIGIN, MODULE_RAIL_ITEMS } from './moduleRailItems'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('ModuleRail', () => {
  let root: Root | undefined
  let container: HTMLDivElement | undefined

  afterEach(() => {
    act(() => root?.unmount())
    container?.remove()
  })

  it('lists the OS first as the current module and every other tool as a link to it', () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root!.render(<TooltipProvider><ModuleRail /></TooltipProvider>))

    const links = [...container.querySelectorAll<HTMLAnchorElement>('nav a')]
    expect(links.map((a) => a.getAttribute('aria-label'))).toEqual(MODULE_RAIL_ITEMS.map((i) => i.label))

    const [os, ...tools] = links
    expect(os.getAttribute('href')).toBe('/')
    expect(os.getAttribute('aria-current')).toBe('page')
    expect(tools.map((tool) => tool.getAttribute('href'))).toEqual([
      `${GREENHAT_TOOLS_ORIGIN}/daisy-notes`,
      'https://pm.greenhatsec.com',
      `${GREENHAT_TOOLS_ORIGIN}/greenbooks`,
      `${GREENHAT_TOOLS_ORIGIN}/greenspot`,
      `${GREENHAT_TOOLS_ORIGIN}/greentype`,
    ])
    expect(container.querySelector('[data-testid="module-rail-item-exponential"]')?.getAttribute('aria-label')).toBe('GreenPM')
    for (const tool of tools) {
      expect(tool.hasAttribute('aria-current')).toBe(false)
      expect(tool.querySelector('img')?.getAttribute('src')).toMatch(/^\/modules\//)
    }
  })
})
