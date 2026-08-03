import { render, screen } from '@testing-library/react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { PaintingData } from '../../model/types/paintingData'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

vi.mock('@cherrystudio/ui', () => ({
  Button: ({
    children,
    size,
    type = 'button',
    variant,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode; size?: string; variant?: string }) => {
    void size
    void variant
    return (
      <button type={type} {...props}>
        {children}
      </button>
    )
  },
  ConfirmDialog: () => null,
  Tooltip: ({ children }: { children: ReactNode }) => children
}))

vi.mock('../PaintingSkeletonSurface', () => ({
  default: () => <div data-testid="painting-skeleton-surface" />
}))

const { default: PaintingStrip } = await import('../PaintingStrip')

const painting: PaintingData = {
  id: 'painting-1',
  providerId: 'openai',
  mode: 'generate',
  model: 'gpt-image-1',
  prompt: '',
  files: []
}

describe('PaintingStrip', () => {
  it('uses the skeleton surface for a running painting without a preview yet', () => {
    render(
      <PaintingStrip
        runningPaintingId={painting.id}
        items={[painting]}
        hasMore={false}
        loadMore={vi.fn()}
        onDeletePainting={vi.fn()}
        onSelectPainting={vi.fn()}
        onAddPainting={vi.fn()}
      />
    )

    expect(screen.getByTestId('painting-skeleton-surface')).toBeInTheDocument()
  })

  it('keeps the 68px strip and New Image action while applying launcher bottom inset only on the scroll strip', () => {
    // Populated-strip contract: page only mounts this component when history has items.
    const { container } = render(
      <PaintingStrip
        items={[painting]}
        hasMore={false}
        loadMore={vi.fn()}
        onDeletePainting={vi.fn()}
        onSelectPainting={vi.fn()}
        onAddPainting={vi.fn()}
      />
    )

    const strip =
      container.querySelector('[data-ui="paintings.painting-strip"]') ??
      container.querySelector('.w-\\[68px\\]') ??
      container.firstElementChild
    expect(strip).toBeTruthy()
    expect(strip).toHaveAttribute('data-ui', 'paintings.painting-strip')
    expect(strip?.className).toContain('w-[68px]')
    expect(strip).toHaveClass('shell-launcher-clearance')
    expect(strip?.className).not.toContain('--shell-launcher-bottom-inset')
    // No local titlebar pad — AppShell owns content-top inset.
    expect(strip?.className).not.toMatch(/pt-\[var\(--shell-titlebar/)
    expect(screen.getByRole('button', { name: 'paintings.button.new.image' })).toBeInTheDocument()
  })
})
