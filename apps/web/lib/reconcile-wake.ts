import fs from "fs";
import os from "os";
import path from "path";

/** Tells app.js's reconcile scheduler a checkout just started, so it polls every few minutes again. */
export function wakeReconcile() {
  try {
    const dir = path.join(os.tmpdir(), "aldeitas-jobs");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "reconcile-wake"), String(Date.now()));
  } catch {
    // Best effort: the idle interval still picks the booking up.
  }
}
