import { describe, expect, it } from "vitest";
import { cleanReviewText } from "@/lib/airbnb-reviews";
import { reviewComplaints } from "@/lib/review-insights";

describe("cleanReviewText", () => {
  it("turns <br/> into newlines and decodes entities", () => {
    expect(cleanReviewText("Great view<br/><br/><br/>Tom &amp; Ana &quot;loved&quot; it")).toBe(
      'Great view\n\nTom & Ana "loved" it'
    );
  });
});

describe("reviewComplaints", () => {
  it("finds every topic in a low-star review", () => {
    const topics = reviewComplaints(
      "No había agua caliente. El aire acondicionado no enfría. El wifi falla.",
      1
    );
    expect([...topics.keys()]).toEqual(expect.arrayContaining(["hotWater", "cooling", "wifi"]));
  });

  it("ignores praise in 5-star reviews", () => {
    expect(reviewComplaints("Muy limpio y tranquilo, regresaría sin pensarlo. Feels private.", 5).size).toBe(0);
  });

  it("catches a caveat inside a 5-star review", () => {
    const topics = reviewComplaints("Lugar precioso. The Wi-Fi isn't the strongest, but who cares.", 5);
    expect(topics.get("wifi")).toContain("Wi-Fi");
  });

  it("works when Airbnb gives no star rating", () => {
    expect(reviewComplaints("Había mosquitos en la noche, pero todo bien.", null).has("bugs")).toBe(true);
  });
});

describe("reviewComplaints quotes", () => {
  it("clips long sentences around the complaint", () => {
    const long = `${"Todo estuvo increíble y el personal fue muy amable ".repeat(4)}pero el wifi fallaba mucho ${"y la vista era hermosa ".repeat(4)}`;
    const quote = reviewComplaints(long, 3).get("wifi") ?? "";
    expect(quote.length).toBeLessThanOrEqual(142);
    expect(quote).toContain("wifi");
    expect(quote.startsWith("…")).toBe(true);
  });
});
