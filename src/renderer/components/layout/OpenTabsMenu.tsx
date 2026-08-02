import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Tooltip
} from '@cherrystudio/ui'
import type { SidebarVisibleLayout } from '@renderer/components/Sidebar'
import { useTabs } from '@renderer/hooks/tab'
import { cn } from '@renderer/utils/style'
import { getTabCapabilities } from '@renderer/utils/tabCapabilities'
import type { Tab } from '@shared/data/cache/cacheValueTypes'
import { Check, ExternalLink, Moon, PanelTop } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

type OpenTabsMenuProps = {
  layout: SidebarVisibleLayout
  onTabSelect?: () => void
}

export function OpenTabsMenu({ layout, onTabSelect }: OpenTabsMenuProps) {
  const { t } = useTranslation()
  const { activeTabId, closeTab, closeTabs, detachTab, pinTab, reorderTabs, setActiveTab, tabs, unpinTab } = useTabs()
  const { normalTabs, pinnedTabs } = useMemo(() => {
    const pinned: Tab[] = []
    const normal: Tab[] = []
    for (const tab of tabs) {
      if (tab.isPinned) pinned.push(tab)
      else normal.push(tab)
    }
    return { normalTabs: normal, pinnedTabs: pinned }
  }, [tabs])
  const label = t('tab.open_tabs')

  const selectTab = (tabId: string) => {
    setActiveTab(tabId)
    onTabSelect?.()
  }

  const moveToFirst = (tab: Tab) => {
    const list = tab.isPinned ? pinnedTabs : normalTabs
    const currentIndex = list.findIndex((candidate) => candidate.id === tab.id)
    if (currentIndex > 0) {
      reorderTabs(tab.isPinned ? 'pinned' : 'normal', currentIndex, 0)
    }
  }

  const closeOthers = (tab: Tab) => {
    closeTabs(
      normalTabs.filter((candidate) => candidate.id !== tab.id).map((candidate) => candidate.id),
      tab.id
    )
  }

  const closeToRight = (tab: Tab) => {
    const normalIndex = normalTabs.findIndex((candidate) => candidate.id === tab.id)
    closeTabs(
      normalTabs.slice(normalIndex + 1).map((candidate) => candidate.id),
      tab.id
    )
  }

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size={layout === 'icon' ? 'icon' : 'default'}
      aria-label={label}
      className={cn(
        layout === 'icon'
          ? 'flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground'
          : 'flex w-full items-center justify-start gap-2.5 rounded-lg px-2.5 py-1.75 text-[13px] text-foreground transition-colors hover:bg-accent/60'
      )}>
      <PanelTop size={layout === 'icon' ? 18 : 16} strokeWidth={1.6} />
      {layout === 'full' && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
      <span
        aria-hidden="true"
        className={cn(
          'flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] text-muted-foreground leading-4',
          layout === 'icon' && 'absolute mt-[-22px] ml-[22px]'
        )}>
        {tabs.length}
      </span>
    </Button>
  )

  return (
    <DropdownMenu>
      <Tooltip content={label} placement="right" delay={500}>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent
        side="right"
        align="end"
        sideOffset={8}
        portalContainer={document.body}
        className="z-[90] max-h-[min(28rem,calc(100vh-1rem))] w-[min(19rem,calc(100vw-2rem))]">
        <DropdownMenuLabel className="text-muted-foreground text-xs">{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tabs.map((tab) => {
          const isPinned = !!tab.isPinned
          const list = isPinned ? pinnedTabs : normalTabs
          const index = list.findIndex((candidate) => candidate.id === tab.id)
          const statusLabels = [
            tab.id === activeTabId ? t('tab.active') : null,
            tab.isDormant ? t('tab.dormant') : null
          ]
            .filter(Boolean)
            .join(', ')
          const capabilities = getTabCapabilities(tab, {
            pinnedCount: pinnedTabs.length,
            normalCount: normalTabs.length,
            canDetach: true,
            normalIndex: isPinned ? undefined : index
          })

          return (
            <DropdownMenuSub key={tab.id}>
              <DropdownMenuSubTrigger
                aria-label={statusLabels ? `${tab.title}, ${statusLabels}` : tab.title}
                aria-current={tab.id === activeTabId ? 'page' : undefined}
                data-pinned={isPinned ? 'true' : undefined}
                className="min-w-0">
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {tab.id === activeTabId ? (
                    <Check aria-hidden="true" />
                  ) : tab.isDormant ? (
                    <Moon aria-hidden="true" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1 truncate" title={tab.title}>
                  {tab.title}
                </span>
                {tab.id === activeTabId && <span className="sr-only">{t('tab.active')}</span>}
                {tab.isDormant && <span className="sr-only">{t('tab.dormant')}</span>}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="z-[90] min-w-48">
                <DropdownMenuItem
                  disabled={tab.id === activeTabId && !tab.isDormant}
                  onSelect={() => selectTab(tab.id)}>
                  {t('common.open')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={!capabilities.reorder || index === 0} onSelect={() => moveToFirst(tab)}>
                  {t('tab.move_to_first')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => (isPinned ? unpinTab(tab.id) : pinTab(tab.id))}>
                  {isPinned ? t('tab.unpin') : t('tab.pin')}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!capabilities.detach} onSelect={() => detachTab(tab.id)}>
                  <ExternalLink aria-hidden="true" />
                  {t('tab.open_in_new_window')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={!capabilities.close}
                  onSelect={() => closeTab(tab.id)}>
                  {t('tab.close')}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!capabilities.closeOthers} onSelect={() => closeOthers(tab)}>
                  {t('tab.close_others')}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!capabilities.closeToRight} onSelect={() => closeToRight(tab)}>
                  {t('tab.close_to_right')}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
