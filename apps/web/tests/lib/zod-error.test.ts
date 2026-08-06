import { describe, it, expect } from "vitest";
import { z } from "zod";
import { formatZodError } from "@/lib/zod-error";

describe("formatZodError", () => {
  it("joins field issues into a readable message", () => {
    const schema = z.object({ email: z.string().email(), age: z.number().min(18) });
    const result = schema.safeParse({ email: "nope", age: 12 });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(formatZodError(result.error)).toBe(
      "email: Invalid email, age: Number must be greater than or equal to 18"
    );
  });

  it("keeps issues without a path", () => {
    const result = z.string().safeParse(42);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(formatZodError(result.error)).toBe("Expected string, received number");
  });
});
