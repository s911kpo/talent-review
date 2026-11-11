import type { Page } from '@playwright/test';

/** Opens a page from the sidebar; below 1024px the sidebar sits behind the menu button. */
export async function goNav(page: Page, name: string) {
  const menu = page.getByRole('button', { name: '開啟選單' });
  const tab = page.getByRole('tablist', { name: '主選單' }).getByRole('tab', { name, exact: true });
  await menu.or(tab).first().waitFor({ state: 'visible' });
  if (await menu.isVisible()) await menu.click();
  await tab.click();
}
