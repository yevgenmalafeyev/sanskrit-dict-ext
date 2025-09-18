# Sanskrit Dictionary Extension – End-to-End Test Scenarios

All scenarios assume Google Chrome (or Chromium-based browser) with the extension loaded unpacked, options page accessible, and sanskrit.myke.blog reachable. Before each scenario, reset the site by clearing local storage and reloading to avoid stale state unless noted.

## 1. Initial Auto-Search Configuration
- Preconditions: `sdExtDebug` disabled, extension freshly loaded with default settings.
- Steps:
  1. Navigate to https://sanskrit.myke.blog/.
  2. Confirm no dictionaries are preselected.
  3. Focus the query input and type `bāla` without pressing Enter.
- Expected:
  - Input loses auto-search attributes and a console log states “Auto-search disabled; press Enter to search.”
  - No network request is fired until Enter is pressed.
  - Upon pressing Enter, search executes successfully.

## 2. Default Dictionary Preselection
- Preconditions: Default preselection (terms matching “dictionary / wörterbuch”) active.
- Steps:
  1. Visit the site with no dictionaries selected.
  2. Observe dictionary list immediately after load.
- Expected:
  - Extension selects default set (English/German dictionaries) exactly once.
  - A single form submission is triggered (verified via DevTools network panel).

## 3. Options Page – Dictionary Order Persistence
- Steps:
  1. Open extension options page.
  2. Move “Monier-Williams Sanskrit-English Dictionary - 1899” to the top.
  3. Reload options page.
  4. Perform search for `bāla` on the site.
- Expected:
  - Ordering persists after reload.
  - Search results show MW block first.

## 4. Options Page – Preselection Customisation
- Steps:
  1. On options page, clear all preselected dictionaries.
  2. Select only “Apte Practical Sanskrit-English Dictionary - 1890”.
  3. Reload the site (clear checkboxes beforehand).
- Expected:
  - Only Apte checkbox auto-selects.
  - Only Apte result block loads (server-side behaviour permitting) after Enter.

## 5. Merge Multiple Blocks Per Dictionary
- Steps:
  1. Ensure “Merge results” option is enabled.
  2. Search for `bāla` (known to yield multiple articles per dictionary).
  3. Inspect DOM for `#result-:cae` (or similar) to confirm single article node.
- Expected:
  - Each dictionary appears at most once.
  - Inner article contains multiple sections separated by blank paragraphs.

## 6. Disable Merge Behaviour
- Steps:
  1. In options, uncheck “Merge results”.
  2. Reload search page and run `bāla`.
- Expected:
  - Multiple result blocks per dictionary reappear as on the native site.
  - Options in step 5 revert when re-enabled.

## 7. Auto-Minimise Long Articles
- Steps:
  1. With “Minimize long articles” enabled, search `bāla`.
  2. Identify a dictionary block with >50 lines.
- Expected:
  - Block loads collapsed with `+` toggle visible.
  - Clicking `+` expands content and `-` re-collapses without flicker.

## 8. Respect User Override
- Preconditions: Same as scenario 7.
- Steps:
  1. Expand a long block (click `+`).
  2. Trigger a partial page update (e.g., toggle radio `fuzzy` then back to `exact`).
- Expected:
  - Expanded block stays expanded after the partial refresh.

## 9. Minimise Disabled Behaviour
- Steps:
  1. Turn off “Minimize long articles”.
  2. Search `bāla`.
- Expected:
  - All blocks load expanded with `-` toggle showing active state.

## 10. Sync Storage Propagation
- Preconditions: Chrome profile with sync enabled, two windows using same profile.
- Steps:
  1. In window A, change dictionary order and merge settings.
  2. Observe options page in window B without manual reload.
- Expected:
  - Changes propagate automatically (or after background sync) and UI updates.

## 11. Mutation Observer Resilience
- Steps:
  1. Perform search.
  2. Trigger Unpoly fragment update via filtering (e.g., use radio `reverse`).
- Expected:
  - Extension re-applies ordering, merge, and collapse logic after each fragment update without double-submissions.

## 12. Debug Logging Toggle
- Steps:
  1. Set `localStorage.sdExtDebug = '1'` in site console.
  2. Perform a search and toggle a block.
- Expected:
  - Console logs `[SanskritExt]` entries for applyResultPresentation and toggles.
  - Clearing the key (`localStorage.removeItem('sdExtDebug')`) silences logs.

## 13. Regression: Disable Extension
- Steps:
  1. Remove or disable the extension.
  2. Reload site, perform search.
- Expected:
  - Site behaves natively (autosubmit per keystroke, no auto-preselection, multiple blocks).

## 14. Error Handling and Console Cleanliness
- Steps:
  1. Run through scenarios 1–10 with DevTools open.
  2. Check console for uncaught exceptions or warnings attributable to the extension.
- Expected:
  - No uncaught errors; debug logs appear only when explicitly enabled.

