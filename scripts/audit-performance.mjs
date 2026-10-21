import { chromium, devices } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const origin = process.env.PERF_BASE_URL ?? "https://reveal-cards-orpin.vercel.app";
const output = new URL(process.env.PERF_BASE_URL ? "../performance-results/local/" : "../performance-results/public/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
const extraSaveKeys = Number(process.env.PERF_SAVE_KEYS ?? 0);
const pages = [
  { name: "opening", path: "/" },
  { name: "title", path: "/?screen=title" },
  { name: "stage2-scan", path: "/?stage=2&battle=blackjack&robot=blackjack-2-3", battle: "stage-2:BlackjackBattle:blackjack-2-3:", stage: 2, robot: "blackjack-2-3" },
  { name: "final-scan", path: "/?stage=4&battle=poker&robot=all-games-last", battle: "stage-4:PokerBattle:all-games-last:", stage: 4, robot: "all-games-last" },
];

try {
  for (const profile of ["desktop", "mobile-slow"].filter((value) => !process.env.PERF_PROFILE || value === process.env.PERF_PROFILE)) {
    for (const target of pages) {
      if (process.env.PERF_PAGE && target.name !== process.env.PERF_PAGE) continue;
      const context = await browser.newContext(profile === "desktop" ? { viewport: { width: 1280, height: 900 } } : { ...devices["Pixel 5"], viewport: { width: 375, height: 812 } });
      await context.addInitScript((target) => {
        localStorage.clear();
        sessionStorage.clear();
        const data = { "__last-played-at": Date.now() };
        if (target.battle) {
          data[`stage-${target.stage}:CasinoGame:activeBattle`] = { gameType: target.stage === 2 ? "blackjack" : "poker", robotId: target.robot };
          data[target.battle + "showPreparation"] = true;
          data[target.battle + (target.stage === 2 ? "preparationAbility" : "pokerPreparationAbility")] = "scan";
          if (target.stage === 4) {
            data[target.battle + "finalPhase"] = 2;
            data["ability:copy-paste:unlocked"] = true;
          }
        }
        for (const [key, value] of Object.entries(data)) localStorage.setItem("reveal-cards:v1:" + key, JSON.stringify(value));
        for (let i = 0; i < target.extraSaveKeys; i++) localStorage.setItem(`reveal-cards:v1:stage-1:performance-fixture:${i}`, JSON.stringify({ value: i }));
        window.__audit = { lcp: 0, lcpElement: "", cls: 0, longTasks: [], events: [] };
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__audit.lcp = entry.startTime;
            window.__audit.lcpElement = entry.element?.outerHTML.slice(0, 350) ?? "";
          }
        }).observe({ type: "largest-contentful-paint", buffered: true });
        let start = 0, last = 0, shift = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.hadRecentInput) continue;
            if (entry.startTime - last > 1000 || entry.startTime - start > 5000) { start = entry.startTime; shift = 0; }
            shift += entry.value;
            last = entry.startTime;
            window.__audit.cls = Math.max(window.__audit.cls, shift);
          }
        }).observe({ type: "layout-shift", buffered: true });
        new PerformanceObserver((list) => window.__audit.longTasks.push(...list.getEntries().map((entry) => ({ start: entry.startTime, duration: entry.duration })))).observe({ type: "longtask", buffered: true });
        new PerformanceObserver((list) => window.__audit.events.push(...list.getEntries().filter((entry) => entry.interactionId).map((entry) => ({ name: entry.name, duration: entry.duration })))).observe({ type: "event", buffered: true, durationThreshold: 16 });
      }, { ...target, extraSaveKeys });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      if (profile === "mobile-slow") {
        await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 });
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      }
      let downloads = [], pending = new Map();
      cdp.on("Network.responseReceived", ({ requestId, type, response }) => pending.set(requestId, { url: response.url, type, status: response.status, mime: response.mimeType }));
      cdp.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => {
        if (pending.has(requestId)) downloads.push({ ...pending.get(requestId), bytes: encodedDataLength });
      });
      for (const cache of ["cold", "warm"]) {
        downloads = []; pending = new Map();
        const response = cache === "cold"
          ? await page.goto(origin + target.path, { waitUntil: "load", timeout: 90000 })
          : await page.reload({ waitUntil: "load", timeout: 90000 });
        await page.locator("main").waitFor({ state: "visible", timeout: 30000 });
        await page.waitForTimeout(1500);
        const metrics = await page.evaluate(() => {
          const nav = performance.getEntriesByType("navigation")[0];
          return {
            ...window.__audit,
            ttfb: nav.responseStart - nav.requestStart,
            domContentLoaded: nav.domContentLoadedEventEnd,
            load: nav.loadEventEnd,
            fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null,
            resources: performance.getEntriesByType("resource").map((entry) => ({ url: entry.name, type: entry.initiatorType, transfer: entry.transferSize, encoded: entry.encodedBodySize, decoded: entry.decodedBodySize, duration: entry.duration })),
          };
        });
        const initialDownloads = [...downloads];
        const actions = [];
        if (target.battle) {
          for (const name of ["エクスチェンジ", "スキャン", "エクスチェンジ", "スキャン"]) {
            const button = page.getByRole("button", { name: new RegExp(`^${name}(?: 残\\d+)?$`) }).first();
            if (!await button.isVisible()) continue;
            await button.click();
            await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            await page.waitForTimeout(100);
            actions.push(name);
          }
        }
        const interaction = await page.evaluate(() => ({ events: window.__audit.events, postLoadLongTasks: window.__audit.longTasks }));
        const result = { profile, page: target.name, cache, url: page.url(), status: response?.status(), headers: { cacheControl: response?.headers()["cache-control"], vercelCache: response?.headers()["x-vercel-cache"] }, ...metrics, interaction, actions, downloads: initialDownloads };
        results.push(result);
        console.log(JSON.stringify({ profile, page: target.name, cache, ttfb: Math.round(metrics.ttfb), fcp: Math.round(metrics.fcp), lcp: Math.round(metrics.lcp), cls: metrics.cls, load: Math.round(metrics.load), bytes: initialDownloads.reduce((sum, entry) => sum + entry.bytes, 0), longTaskMax: Math.max(0, ...metrics.longTasks.map((entry) => entry.duration)), eventMax: Math.max(0, ...interaction.events.map((entry) => entry.duration)) }));
      }
      await context.close();
    }
  }
} finally {
  await writeFile(new URL(extraSaveKeys ? `measurements-${extraSaveKeys}-save-keys.json` : "measurements.json", output), JSON.stringify({ measuredAt: new Date().toISOString(), browser: browser.version(), extraSaveKeys, note: "Single cold and warm navigation per route/profile; synthetic mobile is 1.6 Mbps, 150ms latency, 4x CPU slowdown. Event samples are not field INP.", results }, null, 2));
  await browser.close();
}
