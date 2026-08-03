import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FileSidebar } from '../FileSidebar'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

describe('FileSidebar', () => {
  it('applies shared launcher clearance to the navigation list', () => {
    const { container } = render(
      <FileSidebar filter={{ kind: 'library', value: 'all' }} fileCounts={{}} onFilterChange={vi.fn()} />
    )

    expect(container.querySelector('.shell-launcher-clearance')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'files.all' })).toBeInTheDocument()
  })
})
