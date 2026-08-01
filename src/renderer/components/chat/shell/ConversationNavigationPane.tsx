import { useWindowFrame } from '@renderer/hooks/useWindowFrame'
import { isMac } from '@renderer/utils/platform'
import { cn } from '@renderer/utils/style'
import type { HTMLAttributes } from 'react'

export function ConversationNavigationPane({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const isWindowFrame = useWindowFrame().mode === 'window'

  return (
    <div
      className={cn(
        'conversation-navigation-pane relative flex w-[var(--assistants-width)] flex-col overflow-hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-300',
        isWindowFrame ? 'h-full' : 'h-[calc(100vh_-_var(--navbar-height))]',
        className
      )}
      {...props}>
      {/* ChatWise mode: macOS traffic-light drag spacer at the top of the sidebar */}
      {isMac && <div aria-hidden="true" className="h-11 shrink-0 [-webkit-app-region:drag]" />}
      <div className="conversation-navigation-pane-content flex flex-1 flex-col overflow-hidden transition-[width] duration-300">
        {children}
      </div>
    </div>
  )
}
