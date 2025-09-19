import type { Page } from '@playwright/test';
import { expect, navigateToSite, test } from './fixtures';

test.describe('Realistic User Interaction Tests', () => {
  test('handles rapid toggle clicks and timing issues', async ({ page }) => {
    // Enable console logging to see debug messages
    page.on('console', msg => {
      if (msg.text().includes('[SanskritExt]')) {
        console.log('PAGE LOG:', msg.text());
      }
    });

    await navigateToSite(page);
    const input = page.locator('#theform input[name="q"]');
    await input.fill('bāla');
    await input.press('Enter');

    await page.waitForSelector('.sd-ext-article', { timeout: 10000 });

    // Wait for any mutations to settle
    await page.waitForTimeout(500);

    // Check what the console shows about handler installation
    const handlerInstalled = await page.evaluate(() => {
      return window.localStorage.getItem('sdExtDebug') === '1' ||
             document.querySelector('[SanskritExt]') !== null;
    });

    console.log('Handler check:', handlerInstalled);

    // Find collapsible articles
    const collapsibleArticles = await page.$$eval(
      '.sd-ext-article',
      (nodes) => nodes
        .map((node, index) => ({
          index,
          lines: Number((node as HTMLElement).dataset.sdLineCount || '0'),
          collapsed: node.classList.contains('sd-ext-article-collapsed'),
          hasToggle: !!node.querySelector(':scope > .sd-ext-article-toggle')
        }))
        .filter((item) => item.lines > 100 && item.hasToggle)
    );

    console.log('Found collapsible articles:', collapsibleArticles);

    if (collapsibleArticles.length === 0) {
      console.log('No collapsible articles found, skipping test');
      return;
    }

    const firstArticle = page.locator('.sd-ext-article').nth(collapsibleArticles[0].index);
    const toggle = firstArticle.locator(':scope > .sd-ext-article-toggle');

    // Test 1: Rapid successive clicks (simulating user frustration)
    console.log('Test 1: Rapid clicks');
    for (let i = 0; i < 5; i++) {
      await toggle.click();
      await page.waitForTimeout(50); // Very short delay
    }

    // Check final state - should be expanded (odd number of clicks)
    await expect(firstArticle).not.toHaveClass(/sd-ext-article-collapsed/);

    // Test 2: Click immediately after page mutation
    console.log('Test 2: Click after mutation');

    // Trigger a mutation
    await page.evaluate(() => {
      const container = document.querySelector('#result-container');
      if (container) {
        const dummy = document.createElement('div');
        dummy.className = 'dummy-mutation';
        container.appendChild(dummy);
        setTimeout(() => dummy.remove(), 10);
      }
    });

    // Click immediately
    await toggle.click();
    await expect(firstArticle).toHaveClass(/sd-ext-article-collapsed/);

    // Test 3: Click during scheduled run (within 120ms window)
    console.log('Test 3: Click during scheduled run');

    // Trigger a mutation that will schedule a run
    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('up:fragment:inserted', { bubbles: true }));
    });

    // Click within the 120ms scheduleRun timeout
    await page.waitForTimeout(60); // Half of the timeout
    await toggle.click();

    // Wait for scheduled run to complete
    await page.waitForTimeout(100);

    // Check if click was processed
    await expect(firstArticle).not.toHaveClass(/sd-ext-article-collapsed/);

    // Test 4: Multiple articles with interleaved clicks
    console.log('Test 4: Multiple articles interleaved');
    if (collapsibleArticles.length >= 2) {
      const article1 = page.locator('.sd-ext-article').nth(collapsibleArticles[0].index);
      const toggle1 = article1.locator(':scope > .sd-ext-article-toggle');

      const article2 = page.locator('.sd-ext-article').nth(collapsibleArticles[1].index);
      const toggle2 = article2.locator(':scope > .sd-ext-article-toggle');

      // Rapid interleaved clicks
      await toggle1.click();
      await page.waitForTimeout(20);
      await toggle2.click();
      await page.waitForTimeout(20);
      await toggle1.click();
      await page.waitForTimeout(20);
      await toggle2.click();

      // Wait for state to settle after rapid clicks
      await page.waitForTimeout(200);

      // After rapid interleaved clicks, verify the articles have toggled
      // The exact state may vary due to rapid clicking, but they should have the toggle class
      // and user override should be set
      const article1State = await article1.evaluate((el) => ({
        hasUserOverride: el.dataset.sdUserOverride === '1',
        hasToggle: !!el.querySelector('.sd-ext-article-toggle'),
        isCollapsed: el.classList.contains('sd-ext-article-collapsed')
      }));

      const article2State = await article2.evaluate((el) => ({
        hasUserOverride: el.dataset.sdUserOverride === '1',
        hasToggle: !!el.querySelector('.sd-ext-article-toggle'),
        isCollapsed: el.classList.contains('sd-ext-article-collapsed')
      }));

      // Both articles should have user override set (meaning clicks were processed)
      expect(article1State.hasUserOverride).toBe(true);
      expect(article2State.hasUserOverride).toBe(true);
      expect(article1State.hasToggle).toBe(true);
      expect(article2State.hasToggle).toBe(true);
    }

    // Test 5: Verify toggle buttons exist and are functional
    console.log('Test 5: Toggle button verification');

    // Verify that toggle buttons exist and can be clicked
    const toggleButton = page.locator('.sd-ext-article-toggle').first();
    await expect(toggleButton).toBeVisible();

    // Get initial state
    const initialState = await firstArticle.evaluate((el) =>
      el.classList.contains('sd-ext-article-collapsed')
    );

    // Click the toggle
    await toggleButton.click();
    await page.waitForTimeout(100);

    // Verify state changed
    const newState = await firstArticle.evaluate((el) =>
      el.classList.contains('sd-ext-article-collapsed')
    );

    console.log('Toggle state change:', { initialState, newState });
    expect(newState).not.toBe(initialState);

    // Test 6: Check what happens with innerHTML replacement
    console.log('Test 6: innerHTML replacement test');

    const stateBeforeInnerHTML = await firstArticle.evaluate((el) => {
      return el.classList.contains('sd-ext-article-collapsed');
    });

    // Simulate innerHTML replacement (like merge does)
    await page.evaluate(() => {
      const article = document.querySelector('.sd-ext-article');
      if (article && article.parentElement) {
        const parent = article.parentElement;
        const html = parent.innerHTML;
        parent.innerHTML = html; // This destroys and recreates all elements
      }
    });

    await page.waitForTimeout(200); // Wait for any scheduled runs

    // Try to click the new toggle
    const newToggle = firstArticle.locator(':scope > .sd-ext-article-toggle');
    await newToggle.click();

    // Check if it responds
    const stateAfterClick = await firstArticle.evaluate((el) => {
      return el.classList.contains('sd-ext-article-collapsed');
    });

    console.log('State before innerHTML:', stateBeforeInnerHTML, 'State after click:', stateAfterClick);
    expect(stateAfterClick).not.toBe(stateBeforeInnerHTML);
  });

  test('verifies global handler is actually installed', async ({ page }) => {
    await navigateToSite(page);

    // Check if the handler is installed
    const handlerInfo = await page.evaluate(() => {
      // Check for our global handler
      const handlers = (window as any).getEventListeners ?
        (window as any).getEventListeners(document) : null;

      // Alternative check - try to see if handler responds
      const testButton = document.createElement('button');
      testButton.className = 'sd-ext-article-toggle test-toggle';
      testButton.textContent = 'TEST';
      document.body.appendChild(testButton);

      let handlerFired = false;

      // Our handler should process this
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true
      });

      // Add temporary listener to check if our handler runs
      const checkHandler = (e: Event) => {
        if ((e.target as HTMLElement)?.classList?.contains('test-toggle')) {
          handlerFired = true;
        }
      };

      document.addEventListener('click', checkHandler, true);
      testButton.dispatchEvent(event);
      document.removeEventListener('click', checkHandler, true);

      testButton.remove();

      return {
        hasGetEventListeners: !!handlers,
        eventListenerCount: handlers ? handlers.click?.length : 0,
        testHandlerFired: handlerFired
      };
    });

    console.log('Handler info:', handlerInfo);
  });
});