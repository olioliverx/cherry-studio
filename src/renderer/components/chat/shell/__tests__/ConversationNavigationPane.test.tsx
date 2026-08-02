// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  platformState: { isMac: true },
  windowFrameMode: 'tab' as 'tab' | 'window'
}))

vi.mock('@renderer/utils/platform', () => ({
  get isMac() {
    return mocks.platformState.isMac
  }
}))

vi.mock('@renderer/hooks/useWindowFrame', () => ({
  useWindowFrame: () => ({ mode: mocks.windowFrameMode })
}))

import { ConversationNavigationPane } from '../ConversationNavigationPane'

afterEach(() => {
  cleanup()
  mocks.platformState.isMac = true
  mocks.windowFrameMode = 'tab'
})

describe('ConversationNavigationPane', () => {
  it('uses the residual local top inset token on macOS instead of a fixed h-11 spacer', () => {
    const { container } = render(
      <ConversationNavigationPane>
        <div>nav</div>
      </ConversationNavigationPane>
    )

    const reserve = container.querySelector('[data-shell-local-top-reserve="titlebar"]')
    expect(reserve).toBeTruthy()
    expect(reserve?.className).toContain('h-(--shell-local-top-inset)')
    expect(reserve?.className).not.toMatch(/\bh-11\b/)
  })

  it('does not render a local top reserve on non-mac platforms', () => {
    mocks.platformState.isMac = false

    const { container } = render(
      <ConversationNavigationPane>
        <div>nav</div>
      </ConversationNavigationPane>
    )

    expect(container.querySelector('[data-shell-local-top-reserve="titlebar"]')).toBeNull()
  })

  it('retains the residual titlebar reserve contract in detached window mode', () => {
    // Detached chat windows are not under AppShell ownership; --shell-local-top-inset
    // defaults to the physical titlebar height so the reserve stays 44px.
    mocks.windowFrameMode = 'window'
    mocks.platformState.isMac = true

    const { container } = render(
      <ConversationNavigationPane>
        <div>nav</div>
      </ConversationNavigationPane>
    )

    const pane = container.firstElementChild as HTMLElement
    const reserve = container.querySelector('[data-shell-local-top-reserve="titlebar"]')

    expect(pane.className).toContain('h-full')
    expect(reserve).toBeTruthy()
    expect(reserve?.className).toContain('h-(--shell-local-top-inset)')
    expect(reserve?.className).toContain('[-webkit-app-region:drag]')
  })
})
