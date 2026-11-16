import { expect, type Page } from "@playwright/test";

export async function openRoadmapStep(page: Page, idOrOrder: string | number) {
  const rows = page.getByRole("region", { name: "계획 로드맵", exact: true }).locator(".roadmap-step");
  const button = typeof idOrOrder === "number" ? rows.nth(idOrOrder - 1).locator(".roadmap-step__select")
    : page.locator(`.roadmap-step[data-step-id="${idOrOrder}"] > button`);
  if (await button.getAttribute("aria-pressed") !== "true") await button.click();
  // Wait for this card, rather than an editor that may still show the previous step.
  await expect(button).toHaveAttribute("aria-pressed", "true");
  const editor = page.getByRole("complementary", { name: "로드맵 단계 편집", exact: true });
  await expect(editor).toBeVisible();
  return editor;
}
