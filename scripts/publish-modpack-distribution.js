#!/usr/bin/env node
"use strict";

// Compatibility entry point: modpack:publish now builds files for HTTP(S) hosting.
require("./build-modpack-distribution").main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
