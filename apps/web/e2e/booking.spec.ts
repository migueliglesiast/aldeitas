import { test, expect, Page } from "@playwright/test";

import {
  BLOCKED_END,
  BLOCKED_MIDDLE,
  E2E_BLOCKED_LISTING as BLOCKED_LISTING,
  E2E_HOTEL as HOTEL,
  E2E_LISTING as FREE_LISTING,
  freeBookingRange,
} from "./fixtures";

async function setDates(page: Page, start: string, end: string) {
  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill(start);
  await dateInputs.nth(1).fill(end);
}

async function openListing(page: Page, title: string) {
  await page.goto("/");
  await page.getByText(HOTEL, { exact: true }).click();
  await page.getByRole("link", { name: /See Rooms and Availability/ }).click();
  await page.getByText(title, { exact: true }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

test("searching filters the grid by the availability API response", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(HOTEL, { exact: true })).toBeVisible();

  // The booked suite has a confirmed booking on these dates; the free suite has no calendar, so it stays bookable.
  await setDates(page, BLOCKED_MIDDLE, BLOCKED_END);
  const availability = page.waitForResponse((res) =>
    res.url().includes("/api/search/availability")
  );
  await page.getByRole("button", { name: /Search/ }).click();
  const response = await availability;

  expect(response.status()).toBe(200);
  expect((await response.json()).listingIds).toHaveLength(1);
  await expect(page.getByText("1 room available")).toBeVisible();
  await expect(page.getByText(FREE_LISTING, { exact: true })).toBeVisible();
  await expect(page.getByText(BLOCKED_LISTING, { exact: true })).toHaveCount(0);
});

test("a guest can book available dates and lands on the card payment page", async ({ page }, testInfo) => {
  await openListing(page, FREE_LISTING);

  const { start, end } = freeBookingRange(testInfo.project.name);
  await setDates(page, start, end);
  await page.locator('input[type="email"]').fill("guest@example.com");
  await page.locator('input[type="tel"]').fill("5215551234");

  const bookingResponse = page.waitForResponse(
    (res) => res.url().includes("/api/book") && res.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Reserve" }).click();
  const response = await bookingResponse;

  expect(response.status()).toBe(200);
  await page.waitForURL(/\/booking\/[^/]+\/pay$/);
  const bookingId = new URL(page.url()).pathname.split("/")[2];
  await expect(page.getByRole("heading", { name: FREE_LISTING })).toBeVisible();
  await expect(page.getByText("Total a autorizar")).toBeVisible();

  const status = await page.request.get(`/api/bookings/${bookingId}`);
  expect((await status.json()).status).toBe("PENDING");
});

test("booking blocked dates returns 409 and surfaces the error", async ({ page }) => {
  await openListing(page, BLOCKED_LISTING);

  await setDates(page, BLOCKED_MIDDLE, BLOCKED_END);
  await page.locator('input[type="email"]').fill("guest@example.com");
  await page.locator('input[type="tel"]').fill("5215551234");

  const bookingResponse = page.waitForResponse(
    (res) => res.url().includes("/api/book") && res.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Reserve" }).click();
  const response = await bookingResponse;

  expect(response.status()).toBe(409);
  await expect(page.getByText("Dates unavailable")).toBeVisible();
});

test("the availability calendar marks the seeded booking as booked", async ({ page }) => {
  await openListing(page, BLOCKED_LISTING);

  await expect(page.getByRole("heading", { name: "Availability" })).toBeVisible();
  await expect(page.locator('[title="Booked"]').first()).toBeVisible();
});
