import { test, expect } from "@playwright/test";

function uniqueUser() {
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return {
    username: `e2e${suffix}`,
    email: `e2e${suffix}@example.com`,
    password: "sup3rsecret",
    hotel: `Hotel ${suffix}`,
  };
}

async function signUp(page: import("@playwright/test").Page, user: ReturnType<typeof uniqueUser>) {
  await page.goto("/sign-up");
  await page.getByPlaceholder("Username").fill(user.username);
  await page.getByPlaceholder("Email").fill(user.email);
  await page.getByPlaceholder("Password").fill(user.password);
  await page.getByPlaceholder("Name of hotel").fill(user.hotel);
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Next" }).click();
  }
  await page.getByRole("button", { name: "Finish" }).click();
  await page.waitForURL("**/");
}

test("a host can sign up, stay signed in, sign out and sign back in", async ({ page }) => {
  const user = uniqueUser();

  await signUp(page, user);
  await expect(page.getByText(`Hi, ${user.username}`)).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

  await page.goto("/sign-in");
  await page.getByPlaceholder("Email or username").fill(user.username);
  await page.getByPlaceholder("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/");

  await expect(page.getByText(`Hi, ${user.username}`)).toBeVisible();
});

test("sign in rejects a wrong password", async ({ page }) => {
  const user = uniqueUser();
  await signUp(page, user);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

  await page.goto("/sign-in");
  await page.getByPlaceholder("Email or username").fill(user.username);
  await page.getByPlaceholder("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Invalid credentials")).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
});
