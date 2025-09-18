import type { ConsoleMessage, Page } from '@playwright/test';
import { chromium } from '@playwright/test';
import { expect, navigateToSite, openOptionsPage, test } from './fixtures';

async function clearStatusMessage(page: Page) {
  await page.waitForSelector('#status');
  await page.evaluate(() => {
    const status = document.querySelector('#status');
    if (status) status.textContent = '';
  });
}

async function waitForStatusMessage(page: Page) {
  await page.waitForSelector('#status');
  await page.waitForFunction(() => {
    const status = document.querySelector('#status');
    return !!status && !!status.textContent && status.textContent.trim().length > 0;
  });
}

function sortCodes(values: string[]): string[] {
  return values.map((value) => value.trim().toLowerCase()).sort();
}

function resultSelector(code: string): string {
  return `[id="result-:${code}"]`;
}

test.describe('Sanskrit Dictionary extension', () => {
  test('disables autosearch until Enter is pressed', async ({ page }) => {
    const searchRequests: string[] = [];
    const consoleLogs: string[] = [];

    page.on('requestfinished', (request) => {
      if (request.resourceType() !== 'document') return;
      const url = request.url();
      if (url.startsWith('https://sanskrit.myke.blog/') && /[?&]q=/.test(url)) {
        searchRequests.push(url);
      }
    });
    page.on('console', (message) => {
      if (message.type() === 'log') {
        consoleLogs.push(message.text());
      }
    });

    await navigateToSite(page);
    await page.waitForSelector('#theform input[name="q"]');

    const input = page.locator('#theform input[name="q"]');
    await expect(input).toBeVisible();

    await page.waitForSelector('#theform input[name="q"][data-enter-only="1"]');

    const initialAutoSubmit = await input.getAttribute('up-autosubmit');
    expect(initialAutoSubmit).toBeNull();

    const initialResultCount = await page.locator('div[id^="result-:"]').count();

    searchRequests.length = 0;

    await input.type('bāla', { delay: 120 });
    await page.waitForTimeout(800);

    expect(searchRequests.length).toBe(0);
    expect(consoleLogs.some((entry) => entry.includes('Auto-search disabled; press Enter to search.'))).toBeTruthy();

    await input.press('Enter');
    await expect.poll(() => page.locator('div[id^="result-:"]').count(), { timeout: 10_000 }).toBeGreaterThan(initialResultCount);
  });

  test('preselects default dictionaries once on initial load', async ({ page }) => {
    const autoSubmissions: string[] = [];

    page.on('request', (request) => {
      if (request.resourceType() === 'document' && request.url().startsWith('https://sanskrit.myke.blog/?q=')) {
        autoSubmissions.push(request.url());
      }
    });

    await navigateToSite(page);

    const { selectedCodes, expectedCodes } = await page.evaluate(() => {
      const selected = Array.from(document.querySelectorAll<HTMLInputElement>('#dict-select input[name="s"]:checked')).map((cb) => cb.value || '');
      const expected = Array.isArray((window as unknown as { SANSKRIT_DICTIONARIES?: Array<{ code: string; label: string }> }).SANSKRIT_DICTIONARIES)
        ? (window as unknown as { SANSKRIT_DICTIONARIES: Array<{ code: string; label: string }> }).SANSKRIT_DICTIONARIES.filter((item) => /dictionary|wörterbuch/i.test(item.label || '')).map((item) => item.code)
        : [];
      return { selectedCodes: selected, expectedCodes: expected };
    });

    expect(sortCodes(selectedCodes)).toEqual(sortCodes(expectedCodes));

    await page.waitForTimeout(1000);
    expect(autoSubmissions.length).toBeLessThanOrEqual(1);
  });

  test('persists dictionary ordering from the options page', async ({ context }) => {
    const optionsPage = await openOptionsPage(context);
    await clearStatusMessage(optionsPage);

    const orderSelect = optionsPage.locator('#dictionary-order');
    await orderSelect.waitFor();
    await orderSelect.selectOption('mw');
    await optionsPage.click('#move-top');
    await waitForStatusMessage(optionsPage);

    await optionsPage.reload();
    const firstOptionText = await optionsPage.locator('#dictionary-order option').first().textContent();
    expect(firstOptionText).toContain('Monier-Williams Sanskrit-English Dictionary - 1899');

    await optionsPage.close();

    const searchPage = await context.newPage();
    await navigateToSite(searchPage);
    const searchInput = searchPage.locator('#theform input[name="q"]');
    await searchInput.fill('bāla');
    await searchInput.press('Enter');

    await searchPage.waitForSelector('div[id^="result-:"]');
    const firstResultId = await searchPage.locator('div[id^="result-:"]').first().getAttribute('id');
    expect(firstResultId).toBe('result-:mw');

    await searchPage.close();
  });

  test('applies customised preselection when configured', async ({ context }) => {
    const optionsPage = await openOptionsPage(context);
    await clearStatusMessage(optionsPage);
    await optionsPage.click('#clear-all');
    await optionsPage.getByLabel('Apte Practical Sanskrit-English Dictionary - 1890').check();
    await waitForStatusMessage(optionsPage);
    await optionsPage.close();

    const searchPage = await context.newPage();
    await navigateToSite(searchPage);

    await searchPage.waitForFunction(
      () => document.querySelectorAll('#dict-select input[name="s"]:checked').length > 0,
      undefined,
      { timeout: 5_000 }
    );

    const selected = await searchPage.evaluate(() => Array.from(document.querySelectorAll<HTMLInputElement>('#dict-select input[name="s"]:checked')).map((cb) => cb.value || ''));
    expect(selected).toEqual(['ap90']);

    const input = searchPage.locator('#theform input[name="q"]');
    await input.fill('bāla');
    await input.press('Enter');

    await searchPage.waitForSelector(resultSelector('ap90'));
    const allResultIds = await searchPage.$$eval('div[id^="result-:"]', (nodes) => nodes.map((node) => node.id));
    expect(allResultIds).toEqual(['result-:ap90']);

    await searchPage.close();
  });

  test('merges multiple articles per dictionary when enabled', async ({ page }) => {
    await navigateToSite(page);
    const input = page.locator('#theform input[name="q"]');
    await input.fill('bāla');
    await input.press('Enter');

    await page.waitForSelector(resultSelector('cae'));

    await expect.poll(() => page.$$eval('[id="result-:cae"] > article', (nodes) => nodes.length)).toBe(1);
    const articleCount = await page.$$eval('[id="result-:cae"] > article', (nodes) => nodes.length);
    expect(articleCount).toBe(1);

    const mergeGapCount = await page.locator(`${resultSelector('cae')} .sd-ext-merge-gap`).count();
    expect(mergeGapCount).toBeGreaterThan(0);
  });

  test('restores multiple articles when merging is disabled', async ({ context }) => {
    const optionsPage = await openOptionsPage(context);
    await clearStatusMessage(optionsPage);
    const mergeToggle = optionsPage.locator('#merge-results');
    if (await mergeToggle.isChecked()) {
      await mergeToggle.uncheck();
    }
    await waitForStatusMessage(optionsPage);
    await optionsPage.close();

    const searchPage = await context.newPage();
    await navigateToSite(searchPage);
    const input = searchPage.locator('#theform input[name="q"]');
    await input.fill('bāla');
    await input.press('Enter');
    await searchPage.waitForSelector(resultSelector('cae'));

    const articleCount = await searchPage.$$eval('[id="result-:cae"] > article', (nodes) => nodes.length);
    expect(articleCount).toBeGreaterThan(1);

    await searchPage.close();
  });

  test('auto-minimises long articles and toggles expand/collapse cleanly', async ({ page }) => {
    await navigateToSite(page);
    const input = page.locator('#theform input[name="q"]');
    await input.fill('bāla');
    await input.press('Enter');

    await page.waitForSelector('.sd-ext-article');

    const collapsible = await page.$$eval(
      '.sd-ext-article',
      (nodes) => nodes
        .filter((node) => {
          const lines = Number((node as HTMLElement).dataset.sdLineCount || '0');
          return lines > 50;
        })
        .map((node) => ({
          collapsed: node.classList.contains('sd-ext-article-collapsed'),
          toggleText: (node.querySelector(':scope > .sd-ext-article-toggle') as HTMLElement | null)?.textContent?.trim() || ''
        }))
    );

    const initiallyCollapsed = collapsible.find((item) => item.collapsed);
    expect(initiallyCollapsed).toBeTruthy();
    expect(initiallyCollapsed?.toggleText).toBe('+');

    const collapsedIndex = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('.sd-ext-article'));
      return nodes.findIndex((node) => node.classList.contains('sd-ext-article-collapsed'));
    });
    expect(collapsedIndex).toBeGreaterThanOrEqual(0);

    const article = page.locator('.sd-ext-article').nth(collapsedIndex);
    const toggle = article.locator(':scope > .sd-ext-article-toggle');
    await toggle.click();

    await expect(article).not.toHaveClass(/sd-ext-article-collapsed/);
    await expect(toggle).toHaveText('-');

    await toggle.click();
    await expect(article).toHaveClass(/sd-ext-article-collapsed/);
    await expect(toggle).toHaveText('+');
  });

  test('respects user override across fragment updates when articles are expanded', async ({ page }) => {
    await navigateToSite(page);
    const input = page.locator('#theform input[name="q"]');
    await input.fill('bāla');
    await input.press('Enter');

    await page.waitForSelector('.sd-ext-article.sd-ext-article-collapsed');
    const toggle = page.locator('.sd-ext-article.sd-ext-article-collapsed .sd-ext-article-toggle').first();
    await toggle.click();

    const expandedSelector = '.sd-ext-article:not(.sd-ext-article-collapsed) .sd-ext-article-toggle';
    await expect(page.locator(expandedSelector).first()).toBeVisible();

    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('up:fragment:inserted', { bubbles: true }));
    });

    await page.waitForTimeout(400);
    await expect(page.locator(expandedSelector).first()).toBeVisible();
  });

  test('loads articles expanded when minimisation is turned off', async ({ context }) => {
    const optionsPage = await openOptionsPage(context);
    await clearStatusMessage(optionsPage);
    const toggle = optionsPage.locator('#minimize-long');
    if (await toggle.isChecked()) {
      await toggle.uncheck();
    }
    await waitForStatusMessage(optionsPage);
    await optionsPage.close();

    const searchPage = await context.newPage();
    await navigateToSite(searchPage);
    const input = searchPage.locator('#theform input[name="q"]');
    await input.fill('bāla');
    await input.press('Enter');

    await searchPage.waitForSelector('.sd-ext-article');
    const collapsedCount = await searchPage.locator('.sd-ext-article.sd-ext-article-collapsed').count();
    expect(collapsedCount).toBe(0);

    const toggleSymbols = await searchPage.$$eval('.sd-ext-article > .sd-ext-article-toggle', (nodes) => nodes.map((node) => node.textContent?.trim() || ''));
    toggleSymbols.forEach((symbol) => expect(symbol).toBe('-'));

    await searchPage.close();
  });

  test('propagates storage changes across option windows', async ({ context }) => {
    const optionsA = await openOptionsPage(context);
    const optionsB = await openOptionsPage(context);

    await clearStatusMessage(optionsA);
    await clearStatusMessage(optionsB);

    const orderSelectA = optionsA.locator('#dictionary-order');
    await orderSelectA.waitFor();
    await orderSelectA.selectOption('mw');
    await optionsA.click('#move-bottom');
    await waitForStatusMessage(optionsA);

    await optionsB.waitForFunction(() => {
      const select = document.querySelector('#dictionary-order') as HTMLSelectElement | null;
      return !!select && select.options[select.options.length - 1]?.textContent?.includes('Monier-Williams Sanskrit-English Dictionary - 1899');
    });

    const mergeToggleA = optionsA.locator('#merge-results');
    const initialState = await mergeToggleA.isChecked();
    if (initialState) {
      await mergeToggleA.uncheck();
    } else {
      await mergeToggleA.check();
    }
    await waitForStatusMessage(optionsA);

    const expectedState = !initialState;
    await optionsB.waitForFunction((state: boolean) => {
      const el = document.getElementById('merge-results') as HTMLInputElement | null;
      return !!el && el.checked === state;
    }, expectedState);

    await optionsA.close();
    await optionsB.close();
  });

  test('reapplies ordering and presentation after fragment updates', async ({ context }) => {
    const optionsPage = await openOptionsPage(context);
    await clearStatusMessage(optionsPage);

    const orderSelect = optionsPage.locator('#dictionary-order');
    await orderSelect.waitFor();
    await orderSelect.selectOption('mw');
    await optionsPage.click('#move-top');
    await waitForStatusMessage(optionsPage);

    await clearStatusMessage(optionsPage);
    const mergeToggle = optionsPage.locator('#merge-results');
    if (!(await mergeToggle.isChecked())) {
      await mergeToggle.check();
      await waitForStatusMessage(optionsPage);
    }

    await clearStatusMessage(optionsPage);
    const minimizeToggle = optionsPage.locator('#minimize-long');
    if (!(await minimizeToggle.isChecked())) {
      await minimizeToggle.check();
      await waitForStatusMessage(optionsPage);
    }

    await optionsPage.close();

    const documentRequests: string[] = [];
    const page = await context.newPage();
    page.on('request', (request) => {
      if (request.resourceType() === 'document' && request.url().startsWith('https://sanskrit.myke.blog/')) {
        documentRequests.push(request.url());
      }
    });

    await navigateToSite(page);
    const input = page.locator('#theform input[name="q"]');
    await input.fill('bāla');
    await input.press('Enter');
    await page.waitForSelector(resultSelector('mw'));
    await page.waitForSelector(resultSelector('cae'));

    await expect.poll(() => page.locator('div[id^="result-:"]').first().getAttribute('id')).toBe('result-:mw');
    const firstBefore = await page.locator('div[id^="result-:"]').first().getAttribute('id');
    expect(firstBefore).toBe('result-:mw');
    await expect.poll(() => page.$$eval('[id="result-:cae"] > article', (nodes) => nodes.length)).toBe(1);
    const mergedCountBefore = await page.$$eval('[id="result-:cae"] > article', (nodes) => nodes.length);
    expect(mergedCountBefore).toBe(1);
    const collapsedBefore = await page.locator('.sd-ext-article.sd-ext-article-collapsed').count();
    expect(collapsedBefore).toBeGreaterThan(0);

    const initialRequests = documentRequests.length;

    const reverseRadio = page.locator('input[type="radio"][value="reverse"]').first();
    let toggles = 0;
    if (await reverseRadio.count()) {
      await reverseRadio.check();
      toggles += 1;
      await page.waitForTimeout(800);
    } else {
      await page.evaluate(() => {
        document.dispatchEvent(new CustomEvent('up:fragment:inserted', { bubbles: true }));
      });
      await page.waitForTimeout(400);
    }

    const exactRadio = page.locator('input[type="radio"][value="exact"]').first();
    if (await exactRadio.count()) {
      await exactRadio.check();
      toggles += 1;
      await page.waitForTimeout(800);
    }

    const additionalRequests = documentRequests.length - initialRequests;
    expect(additionalRequests).toBeLessThanOrEqual(Math.max(1, toggles));

    await expect.poll(() => page.locator('div[id^="result-:"]').first().getAttribute('id')).toBe('result-:mw');
    const firstAfter = await page.locator('div[id^="result-:"]').first().getAttribute('id');
    expect(firstAfter).toBe('result-:mw');
    await expect.poll(() => page.$$eval('[id="result-:cae"] > article', (nodes) => nodes.length)).toBe(1);
    const mergedCountAfter = await page.$$eval('[id="result-:cae"] > article', (nodes) => nodes.length);
    expect(mergedCountAfter).toBe(1);
    const collapsedAfter = await page.locator('.sd-ext-article.sd-ext-article-collapsed').count();
    expect(collapsedAfter).toBeGreaterThan(0);

    await page.close();
  });

  test('keeps console clean across critical workflows', async ({ context }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    const captureConsole = (message: ConsoleMessage) => {
      if (message && (message.type() === 'error' || message.type() === 'warning')) {
        consoleErrors.push(message.text());
      }
    };

    const searchPage = await context.newPage();
    searchPage.on('console', captureConsole);
    searchPage.on('pageerror', (error) => pageErrors.push(error.message));

    await navigateToSite(searchPage);
    const input = searchPage.locator('#theform input[name="q"]');
    await searchPage.waitForSelector('#theform input[name="q"][data-enter-only="1"]');
    await searchPage.waitForFunction(
      () => document.querySelectorAll('#dict-select input[name="s"]:checked').length > 0,
      undefined,
      { timeout: 10_000 }
    );
    await input.fill('bāla');
    await searchPage.waitForTimeout(300);
    await input.press('Enter');
    await searchPage.waitForTimeout(5_000);

    const toggle = searchPage.locator('.sd-ext-article .sd-ext-article-toggle').first();
    if (await toggle.count()) {
      await toggle.click();
      await toggle.click();
    }

    await searchPage.waitForTimeout(500);

    const optionsPage = await openOptionsPage(context);
    const optionsConsoleErrors: string[] = [];
    const optionsPageErrors: string[] = [];
    const captureOptionsConsole = (message: ConsoleMessage) => {
      if (message && (message.type() === 'error' || message.type() === 'warning')) {
        optionsConsoleErrors.push(message.text());
      }
    };

    optionsPage.on('console', captureOptionsConsole);
    optionsPage.on('pageerror', (error) => optionsPageErrors.push(error.message));

    const orderSelect = optionsPage.locator('#dictionary-order');
    await orderSelect.waitFor();
    await clearStatusMessage(optionsPage);
    await orderSelect.selectOption('mw');
    await optionsPage.click('#move-top');
    await waitForStatusMessage(optionsPage);

    const mergeToggle = optionsPage.locator('#merge-results');
    if (!(await mergeToggle.isChecked())) {
      await clearStatusMessage(optionsPage);
      await mergeToggle.check();
      await waitForStatusMessage(optionsPage);
    }

    const minimizeToggle = optionsPage.locator('#minimize-long');
    if (!(await minimizeToggle.isChecked())) {
      await clearStatusMessage(optionsPage);
      await minimizeToggle.check();
      await waitForStatusMessage(optionsPage);
    }

    await optionsPage.close();
    await searchPage.close();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(optionsConsoleErrors).toEqual([]);
    expect(optionsPageErrors).toEqual([]);
  });

  test('emits debug logs only when sdExtDebug is set', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'log' && message.text().includes('[SanskritExt]')) {
        logs.push(message.text());
      }
    });

    await navigateToSite(page);
    await page.evaluate(() => window.localStorage.setItem('sdExtDebug', '1'));

    const input = page.locator('#theform input[name="q"]');
    await input.fill('bāla');
    await input.press('Enter');
    await page.waitForSelector('.sd-ext-article');

    const toggle = page.locator('.sd-ext-article .sd-ext-article-toggle').first();
    await toggle.click();
    await toggle.click();

    expect(logs.some((entry) => entry.includes('[SanskritExt]'))).toBeTruthy();

    logs.length = 0;
    await page.evaluate(() => window.localStorage.removeItem('sdExtDebug'));
    await input.press('Enter');
    await page.waitForTimeout(500);

    expect(logs.length).toBe(0);
  });

  test('falls back to native behaviour when the extension is disabled', async () => {
    const plainContext = await chromium.launchPersistentContext('', {
      headless: false
    });

    try {
      const plainPage = await plainContext.newPage();
      await plainPage.goto('https://sanskrit.myke.blog/', { waitUntil: 'domcontentloaded' });

      const input = plainPage.locator('#theform input[name="q"]');
      await input.fill('bāla');
      await plainPage.waitForTimeout(500);

      const autoSubmitAttr = await input.getAttribute('up-autosubmit');
      expect(autoSubmitAttr).not.toBeNull();

      const anyChecked = await plainPage.evaluate(() => Array.from(document.querySelectorAll<HTMLInputElement>('#dict-select input[name="s"]:checked')).length);
      expect(anyChecked).toBe(0);

      await plainPage.close();
    } finally {
      await plainContext.close();
    }
  });
});
