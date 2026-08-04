import { useWindowFrame } from '@renderer/hooks/useWindowFrame'
import { isMac } from '@renderer/utils/platform'
import { cn } from '@renderer/utils/style'
import type { HTMLAttributes } from 'react'

export function ConversationNavigationPane({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const isWindowFrame = useWindowFrame().mode === 'window'

  return (
    <div
      className={cn(
        'conversation-navigation-pane relative flex w-[var(--assistants-width)] flex-col overflow-hidden bg-background transition-[width] duration-300',
        isWindowFrame ? 'h-full' : 'h-[calc(100vh_-_var(--navbar-height))]',
        className
      )}
      {...props}>
      {/* Residual top reserve: its shell host decides whether another titlebar reserve remains. */}
      {isMac && (
        <div
          aria-hidden="true"
          data-shell-local-top-reserve="titlebar"
          className="h-(--shell-local-top-inset) shrink-0 [-webkit-app-region:drag]"
        />
      )}
      <div className="conversation-navigation-pane-content flex flex-1 flex-col overflow-hidden transition-[width] duration-300">
        {children}
      </div>
    </div>
  )
}
