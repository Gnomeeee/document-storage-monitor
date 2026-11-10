import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
function check(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "generated") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) check(path);
    else if (path.endsWith(".js")) {
      const result = spawnSync(process.execPath, ["--check", path], {
        stdio: "inherit",
      });
      if (result.status !== 0) process.exitCode = 1;
    }
  }
}
for (const dir of ["src", "scripts", "tests", "prisma"]) check(dir);
