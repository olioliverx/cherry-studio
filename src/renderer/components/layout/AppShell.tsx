import { useCommandHandler } from '@renderer/hooks/command'
import { useMainWindowNavigation, useTabs } from '@renderer/hooks/tab'
import { ipcApi, useIpcOn } from '@renderer/ipc'
import { isMac } from '@renderer/utils/platform'
import { getDefaultRouteTitle, isPageTitledRoute } from '@renderer/utils/routeTitle'
import { cn } from '@renderer/utils/style'
import { clearTabInstanceMetadata } from '@renderer/utils/tabInstanceMetadata'
import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import Sidebar from '../app/Sidebar'
import { createRecentRouteEntryFromTab, recordGlobalSearchRecentEntry } from '../GlobalSearch/globalSearchGroups'
import GlobalSearchPopup from '../GlobalSearch/GlobalSearchPopup'
import MiniAppTabsPool from '../MiniApp/MiniAppTabsPool'
import { ResourceViewSourceProvider } from '../ResourceViewSourceProvider'
import { useHasWindowControls, WindowControls } from '../WindowControls'
import { TabRouter } from './TabRouter'

/** ChatWise-style shell: no icon rail, no tab bar — all routes. */
export const AppShell = () => {
  const { tabs, activeTabId, updateTab } = useTabs()
  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeTabId), [activeTabId, tabs])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const receivedFullscreenEvent = useRef(false)
  const detectedWindowControls = useHasWindowControls()
  // Linux applies `frame` only when BrowserWindow is created, then relaunches
  // after this preference changes. Keep renderer chrome aligned to that frame
  // for the lifetime of this AppShell rather than reacting before relaunch.
  const hasWindowControls = useRef(detectedWindowControls).current

  const handleOpenGlobalSearch = useCallback(() => {
    void GlobalSearchPopup.show()
  }, [])

  useCommandHandler('app.search', handleOpenGlobalSearch)
  useMainWindowNavigation()

  // Subscribe before requesting the initial snapshot. A native transition that
  // races the request is newer and must win over its late response.
  useIpcOn('window.fullscreen_changed', (value) => {
    receivedFullscreenEvent.current = true
    setIsFullscreen(value)
  })

  useEffect(() => {
    if (!isMac && !hasWindowControls) return

    let cancelled = false
    void ipcApi
      .request('window.is_full_screen')
      .then((value) => {
        // A native event is newer than this mount-time snapshot. Never let a
        // late query response restore stale window chrome over that event.
        if (!cancelled && !receivedFullscreenEvent.current) {
          setIsFullscreen(value)
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [hasWindowControls])

  const recordRouteVisit = useCallback((tab: typeof activeTab, lastAccessTime = tab?.lastAccessTime) => {
    if (!tab) return

    const entry = createRecentRouteEntryFromTab(tab, lastAccessTime)
    if (!entry) return

    recordGlobalSearchRecentEntry(entry)
  }, [])

  useEffect(() => {
    recordRouteVisit(activeTab)
  }, [activeTab, recordRouteVisit])

  // Sync internal navigation back to tab state. For route-titled tabs we also
  // refresh the title and clear the per-entity icon (it was supplied for a
  // specific URL, e.g. a mini-app logo on /app/mini-app/<id>, and no longer
  // applies once the user navigates elsewhere inside the tab). Chat / agent
  // tabs are page-titled — their HomePage/AgentPage owns title + icon (topic /
  // session name + assistant / agent emoji), so we only sync the url and leave
  // title/icon alone, or navigating between topics would wipe them.
  const handleUrlChange = (tabId: string, url: string) => {
    const isPageTitled = isPageTitledRoute(url)
    const tab = tabs.find((candidate) => candidate.id === tabId)
    const patch = isPageTitled
      ? { url, lastAccessTime: Date.now() }
      : {
          url,
          title: getDefaultRouteTitle(url),
          icon: undefined,
          lastAccessTime: Date.now(),
          metadata: clearTabInstanceMetadata(tab?.metadata)
        }
    updateTab(tabId, patch)

    if (tab) {
      recordRouteVisit({ ...tab, ...patch }, Date.now())
    }
  }

  // AppShell owns the effective content-top inset on macOS non-fullscreen so
  // every route clears the traffic-light band once. It zeros chat-local reserves
  // under the main shell; detached windows publish their own value from SubWindowAppShell.
  const ownsContentTopInset = isMac && !isFullscreen
  const contentTopInsetValue = ownsContentTopInset ? 'var(--shell-titlebar-height)' : '0px'
  const localTopInsetValue = '0px'
  const shellGeometryStyle = {
    '--shell-content-top-inset': contentTopInsetValue,
    '--shell-local-top-inset': localTopInsetValue
  } as CSSProperties

  // Mirror geometry tokens onto :root so portaled drawers (Dialog) inherit the
  // same effective titlebar inset as in-tree route content.
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--shell-content-top-inset', contentTopInsetValue)
    document.documentElement.style.setProperty('--shell-local-top-inset', localTopInsetValue)
    return () => {
      document.documentElement.style.removeProperty('--shell-content-top-inset')
      document.documentElement.style.removeProperty('--shell-local-top-inset')
    }
  }, [contentTopInsetValue, localTopInsetValue])

  // Drawer open state lives here so main can take native `inert` while the
  // launcher/Dialog lifecycle stays in app/Sidebar.
  const [drawerOpen, setDrawerOpen] = useState(false)

  // The retired tab bar owned both the drag surface and renderer window controls
  // for frameless Windows/Linux. Keep that platform chrome as one shell-reserved
  // row: routes need no padding, and fullscreen/native-titlebar modes add nothing.
  const windowChrome = hasWindowControls && !isFullscreen && (
    <div
      data-ui="shell.window-chrome"
      inert={drawerOpen || undefined}
      className={cn(
        'relative isolate z-0 flex h-9 w-full shrink-0 items-stretch justify-end bg-background',
        drawerOpen ? '[-webkit-app-region:no-drag]' : '[-webkit-app-region:drag]'
      )}>
      <WindowControls hasWindowControls={hasWindowControls} />
    </div>
  )

  const contentArea = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <main
        data-ui="app.content"
        data-shell-content-top-inset={ownsContentTopInset ? 'titlebar' : 'none'}
        inert={drawerOpen || undefined}
        className="relative min-h-0 flex-1 overflow-hidden bg-background pt-(--shell-content-top-inset)">
        {/* Shared titlebar drag surface when AppShell owns the top inset.
            Height collapses to 0 when the token is 0 (non-mac / fullscreen).
            absolute + behind routes; not a catch-all drag on main. */}
        {ownsContentTopInset && (
          <div
            aria-hidden="true"
            data-testid="shell-content-top-drag-region"
            data-ui="shell.content-top-drag"
            className="pointer-events-auto absolute top-0 right-0 left-0 z-0 h-(--shell-content-top-inset) [-webkit-app-region:drag]"
          />
        )}
        {/* Route content sits above the drag strip. */}
        <div className="relative z-[1] flex h-full min-h-0 min-w-0 flex-col">
          <ResourceViewSourceProvider>
            {tabs
              .filter((t) => t.type === 'route' && !t.isDormant)
              .map((tab) => (
                <TabRouter
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  onUrlChange={(url) => handleUrlChange(tab.id, url)}
                />
              ))}
          </ResourceViewSourceProvider>
        </div>
        {/* MiniApp pool must stay a direct main child so its absolute top/height
            are relative to main's padding box (includes --shell-content-top-inset). */}
        <MiniAppTabsPool />
      </main>
    </div>
  )

  const contentColumn = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {windowChrome}
      {contentArea}
    </div>
  )
  const sidebar = <Sidebar drawerOpen={drawerOpen} onDrawerOpenChange={setDrawerOpen} />

  if (!isMac) {
    return (
      <div
        data-shell-variant="chatwise"
        data-shell-local-top-inset="none"
        style={shellGeometryStyle}
        className={cn('flex h-screen w-screen flex-row overflow-hidden text-foreground', 'bg-background')}>
        {sidebar}
        {contentColumn}
      </div>
    )
  }

  return (
    <div
      data-shell-variant="chatwise"
      data-shell-local-top-inset="none"
      style={shellGeometryStyle}
      className={cn('relative flex h-screen w-screen flex-row overflow-hidden text-foreground', 'bg-background')}>
      {!isFullscreen && (
        <div
          aria-hidden="true"
          data-testid="macos-traffic-light-drag-region"
          className="pointer-events-none absolute top-0 left-0 h-11 w-[env(titlebar-area-x)] [-webkit-app-region:drag]"
        />
      )}
      <div className="flex h-full min-h-0 shrink-0 flex-col [&>#app-sidebar]:min-h-0 [&>#app-sidebar]:flex-1">
        {!isFullscreen && (
          <div
            aria-hidden="true"
            data-testid="macos-traffic-light-spacer"
            className="h-11 shrink-0 [-webkit-app-region:drag]"
          />
        )}
        {sidebar}
      </div>
      {contentColumn}
    </div>
  )
}
