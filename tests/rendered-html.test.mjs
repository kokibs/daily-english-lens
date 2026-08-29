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
  const [home, login, dashboard, layout, authProxy] = await Promise.all([
    source("app/page.tsx"),
    source("app/login/login-client.tsx"),
    dashboardSource(),
    source("app/layout.tsx"),
    source("lib/supabase/proxy.ts"),
  ]);
  assert.match(`${home}${login}`, /Daily English Lens/);
  assert.match(login, /Turn your day/);
  assert.match(login, /Googleで続ける/);
  assert.match(login, /\/privacy/);
  assert.match(dashboard, /Add today/);
  assert.match(dashboard, /Generate today/);
  assert.match(dashboard, /Past days/);
  assert.match(dashboard, /Delete this day/);
  assert.match(dashboard, /Delete this saved day/);
  assert.match(dashboard, /deleteDailyEntry/);
  assert.match(dashboard, /Review complete!/);
  assert.match(dashboard, /Repeat all/);
  assert.match(dashboard, /Retry mistakes/);
  assert.match(dashboard, /Finish for now/);
  assert.match(dashboard, /Choose a day/);
  assert.match(dashboard, /ReviewDayPicker/);
  assert.match(dashboard, /selectedReviewDate/);
  assert.match(dashboard, /Choose another day/);
  assert.match(dashboard, /entry\.expressions\.map/);
  assert.match(dashboard, /concreteJapanesePrompt\(item\)/);
  assert.match(dashboard, /concreteCloze\(item\)/);
  assert.match(dashboard, /concreteReviewTarget\(reviewItem\)/);
  assert.match(dashboard, /Complete the expression:/);
  assert.match(dashboard, /targetWords\.map/);
  assert.doesNotMatch(dashboard, /learningWords/);
  assert.doesNotMatch(dashboard, /reviewSessionIndex \+ 1\) %/);
  assert.match(dashboard, /Mobile navigation/);
  assert.match(layout, /width: "device-width"/);
  assert.match(layout, /initialScale: 1/);
  assert.match(authProxy, /pathname === "\/privacy"/);
  assert.doesNotMatch(`${home}${login}`, /Sample day|Morning commute|Badminton practice/);
  assert.doesNotMatch(`${home}${login}`, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("emits product-specific social metadata", async () => {
  const layout = await source("app/layout.tsx");
  assert.match(layout, /openGraph/);
  assert.match(layout, /Daily English Lens/);
  assert.match(layout, /\/og-dashboard\.png/);
});

test("keeps temporary unlimited generation private and date scoped", async () => {
  const [home, dashboard, route, access] = await Promise.all([
    source("app/page.tsx"),
    dashboardSource(),
    source("app/api/generate/route.ts"),
    source("lib/generation-access.ts"),
  ]);
  assert.match(home, /TEMP_UNLIMITED_GENERATION_EMAIL/);
  assert.match(home, /unlimitedGenerationToday/);
  assert.match(dashboard, /!unlimitedGenerationToday/);
  assert.match(route, /if \(!unlimitedGenerationToday\)/);
  assert.match(access, /Asia\/Tokyo/);
  assert.match(access, /todayInJapan === allowedDate\.trim\(\)/);
  assert.doesNotMatch(`${home}${dashboard}${route}${access}`, /@gmail\.com/);
});
