// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'

import type { SubWindowInitData } from '@shared/types/subWindow'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

type ShellTab = {
  id: string
  type: 'route'
  url: string
  title: string
  metadata?: { instanceAppId: 'assistants' | 'agents'; instanceKey?: string }
}

const defaultTabs: ShellTab[] = [{ id: 'home', type: 'route', url: '/home', title: 'Home' }]
const openTab = vi.fn()
const updateTab = vi.fn()

async function renderSubWindowAppShell({
  detectedWindowControls = false,
  init = null,
  isLinux = false,
  isMac = true,
  isWin = false,
  isPageTitledRoute = () => false,
  tabs = defaultTabs
}: {
  detectedWindowControls?: boolean
  init?: SubWindowInitData | null
  isLinux?: boolean
  isMac?: boolean
  isWin?: boolean
  isPageTitledRoute?: (url: string) => boolean
  tabs?: ShellTab[]
} = {}) {
  vi.resetModules()
  vi.doMock('@renderer/utils/platform', () => ({ isMac, isWin, isLinux }))
  vi.doMock('@renderer/hooks/useWindowInitData', () => ({
    useWindowInitData: () => init
  }))
  vi.doMock('@renderer/hooks/tab', () => ({
    useTabs: () => ({
      tabs,
      activeTabId: 'home',
      setActiveTab: vi.fn(),
      closeTab: vi.fn(),
      updateTab,
      addTab: vi.fn(),
      reorderTabs: vi.fn(),
      openTab,
      pinTab: vi.fn(),
      unpinTab: vi.fn()
    })
  }))
  vi.doMock('@renderer/utils/routeTitle', () => ({
    getDefaultRouteTitle: (url: string) => url,
    isPageTitledRoute
  }))
  vi.doMock('@renderer/components/layout/SubWindowControls', () => ({
    SubWindowControls: () => <div data-testid="sub-window-controls" />
  }))
  vi.doMock('@renderer/components/layout/SubWindowTitle', () => ({
    SubWindowTitle: () => <div data-testid="sub-window-title" />
  }))
  vi.doMock('@renderer/components/WindowControls', () => ({
    WindowControls: ({ hasWindowControls }: { hasWindowControls?: boolean }) =>
      hasWindowControls ? <div data-testid="window-controls" data-explicit-controls="true" /> : null,
    useHasWindowControls: () => detectedWindowControls
  }))
  vi.doMock('../SubWindowTitleBar', () => ({
    SubWindowTitleBar: () => <header data-testid="sub-window-title-bar" />
  }))
  const { ConversationNavigationPane } = await import('@renderer/components/chat/shell/ConversationNavigationPane')
  vi.doMock('@renderer/components/layout/TabRouter', () => ({
    TabRouter: () => (
      <ConversationNavigationPane>
        <section data-testid="tab-router" />
      </ConversationNavigationPane>
    )
  }))
  vi.doMock('@renderer/components/MiniApp/MiniAppTabsPool', () => ({
    default: () => <div data-testid="mini-app-pool" />
  }))
  vi.doMock('@renderer/components/ResourceViewSourceProvider', () => ({
    ResourceViewSourceProvider: ({ children }: { children: ReactNode }) => (
      <div data-testid="resource-view-source-provider">{children}</div>
    )
  }))

  const { SubWindowAppShell } = await import('../SubWindowAppShell')
  return render(<SubWindowAppShell />)
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.resetModules()
})

describe('SubWindowAppShell', () => {
  it('renders the title bar and tab router', async () => {
    await renderSubWindowAppShell()

    const provider = screen.getByTestId('resource-view-source-provider')

    expect(screen.getByTestId('sub-window-title-bar')).toBeInTheDocument()
    expect(provider).toContainElement(screen.getByTestId('tab-router'))
    expect(provider).not.toContainElement(screen.getByTestId('sub-window-title-bar'))
    expect(provider).not.toContainElement(screen.getByTestId('mini-app-pool'))
  })

  it('owns one macOS titlebar reserve and clears the route-local inset across remounts', async () => {
    const rendered = await renderSubWindowAppShell()
    const titleBar = screen.getByTestId('sub-window-title-bar')
    const shell = titleBar.parentElement
    const main = titleBar.nextElementSibling

    if (!(shell instanceof HTMLElement) || !(main instanceof HTMLElement)) {
      throw new Error('Expected detached shell and content')
    }

    expect(screen.getAllByTestId('sub-window-title-bar')).toHaveLength(1)
    expect(shell).toHaveAttribute('data-shell-local-top-inset', 'none')
    expect(shell.style.getPropertyValue('--shell-local-top-inset')).toBe('0px')
    expect(main.tagName).toBe('MAIN')
    expect(main).toContainElement(document.querySelector('.conversation-navigation-pane'))
    expect(main.querySelectorAll('[data-shell-local-top-reserve="titlebar"]')).toHaveLength(1)

    rendered.unmount()
    expect(document.querySelector('[data-shell-local-top-inset="none"]')).toBeNull()

    await renderSubWindowAppShell()
    const remountedShell = screen.getByTestId('sub-window-title-bar').parentElement
    expect(remountedShell).toHaveAttribute('data-shell-local-top-inset', 'none')
    expect(remountedShell?.style.getPropertyValue('--shell-local-top-inset')).toBe('0px')
  })

  it('keeps non-macOS detached content directly below the single titlebar without a local reserve', async () => {
    await renderSubWindowAppShell({ isMac: false })
    const titleBar = screen.getByTestId('sub-window-title-bar')
    const shell = titleBar.parentElement
    const main = titleBar.nextElementSibling

    expect(screen.getAllByTestId('sub-window-title-bar')).toHaveLength(1)
    expect(shell).toHaveAttribute('data-shell-local-top-inset', 'none')
    expect(shell?.style.getPropertyValue('--shell-local-top-inset')).toBe('0px')
    expect(main?.querySelector('[data-shell-local-top-reserve="titlebar"]')).toBeNull()
  })

  it.each([
    { name: 'Windows', platform: { isMac: false, isWin: true, isLinux: false }, expected: true },
    {
      name: 'Linux with the system title bar preference enabled',
      platform: { isMac: false, isWin: false, isLinux: true },
      expected: true
    },
    { name: 'macOS', platform: { isMac: true, isWin: false, isLinux: false }, expected: false }
  ])('follows the detached frameless-window control invariant on $name', async ({ platform, expected }) => {
    await renderSubWindowAppShell({
      ...platform,
      // Models app.use_system_title_bar=true on Linux: the preference-derived hook says no custom controls.
      detectedWindowControls: false
    })

    const shell = screen.getByTestId('sub-window-title-bar').parentElement
    if (!(shell instanceof HTMLElement)) throw new Error('Expected detached shell')

    if (expected) {
      expect(screen.getByTestId('window-controls')).toBeInTheDocument()
    } else {
      expect(screen.queryByTestId('window-controls')).not.toBeInTheDocument()
    }
    expect(shell.style.getPropertyValue('--window-controls-width')).toBe(expected ? '138px' : '0px')
    if (expected) expect(screen.getByTestId('window-controls')).toHaveAttribute('data-explicit-controls', 'true')
  })

  it('opens the detached tab from WindowManager init data', async () => {
    const metadata = { instanceAppId: 'assistants' as const, instanceKey: 'topic-1' }

    await renderSubWindowAppShell({
      init: {
        tabId: 'detached-tab',
        url: '/app/chat?topicId=topic-1',
        title: 'Detached topic',
        icon: '🍒',
        isPinned: true,
        metadata
      }
    })

    await waitFor(() => {
      expect(openTab).toHaveBeenCalledWith('/app/chat?topicId=topic-1', {
        id: 'detached-tab',
        title: 'Detached topic',
        icon: '🍒',
        type: 'route',
        metadata,
        isPinned: true,
        forceNew: true
      })
    })
    expect(openTab).toHaveBeenCalledOnce()
  })

  it('syncs a detached conversation URL from the active tab metadata', async () => {
    await renderSubWindowAppShell({
      isPageTitledRoute: (url) => url.startsWith('/app/chat'),
      tabs: [
        {
          id: 'home',
          type: 'route',
          url: '/app/chat?topicId=entry-topic',
          title: 'Current topic',
          metadata: { instanceAppId: 'assistants', instanceKey: 'current-topic' }
        }
      ]
    })

    await waitFor(() => {
      expect(updateTab).toHaveBeenCalledWith('home', { url: '/app/chat?topicId=current-topic' })
    })
  })
})
