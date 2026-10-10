import { expect, test } from '@playwright/test';
import { signInAsFreshUser } from './session';

/**
 * 選手がいちばんよく通る道を、パソコンとスマホの幅で通す。
 * 最初の登録 → ホーム → 今日の試技を足す → 直す → 大会を足す → 言語を切り替える
 */

test('ログインしていなければ / と /ja は LP、ほかはログインの画面へ。規約は誰でも開ける', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Built for every jump.' }),
  ).toBeVisible();
  await page.goto('/ja');
  await expect(
    page.getByRole('heading', { level: 1, name: '跳躍の、一本一本のために。' }),
  ).toBeVisible();
  // 英語の LP の中身は /en にあるが、正しい URL は /
  await page.goto('/en');
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/log');
  await expect(page).toHaveURL(/\/sign-in$/);
  for (const path of ['/privacy', '/terms', '/en/privacy', '/en/terms']) {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
  }
});

test('登録から試技を足して直し、大会を足す', async ({ page, context, baseURL }, testInfo) => {
  await signInAsFreshUser(context, `e2e-${testInfo.project.name}`, baseURL!);

  // 最初の登録
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole('button', { name: '走幅跳' }).click();
  await page.getByRole('button', { name: 'はじめる' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: '走幅跳' })).toBeVisible();

  // 時間帯が保存されている（東京の人にだけ学年の欄が出る）。描き直すたびに隠し欄が UTC に戻り、
  // 登録した人がみな UTC になっていた（2026-10-11）
  await page.goto('/settings');
  await expect(page.getByRole('combobox', { name: '学年' })).toBeVisible();
  await page.goto('/');

  // 今日を記録（パソコンはヘッダー、スマホは下のタブの真ん中）
  await page.getByRole('link', { name: '今日を記録' }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/log\/today\/new$/);
  const form = page.locator('main form');
  await form.getByRole('spinbutton', { name: /^記録/ }).fill('6.12');
  await form.getByRole('spinbutton', { name: /^風速/ }).fill('1.5');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page).toHaveURL(/\/log\/today$/);
  await expect(page.getByRole('listitem').filter({ hasText: '6.12' })).toBeVisible();

  // 試技を直す
  await page.getByRole('link', { name: '試技を編集' }).click();
  await expect(form.getByRole('spinbutton', { name: /^記録/ })).toHaveValue('6.12');
  await form.getByRole('textbox', { name: 'メモ' }).fill('追い風が強い');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page).toHaveURL(/\/log\/today$/);
  await expect(page.getByText('追い風が強い')).toBeVisible();

  // 大会を足す
  await page.goto('/competitions');
  await page.getByRole('link', { name: '追加', exact: true }).click();
  await form.getByRole('textbox', { name: /^大会名/ }).fill('E2E 記録会');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page).toHaveURL(/\/competitions$/);
  await expect(page.getByText('E2E 記録会')).toBeVisible();
});

test('設定で言語を切り替える', async ({ page, context, baseURL }, testInfo) => {
  await signInAsFreshUser(context, `e2e-lang-${testInfo.project.name}`, baseURL!);
  await page.goto('/');
  await page.getByRole('button', { name: '走高跳' }).click();
  await page.getByRole('button', { name: 'はじめる' }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto('/settings');
  await page.getByRole('radio', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await page.getByRole('radio', { name: 'Auto' }).click();
  await expect(page.getByRole('heading', { name: '設定', level: 1 })).toBeVisible();
});
