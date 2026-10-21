import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import ts from "typescript";

const before = execFileSync("git", ["show", "HEAD:lib/session-state.ts"], { encoding: "utf8" });
const after = await readFile(new URL("../lib/session-state.ts", import.meta.url), "utf8");
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const browser = await chromium.launch();
const output = new URL("../performance-results/", import.meta.url);
await mkdir(output, { recursive: true });
const results = [];
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(process.env.PERF_BASE_URL ?? "http://127.0.0.1:3001/");
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  for (const count of [500, 1500]) {
    for (let run = 0; run < 3; run++) {
      for (const [version, code] of [["before", compile(before)], ["after", compile(after)]]) {
        const ms = await page.evaluate(({ code, count }) => {
          localStorage.clear(); sessionStorage.clear();
          const prefix = "reveal-cards:v1:";
          for (let i = 0; i < count; i++) localStorage.setItem(prefix + "fixture:" + i, String(i));
          const api = {};
          new Function("exports", "require", code)(api, () => ({}));
          api.readSessionState("fixture:1", 0);
          const start = performance.now();
          for (let i = 0; i < 100; i++) {
            api.writeSessionState("benchmark", i);
            if (api.readSessionState("benchmark", -1) !== i) throw new Error("Save mismatch");
          }
          return performance.now() - start;
        }, { code, count });
        results.push({ count, run, version, ms });
        console.log(JSON.stringify({ count, run, version, ms }));
      }
    }
  }
} finally {
  await writeFile(new URL("storage-comparison.json", output), JSON.stringify({ note: "Same Chromium, 4x CPU slowdown. 100 write/read pairs after one initialization. Before is HEAD; after is working tree. Isolated synthetic storage, not field interaction latency.", results }, null, 2));
  await browser.close();
}
