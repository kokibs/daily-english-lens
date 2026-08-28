import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

async function dashboardSource() {
  return readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8");
}

test("renders the login entry and retains the authenticated product experience", async () => {
  const [home, login, dashboard, layout] = await Promise.all([
    source("app/page.tsx"),
    source("app/login/login-client.tsx"),
    dashboardSource(),
    source("app/layout.tsx"),
  ]);
  assert.match(`${home}${login}`, /Daily English Lens/);
  assert.match(login, /Turn your day/);
  assert.match(login, /Googleで続ける/);
  assert.match(login, /\/privacy/);
  assert.match(dashboard, /Add today/);
  assert.match(dashboard, /Generate today/);
  assert.match(dashboard, /Past days/);
  assert.match(dashboard, /Mobile navigation/);
  assert.match(layout, /width: "device-width"/);
  assert.match(layout, /initialScale: 1/);
  assert.doesNotMatch(`${home}${login}`, /Sample day|Morning commute|Badminton practice/);
  assert.doesNotMatch(`${home}${login}`, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("emits product-specific social metadata", async () => {
  const layout = await source("app/layout.tsx");
  assert.match(layout, /openGraph/);
  assert.match(layout, /Daily English Lens/);
  assert.match(layout, /\/og-dashboard\.png/);
});
