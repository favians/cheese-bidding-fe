import { toValue, type MaybeRefOrGetter } from 'vue'

// Map a session's raid/instance name to a theme key (mirrors V1 instanceThemeKey).
export function instanceThemeKey(name?: string | null) {
  const n = (name || '').toLowerCase()
  if (n.includes('karazhan')) return 'karazhan'
  if (n.includes('gruul') || n.includes('magtheridon')) return 'gruul-magtheridon'
  if (n.includes('serpentshrine')) return 'ssc'
  if (n.includes('tempest')) return 'tempestkeep'
  if (n.includes('black temple') || n.includes('blacktemple')) return 'blacktemple'
  if (n.includes('hyjal')) return 'hyjal'
  if (n.includes('sunwell')) return 'sunwell'
  return 'default'
}

// Reflect the session's raid theme onto <body data-instance-theme>. Themes.css
// swaps the accent + background + backdrop off that attribute. Reactive to the
// source (session title / primary instance), cleaned up when the page unmounts.
export function useInstanceTheme(source: MaybeRefOrGetter<string | undefined | null>) {
  if (!import.meta.client) return

  watchEffect(() => {
    document.body.dataset.instanceTheme = instanceThemeKey(toValue(source))
  })

  onBeforeUnmount(() => {
    delete document.body.dataset.instanceTheme
  })
}
