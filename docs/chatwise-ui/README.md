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

Conflicts will be concentrated in the few layout/theme files we changed (see below). Feature components merge cleanly since we don't touch them.

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

## Remaining Phases

### Phase 5: Message Styling
- Adjust message bubble styling for cleaner look
- Code block header with language label + copy button
- Message spacing and typography

### Phase 6: Polish & Refinement
- Fine-tune spacing and proportions
- Settings page cleanup
- Animation and transition tuning

## App Identity

The fork builds as a separate app to avoid conflicts with the original Cherry Studio:

- Product name: `Cherry Studio ChatWise`
- Bundle ID: `com.oliver.cherry-studio.chatwise`
- URL scheme: `cherrystudio-chatwise`
- Separate userData: `~/Library/Application Support/Cherry Studio ChatWise/`

## Verification

All tests pass after each phase:
- `pnpm test:main` — 663 files, 9598 tests
- `pnpm test:renderer` — 800 files, 8366 tests
