# Sanskrit Dictionary Auto-Check (Chrome Extension)

This extension streamlines using [sanskrit.myke.blog](https://sanskrit.myke.blog) by applying your preferred dictionary defaults, reorganising search results, and optionally disabling the site's autosubmit behaviour.

## Key Features
- **Configurable preselection** – pick which dictionaries should be ticked automatically when the page loads without any selections, grouped just like the site (SA→EN, SA→DE, EN→SA, etc.).
- **Result ordering** – reorder the dictionary result blocks so favoured sources appear first after every search.
- **Autosearch toggle** – let the site autosubmit on every keystroke, or require pressing Enter (the original behaviour provided by this extension).
- **Merged dictionary blocks** – optionally collapse multiple hits from the same dictionary into a single block, separated by blank paragraphs, to reduce scrolling.
- **Article minimiser** – each result block gains a +/- toggle; when enabled, entries longer than 50 lines auto-minimise on load.
- **Resilient updates** – settings are persisted via `chrome.storage.sync` and reapplied after Unpoly fragment swaps or other DOM mutations.

## Configuration
1. Install or reload the unpacked extension (see below).
2. Open the options page (`chrome://extensions` → details → "Extension options").
3. Adjust the dictionary order, pick the default selections, and choose whether to disable autosearch, merge dictionary results, or auto-minimise long entries.
4. Changes are saved instantly and sync across Chrome if sync is enabled.

## Files
- `manifest.json` – Manifest V3 configuration (now with `storage` permission and options page entry point).
- `dictionaries.js` – shared list of known dictionary codes and labels.
- `content.js` – content script that reads saved settings, applies preselection, toggles autosearch, and reorders result blocks.
- `options.html` / `options.js` – configuration UI for order, preselection, and autosearch toggle.

## Runtime Behaviour
- Loads saved settings from `chrome.storage.sync` (falling back to sensible defaults derived from the site's checkbox list).
- If no dictionaries are ticked, automatically ticks the configured defaults and triggers a single form submission.
- Replaces the search input with an Enter-only version when "Disable autosearch" is enabled; otherwise restores the site's autosubmit attributes.
- Observes search results and reorders `div#result-:CODE` blocks to match the configured preference.

## Install (Chrome / Chromium / Edge)
1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `chrome-sanskrit-dict-ext` directory.
4. Navigate to [sanskrit.myke.blog](https://sanskrit.myke.blog), perform a search (e.g., `bāla`), and confirm your configured defaults take effect.

## Notes
- The options page works offline but, without `chrome.storage.sync`, settings fall back to defaults on reload.
- The extension targets Manifest V3 and runs on Chrome 88+, Chromium-based Edge, and compatible browsers.
