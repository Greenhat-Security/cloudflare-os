// @vitest-environment jsdom
/* eslint-disable react/react-in-jsx-scope */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import navigationSource from '../../../public/greenhat-navigation.js?raw'

import ModuleRail from './ModuleRail'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('ModuleRail', () => {
  let root: Root | undefined
  let container: HTMLDivElement | undefined

  beforeAll(() => {
    window.eval(navigationSource.replace(/^export const /m, 'const '))
  })

  afterEach(() => {
    act(() => root?.unmount())
    container?.remove()
  })

  it('uses the shared navigation and identifies GreenOS as its only current app', () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root!.render(<ModuleRail />))

    const navigation = container.querySelector('greenhat-navigation')!
    const content = navigation.shadowRoot ?? navigation
    const links = [...content.querySelectorAll<HTMLAnchorElement>('a[href]')]
    expect(links).toHaveLength(14)
    const current = links.filter((link) => link.getAttribute('aria-current') === 'page')
    expect(current).toHaveLength(1)
    expect(current[0].getAttribute('href')).toBe('/')
    expect(current[0].getAttribute('aria-label')).toBe('GreenOS')
    expect(links.some((link) => link.href === 'https://grc.greenhatsec.com/')).toBe(true)
    expect(links.some((link) => link.href === 'https://type.greenhatsec.com/')).toBe(true)
    expect(links.some((link) => link.href.includes('/greentype'))).toBe(false)
  })
})
