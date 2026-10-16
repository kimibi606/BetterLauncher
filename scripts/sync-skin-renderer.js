"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const vendor = path.join(root, "src", "vendor");
const source = path.join(root, "node_modules", "skinview3d");
if (JSON.parse(fs.readFileSync(path.join(source, "package.json"), "utf8")).version !== "3.4.2") {
  throw new Error("Expected pinned skinview3d version 3.4.2.");
}
const files = new Map([
  ["skinview3d.bundle.js", fs.readFileSync(path.join(source, "bundles", "skinview3d.bundle.js"))],
  ["SKIN_RENDERER_LICENSES.txt", Buffer.from(["skinview3d 3.4.2 browser bundle and its included dependencies", "",
    ...["skinview3d", "skinview-utils", "three"].flatMap(name => [name, fs.readFileSync(path.join(root, "node_modules", name, "LICENSE"), "utf8"), ""])
  ].join("\n").trimEnd() + "\n")]
]);
for (const [name, contents] of files) {
  const target = path.join(vendor, name);
  if (process.argv.includes("--check")) {
    if (!fs.existsSync(target) || !fs.readFileSync(target).equals(contents)) throw new Error("Run npm run vendor:skin to synchronize the local skin renderer.");
  } else {
    fs.mkdirSync(vendor, { recursive: true });
    fs.writeFileSync(target, contents);
  }
}
console.log(process.argv.includes("--check") ? "Local skin renderer verified." : "Local skin renderer synchronized.");
