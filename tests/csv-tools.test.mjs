import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanRows,
  detectDelimiter,
  inferPiiHeaders,
  parseCSV,
  stringifyCSV
} from "../src/csv-tools.js";

test("detects semicolon-delimited CSV", () => {
  assert.equal(detectDelimiter("Name;Email;Plan\nAna;ana@example.com;Pro"), ";");
});

test("parses quoted fields and normalizes duplicate headers", () => {
  const parsed = parseCSV('Full Name,Email,Email\n"Ana, M.",a@example.com,backup@example.com');
  assert.deepEqual(parsed.headers, ["full_name", "email", "email_2"]);
  assert.equal(parsed.rows[0].full_name, "Ana, M.");
});

test("removes duplicate rows and masks inferred PII", () => {
  const parsed = parseCSV("Name,Email,Phone\nAna,ana@example.com,+38164111222\nAna,ana@example.com,+38164111222");
  const maskHeaders = inferPiiHeaders(parsed.headers);
  const cleaned = cleanRows(parsed.rows, parsed.headers, { maskHeaders });

  assert.equal(cleaned.rows.length, 1);
  assert.equal(cleaned.removed.duplicates, 1);
  assert.equal(cleaned.rows[0].email, "a***@***.com");
  assert.equal(cleaned.rows[0].phone, "*******1222");
});

test("stringifies values with quotes, newlines, and delimiters", () => {
  const csv = stringifyCSV(["name", "note"], [{ name: "Ana", note: "hello, \"world\"" }]);
  assert.equal(csv, 'name,note\nAna,"hello, ""world"""');
});
