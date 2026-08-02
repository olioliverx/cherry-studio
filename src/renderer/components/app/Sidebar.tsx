import { Button, Dialog, DialogContent, DialogTitle, DialogTrigger, Tooltip } from '@cherrystudio/ui'
import { usePersistCache } from '@data/hooks/useCache'
import { usePreference } from '@data/hooks/usePreference'
import { arrayMove } from '@dnd-kit/sortable'
import { useTabs } from '@renderer/hooks/tab'
import useAvatar from '@renderer/hooks/useAvatar'
import { useMiniApps } from '@renderer/hooks/useMiniApps'
import { useSidebarFavorites } from '@renderer/hooks/useSidebarFavorites'
import { openSettingsTab } from '@renderer/services/mainWindowNavigation'
import { getDefaultRouteTitle } from '@renderer/utils/routeTitle'
import type { SidebarAppId } from '@renderer/utils/sidebar'
import {
  getSidebarFavoriteKey,
  getSidebarMenuPath,
  REQUIRED_SIDEBAR_FAVORITES,
  resolveSidebarActiveItem
} from '@renderer/utils/sidebar'
import { clearTabInstanceMetadata } from '@renderer/utils/tabInstanceMetadata'
import { PanelLeft } from 'lucide-react'
import type { Ref } from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SidebarShellActions } from '../layout/ShellTabBarActions'
import {
  getSidebarDisplayWidth,
  getSidebarLayout,
  normalizeSidebarWidth,
  Sidebar as UISidebar,
  type SidebarUser,
  type SidebarVisibleLayout,
  UserAvatar
} from '../Sidebar'
import UserPopup from '../UserPopup'
import { resolveSidebarEntry, type SidebarVariantContext } from './sidebarVariants'

const MINI_APP_ROUTE_PREFIX = '/app/mini-app/'
const REQUIRED_SIDEBAR_FAVORITE_SET = new Set<SidebarAppId>(REQUIRED_SIDEBAR_FAVORITES)

function getMiniAppIdFromUrl(url: string | undefined): string | undefined {
  if (!url?.startsWith(MINI_APP_ROUTE_PREFIX)) return undefined
  const appId = url.slice(MINI_APP_ROUTE_PREFIX.length).split(/[/?#]/, 1)[0]
  return appId || undefined
}

export type AppSidebarProps = {
  ref?: Ref<HTMLDivElement | null>
  /** Controlled open state for the hidden-layout navigation drawer (owned by AppShell). */
  drawerOpen?: boolean
  onDrawerOpenChange?: (open: boolean) => void
}

export default function Sidebar({ ref, drawerOpen = false, onDrawerOpenChange }: AppSidebarProps) {
  const { t } = useTranslation()
  const [userName] = usePreference('app.user.name')
  const { favorites, setAppPinned, removeMiniApp, reorderFavorites } = useSidebarFavorites()
  const { activeTab, updateTab, openTab } = useTabs()
  const { miniApps, pinned } = useMiniApps()
  const [defaultPaintingProvider] = usePreference('feature.paintings.default_provider')

  // Sidebar width — persisted across restarts. Dragging through the
  // intermediate 50-120px range uses a local preview width so the UI can
  // follow the cursor without persisting unstable widths.
  const [sidebarWidth, setSidebarWidth] = usePersistCache('ui.sidebar.width')
  const [previewSidebarWidth, setPreviewSidebarWidth] = useState<number | null>(null)
  const activeSidebarWidth = previewSidebarWidth ?? sidebarWidth
  const layout = getSidebarLayout(activeSidebarWidth)

  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', `${getSidebarDisplayWidth(activeSidebarWidth)}px`)
  }, [activeSidebarWidth])

  // Hidden layout exposes the bottom-left launcher; publish a bottom inset so
  // route-local scroll content can clear it. Icon/full layouts publish 0.
  // Own effect + cleanup so unmount does not leave a stale inset on :root.
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--shell-launcher-bottom-inset', layout === 'hidden' ? '48px' : '0px')
    return () => {
      document.documentElement.style.removeProperty('--shell-launcher-bottom-inset')
    }
  }, [layout])

  // Migration, not dead code: the resize path only persists normalized widths,
  // but older builds (three-state layout, default 65) persisted intermediate
  // values that must be collapsed once on load. Writing derived state back
  // cannot loop — normalizeSidebarWidth is idempotent and the write is guarded
  // by the inequality check. Skip while a drag preview is active so the
  // write-back does not clobber it.
  useEffect(() => {
    if (previewSidebarWidth !== null) return

    const normalizedWidth = normalizeSidebarWidth(sidebarWidth)
    if (normalizedWidth !== sidebarWidth) {
      setSidebarWidth(normalizedWidth)
    }
  }, [previewSidebarWidth, setSidebarWidth, sidebarWidth])

  // Close the drawer if the user expands the rail out of hidden layout while open.
  useEffect(() => {
    if (layout !== 'hidden' && drawerOpen) {
      onDrawerOpenChange?.(false)
    }
  }, [drawerOpen, layout, onDrawerOpenChange])

  // User avatar
  const avatar = useAvatar()
  const sidebarUser = useMemo<SidebarUser>(
    () => ({
      name: userName || t('chat.user', { defaultValue: t('export.user', { defaultValue: 'User' }) }),
      avatar: avatar || undefined,
      onClick: () => UserPopup.show()
    }),
    [avatar, t, userName]
  )
  const sidebarLogo = useMemo(
    () => (
      <button
        type="button"
        aria-label={sidebarUser.name}
        onClick={sidebarUser.onClick}
        className="flex h-full w-full items-center justify-center rounded-full [-webkit-app-region:no-drag]">
        <UserAvatar user={sidebarUser} className="h-full w-full" ring={false} />
      </button>
    ),
    [sidebarUser]
  )

  const closeDrawer = useCallback(() => {
    onDrawerOpenChange?.(false)
  }, [onDrawerOpenChange])

  // Menu items
  const pathname = activeTab?.url || '/'
  const activeMiniAppId = getMiniAppIdFromUrl(activeTab?.url)
  const openableMiniAppById = useMemo(() => {
    const appById = new Map<string, (typeof miniApps)[number]>()
    for (const app of miniApps) {
      appById.set(app.appId, app)
    }
    for (const app of pinned) {
      appById.set(app.appId, app)
    }
    return appById
  }, [miniApps, pinned])

  const handleRemoveSidebarFavorite = useCallback(
    (favorite: SidebarAppId) => {
      if (REQUIRED_SIDEBAR_FAVORITE_SET.has(favorite)) return
      setAppPinned(favorite, false)
    },
    [setAppPinned]
  )

  const activeItem = resolveSidebarActiveItem(pathname)

  const handleNavigate = useCallback(
    (menuItemId: string) => {
      const menuId = menuItemId as SidebarAppId
      const path = getSidebarMenuPath(menuId, defaultPaintingProvider)
      if (!path || activeTab?.url === path) return

      const title = getDefaultRouteTitle(path)

      if (activeTab?.isPinned) {
        openTab(path, { forceNew: true, title })
        return
      }

      if (activeTab) {
        updateTab(activeTab.id, {
          url: path,
          title,
          icon: undefined,
          metadata: clearTabInstanceMetadata(activeTab.metadata)
        })
        return
      }

      openTab(path, { forceNew: true, title })
    },
    [activeTab, updateTab, openTab, defaultPaintingProvider]
  )
  const handleOpenSettingsTab = useCallback(() => {
    openSettingsTab('/settings/provider')
    // Footer settings is a navigation action; close the modal drawer after accept.
    closeDrawer()
  }, [closeDrawer])

  const handleOpenMiniAppTab = useCallback(
    (appId: string) => {
      const app = openableMiniAppById.get(appId)
      if (!app) return

      const path = `${MINI_APP_ROUTE_PREFIX}${app.appId}`
      if (activeTab?.url === path) return

      const title = app.nameKey ? t(app.nameKey) : app.name
      // Uploaded logo → main-resolved `logoSrc`; preset key → `logo`.
      const icon = app.logoSrc ?? app.logo

      if (activeTab?.isPinned) {
        openTab(path, { forceNew: true, title, icon })
        return
      }

      if (activeTab) {
        updateTab(activeTab.id, {
          url: path,
          title,
          icon,
          metadata: clearTabInstanceMetadata(activeTab.metadata)
        })
        return
      }

      openTab(path, {
        forceNew: true,
        title,
        icon
      })
    },
    [activeTab, openableMiniAppById, openTab, t, updateTab]
  )

  // All per-type sidebar knowledge (icon, label, route, active-match, open, remove)
  // lives in the variant registry; the container only supplies the runtime context.
  const variantContext = useMemo<SidebarVariantContext>(
    () => ({
      t,
      defaultPaintingProvider,
      installedMiniApps: openableMiniAppById,
      isRequiredApp: (id) => REQUIRED_SIDEBAR_FAVORITE_SET.has(id),
      openApp: handleNavigate,
      openMiniApp: handleOpenMiniAppTab,
      removeApp: handleRemoveSidebarFavorite,
      removeMiniApp
    }),
    [
      t,
      defaultPaintingProvider,
      openableMiniAppById,
      handleNavigate,
      handleOpenMiniAppTab,
      handleRemoveSidebarFavorite,
      removeMiniApp
    ]
  )

  // One continuous list: built-in apps and mini apps interleaved in their stored
  // favorites order. Unrenderable rows (no route/icon, or an uninstalled mini app)
  // are dropped here but stay in the preference.
  const entries = useMemo(
    () => favorites.flatMap((favorite) => resolveSidebarEntry(favorite, variantContext) ?? []),
    [favorites, variantContext]
  )

  // A single drag reorders the whole mixed list. arrayMove yields the new entry
  // order; map each entry back to its favorite by key and persist. The sidebar owns
  // its order entirely through `ui.sidebar.favorites` and never touches order keys.
  const handleReorder = useCallback(
    ({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) => {
      const byKey = new Map(favorites.map((favorite) => [getSidebarFavoriteKey(favorite), favorite]))
      const nextFavorites = arrayMove(entries, oldIndex, newIndex).flatMap((entry) => {
        const favorite = byKey.get(entry.key)
        return favorite ? [favorite] : []
      })
      reorderFavorites(nextFavorites)
    },
    [entries, favorites, reorderFavorites]
  )

  // Common props shared between normal and floating sidebar
  const sidebarProps = {
    entries,
    active: { activeItem, activeTabId: activeMiniAppId },
    title: sidebarUser.name,
    logo: sidebarLogo,
    actions: (footerLayout: SidebarVisibleLayout) => (
      <SidebarShellActions layout={footerLayout} onSettingsClick={handleOpenSettingsTab} onTabSelect={closeDrawer} />
    ),
    onEntriesReorder: handleReorder
  }

  const drawerTitle = t('common.open_sidebar')
  const isHiddenLayout = layout === 'hidden'

  return (
    <div ref={ref} id="app-sidebar" data-ui="app.sidebar" className="relative h-full [-webkit-app-region:no-drag]">
      <UISidebar
        width={activeSidebarWidth}
        setWidth={setSidebarWidth}
        onResizePreview={setPreviewSidebarWidth}
        {...sidebarProps}
      />
      {isHiddenLayout && (
        <Dialog open={drawerOpen} onOpenChange={onDrawerOpenChange}>
          {/* Keep Trigger mounted through close so Radix restores focus to the launcher. */}
          <Tooltip
            content={drawerTitle}
            placement="right"
            delay={400}
            classNames={{ placeholder: 'absolute bottom-3 left-3 z-60' }}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={drawerTitle}
                className="size-8 rounded-lg border border-border/60 bg-background/80 text-muted-foreground shadow-sm backdrop-blur-md [-webkit-app-region:no-drag] hover:bg-accent hover:text-foreground">
                <PanelLeft size={16} strokeWidth={1.7} />
              </Button>
            </DialogTrigger>
          </Tooltip>
          <DialogContent
            aria-describedby={undefined}
            aria-modal={true}
            showCloseButton={false}
            motion="fade-scale"
            overlayClassName="bg-black/20"
            // Inline top beats DialogContent's default top-[50%] (tailwind-merge can keep both
            // utility classes; style always wins for the left-edge drawer geometry).
            style={{ top: 'var(--shell-content-top-inset)' }}
            className="data-[state=closed]:slide-out-to-left-2 data-[state=open]:slide-in-from-left-2 fixed right-auto bottom-0 left-0 z-[80] flex h-auto max-h-none w-43.5 max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none rounded-r-sm rounded-br-2xl border-0 bg-transparent p-0 shadow-none sm:max-w-none">
            <DialogTitle className="sr-only">{drawerTitle}</DialogTitle>
            <UISidebar
              width={activeSidebarWidth}
              setWidth={setSidebarWidth}
              isFloating
              onEntryOpen={closeDrawer}
              {...sidebarProps}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
