import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  return readFile(new URL("../.next/server/app/index.html", import.meta.url), "utf8");
}

test("renders the Daily English Lens product experience", async () => {
  const html = await render();
  assert.match(html, /Daily English Lens/);
  assert.match(html, /Turn your day/);
  assert.match(html, /Add today/);
  assert.match(html, /Generate today/);
  assert.match(html, /Past days/);
  assert.match(html, /Mobile navigation/);
  assert.match(html, /width=device-width, initial-scale=1/);
  assert.doesNotMatch(html, /Sample day|Morning commute|Badminton practice/);
  assert.doesNotMatch(html, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("emits product-specific social metadata", async () => {
  const html = await render();
  assert.match(html, /og:title/);
  assert.match(html, /Daily English Lens/);
  assert.match(html, /\/og-dashboard\.png/);
});
