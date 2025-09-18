# Playwright E2E Suite

This project ships a Playwright-based regression suite that exercises the Chrome extension against https://sanskrit.myke.blog/.

## Setup
1. Install dependencies
   ```bash
   npm install
   ```
2. Install Chromium for Playwright (first run only)
   ```bash
   npx playwright install chromium
   ```

## Running the tests
- Headed (default behaviour to allow extensions):
  ```bash
  npm run test:e2e
  ```
- With Playwright Inspector:
  ```bash
  npm run test:e2e:headed
  ```

The harness launches Chromium with the unpacked extension loaded from the project root. Each test uses its own temporary profile so sync propagation scenarios open additional windows inside the same profile when needed.
