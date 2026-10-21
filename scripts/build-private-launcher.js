"use strict";

// Kept for existing local scripts. There is one launcher and one build path.
require("./build-launcher").main().catch(error => { console.error(error.message); process.exitCode = 1; });
