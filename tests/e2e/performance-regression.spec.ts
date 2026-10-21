import { test, expect } from "@playwright/test";

test("playing cards load optimized images without changing card selection", async ({ page }, testInfo) => {
  await page.goto("/?stage=1&battle=high-low&robot=high-low-1-3");
  const cards = page.locator('img[src*="url=%2Fcards%2Fcropped%2F"]').filter({ visible: true });
  await expect(cards.first()).toBeVisible();
  await expect.poll(() => cards.evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect(cards.first()).toHaveAttribute("src", /q=90/);
  await cards.first().screenshot({ path: testInfo.outputPath("optimized-card.png") });
});
