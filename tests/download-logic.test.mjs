import test from "node:test";
import assert from "node:assert/strict";
import { parseRange, hostFromUrl, parseAllowlist } from "../src/lib/download-logic.js";

test("parseRange handles standard ranges", () => {
  assert.deepEqual(parseRange("bytes=0-99", 200), { start: 0, end: 99 });
  assert.deepEqual(parseRange("bytes=50-199", 200), { start: 50, end: 199 });
});

test("parseRange handles suffix bytes", () => {
  assert.deepEqual(parseRange("bytes=-50", 200), { start: 150, end: 199 });
});

test("parseRange rejects invalid ranges", () => {
  assert.equal(parseRange(null, 200), null);
  assert.equal(parseRange("bytes=200-300", 200), null); // start >= size
  assert.equal(parseRange("bytes=100-50", 200), null); // end < start
  assert.equal(parseRange("bytes=abc-def", 200), null);
});

test("hostFromUrl extracts lowercase host", () => {
  assert.equal(hostFromUrl("https://Example.com/path"), "example.com");
  assert.equal(hostFromUrl("not-a-url"), null);
});

test("parseAllowlist splits and normalizes", () => {
  assert.deepEqual(parseAllowlist("A.com, b.com ,"), ["a.com", "b.com"]);
  assert.deepEqual(parseAllowlist(""), []);
});
