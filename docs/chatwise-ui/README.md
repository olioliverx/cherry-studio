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
| `src/renderer/components/Sidebar/Sidebar.tsx` | 2 | Medium — className changes |
| `src/renderer/components/Sidebar/SidebarList.tsx` | 2 | Medium — className changes |
| `src/renderer/components/layout/AppShellTabBar.tsx` | 2 | Medium — className changes |
| `src/renderer/components/composer/ComposerSurface.tsx` | 3 | Low — rounding value |

## Design Reference

ChatWise UI characteristics:
- Clean, minimalist, ChatGPT-Mac-inspired
- Neutral color palette (no green brand accent)
- Darker dark mode (near-black)
- Subtle borders, airy spacing
- Sidebar with vibrancy/blur, rounded selection items
- Floating, rounded input bar
- Centered model name in header
- Thin-stroke line icons
- Inter/SF typography, 14px body

## Completed Phases

### Phase 1: Theme Foundation ✅
- Color palette: neutral foreground, subtler borders, airier UI elements
- Dark mode: darker background (0.16 vs 0.209), darker cards/popovers
- Sidebar: lighter (light mode) / darker (dark mode), border-r added
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

## Remaining Phases

### Phase 4: Settings Restyle
- Clean up settings navigation to match ChatWise style
- Simplify settings page layout
- Adjust settings content spacing

### Phase 5: Message Styling
- Adjust message bubble styling for cleaner look
- Code block header with language label + copy button
- Message spacing and typography

### Phase 6: Header Redesign
- Center model name in chat header with dropdown
- Simplify header controls
- Subtle header border

## Verification

All tests pass after each phase:
- `pnpm test:main` — 663 files, 9598 tests
- `pnpm test:renderer` — 800 files, 8366 tests
