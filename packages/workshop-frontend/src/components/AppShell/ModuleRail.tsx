import { createElement } from 'react'

/**
 * The shared platform navigation is served locally and registered by index.html.
 * The authenticated root reserves its width outside both the OS sidebar and workspace editor.
 */
export default function ModuleRail() {
  return createElement('greenhat-navigation', { 'current-app': 'os' })
}
