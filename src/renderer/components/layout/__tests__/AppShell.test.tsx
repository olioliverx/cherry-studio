// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  commandHandlers: new Map<string, () => void>(),
  ipcHandlers: new Map<string, (value: unknown) => void>(),
  ipcRequest: vi.fn((route: string) => Promise.resolve(route === 'window.is_full_screen' ? false : undefined)),
  platformState: { isLinux: false, isMac: false, isWin: false },
  preferenceState: { useSystemTitleBar: false },
  showSearchPopup: vi.fn()
}))

vi.mock('@renderer/hooks/useMacTransparentWindow', () => ({
  default: () => false
}))

vi.mock('@renderer/utils/platform', () => ({
  get isLinux() {
    return mocks.platformState.isLinux
  },
  get isMac() {
    return mocks.platformState.isMac
  },
  get isWin() {
    return mocks.platformState.isWin
  }
}))

vi.mock('@data/hooks/usePreference', () => ({
  usePreference: (key: string) => {
    if (key === 'app.use_system_title_bar') return [mocks.preferenceState.useSystemTitleBar]
    return [undefined]
  }
}))

vi.mock('@cherrystudio/ui', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'navbar.window.close': 'Close',
        'navbar.window.maximize': 'Maximize',
        'navbar.window.minimize': 'Minimize',
        'navbar.window.restore': 'Restore'
      })[key] ?? key
  })
}))

vi.mock('@renderer/hooks/command', () => ({
  useCommandHandler: (command: string, handler: () => void) => {
    mocks.commandHandlers.set(command, handler)
  }
}))

vi.mock('@renderer/ipc', () => ({
  ipcApi: {
    request: mocks.ipcRequest
  },
  useIpcOn: (event: string, handler: (value: unknown) => void) => {
    mocks.ipcHandlers.set(event, handler)
  }
}))

vi.mock('@renderer/components/GlobalSearch/GlobalSearchPopup', () => ({
  default: {
    show: mocks.showSearchPopup
  }
}))

vi.mock('../../../hooks/tab', () => ({
  useMainWindowNavigation: vi.fn(),
  useTabs: () => ({
    activeTabId: 'home',
    tabs: [
      {
        id: 'home',
        isDormant: false,
        title: 'Chat',
        type: 'route',
        url: '/app/agents'
      }
    ],
    updateTab: vi.fn()
  })
}))

vi.mock('../../app/Sidebar', () => ({
  default: ({
    drawerOpen,
    onDrawerOpenChange
  }: {
    drawerOpen?: boolean
    onDrawerOpenChange?: (open: boolean) => void
  }) => (
    <aside data-testid="sidebar" data-drawer-open={drawerOpen ? 'true' : 'false'}>
      <button type="button" data-testid="mock-drawer-open" onClick={() => onDrawerOpenChange?.(true)}>
        open drawer
      </button>
      <button type="button" data-testid="mock-drawer-close" onClick={() => onDrawerOpenChange?.(false)}>
        close drawer
      </button>
    </aside>
  )
}))

vi.mock('../../GlobalSearch/globalSearchGroups', () => ({
  createRecentRouteEntryFromTab: () => null,
  upsertGlobalSearchRecentEntry: (items: unknown[]) => items
}))

vi.mock('../../MiniApp/MiniAppTabsPool', () => ({
  default: () => <div data-testid="mini-app-pool" />
}))

vi.mock('../../ResourceViewSourceProvider', () => ({
  ResourceViewSourceProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="resource-view-source-provider">{children}</div>
  )
}))

vi.mock('../TabRouter', () => ({
  TabRouter: () => <section data-testid="tab-router" />
}))

import { AppShell } from '../AppShell'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  mocks.commandHandlers.clear()
  mocks.ipcHandlers.clear()
  mocks.ipcRequest.mockImplementation((route: string) =>
    Promise.resolve(route === 'window.is_full_screen' ? false : undefined)
  )
  mocks.platformState.isLinux = false
  mocks.platformState.isMac = false
  mocks.platformState.isWin = false
  mocks.preferenceState.useSystemTitleBar = false
})

describe('AppShell', () => {
  it('owns the resource source provider at the route host boundary', () => {
    render(<AppShell />)

    const provider = screen.getByTestId('resource-view-source-provider')

    expect(provider).toContainElement(screen.getByTestId('tab-router'))
    expect(provider).not.toContainElement(screen.getByTestId('mini-app-pool'))
    expect(provider).not.toContainElement(screen.getByTestId('sidebar'))
  })

  it('opens global search from the shell-level shortcut', () => {
    render(<AppShell />)

    mocks.commandHandlers.get('app.search')?.()

    expect(mocks.showSearchPopup).toHaveBeenCalledTimes(1)
  })

  it('sets the ChatWise shell variant on the root for all routes', () => {
    const { container } = render(<AppShell />)

    const root = container.firstElementChild
    expect(root).toHaveAttribute('data-shell-variant', 'chatwise')
  })

  it('does not render a browser tab bar', () => {
    render(<AppShell />)

    expect(screen.queryByTestId('tab-bar')).toBeNull()
  })

  it('keeps the Windows/Linux sidebar beside the content column', () => {
    const { container } = render(<AppShell />)

    const root = container.firstElementChild
    const sidebar = screen.getByTestId('sidebar')
    const tabRouter = screen.getByTestId('tab-router')

    if (!(root instanceof HTMLElement)) {
      throw new Error('Expected AppShell to render a root')
    }

    expect(sidebar.parentElement).toBe(root)
    expect(tabRouter.closest('main')).toHaveAttribute('data-ui', 'app.content')
    // Root has exactly [sidebar, contentColumn]
    expect(root.children).toHaveLength(2)
    expect(root.children[0]).toBe(sidebar)
    // contentColumn is the second child and contains the tab router
    const contentColumn = root.children[1]
    expect(contentColumn).toContainElement(tabRouter)
  })

  it.each([
    { name: 'Windows', isLinux: false, isWin: true },
    { name: 'Linux custom title bar', isLinux: true, isWin: false }
  ])('renders one accessible custom control set and a shared drag region on $name', async ({ isLinux, isWin }) => {
    mocks.platformState.isLinux = isLinux
    mocks.platformState.isWin = isWin

    const { container } = render(<AppShell />)

    const dragRegion = container.querySelector("[data-ui~='shell.window-chrome']")
    const contentColumn = screen.getByTestId('tab-router').closest('main')?.parentElement?.parentElement

    await act(async () => {
      await Promise.resolve()
    })

    expect(dragRegion).toBeInTheDocument()
    expect(dragRegion).toHaveClass('[-webkit-app-region:drag]')
    expect(dragRegion).toHaveClass('h-9', 'shrink-0')
    expect(dragRegion).toContainElement(screen.getByRole('button', { name: 'Minimize' }))
    expect(dragRegion).toContainElement(screen.getByRole('button', { name: 'Maximize' }))
    expect(dragRegion).toContainElement(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getAllByRole('button', { name: /Minimize|Maximize|Close/ })).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Minimize' }).parentElement).toHaveClass('[-webkit-app-region:no-drag]')
    expect(contentColumn?.children[0]).toBe(dragRegion)
    expect(contentColumn?.children[1]).toContainElement(screen.getByTestId('tab-router'))

    await waitFor(() => {
      expect(mocks.ipcRequest).toHaveBeenCalledWith('window.is_maximized')
    })
  })

  it('uses the native Linux title bar without duplicate custom controls or drag chrome', () => {
    mocks.platformState.isLinux = true
    mocks.preferenceState.useSystemTitleBar = true

    const { container } = render(<AppShell />)

    expect(container.querySelector("[data-ui~='shell.window-chrome']")).toBeNull()
    expect(screen.queryByRole('button', { name: 'Minimize' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Maximize' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    expect(mocks.ipcRequest).not.toHaveBeenCalledWith('window.is_maximized')
  })

  it.each([
    { initialSystemTitleBar: false, expectedCustomChrome: true },
    { initialSystemTitleBar: true, expectedCustomChrome: false }
  ])(
    'keeps the creation-time Linux frame mode until relaunch when initial system title bar is $initialSystemTitleBar',
    async ({ initialSystemTitleBar, expectedCustomChrome }) => {
      mocks.platformState.isLinux = true
      mocks.preferenceState.useSystemTitleBar = initialSystemTitleBar

      const { container, rerender } = render(<AppShell />)
      const customChrome = () => container.querySelector("[data-ui~='shell.window-chrome']")

      await act(async () => {
        await Promise.resolve()
      })

      expect(Boolean(customChrome())).toBe(expectedCustomChrome)

      mocks.preferenceState.useSystemTitleBar = !initialSystemTitleBar
      rerender(<AppShell />)

      expect(Boolean(customChrome())).toBe(expectedCustomChrome)
    }
  )

  it('wires custom controls and reflects maximize/restore state', async () => {
    const user = userEvent.setup()
    mocks.platformState.isWin = true

    render(<AppShell />)

    const minimize = await screen.findByRole('button', { name: 'Minimize' })
    await user.tab()
    await user.tab()
    await user.tab()

    expect(minimize).toHaveFocus()
    expect(minimize.className).toContain('focus-visible:bg-[rgba(128,128,128,0.3)]')

    await user.click(minimize)
    await user.click(screen.getByRole('button', { name: 'Maximize' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(mocks.ipcRequest).toHaveBeenCalledWith('window.minimize')
    expect(mocks.ipcRequest).toHaveBeenCalledWith('window.maximize')
    expect(mocks.ipcRequest).toHaveBeenCalledWith('window.close')

    act(() => {
      mocks.ipcHandlers.get('window.maximized_changed')?.(true)
    })

    await user.click(await screen.findByRole('button', { name: 'Restore' }))

    expect(screen.queryByRole('button', { name: 'Maximize' })).toBeNull()
    expect(mocks.ipcRequest).toHaveBeenCalledWith('window.unmaximize')
  })

  it('removes custom controls and drag chrome in fullscreen and restores them on exit', async () => {
    mocks.platformState.isWin = true

    const { container } = render(<AppShell />)

    expect(await screen.findByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(container.querySelector("[data-ui~='shell.window-chrome']")).toBeInTheDocument()

    act(() => {
      mocks.ipcHandlers.get('window.fullscreen_changed')?.(true)
    })

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
      expect(container.querySelector("[data-ui~='shell.window-chrome']")).toBeNull()
    })

    act(() => {
      mocks.ipcHandlers.get('window.fullscreen_changed')?.(false)
    })

    expect(await screen.findByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(container.querySelector("[data-ui~='shell.window-chrome']")).toBeInTheDocument()
  })

  it('keeps the macOS traffic lights in the left column beside the content column', () => {
    mocks.platformState.isMac = true

    const { container } = render(<AppShell />)

    const root = container.firstElementChild
    const sidebar = screen.getByTestId('sidebar')
    const tabRouter = screen.getByTestId('tab-router')
    const trafficLightSpacer = screen.getByTestId('macos-traffic-light-spacer')
    const trafficLightDragRegion = screen.getByTestId('macos-traffic-light-drag-region')
    const leftColumn = sidebar.parentElement

    if (!(root instanceof HTMLElement) || !(leftColumn instanceof HTMLElement)) {
      throw new Error('Expected AppShell to render macOS left column')
    }

    expect(trafficLightDragRegion.parentElement).toBe(root)
    expect(trafficLightDragRegion).toHaveClass('absolute', 'top-0', 'left-0')
    expect(trafficLightDragRegion).toHaveClass('w-[env(titlebar-area-x)]')
    expect(leftColumn.parentElement).toBe(root)
    expect(Array.from(leftColumn.children)).toEqual([trafficLightSpacer, sidebar])
    // Root has exactly [trafficLightDragRegion, leftColumn, contentColumn]
    expect(root.children).toHaveLength(3)
    expect(root.children[0]).toBe(trafficLightDragRegion)
    expect(root.children[1]).toBe(leftColumn)
    // contentColumn is the third child and contains the tab router
    const contentColumn = root.children[2]
    expect(contentColumn).toContainElement(tabRouter)
    expect(container.querySelector("[data-ui~='shell.window-chrome']")).toBeNull()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })

  it('removes macOS traffic light placeholders when the window is fullscreen', async () => {
    mocks.platformState.isMac = true
    mocks.ipcRequest.mockResolvedValue(true)

    const { container } = render(<AppShell />)

    await waitFor(() => {
      expect(screen.queryByTestId('macos-traffic-light-spacer')).toBeNull()
    })

    const root = container.firstElementChild
    const sidebar = screen.getByTestId('sidebar')

    if (!(root instanceof HTMLElement)) {
      throw new Error('Expected AppShell to render a root')
    }

    expect(mocks.ipcRequest).toHaveBeenCalledWith('window.is_full_screen')
    expect(screen.queryByTestId('macos-traffic-light-drag-region')).toBeNull()
    expect(sidebar.parentElement?.children).toHaveLength(1)
  })

  it('updates macOS traffic light placeholders from fullscreen events', async () => {
    mocks.platformState.isMac = true

    render(<AppShell />)

    expect(await screen.findByTestId('macos-traffic-light-spacer')).toBeInTheDocument()

    act(() => {
      mocks.ipcHandlers.get('window.fullscreen_changed')?.(true)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('macos-traffic-light-spacer')).toBeNull()
    })

    expect(screen.queryByTestId('macos-traffic-light-drag-region')).toBeNull()

    act(() => {
      mocks.ipcHandlers.get('window.fullscreen_changed')?.(false)
    })

    expect(await screen.findByTestId('macos-traffic-light-spacer')).toBeInTheDocument()
    expect(screen.getByTestId('macos-traffic-light-drag-region')).toBeInTheDocument()
  })

  it('does not let the initial fullscreen query overwrite a newer fullscreen event', async () => {
    mocks.platformState.isMac = true
    let resolveInitialState: ((value: boolean) => void) | undefined
    mocks.ipcRequest.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveInitialState = resolve
        })
    )

    render(<AppShell />)

    act(() => {
      mocks.ipcHandlers.get('window.fullscreen_changed')?.(true)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('macos-traffic-light-spacer')).toBeNull()
    })

    await act(async () => {
      resolveInitialState?.(false)
      await Promise.resolve()
    })

    expect(screen.queryByTestId('macos-traffic-light-spacer')).toBeNull()
    expect(screen.getByTestId('tab-router').closest('main')).toHaveAttribute('data-shell-content-top-inset', 'none')
  })

  it('owns a titlebar content-top inset on macOS non-fullscreen and zeros chat-local residual', () => {
    mocks.platformState.isMac = true

    const { container } = render(<AppShell />)
    const root = container.firstElementChild
    const content = screen.getByTestId('tab-router').closest('main')

    if (!(root instanceof HTMLElement) || !(content instanceof HTMLElement)) {
      throw new Error('Expected AppShell root and content')
    }

    expect(content).toHaveAttribute('data-shell-content-top-inset', 'titlebar')
    expect(content.className).toContain('pt-(--shell-content-top-inset)')
    expect(root.style.getPropertyValue('--shell-content-top-inset')).toBe('var(--shell-titlebar-height)')
    expect(root.style.getPropertyValue('--shell-local-top-inset')).toBe('0px')
    expect(root).toHaveAttribute('data-shell-local-top-inset', 'none')
  })

  it('clears all AppShell titlebar insets in fullscreen and restores only the shared inset on exit', async () => {
    mocks.platformState.isMac = true
    let resolveInitialState: ((value: boolean) => void) | undefined
    mocks.ipcRequest.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveInitialState = resolve
        })
    )

    const { container } = render(<AppShell />)
    const root = container.firstElementChild

    if (!(root instanceof HTMLElement)) {
      throw new Error('Expected AppShell root')
    }

    expect(screen.getByTestId('tab-router').closest('main')).toHaveAttribute('data-shell-content-top-inset', 'titlebar')
    expect(root).toHaveAttribute('data-shell-local-top-inset', 'none')
    expect(root.style.getPropertyValue('--shell-local-top-inset')).toBe('0px')

    await act(async () => {
      resolveInitialState?.(false)
      await Promise.resolve()
    })

    act(() => {
      mocks.ipcHandlers.get('window.fullscreen_changed')?.(true)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('macos-traffic-light-spacer')).toBeNull()
      expect(screen.queryByTestId('macos-traffic-light-drag-region')).toBeNull()
      // Ownership attributes flip with fullscreen; token values follow the same branch.
      expect(screen.getByTestId('tab-router').closest('main')).toHaveAttribute('data-shell-content-top-inset', 'none')
      expect(root).toHaveAttribute('data-shell-local-top-inset', 'none')
      expect(root.style.getPropertyValue('--shell-content-top-inset')).toBe('0px')
      expect(root.style.getPropertyValue('--shell-local-top-inset')).toBe('0px')
      // The portal host receives the same active geometry as the in-tree shell.
      expect(document.documentElement.style.getPropertyValue('--shell-content-top-inset')).toBe('0px')
      expect(document.documentElement.style.getPropertyValue('--shell-local-top-inset')).toBe('0px')
    })

    act(() => {
      mocks.ipcHandlers.get('window.fullscreen_changed')?.(false)
    })

    await waitFor(() => {
      expect(screen.getByTestId('macos-traffic-light-spacer')).toBeInTheDocument()
      expect(screen.getByTestId('macos-traffic-light-drag-region')).toBeInTheDocument()
      expect(screen.getByTestId('tab-router').closest('main')).toHaveAttribute(
        'data-shell-content-top-inset',
        'titlebar'
      )
      expect(root).toHaveAttribute('data-shell-local-top-inset', 'none')
      expect(root.style.getPropertyValue('--shell-content-top-inset')).toBe('var(--shell-titlebar-height)')
      expect(root.style.getPropertyValue('--shell-local-top-inset')).toBe('0px')
      expect(document.documentElement.style.getPropertyValue('--shell-content-top-inset')).toBe(
        'var(--shell-titlebar-height)'
      )
      expect(document.documentElement.style.getPropertyValue('--shell-local-top-inset')).toBe('0px')
    })
  })

  it('does not own a content-top inset on non-mac platforms', () => {
    mocks.platformState.isMac = false

    const { container } = render(<AppShell />)
    const root = container.firstElementChild
    const content = screen.getByTestId('tab-router').closest('main')

    if (!(root instanceof HTMLElement) || !(content instanceof HTMLElement)) {
      throw new Error('Expected AppShell root and content')
    }

    expect(content).toHaveAttribute('data-shell-content-top-inset', 'none')
    expect(root.style.getPropertyValue('--shell-content-top-inset')).toBe('0px')
    expect(root.style.getPropertyValue('--shell-local-top-inset')).toBe('0px')
  })

  it('marks main content and custom window chrome inert while the global navigation drawer is open', async () => {
    mocks.platformState.isWin = true
    render(<AppShell />)

    const main = screen.getByTestId('tab-router').closest('main')
    const windowChrome = document.querySelector("[data-ui~='shell.window-chrome']")
    if (!(main instanceof HTMLElement)) {
      throw new Error('Expected app content main')
    }
    if (!(windowChrome instanceof HTMLElement)) {
      throw new Error('Expected custom window chrome')
    }

    await act(async () => {
      await Promise.resolve()
    })

    // Portal content lives outside main; AppShell must not inert the drawer itself.
    const dialogPortal = document.createElement('div')
    dialogPortal.setAttribute('role', 'dialog')
    dialogPortal.setAttribute('data-testid', 'drawer-portal-probe')
    document.body.appendChild(dialogPortal)

    // jsdom may not implement the inert IDL property; assert the attribute React sets
    // from the native boolean prop `inert={drawerOpen || undefined}`.
    expect(main.hasAttribute('inert')).toBe(false)
    expect(windowChrome.hasAttribute('inert')).toBe(false)
    expect(windowChrome).toHaveClass('[-webkit-app-region:drag]')
    expect(windowChrome).not.toHaveClass('[-webkit-app-region:no-drag]')

    fireEvent.click(screen.getByTestId('mock-drawer-open'))

    expect(main.hasAttribute('inert')).toBe(true)
    expect(windowChrome.hasAttribute('inert')).toBe(true)
    expect(windowChrome).toHaveClass('[-webkit-app-region:no-drag]')
    expect(windowChrome).not.toHaveClass('[-webkit-app-region:drag]')
    // Prefer the IDL boolean when the environment exposes it.
    if ('inert' in main) {
      expect((main as HTMLElement & { inert: boolean }).inert).toBe(true)
    }
    expect(dialogPortal.hasAttribute('inert')).toBe(false)
    // Sidebar/drawer control stays operable while main is inert.
    expect(screen.getByTestId('sidebar')).not.toHaveAttribute('inert')

    fireEvent.click(screen.getByTestId('mock-drawer-close'))

    expect(main.hasAttribute('inert')).toBe(false)
    expect(windowChrome.hasAttribute('inert')).toBe(false)
    expect(windowChrome).toHaveClass('[-webkit-app-region:drag]')
    expect(windowChrome).not.toHaveClass('[-webkit-app-region:no-drag]')
    if ('inert' in main) {
      expect((main as HTMLElement & { inert: boolean }).inert).toBe(false)
    }

    dialogPortal.remove()
  })

  it('owns a dedicated titlebar drag strip inside main on macOS non-fullscreen only', () => {
    mocks.platformState.isMac = true

    render(<AppShell />)

    const main = screen.getByTestId('tab-router').closest('main')
    const drag = screen.getByTestId('shell-content-top-drag-region')

    if (!(main instanceof HTMLElement)) {
      throw new Error('Expected app content main')
    }

    expect(main).toContainElement(drag)
    expect(drag).toHaveAttribute('aria-hidden', 'true')
    expect(drag).toHaveAttribute('data-ui', 'shell.content-top-drag')
    expect(drag.className).toContain('h-(--shell-content-top-inset)')
    expect(drag.className).toContain('[-webkit-app-region:drag]')
    expect(drag.className).toContain('absolute')
    // Strip is behind route content (z-0); routes stay interactive.
    expect(drag.className).toMatch(/\bz-0\b/)
    // Main itself is not a blanket drag surface.
    expect(main.className).not.toContain('[-webkit-app-region:drag]')
  })

  it('removes the titlebar drag strip on macOS fullscreen and non-mac platforms', async () => {
    mocks.platformState.isMac = true

    render(<AppShell />)
    expect(screen.getByTestId('shell-content-top-drag-region')).toBeInTheDocument()

    act(() => {
      mocks.ipcHandlers.get('window.fullscreen_changed')?.(true)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('shell-content-top-drag-region')).toBeNull()
      expect(screen.getByTestId('tab-router').closest('main')).toHaveAttribute('data-shell-content-top-inset', 'none')
    })

    cleanup()
    mocks.platformState.isMac = false
    render(<AppShell />)
    expect(screen.queryByTestId('shell-content-top-drag-region')).toBeNull()
  })
})
