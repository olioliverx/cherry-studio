import './Sidebar.css'

import useMacTransparentWindow from '@renderer/hooks/useMacTransparentWindow'
import { cn } from '@renderer/utils/style'
import { Search } from 'lucide-react'
import React, { type Ref } from 'react'

import { getSidebarDisplayWidth, getSidebarLayout } from './constants'
import { DefaultLogo } from './primitives'
import { SidebarFooter, type SidebarFooterActions } from './SidebarFooter'
import { SidebarList } from './SidebarList'
import { SidebarTooltip } from './Tooltip'
import type { ResolvedSidebarEntry, SidebarActiveState, SidebarUser } from './types'
import { useSidebarResize } from './useSidebarResize'

export interface SidebarProps {
  width: number
  setWidth: (width: number) => void
  entries: ResolvedSidebarEntry[]
  active: SidebarActiveState
  title?: string
  logo?: React.ReactNode
  user?: SidebarUser
  isFloating?: boolean
  searchLabel?: string
  extensionsLabel?: string
  actions?: SidebarFooterActions
  onHoverChange?: (visible: boolean) => void
  onResizePreview?: (width: number | null) => void
  onSearchClick?: () => void
  onExtensionsClick?: () => void
  onEntriesReorder?: (event: { oldIndex: number; newIndex: number }) => void
  onEntryOpen?: () => void
  /** @deprecated Modal dismiss is owned by the Dialog host; kept for call-site compatibility. */
  onDismiss?: () => void
  /** @deprecated Focus is owned by Dialog FocusScope; kept for call-site compatibility. */
  floatingPanelRef?: Ref<HTMLDivElement>
}

export function Sidebar({
  width,
  setWidth,
  entries,
  active,
  title = '',
  logo,
  user,
  isFloating = false,
  searchLabel = '',
  extensionsLabel = '',
  actions,
  onHoverChange,
  onResizePreview,
  onSearchClick,
  onExtensionsClick,
  onEntriesReorder,
  onEntryOpen
}: SidebarProps) {
  const isMacTransparentWindow = useMacTransparentWindow()
  const { sidebarRef, startResizing } = useSidebarResize(width, setWidth, onResizePreview)
  const layout = getSidebarLayout(width)
  const showFooter = Boolean(extensionsLabel || user || onExtensionsClick || actions)
  const showSearch = Boolean(onSearchClick)
  const logoNode = logo ?? <DefaultLogo title={title} />

  const renderLogo = (size: 'sm' | 'default' = 'default') => (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden *:h-full *:w-full',
        size === 'sm' ? 'size-8 rounded-lg' : 'size-9 rounded-lg'
      )}>
      {logoNode}
    </div>
  )

  const listProps = {
    entries,
    active,
    onReorder: onEntriesReorder,
    onEntryOpen
  }
  const footerProps = { user, actions, extensionsLabel, onExtensionsClick }

  // --- Floating sidebar (panel presentation only; Dialog host owns modal chrome) ---
  if (isFloating) {
    return (
      <div
        data-testid="floating-sidebar"
        className="sidebar-theme flex h-full w-43.5 select-none flex-col bg-sidebar [-webkit-app-region:drag]">
        <div className="flex h-14 shrink-0 items-center gap-2.5 px-4 [-webkit-app-region:drag]">
          {renderLogo()}
          <span className="truncate text-sidebar-foreground text-sm">{title}</span>
        </div>

        {showSearch && (
          <div className="px-3 py-2">
            <div
              onClick={() => {
                onSearchClick?.()
                onEntryOpen?.()
              }}
              className="flex cursor-pointer items-center gap-2 rounded-md bg-sidebar-accent/50 px-2.5 py-1.5 text-muted-foreground text-xs transition-colors [-webkit-app-region:no-drag] hover:bg-accent">
              <Search size={13} />
              <span>{searchLabel}</span>
            </div>
          </div>
        )}

        <div
          data-ui="sidebar.navigation"
          className="flex-1 overflow-y-auto py-1 [-webkit-app-region:no-drag] [&::-webkit-scrollbar]:hidden">
          <SidebarList layout="full" {...listProps} />
        </div>

        {showFooter && (
          <div className="shrink-0">
            <SidebarFooter layout="full" {...footerProps} />
          </div>
        )}
      </div>
    )
  }

  // --- Hidden sidebar (resize handle only; hover no longer opens navigation) ---
  if (layout === 'hidden') {
    return (
      <div ref={sidebarRef} className="relative h-full w-2 shrink-0">
        <div className="absolute inset-y-0 left-0 z-50 w-4 [-webkit-app-region:no-drag]">
          <div
            onMouseDown={(event) => {
              onHoverChange?.(false)
              startResizing(event)
            }}
            className="group/handle h-full w-full cursor-col-resize">
            <div className="ml-0.5 h-full w-0.5 rounded-full bg-primary/30 opacity-0 transition-opacity group-hover/handle:opacity-100" />
          </div>
        </div>
      </div>
    )
  }

  // --- Visible sidebar (icon / full) ---
  const actualWidth = getSidebarDisplayWidth(width)

  return (
    <div
      ref={sidebarRef}
      style={{ width: actualWidth }}
      className={cn(
        'sidebar-theme group/sidebar relative z-20 flex h-full shrink-0 select-none flex-col [-webkit-app-region:drag]',
        isMacTransparentWindow ? 'bg-transparent backdrop-blur-xl backdrop-saturate-150' : 'bg-sidebar'
      )}>
      {/* Header */}
      <div
        className={`flex shrink-0 items-center [-webkit-app-region:drag] ${layout === 'full' ? 'h-14 gap-2.5 px-4' : 'h-14 justify-center'}`}>
        {renderLogo(layout === 'icon' ? 'sm' : 'default')}
        {layout === 'full' && <span className="truncate text-sidebar-foreground text-sm">{title}</span>}
      </div>

      {/* Search */}
      {showSearch &&
        (layout === 'full' ? (
          <div className="px-3 py-2">
            <div
              onClick={onSearchClick}
              className="flex cursor-pointer items-center gap-2 rounded-md bg-sidebar-accent px-2.5 py-1.5 text-muted-foreground text-xs transition-colors [-webkit-app-region:no-drag] hover:bg-accent">
              <Search size={13} />
              <span>{searchLabel}</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-1.5 [-webkit-app-region:no-drag]">
            <SidebarTooltip content={searchLabel}>
              <button
                type="button"
                onClick={onSearchClick}
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground">
                <Search size={16} strokeWidth={1.6} />
              </button>
            </SidebarTooltip>
          </div>
        ))}

      {/* Content */}
      <div data-ui="sidebar.navigation" className="flex-1 overflow-y-auto py-1 [&::-webkit-scrollbar]:hidden">
        <SidebarList layout={layout} {...listProps} />
      </div>

      {/* Footer */}
      {showFooter && (
        <div className="shrink-0">
          <SidebarFooter layout={layout} {...footerProps} />
        </div>
      )}

      {/* Resize handle */}
      <div
        onMouseDown={startResizing}
        className="group/handle absolute top-0 right-0 bottom-0 z-50 w-0.75 cursor-col-resize [-webkit-app-region:no-drag]">
        <div className="h-full w-full bg-primary/20 opacity-0 transition-opacity group-hover/handle:opacity-100" />
      </div>
    </div>
  )
}
