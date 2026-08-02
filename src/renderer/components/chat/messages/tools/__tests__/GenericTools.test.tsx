import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ToolStatusIndicator } from '../shared/GenericTools'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: vi.fn() }
}))

describe('ToolStatusIndicator', () => {
  it('renders completed tools with semantic success color', () => {
    render(<ToolStatusIndicator status="done" />)

    expect(screen.getByText('message.tools.completed')).toHaveStyle({ color: 'var(--success)' })
  })

  it('keeps invoking and pending tools on the primary color', () => {
    const { rerender } = render(<ToolStatusIndicator status="invoking" />)

    expect(screen.getByText('message.tools.invoking')).toHaveStyle({ color: 'var(--primary)' })

    rerender(<ToolStatusIndicator status="pending" />)

    expect(screen.getByText('message.tools.invoking')).toHaveStyle({ color: 'var(--primary)' })
  })
})
