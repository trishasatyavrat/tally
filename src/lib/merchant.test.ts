import { describe, it, expect } from "vitest";
import { normalizeMerchant } from "./merchant";

describe("normalizeMerchant", () => {
  const cases: [string, string][] = [
    ["CHIPOTLE 0231 IRVINE CA", "chipotle"],
    ["Chipotle #2231", "chipotle"],
    ["SQ *BLUE BOTTLE COFFEE", "blue bottle coffee"],
    ["TST* THE CAFE - IRVINE", "the cafe irvine"], // no state, so the city cannot be told apart from the name
    ["AMZN Mktp US*2K3AB1", "amzn mktp us"],
    ["UBER *EATS", "uber eats"],
    ["UBER   EATS   HELP.UBER.COM CA", "uber eats"],
    ["SHELL OIL 12345 LOS ANGELES CA 92602", "shell oil"],
    ["DD *DOORDASH CHIPOTLE", "doordash chipotle"],
    ["PAYPAL *SPOTIFY", "spotify"],
    ["TRADER JOE'S #123 IRVINE CA", "trader joe's"],
    ["POS DEBIT TARGET T-1234 TUSTIN CA", "target t"],
    ["Netflix.com", "netflix"],
    ["ARCO#42011 09/03 ANAHEIM CA", "arco"],
    ["", ""],
  ];
  it.each(cases)("%s -> %s", (raw, want) => {
    expect(normalizeMerchant(raw)).toBe(want);
  });

  it("maps the same store on different days to one key", () => {
    expect(normalizeMerchant("CHIPOTLE 0231 IRVINE CA")).toBe(normalizeMerchant("CHIPOTLE 0231 TUSTIN CA"));
    expect(normalizeMerchant("SQ *BLUE BOTTLE #12")).toBe(normalizeMerchant("Blue Bottle"));
  });
});
