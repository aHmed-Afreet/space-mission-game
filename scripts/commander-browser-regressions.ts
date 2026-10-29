/**
 * Real Chromium regressions for Commander controls.
 *
 * Start a built preview, then run:
 *   BASE_URL=http://127.0.0.1:4173 node --import tsx scripts/commander-browser-regressions.ts
 * Add --layout-only for the seeded EVA layout cases, or --walkthrough to continue
 * the fresh, UI-started Orbital Qualification flight through its full procedure.
 * --skip-layout starts directly with the fresh 3D flight.
 * --walkthrough-only starts a fresh flight and walks the full procedure without
 * first running the separate layout and closed-wall regression cases.
 * Every case uses a fresh browser context; existing browser saves are untouched.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newStore, SAVE_KEY } from "../src/commander/campaign/save";
import { launchMission, type Session } from "../src/commander/campaign/engine";
import { missionById, type Site } from "../src/commander/campaign/definitions";
import { deck } from "../src/commander/layout";
import { doors } from "../src/commander/campaign/ship";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ||
  "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const baseUrl = process.env.BASE_URL || "http://127.0.0.1:4173";
const artifacts = process.env.BROWSER_ARTIFACTS || join(tmpdir(), "commander-browser-regressions");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: process.env.HEADED !== "1",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"],
});
process.once("SIGTERM", () => { void browser.close().finally(() => process.exit(143)); });
process.once("SIGINT", () => { void browser.close().finally(() => process.exit(130)); });
await mkdir(artifacts, { recursive: true });
const contexts: any[] = [];
const failurePages: { page: any; name: string }[] = [];
const browserErrors: string[] = [];

async function contextPage(name: string, viewport: { width: number; height: number }, fixture?: unknown, deviceScaleFactor = 1) {
  const context = await browser.newContext({ viewport, deviceScaleFactor, hasTouch: true });
  contexts.push(context);
  await context.addInitScript(({ saveKey, fixture }: any) => {
    const runtime = window as typeof window & { __commanderDrawCalls?: number };
    runtime.__commanderDrawCalls = 0;
    // Count native draws without replacing rendering or changing its output.
    for (const Constructor of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!Constructor) continue;
      const prototype = Constructor.prototype as any;
      for (const name of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
        const original = prototype[name];
        if (typeof original !== "function") continue;
        prototype[name] = function (...args: any[]) {
          runtime.__commanderDrawCalls!++;
          return original.apply(this, args);
        };
      }
    }
    localStorage.setItem("orbital-player-settings-v1", JSON.stringify({ graphics: "battery", lookSensitivity: 1, showHints: true }));
    if (fixture) localStorage.setItem(saveKey, JSON.stringify(fixture));
  }, { saveKey: SAVE_KEY, fixture });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on("pageerror", (error: Error) => browserErrors.push(`${name}: ${error.message}`));
  failurePages.push({ page, name });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "ENTER COMMANDER" }).click();
  return page;
}

async function chooseDevice(page: any, device: "ipad" | "iphone" | "laptop") {
  await page.getByRole("button", { name: device === "ipad" ? /^iPad / : device === "iphone" ? /^iPhone / : /^Laptop / }).click();
  if (device === "laptop") await page.getByRole("button", { name: "Continue →", exact: true }).click();
}

function evaFixture() {
  const store = newStore();
  const mission = missionById("mission-2");
  const launched = launchMission(mission, store.design, store.life, [...mission.requiredEquipment], store.progress);
  const s = launched.session;
  s.position = { x: 0, z: 11.8, heading: 0 };
  s.flight.status = "orbit";
  s.state.paused = false;
  s.suit = { ...s.suit, equipped: true, oxygen: 1.5, power: 1, oxygenChecked: true, powerChecked: true };
  s.airlock = { inner: false, outer: true, pressure: 0, cycling: null };
  return { ...store, ...launched, session: s };
}

async function layoutCases() {
  for (const { name, viewport, device } of [
    { name: "ipad-landscape", viewport: { width: 1024, height: 768 }, device: "ipad" },
    { name: "iphone-portrait", viewport: { width: 390, height: 844 }, device: "iphone" },
    { name: "iphone-landscape", viewport: { width: 844, height: 390 }, device: "iphone" },
  ] as const) {
    const page = await contextPage(name, viewport, evaFixture());
    await chooseDevice(page, device);
    await page.getByRole("button", { name: "Resume mission →", exact: true }).click();
    const resume = page.getByRole("button", { name: "Resume mission", exact: true });
    if (await resume.isVisible()) await resume.click();
    await page.locator(".cmd-orbital-thrusters button").first().waitFor({ state: "visible" });
    const report = await page.evaluate(() => {
      const session = document.querySelector(".cmd-session")!.getBoundingClientRect();
      const selectors = [".cmd-sprint", ".cmd-work", ".cmd-orbital-thrusters button:first-child", ".cmd-orbital-thrusters button:last-child"];
      return selectors.map(selector => {
        const element = document.querySelector(selector)!;
        const r = element.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        return {
          selector, text: element.textContent?.trim(), left: r.left, top: r.top,
          right: r.right, bottom: r.bottom, width: r.width, height: r.height,
          centerHitsSelf: hit === element || element.contains(hit),
          hit: hit?.getAttribute("class") || hit?.tagName,
          inside: r.left >= Math.max(0, session.left) && r.right <= Math.min(innerWidth, session.right) &&
            r.top >= Math.max(0, session.top) && r.bottom <= Math.min(innerHeight, session.bottom),
        };
      });
    });
    for (const control of report) {
      assert.ok(control.inside, `${name}: ${control.text} must stay inside the viewport: ${JSON.stringify(control)}`);
      assert.ok(control.width >= 44 && control.height >= 44, `${name}: ${control.text} requires a 44px touch target`);
      assert.ok(control.centerHitsSelf, `${name}: ${control.text} center is intercepted by ${control.hit}`);
    }
    for (let i = 0; i < report.length; i++) for (let j = i + 1; j < report.length; j++) {
      const a = report[i], b = report[j];
      const overlap = Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
      assert.equal(overlap, false, `${name}: ${a.text} overlaps ${b.text}`);
    }
    // Exercise the real interaction container with a long menu. This fixture is
    // confined to the isolated EVA layout context and is removed immediately.
    const menuReport = await page.evaluate(() => {
      const host = document.querySelector(".campaign-interaction")!;
      const menu = document.createElement("div");
      menu.className = "cmd-action-menu";
      for (let i = 0; i < 20; i++) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `Layout operation ${i + 1}`;
        menu.append(button);
      }
      host.append(menu);
      const r = menu.getBoundingClientRect();
      const first = menu.firstElementChild!.getBoundingClientRect();
      const actions = document.querySelector(".cmd-touch-actions")!.getBoundingClientRect();
      const scrollable = menu.scrollHeight > menu.clientHeight && ["auto", "scroll"].includes(getComputedStyle(menu).overflowY);
      menu.scrollTop = menu.scrollHeight;
      const last = menu.lastElementChild!.getBoundingClientRect();
      const result = {
        top: r.top, bottom: r.bottom, actionsTop: actions.top, scrollable,
        firstInside: first.top >= r.top && first.bottom <= r.bottom,
        lastInside: last.top >= r.top && last.bottom <= r.bottom,
      };
      menu.remove();
      return result;
    });
    assert.ok(menuReport.top >= 12, `${name}: station menu must stay below the safe top inset: ${JSON.stringify(menuReport)}`);
    assert.ok(menuReport.bottom <= menuReport.actionsTop - 8, `${name}: station menu stays above the main action controls`);
    assert.ok(menuReport.firstInside && menuReport.scrollable && menuReport.lastInside, `${name}: the first and last menu controls remain reachable through scrolling: ${JSON.stringify(menuReport)}`);
    // Dispatch physical mouse/pointer input at each center, rather than force-clicking
    // a covered element. This also guards the DOM stacking order used by real touch.
    for (const control of [report[0], report[2], report[3], report[1]]) {
      await page.mouse.move((control.left + control.right) / 2, (control.top + control.bottom) / 2);
      await page.mouse.down();
      await page.waitForTimeout(40);
      await page.mouse.up();
    }
    await page.screenshot({ path: join(artifacts, `${name}.png`) });
    console.log(`PASS ${name}: four separate, visible, reachable touch controls; long menu stays onscreen and scrolls to its last control`);
    await page.context().close();
  }
}

type Position = { x: number; z: number; heading: number };

// Read the rendered navigation map marker. The walkthrough never writes the
// session position, unlocks, objective or simulation state.
async function mapPosition(page: any): Promise<Position> {
  await page.getByRole("button", { name: "Open navigation map", exact: true }).click();
  const transform = await page.locator(".nav-map-svg g[transform^='translate(']").last().getAttribute("transform");
  const match = transform?.match(/translate\(([-\d.e]+) ([-\d.e]+)\) rotate\(([-\d.e]+)\)/);
  assert.ok(match, `Navigation map must render a player marker; got ${transform}`);
  await page.getByRole("dialog", { name: "Navigation map", exact: true }).getByRole("button", { name: "Close", exact: true }).click();
  return { x: (Number(match[1]) - 320) / 90, z: (Number(match[2]) - 64) / 35.5 - 6.1, heading: -Number(match[3]) * Math.PI / 180 };
}

async function pointCamera(page: any, heading: number, position?: Position) {
  const p = position || await mapPosition(page);
  let delta = Math.atan2(Math.sin(heading - p.heading), Math.cos(heading - p.heading));
  while (Math.abs(delta) > .002) {
    const part = Math.max(-1.1, Math.min(1.1, delta));
    const size = page.viewportSize();
    const x = size.width * .77, y = size.height * .42;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - part / .0035, y);
    await page.mouse.up();
    delta -= part;
  }
  await page.waitForTimeout(200);
}

async function hold(page: any, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(300); // Let the game's movement smoothing come to rest.
}

async function sessionFromSave(page: any): Promise<Session> {
  return page.evaluate((key: string) => JSON.parse(localStorage.getItem(key)!).session, SAVE_KEY);
}

async function waitForSave(page: any, predicate: (s: Session) => boolean, message: string, timeout = 5000) {
  const start = Date.now();
  let s: Session;
  do {
    s = await sessionFromSave(page);
    if (s && predicate(s)) return s;
    await page.waitForTimeout(200);
  } while (Date.now() - start < timeout);
  assert.fail(`${message}; saved objective=${s!.objective}, notice=${s!.notice}`);
}

async function freshMission(page: any) {
  console.log("WALK start: choose laptop controls");
  await chooseDevice(page, "laptop");
  await page.getByRole("button", { name: /Orbital Training/ }).click();
  console.log("WALK start: open Orbital Training and prepare Level 1");
  await page.getByRole("button", { name: "Prepare Level 1", exact: true }).click();
  await page.getByRole("button", { name: "Commit flight & board →", exact: true }).click();
  await page.locator(".cmd-canvas canvas").waitFor();
  console.log("WALK start: boarded fresh Orbital Qualification, 3D canvas present");
  await page.waitForTimeout(500);
}

async function renderingPauseCase(page: any) {
  const drawCount = () => page.evaluate(() => (window as typeof window & { __commanderDrawCalls: number }).__commanderDrawCalls);
  await page.getByRole("button", { name: "Open navigation map", exact: true }).click();
  await page.waitForTimeout(500);
  const settled = await drawCount();
  await page.waitForTimeout(750);
  assert.equal(await drawCount(), settled, "A locked MAP preserves the last 3D frame without issuing more native draws");
  const size = page.viewportSize();
  await page.setViewportSize({ width: size.width + 1, height: size.height });
  await page.waitForFunction((before: number) => (window as typeof window & { __commanderDrawCalls: number }).__commanderDrawCalls > before, settled);
  await page.waitForTimeout(500);
  const resized = await drawCount();
  await page.waitForTimeout(750);
  assert.equal(await drawCount(), resized, "Resizing a locked MAP redraws once, then preserves that frame");
  await page.getByRole("dialog", { name: "Navigation map", exact: true }).getByRole("button", { name: "Close", exact: true }).click();
  await page.waitForFunction((before: number) => (window as typeof window & { __commanderDrawCalls: number }).__commanderDrawCalls > before, resized);
  await page.setViewportSize(size);
  console.log("PASS native WebGL: MAP retains the last frame, resize redraws it, closing MAP resumes live draws");
}

async function targetAndTraversalCase() {
  // Lower only raster resolution for software-rendered CI; CSS coordinates,
  // collisions, camera input, map and mission procedures remain real.
  const page = await contextPage("fresh-qualification", { width: 960, height: 600 }, undefined, .6);
  await freshMission(page);
  await renderingPauseCase(page);
  const start = await mapPosition(page);
  console.log(`WALK hatch: initial MAP marker ${JSON.stringify(start)}`);
  assert.ok(Math.hypot(start.x, start.z + 4.95) < .05, "Fresh flight starts at the expected flight-deck location");
  await pointCamera(page, Math.PI);
  console.log("WALK hatch: camera turned toward rear hatch");
  assert.equal((await sessionFromSave(page)).world.doors.flight.open, false, "Fresh flight hatch remains closed before interacting");
  let blocked = start, wallConfirmed = false;
  for (let attempt = 0; attempt < 8; attempt++) {
    await hold(page, "w", 4500);
    const next = await mapPosition(page);
    if (Math.abs(next.z + 4.55) < .10 && Math.abs(next.z - blocked.z) < .015) wallConfirmed = true;
    blocked = next;
    if (wallConfirmed) break;
  }
  console.log(`WALK hatch: blocked MAP marker ${JSON.stringify(blocked)}`);
  assert.ok(wallConfirmed, `Closed Flight-deck hatch blocks another held W at its physical boundary (${blocked.z})`);
  await page.waitForTimeout(250);
  assert.match(await page.locator(".cmd-aim-target").innerText(), /OPEN FLIGHT-DECK HATCH/, "The near blocking hatch must be targeted before Engineering");
  console.log("WALK hatch: HUD selects OPEN FLIGHT-DECK HATCH");
  await page.keyboard.press("e");
  await waitForSave(page, s => s.world.doors.flight.open, "E must open the targeted Flight-deck hatch");
  await page.waitForTimeout(750); // Allow the visible hatch leaf animation/interlock to clear.
  let crossed = blocked;
  for (let attempt = 0; attempt < 8 && crossed.z < -4.15; attempt++) {
    await hold(page, "w", 1500);
    crossed = await mapPosition(page);
    console.log(`WALK hatch: open-door traversal MAP marker ${JSON.stringify(crossed)}`);
  }
  assert.ok(crossed.z > -4.15, `Opening the same hatch permits real keyboard traversal (${crossed.z})`);
  console.log(`PASS fresh 3D flight: MAP, closed hatch collision, correct HUD target, E opens it, W crosses (${start.z.toFixed(2)} → ${blocked.z.toFixed(2)} → ${crossed.z.toFixed(2)})`);
  await page.screenshot({ path: join(artifacts, "qualification-hatch-traversal.png") });
  return page;
}

async function moveAxis(page: any, axis: "x" | "z", target: number) {
  let p = await mapPosition(page);
  if (Math.abs(Math.atan2(Math.sin(p.heading), Math.cos(p.heading))) > .002) await pointCamera(page, 0, p);
  let measuredSpeed = 2.97;
  for (let attempt = 0; attempt < 30; attempt++) {
    const remaining = target - p[axis];
    if (Math.abs(remaining) < .10) return;
    const key = axis === "x" ? remaining > 0 ? "d" : "a" : remaining > 0 ? "s" : "w";
    const duration = Math.min(12_000, Math.max(100, Math.abs(remaining) / measuredSpeed * 1000));
    await page.keyboard.down("Shift");
    await page.keyboard.down(key);
    const began = Date.now();
    // Read only the game's genuine autosave as a coarse stop signal during
    // long software-rendered holds; every final position is checked on MAP.
    do {
      await page.waitForTimeout(Math.min(500, Math.max(80, duration - (Date.now() - began))));
      const observed = (await sessionFromSave(page)).position[axis];
      if (Math.sign(remaining) * (observed - p[axis]) > .04 &&
        (Math.abs(target - observed) < .10 || Math.sign(remaining) * (target - observed) < 0)) break;
    } while (Date.now() - began < duration);
    await page.keyboard.up(key);
    await page.keyboard.up("Shift");
    const elapsed = Date.now() - began;
    await page.waitForTimeout(300);
    const next = await mapPosition(page);
    const traveled = Math.abs(next[axis] - p[axis]);
    if (traveled <= .006) {
      assert.ok(duration < 5000 || attempt < 3, `Movement blocked on ${axis} at ${JSON.stringify(p)} towards ${target}`);
      measuredSpeed = Math.max(.10, measuredSpeed / 4);
      p = next;
      continue;
    }
    measuredSpeed = Math.max(.10, Math.min(3.3, traveled / elapsed * 1000));
    console.log(`MOVE ${axis}: ${p[axis].toFixed(2)} → ${next[axis].toFixed(2)} / target ${target.toFixed(2)}`);
    p = next;
  }
  assert.fail(`Could not reach ${axis}=${target}`);
}

async function walkTo(page: any, site: Site) {
  assert.ok(site in deck, `Walkthrough supports ship stations, got ${site}`);
  const location = deck[site as keyof typeof deck];
  await moveAxis(page, "x", 0);
  let p = await mapPosition(page);
  const targetZ = site === "cockpit" ? -5.7 : location.z;
  const direction = targetZ > p.z ? 1 : -1;
  for (const [id, door] of Object.entries(doors).sort((a, b) => direction * (a[1].z - b[1].z))) {
    if ((p.z - door.z) * (targetZ - door.z) >= 0) continue;
    await moveAxis(page, "z", door.z - direction * .85);
    const saved = await sessionFromSave(page);
    if (!saved.world.doors[id as keyof typeof doors].open) {
      await pointCamera(page, direction > 0 ? Math.PI : 0);
      await page.waitForTimeout(250);
      assert.match(await page.locator(".cmd-aim-target").innerText(), new RegExp(`OPEN ${door.name.toUpperCase()}`), `Target ${door.name} from its accessible side`);
      await page.keyboard.press("e");
      await waitForSave(page, s => s.world.doors[id as keyof typeof doors].open, `Open ${door.name}`);
    }
    await moveAxis(page, "z", door.z + direction * .65);
    p = await mapPosition(page);
  }
  await moveAxis(page, "z", targetZ);
  if (location.x) await moveAxis(page, "x", Math.sign(location.x) * 1.08);
  await pointCamera(page, location.x > 0 ? -Math.PI / 2 : location.x < 0 ? Math.PI / 2 : 0);
  console.log(`WALK ${location.name}: ${JSON.stringify(await mapPosition(page))}`);
}

async function showStation(page: any) {
  if (await page.getByRole("region", { name: "Station operations", exact: true }).isVisible()) return;
  await page.keyboard.press("e");
  if (await page.getByRole("region", { name: "Station operations", exact: true }).isVisible()) return;
  await page.getByRole("button", { name: /HOW TO COMPLETE/ }).click();
  await page.getByRole("button", { name: "Show station controls", exact: true }).click();
}

async function fullWalkthrough(page: any) {
  const mission = missionById("mission-1");
  await pointCamera(page, 0);
  let guard = 0;
  while (guard++ < 80) {
    const saved = await sessionFromSave(page);
    if (saved.report) {
      assert.equal(saved.report.success, true, saved.report.improve.join(" "));
      console.log(`PASS full Orbital Qualification walkthrough: score=${saved.report.score}, ${saved.completed.length} objectives completed`);
      await page.screenshot({ path: join(artifacts, "qualification-report.png") });
      return;
    }
    const objective = mission.objectives[saved.objective];
    assert.ok(objective, `Current objective ${saved.objective} exists`);
    console.log(`OBJECTIVE ${saved.objective + 1}/${mission.objectives.length}: ${objective.title}`);
    if (saved.state.paused) await page.getByRole("button", { name: "Resume mission", exact: true }).click();
    if (objective.site && !["countdown", "staging", "orbitHeight"].includes(objective.condition || "")) await walkTo(page, objective.site);
    if (objective.type === "WAIT") {
      await page.getByRole("combobox", { name: "Simulation rate", exact: true }).selectOption("20");
      for (let step = 0; step < 90; step++) {
        const s = await sessionFromSave(page);
        if (s.objective !== saved.objective) break;
        if (s.flight.status === "ascent") {
          const target = Math.max(25, 90 - s.flight.altitude * .3);
          const pitch = page.getByRole("slider", { name: "Launch pitch", exact: true });
          await pitch.fill(String(Math.round(target)));
          await page.getByRole("slider", { name: "Launch thrust", exact: true }).fill("90");
        }
        await page.waitForTimeout(500);
      }
      await page.getByRole("combobox", { name: "Simulation rate", exact: true }).selectOption("1");
      await waitForSave(page, s => s.objective !== saved.objective, `Wait objective completes: ${objective.title}`);
      continue;
    }
    if (objective.action === "wake") {
      await page.getByRole("button", { name: "Wake up →", exact: true }).click();
    } else if (["eat", "drink"].includes(objective.action || "")) {
      await page.getByRole("button", { name: "Open inventory", exact: true }).click();
      await page.getByRole("button", { name: objective.action === "eat" ? "Eat meal" : "Drink water · 250 mL", exact: true }).click();
      await page.getByRole("button", { name: "Close tablet", exact: true }).click();
    } else if (["armLaunch", "ignite", "separate", "insertOrbit"].includes(objective.action || "")) {
      const button = page.getByRole("button", { name: objective.title, exact: true });
      if (!(await button.isVisible())) await showStation(page);
      await button.click();
    } else {
      await showStation(page);
      const station = page.getByRole("region", { name: "Station operations", exact: true });
      if (objective.action === "takeMeal") {
        const open = station.getByRole("button", { name: "Open Food locker", exact: true });
        if (await open.isVisible()) await open.click();
        await station.getByRole("button", { name: "Take meal pack", exact: true }).click();
      } else if (objective.action === "fill") {
        const open = station.getByRole("button", { name: "Open Water service cabinet", exact: true });
        if (await open.isVisible()) await open.click();
        await station.getByRole("button", { name: "Fill bottle from potable tank", exact: true }).click();
      } else if (objective.action === "returnBurn") {
        await station.getByRole("combobox", { name: "Navigation target", exact: true }).selectOption("earth");
        const arm = station.getByRole("switch", { name: /Guarded manoeuvre arm/ });
        if (await arm.getAttribute("aria-checked") !== "true") await arm.click();
        await station.getByRole("button", { name: objective.title, exact: true }).click();
      } else if (objective.event === "power") {
        await station.getByRole("button", { name: "Inspect power and diagnose faults", exact: true }).click();
        await station.getByRole("button", { name: /Bypass the failed branch/ }).click();
      } else if (objective.choices) {
        await station.getByRole("button", { name: new RegExp(objective.choices[0].title) }).click();
      } else await station.getByRole("button", { name: objective.title, exact: true }).click();
    }
    await waitForSave(page, s => s.objective !== saved.objective || !!s.report, `UI operation completes: ${objective.title}`);
  }
  assert.fail("Full walkthrough exceeded its objective guard");
}

try {
  if (process.argv.includes("--walkthrough-only")) {
    const page = await contextPage("fresh-qualification", { width: 960, height: 600 }, undefined, .6);
    await freshMission(page);
    await fullWalkthrough(page);
  } else {
    if (!process.argv.includes("--skip-layout")) await layoutCases();
    if (!process.argv.includes("--layout-only")) {
    const page = await targetAndTraversalCase();
    if (process.argv.includes("--walkthrough")) await fullWalkthrough(page);
    }
  }
  assert.deepEqual(browserErrors, [], "Browser runtime must not throw page errors");
  console.log(`Browser artifacts: ${artifacts}`);
} catch (error) {
  for (const { page, name } of failurePages) if (!page.isClosed()) {
    await page.screenshot({ path: join(artifacts, `${name}-failure.png`) }).catch(() => {});
  }
  throw error;
} finally {
  await Promise.allSettled(contexts.map(context => context.close()));
  await browser.close();
}
