import type { Tab } from '@shared/data/cache/cacheValueTypes'

export interface TabCapabilities {
  /** Show a right-click context menu at all. */
  menu: boolean
  /** "Move to first" + drag-to-reorder, within the tab's own zone. */
  reorder: boolean
  /** Pin (normal) or unpin (pinned). */
  togglePin: boolean
  /** "Open in new window" (detach to its own window). */
  detach: boolean
  /** Close the tab (context-menu item + inline X). */
  close: boolean
  /** "Close other tabs" — every other normal tab; pinned tabs are exempt. */
  closeOthers: boolean
  /** "Close tabs to the right" — normal tabs after this one in the strip. */
  closeToRight: boolean
}

/**
 * Single source of truth for what a tab can do, derived from its zone and the
 * tab counts. Normal tabs can always be closed/pinned/detached; if the last tab
 * closes, TabsProvider opens Launchpad as the empty-state fallback. Pinned tabs
 * can be closed via the context menu (no inline X), and the batch close actions
 * only ever clear the normal zone — pinned tabs are exempt as close *targets*,
 * matching browser convention. Reordering is per-zone. `normalIndex` is the
 * tab's position within the normal zone — required to offer "close tabs to the
 * right"; for a pinned tab every normal tab counts as being to its right.
 */
export function getTabCapabilities(
  tab: Pick<Tab, 'id' | 'isPinned'>,
  ctx: { pinnedCount: number; normalCount: number; canDetach: boolean; normalIndex?: number }
): TabCapabilities {
  const detach = ctx.canDetach
  if (tab.isPinned) {
    const hasSiblings = ctx.pinnedCount > 1
    return {
      menu: true,
      reorder: hasSiblings,
      togglePin: true,
      detach,
      close: true,
      closeOthers: ctx.normalCount > 0,
      closeToRight: ctx.normalCount > 0
    }
  }
  const hasSiblings = ctx.normalCount > 1
  return {
    menu: true,
    reorder: hasSiblings,
    togglePin: true,
    detach,
    close: true,
    closeOthers: hasSiblings,
    closeToRight: ctx.normalIndex !== undefined && ctx.normalIndex < ctx.normalCount - 1
  }
}
