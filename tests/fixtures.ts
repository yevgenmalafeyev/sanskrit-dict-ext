import fs from 'fs';
import os from 'os';
import path from 'path';
import { chromium, expect as baseExpect, test as base } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';

const EXTENSION_PATH = path.resolve(__dirname, '..');

async function createUserDataDir(testId: string) {
  const prefix = path.join(os.tmpdir(), `pw-sanskrit-${testId}-`);
  return await fs.promises.mkdtemp(prefix);
}

function cleanupUserDataDir(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_err) {}
}

async function extractExtensionId(context: BrowserContext): Promise<string> {
  const cached = (context as unknown as { _extensionId?: string })._extensionId;
  if (cached) return cached;

  const attemptFromServiceWorker = () => {
    const workers = context.serviceWorkers();
    for (const worker of workers) {
      const match = /chrome-extension:\/\/([a-z]+)\//i.exec(worker.url());
      if (match && match[1]) {
        (context as unknown as { _extensionId?: string })._extensionId = match[1];
        return match[1];
      }
    }
    return null;
  };

  const workerId = attemptFromServiceWorker();
  if (workerId) return workerId;

  try {
    const worker = await context.waitForEvent('serviceworker', { timeout: 5_000 });
    const match = /chrome-extension:\/\/([a-z]+)\//i.exec(worker.url());
    if (match && match[1]) {
      (context as unknown as { _extensionId?: string })._extensionId = match[1];
      return match[1];
    }
  } catch (_err) {}

  const page = await context.newPage();
  await page.goto('chrome://extensions/', { waitUntil: 'domcontentloaded' });

  const maybeEnableDevMode = page.locator('extensions-manager').locator('>>> extensions-toolbar').locator('>>> #devMode');
  try {
    if (await maybeEnableDevMode.count()) {
      const isChecked = await maybeEnableDevMode.evaluate((el: HTMLInputElement) => el.hasAttribute('checked'));
      if (!isChecked) {
        await maybeEnableDevMode.evaluate((el: HTMLInputElement) => el.click());
      }
    }
  } catch (_err) {}

  const extensionId = await page.evaluate(() => {
    function extractFromItem(item: Element & { item?: { id?: string } }): string | null {
      if (!item) return null;
      const attrId = item.getAttribute('id');
      if (attrId) return attrId;
      const attrGuid = item.getAttribute('guid');
      if (attrGuid) return attrGuid;
      if (item.item && item.item.id) return item.item.id;
      const idLabel = (item.shadowRoot && item.shadowRoot.querySelector('#extension-id')) as HTMLElement | null;
      if (idLabel && idLabel.textContent) {
        const match = /ID:\s*(.+)/i.exec(idLabel.textContent);
        if (match) return match[1].trim();
      }
      return null;
    }

    const manager = document.querySelector('extensions-manager');
    if (!manager || !manager.shadowRoot) return null;
    const itemList = manager.shadowRoot.querySelector('extensions-item-list');
    if (!itemList || !(itemList as HTMLElement).shadowRoot) return null;
    const items = (itemList as HTMLElement).shadowRoot.querySelectorAll('extensions-item');
    for (const rawItem of Array.from(items)) {
      const id = extractFromItem(rawItem as Element & { item?: { id?: string } });
      if (id) return id;
    }
    return null;
  });

  await page.close();

  if (!extensionId) {
    throw new Error('Unable to determine extension id.');
  }

  (context as unknown as { _extensionId?: string })._extensionId = extensionId;
  return extensionId;
}

export async function openOptionsPage(context: BrowserContext): Promise<Page> {
  const extensionId = await extractExtensionId(context);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' });
  return page;
}

export async function resetExtensionStorage(context: BrowserContext): Promise<void> {
  const page = await openOptionsPage(context);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const sync = (window as unknown as { chrome?: { storage?: { sync?: { clear: (cb: () => void) => void } } } }).chrome?.storage?.sync;
        if (sync && typeof sync.clear === 'function') {
          sync.clear(() => resolve());
        } else {
          resolve();
        }
      })
  );
  await page.close();
}

export const test = base.extend<{ context: BrowserContext; page: Page }>({
  context: async ({}, use, testInfo) => {
    const userDataDir = await createUserDataDir(testInfo.parallelIndex.toString());
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-first-run',
        '--no-default-browser-check'
      ]
    });

    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://sanskrit.myke.blog' });

    try {
      await use(context);
    } finally {
      await context.close();
      cleanupUserDataDir(userDataDir);
    }
  },

  page: async ({ context }, use) => {
    const page = await context.newPage();
    try {
      await use(page);
    } finally {
      if (!page.isClosed()) {
        await page.close();
      }
    }
  }
});

export const expect = baseExpect;

export async function navigateToSite(page: Page) {
  await page.goto('https://sanskrit.myke.blog/', { waitUntil: 'domcontentloaded' });
}
