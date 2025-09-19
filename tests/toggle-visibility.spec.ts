import { expect, navigateToSite, openOptionsPage, test } from './fixtures';

test.describe('Toggle Button Visibility', () => {
  test('toggles should respect the showToggles setting', async ({ page, context }) => {
    // Open options page
    const optionsPage = await openOptionsPage(context);

    // Wait for options page to load
    await optionsPage.waitForSelector('#minimize-long', { timeout: 5000 });

    // Disable both settings
    const minimizeLong = optionsPage.locator('#minimize-long');
    const showToggles = optionsPage.locator('#show-toggles');

    // First uncheck minimize long articles
    if (await minimizeLong.isChecked()) {
      await minimizeLong.uncheck();
    }

    // Wait for showToggles to become enabled
    await optionsPage.waitForTimeout(200);

    // Now uncheck show toggles (should be enabled now)
    if (await showToggles.isChecked()) {
      await showToggles.uncheck();
    }

    // Wait for settings to save
    await optionsPage.waitForTimeout(500);
    await optionsPage.close();

    // Navigate to the Sanskrit dictionary site
    await navigateToSite(page);

    // Search for a term
    const input = page.locator('#theform input[name="q"]');
    await input.fill('yoga');
    await input.press('Enter');

    // Wait for results
    await page.waitForSelector('article:not([hidden])', { timeout: 10000 });
    await page.waitForTimeout(1000); // Wait for extension to process

    // Check that NO toggle buttons are visible
    const togglesHidden = await page.evaluate(() => {
      const toggles = document.querySelectorAll('.sd-ext-article-toggle');
      console.log('Found toggles:', toggles.length);
      let allHidden = true;
      toggles.forEach((toggle, i) => {
        const computed = window.getComputedStyle(toggle as HTMLElement);
        const isVisible = computed.display !== 'none' &&
                         computed.visibility !== 'hidden' &&
                         (toggle as HTMLElement).offsetParent !== null;
        console.log(`Toggle ${i}: display=${computed.display}, visibility=${computed.visibility}, offsetParent=${(toggle as HTMLElement).offsetParent}, visible=${isVisible}`);
        if (isVisible) allHidden = false;
      });
      return { count: toggles.length, allHidden };
    });

    console.log('Toggles when showToggles=false:', togglesHidden);
    expect(togglesHidden.count).toBe(0); // Should be no toggles in DOM at all

    // Now enable showToggles
    const optionsPage2 = await openOptionsPage(context);
    await optionsPage2.waitForSelector('#show-toggles', { timeout: 5000 });

    const showToggles2 = optionsPage2.locator('#show-toggles');
    if (!(await showToggles2.isChecked())) {
      await showToggles2.check();
    }

    // Wait for settings to save
    await optionsPage2.waitForTimeout(500);
    await optionsPage2.close();

    // Navigate back to the site
    await page.reload();
    await input.fill('yoga');
    await input.press('Enter');

    // Wait for results
    await page.waitForSelector('article:not([hidden])', { timeout: 10000 });
    await page.waitForTimeout(1000); // Wait for extension to process

    // Check that toggle buttons ARE visible now
    const togglesVisible = await page.evaluate(() => {
      const toggles = document.querySelectorAll('.sd-ext-article-toggle');
      console.log('Found toggles after enabling:', toggles.length);
      let anyVisible = false;
      toggles.forEach((toggle, i) => {
        const computed = window.getComputedStyle(toggle as HTMLElement);
        const isVisible = computed.display !== 'none' &&
                         computed.visibility !== 'hidden' &&
                         (toggle as HTMLElement).offsetParent !== null;
        console.log(`Toggle ${i} after: display=${computed.display}, visibility=${computed.visibility}, offsetParent=${(toggle as HTMLElement).offsetParent}, visible=${isVisible}`);
        if (isVisible) anyVisible = true;
      });
      return { count: toggles.length, anyVisible };
    });

    console.log('Toggles when showToggles=true:', togglesVisible);
    expect(togglesVisible.count).toBeGreaterThan(0);
    expect(togglesVisible.anyVisible).toBe(true);

    // Test that minimizeLongArticles forces toggles to show
    const optionsPage3 = await openOptionsPage(context);
    await optionsPage3.waitForSelector('#minimize-long', { timeout: 5000 });

    const minimizeLong3 = optionsPage3.locator('#minimize-long');
    if (!(await minimizeLong3.isChecked())) {
      await minimizeLong3.check();
    }

    // Verify showToggles is forced checked and disabled
    const showToggles3 = optionsPage3.locator('#show-toggles');
    await expect(showToggles3).toBeChecked();
    await expect(showToggles3).toBeDisabled();

    // Wait for settings to save
    await optionsPage3.waitForTimeout(500);
    await optionsPage3.close();

    // Navigate to site and verify toggles are visible
    await page.reload();
    await input.fill('yoga');
    await input.press('Enter');

    await page.waitForSelector('article:not([hidden])', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const togglesWithMinimize = await page.evaluate(() => {
      const toggles = document.querySelectorAll('.sd-ext-article-toggle');
      return { count: toggles.length };
    });

    expect(togglesWithMinimize.count).toBeGreaterThan(0);
  });
});