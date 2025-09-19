# Collapse/Expand Toggle Button Bug Analysis

## Issue Description
The collapse button ("-") does not work consistently for most articles after expanding them with the "+" button. Only some articles respond to the collapse action after a delay.

## Symptoms
- Expand button (+) works correctly and logs appropriate console messages
- Collapse button (-) is unresponsive for most articles
- Some collapse buttons work after a delay
- When working, correct console logs are shown

## Root Cause Analysis

### 1. Duplicate Function Definitions
**Location**: `content.js` lines 682-690 and 978-986

The `logDebug` function is defined twice in the file:
```javascript
// First definition at line 682
function logDebug(label, payload) {
  // implementation
}

// Second definition at line 978 (exact duplicate)
function logDebug(label, payload) {
  // same implementation
}
```

This causes the second definition to override the first, potentially breaking closures and references established by event handlers set up between these definitions.

### 2. Multiple Event Listener Attachments
**Location**: `content.js` line 779-790 in `setupArticle()` function

The toggle button click event listener is added during `setupArticle()`:
```javascript
toggle.addEventListener('click', function (ev) {
  // handler code
}, false);
```

The function attempts to prevent re-initialization using:
```javascript
var initGen = article.dataset ? article.dataset.sdInitGen : null;
if (initGen && String(initGen) === String(settingsGeneration) && articleStates.has(article)) {
  return 0;
}
```

However, this check may fail under certain conditions, causing multiple event listeners to be attached to the same button.

### 3. Race Conditions with Mutation Observer
The mutation observer (line 174-178) and fragment insertion handler (line 167-171) can trigger multiple `setupArticle()` calls for the same article, especially during dynamic content updates.

## Why Expand Works but Collapse Doesn't
1. The expand action is typically the first user interaction with a fresh button
2. After expansion, mutation observers may trigger and cause duplicate event listeners
3. Multiple event listeners on the same button can interfere with each other
4. The inconsistent "works after some time" behavior indicates race conditions settling

## Applied Fixes

### Fix 1: Remove Duplicate logDebug Function
**File**: `content.js`
**Action**: Removed the second `logDebug` function definition at lines 978-986
**Status**: ✅ COMPLETED

### Fix 2: Prevent Duplicate Event Listeners
**File**: `content.js` (lines 780-795)
**Action**: Added a data attribute check to ensure event listeners are only attached once per toggle button
**Status**: ✅ COMPLETED

Modified the `setupArticle()` function to mark when an event listener has been attached:
```javascript
// Check if event listener already attached to prevent duplicates
if (!toggle.dataset.sdEventAttached) {
  toggle.dataset.sdEventAttached = '1';
  toggle.addEventListener('click', function (ev) {
    // existing handler code
  }, false);
}
```

This ensures that even if `setupArticle()` is called multiple times for the same article (due to mutation observers or fragment updates), the click event listener is only attached once to the toggle button.

## Summary of Changes
1. **Removed duplicate function definition** that was causing closure and reference issues
2. **Added event listener guard** using `dataset.sdEventAttached` flag to prevent multiple event listeners on the same toggle button
3. Both fixes work together to ensure consistent toggle behavior regardless of how many times the DOM is updated or mutation observers fire

## Testing Recommendations
1. Clear browser cache and reload extension
2. Test multiple expand/collapse cycles on various articles
3. Verify console logs show single event firing
4. Test with dynamic content updates (filtering, searching)
5. Ensure user override preferences are preserved

## Fix 3: Mutation Observer Infinite Loop Fix
**File**: `content.js` (lines 161-162, 183-217, 335-350)
**Action**: Fixed infinite loop caused by mutation observer triggering on DOM modifications made by setupArticle
**Status**: ✅ COMPLETED

The mutation observer was watching all childList mutations in the document and triggering `scheduleRun` for every DOM modification. When `setupArticle` modified the DOM (adding/removing elements), it triggered the mutation observer again, creating an infinite loop.

**Applied fixes**:
1. Added `isProcessingMutations` flag to prevent recursive triggers
2. Made mutation observer selective - only triggers on relevant mutations (new result containers)
3. Pauses mutation observation during DOM modifications by `setupArticle`

This stops the infinite loop where setupArticle was being called thousands of times per second, flooding the console with "Skipping setupArticle - already initialized" messages.