import { describe, it, expect } from "vitest";
import { buildRuleMap } from "./rules";

describe("buildRuleMap", () => {
  it("maps each merchant key to its majority category", () => {
    const rules = buildRuleMap([
      { merchant: "CHIPOTLE 0231 IRVINE CA", description: "", categoryId: "food" },
      { merchant: "CHIPOTLE 0555 TUSTIN CA", description: "", categoryId: "food" },
      { merchant: "CHIPOTLE 0231 IRVINE CA", description: "", categoryId: "fun" },
      { merchant: "SQ *BLUE BOTTLE", description: "", categoryId: "food" },
      { merchant: null, description: "Shell Oil 1234", categoryId: "gas" },
      { merchant: "Nothing", description: "", categoryId: null },
    ]);
    expect(rules.get("chipotle")).toBe("food");
    expect(rules.get("blue bottle")).toBe("food");
    expect(rules.get("shell oil")).toBe("gas");
    expect(rules.has("nothing")).toBe(false);
    expect(rules.size).toBe(3);
  });

  it("breaks ties toward the most recent label (rows newest-first)", () => {
    const rules = buildRuleMap([
      { merchant: "TARGET", description: "", categoryId: "misc" },
      { merchant: "TARGET #12", description: "", categoryId: "food" },
    ]);
    expect(rules.get("target")).toBe("misc");
  });

  it("ignores rows whose merchant normalizes to nothing", () => {
    expect(buildRuleMap([{ merchant: "#### 1234", description: "", categoryId: "x" }]).size).toBe(0);
  });
});
