import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SettingsPage from '../SettingsPage'

const responsiveStyles = readFileSync(join(process.cwd(), 'src/renderer/assets/styles/responsive.css'), 'utf8')

const { isMacTransparentWindowMock, navigateMock } = vi.hoisted(() => ({
  isMacTransparentWindowMock: vi.fn(),
  navigateMock: vi.fn()
}))

vi.mock('@cherrystudio/ui', () => ({
  MenuDivider: () => <hr data-testid="menu-divider" />,
  MenuItem: ({ icon, label, onClick }: { icon?: ReactNode; label: string; onClick?: () => void }) => (
    <button type="button" data-testid="menu-item" onClick={onClick}>
      {icon}
      {label}
    </button>
  ),
  MenuList: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="settings-menu-list" className={className}>
      {children}
    </div>
  ),
  PageHeader: ({ className, title }: { className?: string; title: string }) => (
    <div data-slot="page-header" className={className}>
      <h2>{title}</h2>
    </div>
  )
}))

vi.mock('@renderer/components/Scrollbar', () => ({
  default: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="settings-navigation-scroll" className={className}>
      {children}
    </div>
  )
}))

vi.mock('@renderer/hooks/useMacTransparentWindow', () => ({
  default: () => isMacTransparentWindowMock()
}))

vi.mock('@tanstack/react-router', () => ({
  Outlet: () => null,
  useLocation: () => ({ pathname: '/settings/provider' }),
  useNavigate: () => navigateMock
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'agent.settings.toolsMcp.mcp.tab': 'MCP',
        'selection.name': '划词助手',
        'settings.channels.title': '频道',
        'settings.dependencies.title': '环境依赖',
        'settings.dependencies.localModels.title': '本地模型',
        'settings.menuGroups.automation': '效率',
        'settings.menuGroups.capabilities': '工具',
        'settings.menuGroups.personal': '偏好',
        'settings.menuGroups.quickAccess': '快捷入口',
        'settings.model': '默认模型',
        'settings.quickAssistant.title': '快捷助手',
        'settings.scheduledTasks.title': '定时任务',
        'settings.shortcuts.title': '快捷键',
        'settings.skills.title': '技能',
        'settings.system.title': '系统',
        'settings.tool.file_processing.features.image_to_text.title': 'OCR',
        'settings.tool.file_processing.features.document_to_markdown.title': '文档处理'
      })[key] ?? key
  })
}))

describe('SettingsPage', () => {
  beforeEach(() => {
    isMacTransparentWindowMock.mockReturnValue(false)
    navigateMock.mockReset()
  })

  it('places local models directly below the default model', () => {
    const { container } = render(<SettingsPage />)

    expect(container.querySelector('[data-ui~="settings.view"]')).toBeInTheDocument()
    expect(container.querySelector('[data-ui~="settings.navigation"]')).toBeInTheDocument()
    expect(container.querySelector('[data-ui~="settings.content"]')).toBeInTheDocument()
    expect(screen.getByText('偏好')).toBeInTheDocument()

    const defaultModelItem = screen.getByRole('button', { name: '默认模型' })
    const localModelsItem = screen.getByRole('button', { name: '本地模型' })

    expect(defaultModelItem.nextElementSibling).toBe(localModelsItem)
    fireEvent.click(localModelsItem)
    expect(navigateMock).toHaveBeenCalledWith({ to: '/settings/local-models' })
  })

  it('keeps document processing and OCR together in tools and places dependencies below system', () => {
    render(<SettingsPage />)

    expect(screen.getByText('工具')).toBeInTheDocument()

    const documentProcessingItem = screen.getByRole('button', { name: '文档处理' })
    const ocrItem = screen.getByRole('button', { name: 'OCR' })
    expect(documentProcessingItem.nextElementSibling).toBe(ocrItem)
    expect(ocrItem.nextElementSibling).toHaveAttribute('data-testid', 'menu-divider')

    const systemItem = screen.getByRole('button', { name: '系统' })
    const dependenciesItem = screen.getByRole('button', { name: '环境依赖' })
    expect(systemItem.nextElementSibling).toBe(dependenciesItem)
    fireEvent.click(dependenciesItem)
    expect(navigateMock).toHaveBeenCalledWith({ to: '/settings/dependencies' })
  })

  it('places Skills directly below MCP and opens the Skills settings page', () => {
    render(<SettingsPage />)

    const mcpItem = screen.getByText('MCP').closest('button')
    const skillsItem = screen.getByRole('button', { name: '技能' })

    expect(mcpItem).not.toBeNull()
    expect(mcpItem?.nextElementSibling).toBe(skillsItem)
    fireEvent.click(skillsItem)
    expect(navigateMock).toHaveBeenCalledWith({ to: '/settings/skills' })
  })

  it('merges quick access into efficiency and places both assistants last', () => {
    render(<SettingsPage />)

    expect(screen.getByText('效率')).toBeInTheDocument()
    expect(screen.queryByText('快捷入口')).not.toBeInTheDocument()

    const efficiencyItems = ['频道', '定时任务', '快捷键', '快捷助手', '划词助手'].map((name) =>
      screen.getByRole('button', { name })
    )
    const menuItems = screen.getAllByTestId('menu-item')
    const efficiencyStart = menuItems.indexOf(efficiencyItems[0])

    expect(menuItems.slice(efficiencyStart, efficiencyStart + efficiencyItems.length)).toEqual(efficiencyItems)
    expect(efficiencyItems.at(-1)?.nextElementSibling).toHaveAttribute('data-testid', 'menu-divider')
  })

  it('keeps default PageHeader mt-3 and launcher inset only on the navigation menu list', () => {
    const { container } = render(<SettingsPage />)

    const navigation = container.querySelector('[data-ui~="settings.navigation"]')
    const content = container.querySelector('[data-ui~="settings.content"]')
    const pageHeader = navigation?.querySelector('[data-slot="page-header"]')
    const navigationScroll = screen.getByTestId('settings-navigation-scroll')
    const menuList = screen.getByTestId('settings-menu-list')

    expect(navigation).toBeTruthy()
    expect(content).toBeTruthy()
    expect(pageHeader).toBeTruthy()
    // Default spacing for Windows/Linux and mac fullscreen; AppShell titlebar
    // ownership suppresses mt-3 via responsive.css descendant rule.
    expect(pageHeader?.className).toMatch(/\bmt-3\b/)
    // At short window heights this is the only navigation region allowed to
    // shrink and scroll; PageHeader itself owns shrink-0.
    expect(navigation?.className).toMatch(/\bmin-h-0\b/)
    expect(navigationScroll.className).toMatch(/\bmin-h-0\b/)
    expect(navigationScroll.className).toMatch(/\bflex-1\b/)
    expect(menuList).toHaveClass('shell-launcher-clearance')
    expect(menuList.className).not.toContain('--shell-launcher-bottom-inset')
    expect(content?.className).not.toContain('--shell-launcher-bottom-inset')
    expect(navigation?.className).not.toContain('--shell-launcher-bottom-inset')
    expect(responsiveStyles).toContain('.shell-launcher-clearance')
    expect(responsiveStyles).toContain('var(--shell-launcher-bottom-inset)')
  })

  it('keeps nested ordinary launcher clearance independent from a flush owner', () => {
    const { container } = render(
      <div className="shell-launcher-clearance shell-launcher-clearance-flush" data-testid="flush-owner">
        <div className="shell-launcher-clearance" data-testid="ordinary-consumer" />
      </div>
    )
    const flushOwner = screen.getByTestId('flush-owner')
    const ordinaryConsumer = screen.getByTestId('ordinary-consumer')

    expect(flushOwner.matches('.shell-launcher-clearance.shell-launcher-clearance-flush')).toBe(true)
    expect(ordinaryConsumer.matches('.shell-launcher-clearance:not(.shell-launcher-clearance-flush)')).toBe(true)
    expect(responsiveStyles).toMatch(
      /\.shell-launcher-clearance\s*{\s*padding-bottom:\s*calc\(calc\(var\(--spacing\) \* 3\) \+ var\(--shell-launcher-bottom-inset\)\);\s*}/
    )
    expect(responsiveStyles).toMatch(
      /\.shell-launcher-clearance\.shell-launcher-clearance-flush\s*{\s*padding-bottom:\s*var\(--shell-launcher-bottom-inset\);\s*}/
    )
    expect(responsiveStyles).not.toContain('--shell-launcher-clearance-base')
    expect(container.querySelectorAll('.shell-launcher-clearance')).toHaveLength(2)
  })

  it('keeps the Settings header selector shape the AppShell titlebar suppress rule targets', () => {
    // responsive.css:
    // main[data-shell-content-top-inset='titlebar'] [data-ui~='settings.navigation'] > [data-slot='page-header']
    // { margin-top: 0 }
    // Settings owns default mt-3; AppShell owns the attribute that activates the suppress rule.
    const { container } = render(<SettingsPage />)
    const navigation = container.querySelector('[data-ui~="settings.navigation"]')
    const pageHeader = navigation?.querySelector(':scope > [data-slot="page-header"]')

    expect(pageHeader).toBeTruthy()
    expect(pageHeader?.className).toMatch(/\bmt-3\b/)
    expect(responsiveStyles).toContain(
      "main[data-shell-content-top-inset='titlebar'] [data-ui~='settings.navigation'] > [data-slot='page-header']"
    )
    // Direct-child PageHeader is required by the descendant rule's child selector.
    expect(navigation?.firstElementChild).toBe(pageHeader)
  })
})
