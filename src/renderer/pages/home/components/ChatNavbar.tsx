import { usePreference } from '@data/hooks/usePreference'
import { ConversationSidebarToggleButton } from '@renderer/components/chat/shell/ConversationSidebarToggleButton'
import { ConversationTopBarPortalHost } from '@renderer/components/chat/shell/ConversationTopBarPortal'
import { NavbarHeader } from '@renderer/components/Navbar'
import type { FC, ReactNode } from 'react'

interface HeaderNavbarProps {
  conversationControls?: ReactNode
  showSidebarControls?: boolean
  sidebarOpen?: boolean
  onSidebarToggle?: () => void
}

const HeaderNavbar: FC<HeaderNavbarProps> = ({
  conversationControls,
  showSidebarControls = true,
  sidebarOpen,
  onSidebarToggle
}) => {
  const [preferredShowSidebar] = usePreference('topic.tab.show')
  const showSidebar = sidebarOpen ?? preferredShowSidebar

  return (
    <NavbarHeader className="home-navbar relative" style={{ height: 'var(--navbar-height)' }}>
      <div className="-mx-1 flex h-full min-w-0 flex-1 items-center overflow-hidden">
        {/* Left: sidebar toggle */}
        <div className="flex shrink-0 items-center [-webkit-app-region:no-drag]">
          {showSidebarControls && (
            <ConversationSidebarToggleButton
              sidebarOpen={showSidebar}
              onSidebarToggle={onSidebarToggle}
              tooltipPlacement="bottom"
            />
          )}
        </div>
        {/* Center: model/assistant selector — ChatWise-style centered title */}
        <div className="flex min-w-0 flex-1 items-center justify-center overflow-hidden">
          <ConversationTopBarPortalHost>{conversationControls}</ConversationTopBarPortalHost>
        </div>
        {/* Right: spacer to balance the centered title */}
        <div
          className="flex shrink-0 items-center"
          style={{ width: showSidebarControls ? 'var(--navbar-height)' : 0 }}
        />
      </div>
    </NavbarHeader>
  )
}

export default HeaderNavbar
