# ChatWise UI for Cherry Studio

Restyling Cherry Studio's UI to match [ChatWise](https://chatwise.app)'s clean, minimalist aesthetic while preserving all Cherry Studio features and maintaining upstream mergeability.

## Branch

- **`chatwise-ui`** — all UI restyle work
- **`main`** — stays aligned with upstream for tracking

## Git Workflow

### Remotes

```
origin    → olioliverx/cherry-studio (your fork)
upstream  → CherryHQ/cherry-studio   (official)
```

### Syncing with upstream

```bash
# Fetch upstream changes
git fetch upstream

# Rebase your UI work onto the latest upstream
git checkout chatwise-ui
git rebase upstream/main

# Force-push the rebased branch
git push --force-with-lease origin chatwise-ui
```

The table below highlights the main conflict surface. Most changes remain presentation-only, but the final app-wide pass
also touches route-owned feature components.

### Files changed (conflict surface)

| File | Phase | Risk |
|------|-------|------|
| `packages/ui/src/styles/tokens/colors/providers.css` | 1 | Low — CSS values only |
| `packages/ui/src/styles/product.css` | 1 | Low — CSS values only |
| `src/renderer/components/Sidebar/Sidebar.css` | 1 | Low — CSS values only |
| `src/renderer/components/Sidebar/Sidebar.tsx` | 2, 4 | Medium — className changes |
| `src/renderer/components/Sidebar/SidebarList.tsx` | 2 | Medium — className changes |
| `src/renderer/components/layout/AppShell.tsx` | 4 | Medium — removed panel border/rounding |
| `src/renderer/components/layout/AppShellTabBar.tsx` | 2, 4 | Medium — height + bg changes |
| `src/renderer/components/composer/ComposerSurface.tsx` | 3, 4 | Low — border/shadow values |
| `src/renderer/components/chat/shell/ConversationShell.tsx` | 4 | Medium — removed rounded corners |
| `src/renderer/components/chat/shell/ConversationNavigationPane.tsx` | 4 | Low — bg + border classes |
| `src/renderer/components/chat/shell/ConversationTopBarPortal.tsx` | 4 | Low — added justify-center |
| `src/renderer/pages/home/components/ChatNavbar.tsx` | 4 | Medium — centered header layout |
| `src/renderer/pages/home/HomePage.tsx` | 4 | Low — removed rounded corners |
| `src/renderer/pages/{files,knowledge,translate,notes,code,paintings}/` | 6 | Low — presentation classes only |

## Design Reference

ChatWise UI characteristics:
- Clean, minimalist, ChatGPT-Mac-inspired
- Neutral color palette (no green brand accent)
- Darker dark mode (near-black)
- Subtle borders, airy spacing
- One unified sidebar (no double-sidebar boundary)
- Semi-transparent sidebar with vibrancy/blur
- Floating, rounded input bar with clean border
- Centered model name in header with dropdown chevron
- Minimal top chrome — no prominent browser-style tab strip
- Flush content surface — no nested rounded panel
- Thin-stroke line icons
- Inter/SF typography, 14px body
- 800px centered conversation content

## Completed Phases

### Phase 1: Theme Foundation ✅
- Color palette: neutral foreground, subtler borders, airier UI elements
- Dark mode: darker background (0.16 vs 0.209), darker cards/popovers
- Sidebar: lighter (light mode) / darker (dark mode)
- Sidebar active states: green → neutral oklch values
- Backdrop blur for macOS transparent windows
- Code blocks: cleaner oklch colors
- User message surface: subtler (0.035 vs 0.045)

### Phase 2: Sidebar & Tab Bar ✅
- Sidebar items: rounded-xl → rounded-lg (14px → 10px)
- Icon mode items: rounded-full → rounded-lg (squircle)
- Tab bar: active tabs use bg-background (merge with content)
- Tab bar: subtler hover states

### Phase 3: Composer ✅
- Input card rounding: rounded-[20px] → rounded-2xl (18px)

### Phase 4: Structural Shell Redesign ✅
- **Flush content panel**: removed rounded bordered `<main>` — content is now
  edge-to-edge with no nested panel look
- **Removed rounded corners** from ConversationShell and MessageOnlyStatus
- **Minimized tab bar**: reduced height (h-11→h-9), blends with content
  background instead of sidebar background
- **Centered model/assistant selector** in ChatNavbar (ChatWise signature):
  sidebar toggle on the left, centered title, balanced right spacer
- **Unified sidebar**: removed border between app sidebar and conversation
  pane so they read as one coherent surface; conversation pane has a
  right border only (separating it from chat content)
- **Simplified composer**: cleaner border (border/60), subtler shadow
- **Subtle top bar divider** (border/40)

### Phase 5: Single-Sidebar Chat Shell ✅
- Removed the browser-style tab bar and default icon rail without removing route or tab state
- Unified the assistant/topic navigation and conversation surface
- Centered the model selector and adopted the native system font on macOS

### Phase 6: App-Wide Polish ✅
- Applied the ChatWise shell to every route
- Tightened global radius and shadow tokens
- Restyled Settings with quieter dividers, compact navigation, and more deliberate spacing
- Reduced chat message, avatar, action-row, and composer chrome
- Flattened the assistant resource rail while preserving Add Assistant, New Chat, groups, and actions
- Added an explicit keyboard-focusable launcher and modal drawer for the hidden global navigation
- Brought Agents, Files, Knowledge, Translate, Paintings, Notes, and Code into the same surface, divider, radius, and spacing system

## Roadmap Status

The refactoring roadmap and its macOS visual regression gate are complete. The final verification covered:

- the global navigation launcher and floating sidebar on every route;
- macOS traffic lights, titlebar drag regions, keyboard focus, and dismissal behavior;
- chat, multiline composer, Settings, and dark mode;
- Files, Knowledge, Translate, Paintings, Notes, Code, and Agents at narrow, standard, and wide window widths.

No data model, persistence, IPC, route, shortcut, or command behavior is intentionally changed by this refactor.

## App Identity

The fork builds as a separate app to avoid conflicts with the original Cherry Studio:

- Product name: `Wonder Chat`
- Bundle ID: `com.oliver.wonderchat`
- URL scheme: `wonderchat`
- Separate userData: `~/Library/Application Support/Wonder Chat/`

Because the URL scheme differs from upstream's `cherrystudio`, the CherryIn OAuth sign-in
(`cherrystudio://oauth/callback`, registered on a server this fork does not control) cannot call
back into this build. Provider API keys are unaffected.

## Verification

Required completion gates:

- `pnpm lint`
- `pnpm test`
- `pnpm format`
- `pnpm build:check`
- macOS package build and route-by-route visual regression pass
