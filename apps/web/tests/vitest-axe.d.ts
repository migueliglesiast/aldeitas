import "vitest";

declare module "vitest" {
  interface Matchers<R extends void | Promise<void> = void | Promise<void>> {
    toHaveNoViolations: () => R;
  }
}
