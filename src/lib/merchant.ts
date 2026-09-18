// Merchant normalization: "SQ *BLUE BOTTLE COFFEE 0231 IRVINE CA" -> "blue bottle coffee".
//
// Bank descriptions carry noise the merchant did not choose: payment
// processor prefixes (SQ = Square, TST = Toast, PP = PayPal), store
// numbers, city/state suffixes, transaction ids. Two visits to the
// same place must produce the same key, or "remember what I picked
// last time" cannot work. Pure function, heavily tested, easy to extend
// when a new bank format shows up.

const PROCESSOR_PREFIXES = [
  /^sq\s*\*\s*/, /^tst\s*\*\s*/, /^pp\s*\*\s*/, /^paypal\s*\*\s*/, /^dd\s*\*\s*/,
  /^apl\s*\*\s*/, /^py\s*\*\s*/, /^ach\s+/, /^pos\s+(debit\s+|purchase\s+)?/, /^debit card purchase\s+/,
  /^purchase\s+/, /^checkcard\s+\d*\s*/, /^visa\s+/,
];

const US_STATES = "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";

export function normalizeMerchant(raw: string): string {
  let s = raw.toLowerCase().trim();
  for (const re of PROCESSOR_PREFIXES) s = s.replace(re, "");
  // "amzn mktp us*2k3abc" -> drop a trailing *id (must contain a digit:
  // "uber *eats" is a word, not an id). Any other "*" is just a separator.
  s = s.replace(/\*[a-z]*\d[a-z0-9]*$/, "").replace(/\s*\*\s*/g, " ");
  // Web addresses are noise: "uber eats help.uber.com" -> "uber eats".
  const domain = s.match(/([a-z0-9-]+)\.(com|net|org|io|co)\b/);
  s = s.replace(/\s*\S+\.(com|net|org|io|co)\b\S*/g, " ");
  if (s.trim() === "" && domain) s = domain[1]; // "netflix.com" -> "netflix"
  // Trailing "city st [zip]". A city is only stripped when the token
  // before it contains a digit (a store number): "chipotle 0231 irvine
  // ca" -> "chipotle 0231", but "uber eats ca" keeps "eats" because
  // nothing says it is a city rather than the merchant's name.
  const st = US_STATES.toLowerCase();
  s = s.replace(new RegExp(`(\\S*\\d\\S*)\\s+[a-z.'-]+(\\s+[a-z.'-]+)?\\s+(${st})(\\s+\\d{5})?$`), "$1");
  s = s.replace(new RegExp(`\\s+(${st})(\\s+\\d{5})?$`), "");
  // Store / transaction numbers: "#1234", "0231", long digit runs, dates.
  s = s.replace(/#\s*\d+/g, " ").replace(/\b\d{2}\/\d{2}(\/\d{2,4})?\b/g, " ").replace(/\b\d{3,}\b/g, " ");
  // Punctuation to spaces, collapse, trim.
  s = s.replace(/[^a-z0-9&' ]+/g, " ").replace(/\s+/g, " ").trim();
  return s;
}
