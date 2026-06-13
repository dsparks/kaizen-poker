// Shared headless-browser launcher for verification scripts.
// Spawns Edge (or Chrome) with a fresh temp profile and --remote-debugging-port=0,
// reads the auto-assigned port from DevToolsActivePort, and connects puppeteer-core.
// Fresh profile per run = no stale-profile/port collisions; close() kills the
// process tree and deletes the profile.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const BROWSER_CANDIDATES = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
];

export async function launchBrowser() {
  const bin = BROWSER_CANDIDATES.find(p => fs.existsSync(p));
  if (!bin) throw new Error("No Edge/Chrome binary found in standard locations");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "kp-edge-smoke-"));
  // KP_HEADED=1 opens a visible window (for watching a run); default headless.
  const headed = process.env.KP_HEADED === "1";
  const child = spawn(bin, [
    ...(headed ? ["--start-maximized"] : ["--headless=new", "--disable-gpu"]),
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "about:blank",
  ], { stdio: "ignore" });

  // Note: the spawned process may exit immediately after handing off to the
  // real browser process — that's normal. The DevToolsActivePort file in the
  // profile dir is the reliable readiness signal.
  const portFile = path.join(profile, "DevToolsActivePort");
  let port = null;
  for (let i = 0; i < 60; i++) {
    if (fs.existsSync(portFile)) {
      port = parseInt(fs.readFileSync(portFile, "utf8").split(/\r?\n/)[0], 10);
      if (port) break;
    }
    await new Promise(r => setTimeout(r, 250));
  }
  if (!port) throw new Error("DevToolsActivePort never appeared; browser failed to start");

  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null });
  const close = async () => {
    // browser.close() over CDP terminates the real browser process (the
    // spawned launcher PID is long gone).
    try { await browser.close(); } catch {}
    try { if (child.exitCode === null) execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: "ignore" }); } catch {}
    for (let i = 0; i < 10; i++) {
      try { fs.rmSync(profile, { recursive: true, force: true }); break; }
      catch { await new Promise(r => setTimeout(r, 300)); }
    }
  };
  return { browser, close };
}
