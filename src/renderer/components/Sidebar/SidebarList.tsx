import { MenuItem } from '@cherrystudio/ui'
import { CommandContextMenu } from '@renderer/components/command'
import type { ReactNode } from 'react'

import { ActiveIndicator } from './primitives'
import type { SidebarClickGuard } from './SidebarSortableList'
import { SidebarSortableList } from './SidebarSortableList'
import { SidebarTooltip } from './Tooltip'
import type { ResolvedSidebarEntry, SidebarActiveState, SidebarVisibleLayout } from './types'

export interface SidebarListProps {
  layout: SidebarVisibleLayout
  entries: ResolvedSidebarEntry[]
  active: SidebarActiveState
  onReorder?: (event: { oldIndex: number; newIndex: number }) => void
  onEntryOpen?: () => void
}

/**
 * Renders built-in apps and mini apps as one continuous, drag-reorderable list.
 * A single `SidebarSortableList` (one dnd-kit context) backs the whole list, so a
 * drag can move an item to any position regardless of type — apps and mini apps
 * freely interleave with no divider between them.
 *
 * Entries are already resolved to a type-agnostic shape (see
 * `components/app/sidebarVariants`), so this presentation layer never switches on
 * whether a row is an app or a mini app.
 */
export function SidebarList({ layout, ...props }: SidebarListProps) {
  if (layout === 'icon') return <IconList {...props} />
  return <FullList {...props} />
}

type ListProps = Omit<SidebarListProps, 'layout'>

function EntryContextMenu({
  children,
  items
}: {
  children: ReactNode
  items?: ResolvedSidebarEntry['contextMenuItems']
}) {
  if (!items?.length) return <>{children}</>

  return (
    <CommandContextMenu location="webcontents.context" extraItems={items}>
      {children}
    </CommandContextMenu>
  )
}

function IconList({ entries, active, onReorder, onEntryOpen }: ListProps) {
  return (
    <SidebarSortableList
      items={entries}
      itemKey="key"
      onReorder={onReorder}
      className="flex flex-col items-center gap-0.5 px-1.5 [-webkit-app-region:no-drag]">
      {(entry, guardClick) => {
        const isActive = entry.isActive(active)

        return (
          <SidebarTooltip key={entry.key} content={entry.label}>
            <EntryContextMenu items={entry.contextMenuItems}>
              <button
                type="button"
                aria-label={entry.label}
                onClick={guardClick(entry.key, () => {
                  entry.onOpen()
                  onEntryOpen?.()
                })}
                className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-150 ${
                  isActive
                    ? 'bg-[var(--sidebar-active-bg)] text-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                }`}>
                {isActive && <ActiveIndicator className="rounded-lg" />}
                {entry.renderIcon(18, 'lg')}
              </button>
            </EntryContextMenu>
          </SidebarTooltip>
        )
      }}
    </SidebarSortableList>
  )
}

function FullList({ entries, active, onReorder, onEntryOpen }: ListProps) {
  return (
    <SidebarSortableList
      items={entries}
      itemKey="key"
      onReorder={onReorder}
      className="space-y-0.5 px-2 [-webkit-app-region:no-drag]">
      {(entry, guardClick: SidebarClickGuard) => {
        const isActive = entry.isActive(active)

        return (
          <div key={entry.key} className="relative">
            <EntryContextMenu items={entry.contextMenuItems}>
              <MenuItem
                variant="ghost"
                icon={entry.renderIcon(16, 'md')}
                label={entry.label}
                active={isActive}
                onClick={guardClick(entry.key, () => {
                  entry.onOpen()
                  onEntryOpen?.()
                })}
                className="rounded-lg data-[active=true]:bg-[var(--sidebar-active-bg)]"
              />
            </EntryContextMenu>
            {isActive && <ActiveIndicator className="rounded-lg" />}
          </div>
        )
      }}
    </SidebarSortableList>
  )
}
