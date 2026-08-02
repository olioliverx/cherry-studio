// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'

import type { Tab } from '@shared/data/cache/cacheValueTypes'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  activeTabId: 'home',
  detachedTabs: [] as Tab[],
  normalTabs: [] as Tab[],
  pinnedTabs: [] as Tab[]
}))

vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })
  }
}))

vi.mock('@renderer/data/hooks/useCache', async () => {
  const React = await import('react')

  return {
    usePersistCache: (key: string) => {
      const initialValue =
        key === 'ui.tab.pinned_tabs'
          ? state.pinnedTabs
          : key === 'ui.tab.normal_tabs'
            ? state.normalTabs
            : state.activeTabId
      const [value, setValue] = React.useState(initialValue)
      const setPersistedValue = React.useCallback(
        (update: unknown) => {
          setValue((previous) => {
            const next = (typeof update === 'function' ? (update as (value: unknown) => unknown)(previous) : update) as
              | string
              | Tab[]
            if (key === 'ui.tab.pinned_tabs') state.pinnedTabs = next as Tab[]
            else if (key === 'ui.tab.normal_tabs') state.normalTabs = next as Tab[]
            else state.activeTabId = next as string
            return next
          })
        },
        [key]
      )
      return [value, setPersistedValue]
    }
  }
})

vi.mock('@renderer/ipc', () => ({
  ipcApi: {
    request: vi.fn((_route: string, tab?: Tab) => {
      if (tab) state.detachedTabs.push(tab)
      return Promise.resolve(undefined)
    })
  },
  useIpcOn: vi.fn()
}))

vi.mock('@renderer/utils/routeTitle', () => ({
  getDefaultRouteTitle: (url: string) => ({ '/app/files': 'Files', '/app/launchpad': 'Launchpad' })[url] ?? url,
  isPageTitledRoute: (url: string) => url.startsWith('/app/chat') || url.startsWith('/app/agents'),
  isTopLevelRoute: () => true
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en-us' },
    t: (key: string) =>
      ({
        'common.open': 'Open',
        'tab.active': 'Active',
        'tab.close': 'Close Tab',
        'tab.close_others': 'Close Other Tabs',
        'tab.close_to_right': 'Close Tabs to the Right',
        'tab.dormant': 'Dormant',
        'tab.move_to_first': 'Move to First',
        'tab.open_in_new_window': 'Open in New Window',
        'tab.open_tabs': 'Open Tabs',
        'tab.pin': 'Pin Tab',
        'tab.unpin': 'Unpin Tab'
      })[key] ?? key
  })
}))

vi.mock('@cherrystudio/ui', async (importOriginal) => {
  const React = await import('react')
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    Tooltip: ({ children }: { children: ReactNode }) => React.createElement(React.Fragment, null, children)
  }
})

import { useTabsContext } from '@renderer/hooks/tab'

import { OpenTabsMenu } from '../OpenTabsMenu'
import { TabsProvider } from '../TabsProvider'

const tab = (id: string, overrides: Partial<Tab> = {}): Tab => ({
  id,
  type: 'route',
  url: `/app/${id}`,
  title: id[0].toUpperCase() + id.slice(1),
  lastAccessTime: 1,
  isDormant: false,
  ...overrides
})

function Inspector() {
  const { activeTabId, openTab, tabs } = useTabsContext()
  return (
    <>
      <button
        type="button"
        onClick={() =>
          openTab('/app/chat', {
            forceNew: true,
            id: 'forced-topic',
            metadata: { instanceAppId: 'assistants', instanceKey: 'topic-2' },
            title: 'Forced topic'
          })
        }>
        Force topic tab
      </button>
      <output aria-label="Active tab">{activeTabId}</output>
      <output aria-label="Tab order">{tabs.map((item) => item.id).join(',')}</output>
      <output aria-label="Dormant tabs">
        {tabs
          .filter((item) => item.isDormant)
          .map((item) => item.id)
          .join(',')}
      </output>
    </>
  )
}

function renderManager(onTabSelect = vi.fn()) {
  render(
    <TabsProvider initialDefaultTab={null}>
      <OpenTabsMenu layout="full" onTabSelect={onTabSelect} />
      <Inspector />
    </TabsProvider>
  )
  return onTabSelect
}

async function openManager(user: ReturnType<typeof userEvent.setup>) {
  const trigger = screen.getByRole('button', { name: 'Open Tabs' })
  await user.click(trigger)
  return { menu: await screen.findByRole('menu'), trigger }
}

async function openTabActions(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  const [menu] = await screen.findAllByRole('menu')
  const row = within(menu).getByRole('menuitem', { name })
  row.focus()
  await user.keyboard('{ArrowRight}')
  const menus = await screen.findAllByRole('menu')
  const actions = menus.at(-1)
  if (!actions) throw new Error('Tab actions menu did not open')
  return actions
}

beforeAll(() => {
  if (!HTMLElement.prototype.hasPointerCapture) HTMLElement.prototype.hasPointerCapture = () => false
  if (!HTMLElement.prototype.releasePointerCapture) HTMLElement.prototype.releasePointerCapture = () => {}
  if (!HTMLElement.prototype.setPointerCapture) HTMLElement.prototype.setPointerCapture = () => {}
  HTMLElement.prototype.scrollIntoView = () => {}
})

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  state.activeTabId = 'home'
  state.detachedTabs = []
  state.normalTabs = [
    tab('home', { title: 'Chat', url: '/app/chat' }),
    tab('topic', { isDormant: true, url: '/app/chat?topicId=topic' }),
    tab('session', { isDormant: true, url: '/app/agents?sessionId=session' })
  ]
  state.pinnedTabs = [tab('files', { isDormant: true, isPinned: true })]
})

describe('OpenTabsMenu with TabsProvider', () => {
  it('discovers restored pinned, normal, and dormant tabs and wakes a selection', async () => {
    const user = userEvent.setup()
    const onTabSelect = renderManager()

    const { menu } = await openManager(user)

    expect(menu).toHaveClass('z-[90]')
    expect(within(menu).getByRole('menuitem', { name: /Files.*Dormant/ })).toHaveAttribute('data-pinned', 'true')
    expect(within(menu).getByRole('menuitem', { name: /Chat.*Active/ })).toHaveAttribute('aria-current', 'page')
    expect(within(menu).getByRole('menuitem', { name: /Topic.*Dormant/ })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /Session.*Dormant/ })).toBeInTheDocument()

    const actions = await openTabActions(user, /Topic.*Dormant/)
    await user.click(within(actions).getByRole('menuitem', { name: 'Open' }))

    await waitFor(() => expect(screen.getByRole('status', { name: 'Active tab' })).toHaveTextContent('topic'))
    expect(screen.getByRole('status', { name: 'Dormant tabs' })).not.toHaveTextContent('topic')
    expect(onTabSelect).toHaveBeenCalledTimes(1)
  })

  it('supports keyboard entry, nested action navigation, Escape, and trigger focus restoration', async () => {
    const user = userEvent.setup()
    renderManager()
    const trigger = screen.getByRole('button', { name: 'Open Tabs' })

    trigger.focus()
    await user.keyboard('{Enter}')

    const menu = await screen.findByRole('menu')
    expect(menu).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /Files.*Dormant/ })).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(await screen.findByRole('menuitem', { name: 'Open' })).toHaveFocus()
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('routes pin, unpin, reorder, batch close, and detach through TabsProvider', async () => {
    const user = userEvent.setup()
    renderManager()

    await openManager(user)
    let actions = await openTabActions(user, /Session.*Dormant/)
    await user.click(within(actions).getByRole('menuitem', { name: 'Pin Tab' }))
    await waitFor(() => expect(state.pinnedTabs.map((item) => item.id)).toContain('session'))

    await openManager(user)
    actions = await openTabActions(user, /Session.*Dormant/)
    await user.click(within(actions).getByRole('menuitem', { name: 'Unpin Tab' }))
    await waitFor(() => expect(state.normalTabs.map((item) => item.id)).toContain('session'))

    await openManager(user)
    actions = await openTabActions(user, /Session.*Dormant/)
    await user.click(within(actions).getByRole('menuitem', { name: 'Move to First' }))
    await waitFor(() => expect(screen.getByRole('status', { name: 'Tab order' })).toHaveTextContent('files,session'))

    await openManager(user)
    actions = await openTabActions(user, /Chat.*Active/)
    await user.click(within(actions).getByRole('menuitem', { name: 'Close Tabs to the Right' }))
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Tab order' })).toHaveTextContent('files,session,home')
    )

    await openManager(user)
    actions = await openTabActions(user, /Files.*Dormant/)
    await user.click(within(actions).getByRole('menuitem', { name: 'Open in New Window' }))
    await waitFor(() => expect(state.detachedTabs.map((item) => item.id)).toContain('files'))
    expect(screen.getByRole('status', { name: 'Tab order' })).not.toHaveTextContent('files')
  })

  it('surfaces force-created tabs and preserves the provider fallback when the last tab closes', async () => {
    const user = userEvent.setup()
    state.normalTabs = [tab('home', { title: 'Chat', url: '/app/chat' })]
    state.pinnedTabs = []
    renderManager()

    await user.click(screen.getByRole('button', { name: 'Force topic tab' }))
    await openManager(user)
    expect(screen.getByRole('menuitem', { name: /Forced topic/ })).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await openManager(user)
    let actions = await openTabActions(user, /Forced topic/)
    await user.click(within(actions).getByRole('menuitem', { name: 'Close Other Tabs' }))
    await waitFor(() => expect(screen.getByRole('status', { name: 'Tab order' })).toHaveTextContent('forced-topic'))

    await openManager(user)
    actions = await openTabActions(user, /Forced topic/)
    await user.click(within(actions).getByRole('menuitem', { name: 'Close Tab' }))
    await waitFor(() => expect(screen.getByRole('status', { name: 'Tab order' })).toHaveTextContent(/^[^,]+$/))
    expect(screen.getByRole('status', { name: 'Active tab' })).not.toHaveTextContent('forced-topic')
  })
})
