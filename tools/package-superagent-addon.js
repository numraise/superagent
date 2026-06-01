const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const ADDON = path.join(ROOT, "superagent-addon");
const DIST = path.join(ROOT, "dist");
const OUTPUT = path.join(DIST, "superagent.mcaddon");

fs.mkdirSync(DIST, { recursive: true });
if (fs.existsSync(OUTPUT)) {
  fs.rmSync(OUTPUT);
}

execFileSync("zip", ["-qr", OUTPUT, "superagent_BP", "superagent_RP"], {
  cwd: ADDON,
  stdio: "inherit",
});

console.log(OUTPUT);
