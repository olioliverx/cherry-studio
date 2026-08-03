// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'

import type * as TabHooks from '@renderer/hooks/tab'
import type { SidebarAppId } from '@renderer/utils/sidebar'
import type { Tab } from '@shared/data/cache/cacheValueTypes'
import type { SidebarFavoriteItem } from '@shared/data/preference/preferenceTypes'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type ReactNode, useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type * as ShellTabBarActionsModule from '../../layout/ShellTabBarActions'
import type * as SidebarConstants from '../../Sidebar/constants'

// Real Dialog primitives so focus trap / Escape / overlay close match production.
// Keep Tooltip passive (setup-style wrapper) so launcher focus tests do not fight
// Radix tooltip open-state updates outside act().
vi.mock('@cherrystudio/ui', async (importOriginal) => {
  const React = await import('react')
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    Tooltip: ({
      children,
      classNames,
      content,
      title
    }: {
      children?: React.ReactNode
      classNames?: { placeholder?: string }
      content?: React.ReactNode
      title?: React.ReactNode
    }) => {
      const tooltipText = content || title
      return React.createElement(
        'div',
        {
          className: classNames?.placeholder,
          'data-testid': 'tooltip',
          ...(tooltipText ? { 'data-title': String(tooltipText) } : {})
        },
        children
      )
    }
  }
})

beforeAll(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = () => {}
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => {}
  }
  HTMLElement.prototype.scrollIntoView = () => {}
})

type FakeTab = {
  id: string
  type: 'route' | 'miniapp'
  url: string
  title: string
  icon?: string
  isPinned?: boolean
  metadata?: Record<string, unknown>
}

type FakeMiniApp = {
  appId: string
  name: string
  logo?: string
  url: string
}

const mocks = vi.hoisted(() => ({
  emitResourceListReveal: vi.fn(),
  openTab: vi.fn(),
  openSettingsTab: vi.fn(),
  setActiveTab: vi.fn(),
  updateTab: vi.fn(),
  activeTab: {
    id: 'chat',
    type: 'route',
    url: '/app/chat',
    title: 'Chat'
  } as FakeTab | null,
  setSidebarWidth: vi.fn(),
  setSidebarFavorites: vi.fn(() => Promise.resolve()),
  reorderMiniAppsByStatus: vi.fn(() => Promise.resolve()),
  showUserPopup: vi.fn(),
  sidebarWidth: 50,
  tabs: [] as FakeTab[],
  sidebarFavorites: [{ type: 'app', id: 'assistants' }] as SidebarFavoriteItem[],
  sidebarMiniAppFavorites: [] as SidebarFavoriteItem[],
  allApps: [] as FakeMiniApp[],
  visibleMiniApps: null as FakeMiniApp[] | null,
  pinnedMiniApps: [] as FakeMiniApp[],
  useRealShellActions: false,
  useRealTabs: false,
  persistedActiveTabId: 'home',
  persistedNormalTabs: [] as Tab[],
  persistedPinnedTabs: [] as Tab[],
  onEntriesReorder: undefined as ((event: { oldIndex: number; newIndex: number }) => void) | undefined
}))

vi.mock('@data/hooks/useCache', async () => {
  const React = await import('react')
  return {
    usePersistCache: (key: string) => {
      const initialValue =
        key === 'ui.tab.pinned_tabs'
          ? mocks.persistedPinnedTabs
          : key === 'ui.tab.normal_tabs'
            ? mocks.persistedNormalTabs
            : key === 'ui.tab.active_tab_id'
              ? mocks.persistedActiveTabId
              : mocks.sidebarWidth
      const [value, setValue] = React.useState(initialValue)
      const setPersistedValue = React.useCallback(
        (update: unknown) => {
          setValue((previous) => {
            const next = (
              typeof update === 'function' ? (update as (current: unknown) => unknown)(previous) : update
            ) as string | number | Tab[]
            if (key === 'ui.tab.pinned_tabs') mocks.persistedPinnedTabs = next as Tab[]
            else if (key === 'ui.tab.normal_tabs') mocks.persistedNormalTabs = next as Tab[]
            else if (key === 'ui.tab.active_tab_id') mocks.persistedActiveTabId = next as string
            else {
              mocks.sidebarWidth = next as number
              mocks.setSidebarWidth(next as number)
            }
            return next
          })
        },
        [key]
      )
      return [value, setPersistedValue]
    }
  }
})

vi.mock('@data/hooks/usePreference', () => ({
  usePreference: (key: string) => {
    if (key === 'app.user.name') return ['JD']
    if (key === 'ui.sidebar.favorites')
      return [[...mocks.sidebarFavorites, ...mocks.sidebarMiniAppFavorites], mocks.setSidebarFavorites]
    return [undefined]
  }
}))

vi.mock('@renderer/hooks/useAvatar', () => ({
  default: () => undefined
}))

vi.mock('@renderer/hooks/useMiniApps', () => ({
  useMiniApps: () => ({
    allApps: mocks.allApps,
    miniApps: mocks.visibleMiniApps ?? mocks.allApps,
    pinned: mocks.pinnedMiniApps,
    reorderMiniAppsByStatus: mocks.reorderMiniAppsByStatus
  })
}))
vi.mock('@renderer/i18n/label', () => ({
  getSidebarIconLabelKey: (icon: string) =>
    ({
      agents: 'Work',
      assistants: 'Chat',
      translate: 'Translate'
    })[icon] ?? icon
}))

vi.mock('@renderer/utils/routeTitle', () => ({
  getDefaultRouteTitle: (url: string) =>
    ({
      '/app/agents': 'Work',
      '/app/chat': 'Chat',
      '/app/files': 'Files',
      '/app/translate': 'Translate'
    })[url] ?? 'Chat',
  isPageTitledRoute: (url: string) => url.startsWith('/app/chat') || url.startsWith('/app/agents'),
  isTopLevelRoute: () => true
}))

vi.mock('@renderer/services/resourceListRevealEvents', () => ({
  emitResourceListReveal: mocks.emitResourceListReveal
}))

vi.mock('@renderer/hooks/tab', async (importOriginal) => {
  const actual = await importOriginal<typeof TabHooks>()
  return {
    ...actual,
    useTabs: () =>
      mocks.useRealTabs
        ? actual.useTabs()
        : {
            activeTab: mocks.activeTab,
            tabs: mocks.tabs,
            openTab: mocks.openTab,
            updateTab: mocks.updateTab,
            setActiveTab: mocks.setActiveTab
          },
    useOptionalTabsContext: () =>
      mocks.useRealTabs
        ? actual.useOptionalTabsContext()
        : {
            tabs: mocks.tabs,
            openTab: mocks.openTab,
            setActiveTab: mocks.setActiveTab
          }
  }
})

vi.mock('@renderer/ipc', () => ({
  ipcApi: { request: vi.fn(() => Promise.resolve(undefined)) },
  useIpcOn: vi.fn()
}))

vi.mock('@renderer/services/mainWindowNavigation', () => ({
  openSettingsTab: mocks.openSettingsTab
}))

vi.mock('../../UserPopup', () => ({
  default: {
    show: mocks.showUserPopup
  }
}))

vi.mock('../../icons/SvgIcon', () => ({
  OpenClawSidebarIcon: () => null
}))

vi.mock('../../layout/ShellTabBarActions', async (importOriginal) => {
  const actual = await importOriginal<typeof ShellTabBarActionsModule>()
  return {
    ...actual,
    SidebarShellActions: (props: React.ComponentProps<typeof actual.SidebarShellActions>) =>
      mocks.useRealShellActions ? (
        <actual.SidebarShellActions {...props} />
      ) : (
        <button type="button" data-testid={`sidebar-shell-actions-${props.layout}`} onClick={props.onSettingsClick} />
      )
  }
})

type MockSidebarEntry = {
  key: string
  label: string
  isActive: (active: { activeItem: string; activeTabId?: string }) => boolean
  onOpen: () => void
  contextMenuItems?: Array<{ id: string; label: string; enabled?: boolean; onSelect?: () => void }>
}

const parseEntryKey = (key: string) => {
  const idx = key.indexOf(':')
  return { type: key.slice(0, idx), id: key.slice(idx + 1) }
}

vi.mock('../../Sidebar', async () => {
  const constants = await vi.importActual<typeof SidebarConstants>('../../Sidebar/constants')
  return {
    ...constants,
    UserAvatar: ({ user, className }: { user: { name: string }; className?: string }) => (
      <div className={className} data-testid="sidebar-user-avatar">
        {user.name}
      </div>
    ),
    MiniAppIcon: () => null,
    Sidebar: ({
      isFloating,
      onEntryOpen,
      onEntriesReorder,
      active,
      entries,
      title,
      logo,
      user,
      actions,
      width,
      onResizePreview
    }: {
      isFloating?: boolean
      active?: { activeItem: string; activeTabId?: string }
      entries?: MockSidebarEntry[]
      title?: string
      logo?: ReactNode
      user?: unknown
      actions?: ReactNode | ((layout: 'icon' | 'full') => ReactNode)
      width?: number
      onResizePreview?: (width: number | null) => void
      onEntryOpen?: () => void
      onEntriesReorder?: (event: { oldIndex: number; newIndex: number }) => void
    }) => {
      mocks.onEntriesReorder = onEntriesReorder
      // Entries are type-agnostic resolved rows; the tests still assert per-type
      // testids, so recover the type/id from the stable `entry.key` (`${type}:${id}`).
      const activeState = active ?? { activeItem: '' }
      const items = entries?.filter((entry) => parseEntryKey(entry.key).type === 'app')
      const dockedTabs = entries?.filter((entry) => parseEntryKey(entry.key).type === 'mini_app')
      const navigation = (
        <>
          <div data-ui="sidebar.navigation" data-testid={isFloating ? 'floating-nav' : 'docked-nav'}>
            {items?.map((item) => (
              <div key={item.key}>
                <button
                  type="button"
                  data-testid={`${isFloating ? 'floating' : 'sidebar'}-item-${parseEntryKey(item.key).id}`}
                  onClick={() => {
                    item.onOpen()
                    onEntryOpen?.()
                  }}>
                  <span>{item.label}</span>
                </button>
                {item.contextMenuItems?.map((menuItem) => (
                  <button
                    key={menuItem.id}
                    type="button"
                    data-testid={`${isFloating ? 'floating' : 'sidebar'}-menu-${menuItem.id}`}
                    disabled={menuItem.enabled === false}
                    onClick={menuItem.onSelect}>
                    {menuItem.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div data-testid={isFloating ? 'floating-mini-app-section' : 'sidebar-mini-app-section'}>
            {dockedTabs?.map((miniTab) => (
              <div key={miniTab.key}>
                <button
                  type="button"
                  data-active={miniTab.isActive(activeState) ? 'true' : 'false'}
                  data-testid={`${isFloating ? 'floating' : 'sidebar'}-mini-app-${parseEntryKey(miniTab.key).id}`}
                  onClick={() => {
                    miniTab.onOpen()
                    onEntryOpen?.()
                  }}>
                  {miniTab.label}
                </button>
                {miniTab.contextMenuItems?.map((menuItem) => (
                  <button
                    key={menuItem.id}
                    type="button"
                    data-testid={`${isFloating ? 'floating' : 'sidebar'}-menu-${menuItem.id}`}
                    disabled={menuItem.enabled === false}
                    onClick={menuItem.onSelect}>
                    {menuItem.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )

      return isFloating ? (
        <div data-testid="floating-sidebar" className="slide-in-from-left-2 bg-sidebar">
          {navigation}
          <div data-testid="floating-footer-actions">{typeof actions === 'function' ? actions('full') : actions}</div>
          <button
            type="button"
            data-testid="floating-context-menu-open"
            onClick={(event) => {
              // Nested overlays must not count as outside dismissal for the drawer.
              event.stopPropagation()
            }}>
            context
          </button>
        </div>
      ) : (
        <>
          <div data-testid="sidebar-title">{title}</div>
          <div data-testid="sidebar-logo">{logo}</div>
          <div data-testid="sidebar-footer-user">{user ? 'user' : 'none'}</div>
          <div data-testid="sidebar-footer-actions">{typeof actions === 'function' ? actions('icon') : actions}</div>
          <button type="button" data-testid="preview-80" onClick={() => onResizePreview?.(80)} />
          <button type="button" data-testid="preview-null" onClick={() => onResizePreview?.(null)} />
          <div data-testid="hidden-hot-zone" data-testid-hover="true" />
          <div data-testid="ui-sidebar" data-width={width} />
          <div data-testid="sidebar-items">
            {items?.map((item) => (
              <div key={item.key}>
                <button
                  type="button"
                  data-testid={`sidebar-item-${parseEntryKey(item.key).id}`}
                  onClick={() => item.onOpen()}>
                  <span>{item.label}</span>
                </button>
                {item.contextMenuItems?.map((menuItem) => (
                  <button
                    key={menuItem.id}
                    type="button"
                    data-testid={`sidebar-menu-${menuItem.id}`}
                    disabled={menuItem.enabled === false}
                    onClick={menuItem.onSelect}>
                    {menuItem.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div data-testid="sidebar-mini-app-section">
            {dockedTabs?.map((miniTab) => (
              <div key={miniTab.key}>
                <button
                  type="button"
                  data-active={miniTab.isActive(activeState) ? 'true' : 'false'}
                  data-testid={`sidebar-mini-app-${parseEntryKey(miniTab.key).id}`}
                  onClick={() => miniTab.onOpen()}>
                  {miniTab.label}
                </button>
                {miniTab.contextMenuItems?.map((menuItem) => (
                  <button
                    key={menuItem.id}
                    type="button"
                    data-testid={`sidebar-menu-${menuItem.id}`}
                    disabled={menuItem.enabled === false}
                    onClick={menuItem.onSelect}>
                    {menuItem.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )
    }
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en-us' },
    t: (key: string, options?: { defaultValue?: string }) => {
      if (key === 'common.search') return 'Search'
      return options?.defaultValue ?? key
    }
  })
}))

import { useTabsContext } from '@renderer/hooks/tab'
import { resolveSidebarAppTabEntryUrl } from '@renderer/utils/sidebar'

import { TabsProvider } from '../../layout/TabsProvider'
import Sidebar from '../Sidebar'

/** Controlled harness: AppShell owns drawerOpen; mirror that for unit tests. */
function ControlledSidebar() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  return <Sidebar drawerOpen={drawerOpen} onDrawerOpenChange={setDrawerOpen} />
}

function ControlledSidebarWithTabs() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { activeTabId, tabs } = useTabsContext()
  return (
    <>
      <Sidebar drawerOpen={drawerOpen} onDrawerOpenChange={setDrawerOpen} />
      <output aria-label="Active tab">{activeTabId}</output>
      <output aria-label="Tab URLs">{tabs.map((item) => item.url).join(',')}</output>
      <output aria-label="Dormant tabs">
        {tabs
          .filter((item) => item.isDormant)
          .map((item) => item.id)
          .join(',')}
      </output>
    </>
  )
}

const appFavorite = (id: SidebarAppId): SidebarFavoriteItem => ({ type: 'app', id })
const miniAppFavorite = (id: string): SidebarFavoriteItem => ({ type: 'mini_app', id })
const calculatorMiniApp: FakeMiniApp = {
  appId: 'calculator',
  name: 'Calculator',
  logo: 'calculator-logo',
  url: 'https://calc.example'
}
const weatherMiniApp: FakeMiniApp = {
  appId: 'weather',
  name: 'Weather',
  logo: 'weather-logo',
  url: 'https://weather.example'
}

function configureMiniApps(favoriteIds: string[], apps: FakeMiniApp[] = [calculatorMiniApp]) {
  mocks.sidebarFavorites = [appFavorite('assistants'), appFavorite('mini_app')]
  mocks.sidebarMiniAppFavorites = favoriteIds.map(miniAppFavorite)
  mocks.allApps = apps
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  mocks.sidebarFavorites = [appFavorite('assistants')]
  mocks.sidebarMiniAppFavorites = []
  mocks.setSidebarFavorites.mockReset()
  mocks.setSidebarFavorites.mockResolvedValue(undefined)
  mocks.reorderMiniAppsByStatus.mockReset()
  mocks.reorderMiniAppsByStatus.mockResolvedValue(undefined)
  mocks.activeTab = {
    id: 'chat',
    type: 'route',
    url: '/app/chat',
    title: 'Chat'
  }
  mocks.tabs = []
  mocks.allApps = []
  mocks.visibleMiniApps = null
  mocks.pinnedMiniApps = []
  mocks.sidebarWidth = 50
  mocks.useRealShellActions = false
  mocks.useRealTabs = false
  mocks.persistedActiveTabId = 'home'
  mocks.persistedNormalTabs = []
  mocks.persistedPinnedTabs = []
  vi.useRealTimers()
  document.documentElement.style.removeProperty('--sidebar-width')
  document.documentElement.style.removeProperty('--shell-launcher-bottom-inset')
})

describe('app Sidebar', () => {
  it('uses the user avatar as the header logo and moves footer actions out of the tab bar', () => {
    const { container } = render(<Sidebar />)

    expect(container.querySelector('#app-sidebar')).toHaveAttribute('data-ui', 'app.sidebar')
    expect(screen.getByTestId('sidebar-logo')).toContainElement(screen.getByTestId('sidebar-user-avatar'))
    expect(screen.getByTestId('sidebar-title')).toHaveTextContent('JD')
    expect(screen.getByTestId('sidebar-footer-user')).toHaveTextContent('none')
    expect(screen.getByTestId('sidebar-shell-actions-icon')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'JD' }))

    expect(mocks.showUserPopup).toHaveBeenCalledTimes(1)
  })

  it('opens settings in a main-window tab from the sidebar footer action', () => {
    render(<Sidebar />)

    fireEvent.click(screen.getByTestId('sidebar-shell-actions-icon'))

    expect(mocks.openSettingsTab).toHaveBeenCalledWith('/settings/provider')
  })

  it('opens an accessible modal drawer from the launcher and restores focus on Escape', async () => {
    const user = userEvent.setup()
    mocks.sidebarWidth = 0

    render(<ControlledSidebar />)

    const launcher = screen.getByRole('button', { name: 'common.open_sidebar' })
    expect(launcher).toHaveAttribute('aria-haspopup', 'dialog')
    launcher.focus()
    await user.keyboard('{Enter}')

    const dialog = await screen.findByRole('dialog', { name: 'common.open_sidebar' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)

    const overlay = document.querySelector('[data-slot="dialog-overlay"]')
    expect(overlay).toBeInTheDocument()
    expect(overlay?.className).toContain('bg-black/20')

    const floatingSidebar = within(dialog).getByTestId('floating-sidebar')
    expect(floatingSidebar).toBeInTheDocument()

    // Focus enters the drawer (Radix FocusScope).
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true)
    })

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    await waitFor(() => expect(screen.getByRole('button', { name: 'common.open_sidebar' })).toHaveFocus())
  })

  it('wakes a dormant tab through the body-portaled manager without breaking drawer modality', async () => {
    const user = userEvent.setup()
    mocks.sidebarWidth = 0
    mocks.useRealShellActions = true
    mocks.useRealTabs = true
    mocks.persistedNormalTabs = [
      {
        id: 'home',
        type: 'route',
        url: '/app/chat',
        title: 'Chat',
        lastAccessTime: 2,
        isDormant: false
      },
      {
        id: 'topic',
        type: 'route',
        url: '/app/chat?topicId=topic',
        title: 'Topic',
        lastAccessTime: 1,
        isDormant: true
      }
    ]

    render(
      <TabsProvider initialDefaultTab={null}>
        <ControlledSidebarWithTabs />
      </TabsProvider>
    )

    const launcher = screen.getByRole('button', { name: 'common.open_sidebar' })
    await user.click(launcher)
    const dialog = await screen.findByRole('dialog', { name: 'common.open_sidebar' })
    await user.click(within(dialog).getByRole('button', { name: 'tab.open_tabs' }))

    const [tabsMenu] = await screen.findAllByRole('menu')
    expect(tabsMenu.closest('[data-radix-popper-content-wrapper]')?.parentElement).toBe(document.body)
    for (let element: Element | null = tabsMenu; element; element = element.parentElement) {
      expect(element).not.toHaveAttribute('aria-hidden', 'true')
    }

    const dormantRow = within(tabsMenu).getByRole('menuitem', { name: /Topic.*tab.dormant/ })
    dormantRow.focus()
    await user.keyboard('{ArrowRight}')
    const menus = await screen.findAllByRole('menu')
    const actions = menus.at(-1)
    if (!actions) throw new Error('Expected dormant tab actions')
    await user.click(within(actions).getByRole('menuitem', { name: 'common.open' }))

    await waitFor(() => expect(screen.getByRole('status', { name: 'Active tab' })).toHaveTextContent('topic'))
    expect(screen.getByRole('status', { name: 'Dormant tabs' })).not.toHaveTextContent('topic')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await waitFor(() => expect(launcher).toHaveFocus())
    expect(document.body.style.pointerEvents).not.toBe('none')
  })

  it('creates a force-new Launchpad tab from the drawer manager and restores launcher focus', async () => {
    const user = userEvent.setup()
    mocks.sidebarWidth = 0
    mocks.useRealShellActions = true
    mocks.useRealTabs = true
    mocks.persistedNormalTabs = [
      {
        id: 'home',
        type: 'route',
        url: '/app/chat',
        title: 'Chat',
        lastAccessTime: 1,
        isDormant: false
      }
    ]

    render(
      <TabsProvider initialDefaultTab={null}>
        <ControlledSidebarWithTabs />
      </TabsProvider>
    )

    const launcher = screen.getByRole('button', { name: 'common.open_sidebar' })
    await user.click(launcher)
    const dialog = await screen.findByRole('dialog', { name: 'common.open_sidebar' })
    await user.click(within(dialog).getByRole('button', { name: 'tab.open_tabs' }))
    const menu = await screen.findByRole('menu')
    await user.click(within(menu).getByRole('menuitem', { name: 'tab.new' }))

    await waitFor(() => expect(screen.getByRole('status', { name: 'Tab URLs' })).toHaveTextContent('/app/launchpad'))
    expect(mocks.persistedNormalTabs).toHaveLength(2)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await waitFor(() => expect(launcher).toHaveFocus())
    expect(document.body.style.pointerEvents).not.toBe('none')
  })

  it('does not open the drawer from pointer hover alone', async () => {
    mocks.sidebarWidth = 0
    render(<ControlledSidebar />)

    fireEvent.mouseEnter(screen.getByTestId('hidden-hot-zone'))
    fireEvent.mouseOver(document.body)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByTestId('floating-sidebar')).not.toBeInTheDocument()
  })

  it('closes the drawer on overlay click and returns focus to the launcher', async () => {
    const user = userEvent.setup()
    mocks.sidebarWidth = 0
    render(<ControlledSidebar />)

    await user.click(screen.getByRole('button', { name: 'common.open_sidebar' }))
    expect(await screen.findByRole('dialog', { name: 'common.open_sidebar' })).toBeInTheDocument()

    const overlay = document.querySelector('[data-slot="dialog-overlay"]')
    expect(overlay).toBeTruthy()
    await user.click(overlay!)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: 'common.open_sidebar' })).toHaveFocus())
  })

  it('closes the drawer after a navigation entry is activated and restores launcher focus', async () => {
    const user = userEvent.setup()
    mocks.sidebarWidth = 0
    mocks.sidebarFavorites = [appFavorite('assistants'), appFavorite('agents')]
    render(<ControlledSidebar />)

    await user.click(screen.getByRole('button', { name: 'common.open_sidebar' }))
    const dialog = await screen.findByRole('dialog', { name: 'common.open_sidebar' })

    await user.click(within(dialog).getByTestId('floating-item-agents'))

    expect(mocks.updateTab).toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: 'common.open_sidebar' })).toHaveFocus())
  })

  it('keeps focus trapped inside the open drawer for Tab cycling', async () => {
    const user = userEvent.setup()
    mocks.sidebarWidth = 0
    mocks.sidebarFavorites = [appFavorite('assistants'), appFavorite('agents')]
    render(<ControlledSidebar />)

    await user.click(screen.getByRole('button', { name: 'common.open_sidebar' }))
    const dialog = await screen.findByRole('dialog', { name: 'common.open_sidebar' })

    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))

    for (let i = 0; i < 8; i += 1) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }

    for (let i = 0; i < 8; i += 1) {
      await user.tab({ shift: true })
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })

  it('keeps the drawer open when interacting with nested sidebar controls', async () => {
    const user = userEvent.setup()
    mocks.sidebarWidth = 0
    render(<ControlledSidebar />)

    await user.click(screen.getByRole('button', { name: 'common.open_sidebar' }))
    const dialog = await screen.findByRole('dialog', { name: 'common.open_sidebar' })

    await user.click(within(dialog).getByTestId('floating-context-menu-open'))

    expect(screen.getByRole('dialog', { name: 'common.open_sidebar' })).toBeInTheDocument()
  })

  it('derives conversation detach URLs from instance metadata', () => {
    expect(
      resolveSidebarAppTabEntryUrl({
        url: '/app/chat?topicId=entry-topic',
        metadata: { instanceAppId: 'assistants', instanceKey: 'current-topic' }
      })
    ).toBe('/app/chat?topicId=current-topic')
    expect(
      resolveSidebarAppTabEntryUrl({
        url: '/app/agents?sessionId=entry-session',
        metadata: { instanceAppId: 'agents', instanceKey: 'current-session' }
      })
    ).toBe('/app/agents?sessionId=current-session')
  })

  it('uses the conversation base route when instance metadata represents a draft', () => {
    expect(
      resolveSidebarAppTabEntryUrl({
        url: '/app/chat?topicId=previous-topic',
        metadata: { instanceAppId: 'assistants' }
      })
    ).toBe('/app/chat')
    expect(
      resolveSidebarAppTabEntryUrl({
        url: '/app/agents?sessionId=previous-session',
        metadata: { instanceAppId: 'agents' }
      })
    ).toBe('/app/agents')
  })

  it('keeps a message-only detach URL when there is no normal instance key', () => {
    expect(
      resolveSidebarAppTabEntryUrl({
        url: '/app/chat?topicId=t-1&view=message',
        metadata: { instanceAppId: 'assistants', instanceKey: 'stale-topic' }
      })
    ).toBe('/app/chat?topicId=t-1&view=message')
  })

  it('renders sidebar menu items in visible preference order', () => {
    mocks.sidebarFavorites = [appFavorite('translate'), appFavorite('assistants'), appFavorite('agents')]

    render(<Sidebar />)

    const labels = Array.from(screen.getByTestId('sidebar-items').querySelectorAll('span')).map(
      (element) => element.textContent
    )
    expect(labels).toEqual(['Translate', 'Chat', 'Work'])
  })

  it('removes a sidebar app favorite from the context menu', () => {
    mocks.sidebarFavorites = [appFavorite('assistants'), appFavorite('knowledge'), appFavorite('files')]

    render(<Sidebar />)

    expect(screen.getByTestId('sidebar-menu-sidebar.remove-app.knowledge')).toHaveTextContent(
      'launchpad.unpin_from_sidebar'
    )

    fireEvent.click(screen.getByTestId('sidebar-menu-sidebar.remove-app.knowledge'))

    expect(mocks.setSidebarFavorites).toHaveBeenCalledWith([appFavorite('assistants'), appFavorite('files')])
  })

  it('keeps required sidebar favorites protected in the context menu', () => {
    render(<Sidebar />)

    expect(screen.getByTestId('sidebar-menu-sidebar.remove-app.assistants')).toBeDisabled()

    fireEvent.click(screen.getByTestId('sidebar-menu-sidebar.remove-app.assistants'))

    expect(mocks.setSidebarFavorites).not.toHaveBeenCalled()
  })

  it('renders favorite mini apps directly in the sidebar mini app section', () => {
    configureMiniApps(['calculator', 'weather'], [calculatorMiniApp, weatherMiniApp])
    mocks.activeTab = {
      id: 'calculator-tab',
      type: 'route',
      url: '/app/mini-app/calculator',
      title: 'Calculator'
    }

    render(<Sidebar />)

    expect(screen.getByTestId('sidebar-mini-app-section')).toContainElement(
      screen.getByTestId('sidebar-mini-app-calculator')
    )
    expect(screen.getByTestId('sidebar-mini-app-calculator')).toHaveTextContent('Calculator')
    expect(screen.getByTestId('sidebar-mini-app-calculator')).toHaveAttribute('data-active', 'true')
    expect(screen.getByTestId('sidebar-mini-app-weather')).toHaveTextContent('Weather')
    expect(
      Array.from(screen.getByTestId('sidebar-mini-app-section').querySelectorAll('button')).map(
        (button) => button.textContent
      )
    ).toEqual(['Calculator', 'launchpad.unpin_from_sidebar', 'Weather', 'launchpad.unpin_from_sidebar'])
  })

  it('removes a sidebar mini app favorite from the context menu', () => {
    configureMiniApps(['calculator', 'weather'], [calculatorMiniApp, weatherMiniApp])

    render(<Sidebar />)

    fireEvent.click(screen.getByTestId('sidebar-menu-sidebar.remove-mini-app.calculator'))

    expect(mocks.setSidebarFavorites).toHaveBeenCalledWith([
      appFavorite('assistants'),
      appFavorite('mini_app'),
      miniAppFavorite('weather')
    ])
  })

  it('reorders sidebar favorites through a single mixed drag', () => {
    mocks.sidebarFavorites = [appFavorite('assistants'), appFavorite('knowledge'), appFavorite('files')]
    mocks.sidebarMiniAppFavorites = [miniAppFavorite('calculator')]
    mocks.allApps = [calculatorMiniApp]

    render(<Sidebar />)
    // Mixed list is [assistants, knowledge, files, calculator]; drag files to front.
    act(() => mocks.onEntriesReorder?.({ oldIndex: 2, newIndex: 0 }))

    expect(mocks.setSidebarFavorites).toHaveBeenCalledWith([
      appFavorite('files'),
      appFavorite('assistants'),
      appFavorite('knowledge'),
      miniAppFavorite('calculator')
    ])
  })

  it('reorders sidebar mini apps through favorites without touching the mini app order key', () => {
    configureMiniApps(['calculator', 'weather'], [calculatorMiniApp, weatherMiniApp])

    render(<Sidebar />)
    // Mixed list is [assistants, mini_app, calculator, weather]; drag weather above calculator.
    act(() => mocks.onEntriesReorder?.({ oldIndex: 3, newIndex: 2 }))

    expect(mocks.setSidebarFavorites).toHaveBeenCalledWith([
      appFavorite('assistants'),
      appFavorite('mini_app'),
      miniAppFavorite('weather'),
      miniAppFavorite('calculator')
    ])
    // The sidebar owns its order through favorites only — the mini app order key
    // (shared with the mini apps grid) is left untouched.
    expect(mocks.reorderMiniAppsByStatus).not.toHaveBeenCalled()
  })

  it('drag-reorders a mini app above a built-in app, interleaving the two types', () => {
    configureMiniApps(['calculator'])

    render(<Sidebar />)
    // Mixed list is [assistants, mini_app, calculator]; drag calculator to the very top.
    act(() => mocks.onEntriesReorder?.({ oldIndex: 2, newIndex: 0 }))

    expect(mocks.setSidebarFavorites).toHaveBeenCalledWith([
      miniAppFavorite('calculator'),
      appFavorite('assistants'),
      appFavorite('mini_app')
    ])
  })

  it('does not render mini apps unless they are sidebar favorites', () => {
    configureMiniApps([])

    render(<Sidebar />)

    expect(screen.queryByTestId('sidebar-mini-app-calculator')).not.toBeInTheDocument()
  })

  it('drops stale mini app ids from sidebar favorites', () => {
    configureMiniApps(['calculator', 'stale'])

    render(<Sidebar />)

    expect(screen.getByTestId('sidebar-mini-app-calculator')).toHaveTextContent('Calculator')
    expect(screen.queryByTestId('sidebar-mini-app-stale')).not.toBeInTheDocument()
  })

  it('does not render hidden mini apps left in sidebar favorites', () => {
    configureMiniApps(['calculator'])
    mocks.visibleMiniApps = []

    render(<Sidebar />)

    expect(screen.queryByTestId('sidebar-mini-app-calculator')).not.toBeInTheDocument()
  })

  it('reuses the active tab from the sidebar mini app section', () => {
    configureMiniApps(['calculator'])
    mocks.activeTab = {
      id: 'chat',
      type: 'route',
      url: '/app/chat?topicId=t-1',
      title: 'Topic',
      icon: 'emoji:🍒',
      metadata: { instanceAppId: 'assistants', instanceKey: 't-1', keep: true }
    }

    render(<Sidebar />)
    fireEvent.click(screen.getByTestId('sidebar-mini-app-calculator'))

    expect(mocks.updateTab).toHaveBeenCalledWith('chat', {
      url: '/app/mini-app/calculator',
      title: 'Calculator',
      icon: 'calculator-logo',
      metadata: { keep: true }
    })
    expect(mocks.openTab).not.toHaveBeenCalled()
  })

  it('does nothing when the active tab is already on the target mini app route', () => {
    configureMiniApps(['calculator'])
    mocks.activeTab = {
      id: 'calculator-tab',
      type: 'route',
      url: '/app/mini-app/calculator',
      title: 'Calculator'
    }

    render(<Sidebar />)
    fireEvent.click(screen.getByTestId('sidebar-mini-app-calculator'))

    expect(mocks.updateTab).not.toHaveBeenCalled()
    expect(mocks.openTab).not.toHaveBeenCalled()
  })

  it('opens a forced mini app tab when the active tab is pinned', () => {
    configureMiniApps(['calculator'])
    mocks.activeTab = {
      id: 'chat',
      type: 'route',
      url: '/app/chat',
      title: 'Chat',
      isPinned: true
    }

    render(<Sidebar />)
    fireEvent.click(screen.getByTestId('sidebar-mini-app-calculator'))

    expect(mocks.openTab).toHaveBeenCalledWith('/app/mini-app/calculator', {
      forceNew: true,
      title: 'Calculator',
      icon: 'calculator-logo'
    })
    expect(mocks.updateTab).not.toHaveBeenCalled()
  })

  it('does nothing when the active tab is already on the target route', () => {
    mocks.sidebarFavorites = [appFavorite('agents')]
    mocks.activeTab = {
      id: 'agents',
      type: 'route',
      url: '/app/agents',
      title: 'Work'
    }

    render(<Sidebar />)
    fireEvent.click(screen.getByTestId('sidebar-item-agents'))

    expect(mocks.updateTab).not.toHaveBeenCalled()
    expect(mocks.openTab).not.toHaveBeenCalled()
    expect(mocks.emitResourceListReveal).not.toHaveBeenCalled()
  })

  it('reuses the active tab without revealing its resource list', () => {
    mocks.sidebarFavorites = [appFavorite('agents')]
    mocks.activeTab = {
      id: 'chat',
      type: 'route',
      url: '/app/chat',
      title: 'Chat'
    }
    mocks.tabs = [{ id: 'agents-1', type: 'route', url: '/app/agents?sessionId=s-1', title: 'Session 1' }]

    render(<Sidebar />)
    fireEvent.click(screen.getByTestId('sidebar-item-agents'))

    expect(mocks.updateTab).toHaveBeenCalledWith('chat', {
      url: '/app/agents',
      title: 'Work',
      icon: undefined,
      metadata: undefined
    })
    expect(mocks.emitResourceListReveal).not.toHaveBeenCalled()
    expect(mocks.setActiveTab).not.toHaveBeenCalled()
    expect(mocks.openTab).not.toHaveBeenCalled()
  })

  it('clears stale instance metadata when reusing the active tab', () => {
    mocks.sidebarFavorites = [appFavorite('translate')]
    mocks.activeTab = {
      id: 'chat',
      type: 'route',
      url: '/app/chat?topicId=t-1',
      title: 'Topic',
      icon: 'emoji:🍒',
      metadata: { instanceAppId: 'assistants', instanceKey: 't-1', keep: true }
    }

    render(<Sidebar />)
    fireEvent.click(screen.getByTestId('sidebar-item-translate'))

    expect(mocks.updateTab).toHaveBeenCalledWith('chat', {
      url: '/app/translate',
      title: 'Translate',
      icon: undefined,
      metadata: { keep: true }
    })
    expect(mocks.openTab).not.toHaveBeenCalled()
    expect(mocks.emitResourceListReveal).not.toHaveBeenCalled()
  })

  it('reuses the active tab for single-policy routes too', () => {
    mocks.sidebarFavorites = [appFavorite('translate')]
    mocks.activeTab = {
      id: 'chat',
      type: 'route',
      url: '/app/chat',
      title: 'Chat'
    }

    render(<Sidebar />)
    fireEvent.click(screen.getByTestId('sidebar-item-translate'))

    expect(mocks.updateTab).toHaveBeenCalledWith('chat', {
      url: '/app/translate',
      title: 'Translate',
      icon: undefined,
      metadata: undefined
    })
    expect(mocks.openTab).not.toHaveBeenCalled()
  })

  it('opens a forced tab without revealing its resource list when the active tab is pinned', () => {
    mocks.sidebarFavorites = [appFavorite('agents')]
    mocks.activeTab = {
      id: 'chat',
      type: 'route',
      url: '/app/chat',
      title: 'Chat',
      isPinned: true
    }
    mocks.openTab.mockReturnValue('agents-new')

    render(<Sidebar />)
    fireEvent.click(screen.getByTestId('sidebar-item-agents'))

    expect(mocks.openTab).toHaveBeenCalledWith('/app/agents', { forceNew: true, title: 'Work' })
    expect(mocks.emitResourceListReveal).not.toHaveBeenCalled()
    expect(mocks.updateTab).not.toHaveBeenCalled()
    expect(mocks.setActiveTab).not.toHaveBeenCalled()
  })

  it('opens a forced tab when there is no active tab', () => {
    mocks.sidebarFavorites = [appFavorite('files')]
    mocks.activeTab = null
    mocks.openTab.mockReturnValue('files-new')

    render(<Sidebar />)
    fireEvent.click(screen.getByTestId('sidebar-item-files'))

    expect(mocks.openTab).toHaveBeenCalledWith('/app/files', { forceNew: true, title: 'Files' })
    expect(mocks.updateTab).not.toHaveBeenCalled()
    expect(mocks.setActiveTab).not.toHaveBeenCalled()
    expect(mocks.emitResourceListReveal).not.toHaveBeenCalled()
  })

  it('migrates a persisted intermediate sidebar width to icon width and converges', () => {
    mocks.sidebarWidth = 80

    const { rerender } = render(<Sidebar />)

    expect(mocks.sidebarWidth).toBe(50)
    expect(mocks.setSidebarWidth).toHaveBeenCalledTimes(1)

    rerender(<Sidebar />)

    expect(mocks.sidebarWidth).toBe(50)
    expect(mocks.setSidebarWidth).toHaveBeenCalledTimes(1)
  })

  it('uses the resize preview width for rendering and CSS variable without persisting it', () => {
    render(<Sidebar />)

    expect(screen.getByTestId('ui-sidebar')).toHaveAttribute('data-width', '50')
    expect(document.documentElement.style.getPropertyValue('--sidebar-width')).toBe('50px')

    fireEvent.click(screen.getByTestId('preview-80'))

    expect(screen.getByTestId('ui-sidebar')).toHaveAttribute('data-width', '80')
    expect(document.documentElement.style.getPropertyValue('--sidebar-width')).toBe('80px')
    expect(mocks.sidebarWidth).toBe(50)
    expect(mocks.setSidebarWidth).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('preview-null'))

    expect(screen.getByTestId('ui-sidebar')).toHaveAttribute('data-width', '50')
    expect(document.documentElement.style.getPropertyValue('--sidebar-width')).toBe('50px')
  })

  it('publishes shell dimensions for hidden layout and removes them on unmount', () => {
    mocks.sidebarWidth = 0
    const { unmount } = render(<Sidebar />)

    expect(document.documentElement.style.getPropertyValue('--sidebar-width')).toBe('0px')
    expect(document.documentElement.style.getPropertyValue('--shell-launcher-bottom-inset')).toBe('48px')

    unmount()

    expect(document.documentElement.style.getPropertyValue('--sidebar-width')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--shell-launcher-bottom-inset')).toBe('')
  })

  it('publishes zero launcher bottom inset for icon/full layouts', () => {
    mocks.sidebarWidth = 50
    render(<Sidebar />)
    expect(document.documentElement.style.getPropertyValue('--shell-launcher-bottom-inset')).toBe('0px')
  })

  it('closes the drawer when the rail expands out of hidden layout', async () => {
    const user = userEvent.setup()
    mocks.sidebarWidth = 0

    function Harness() {
      const [drawerOpen, setDrawerOpen] = useState(false)
      return (
        <div>
          <span data-testid="drawer-open-flag">{drawerOpen ? 'open' : 'closed'}</span>
          <Sidebar drawerOpen={drawerOpen} onDrawerOpenChange={setDrawerOpen} />
        </div>
      )
    }

    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'common.open_sidebar' }))
    expect(await screen.findByRole('dialog', { name: 'common.open_sidebar' })).toBeInTheDocument()
    expect(screen.getByTestId('drawer-open-flag')).toHaveTextContent('open')

    // Expand out of hidden via the existing resize-preview path (80 → icon layout).
    fireEvent.click(screen.getByTestId('preview-80'))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByTestId('drawer-open-flag')).toHaveTextContent('closed')
    })
    // Launcher unmounts with non-hidden layout; no orphan dialog remains.
    expect(screen.queryByRole('button', { name: 'common.open_sidebar' })).not.toBeInTheDocument()
  })
})
