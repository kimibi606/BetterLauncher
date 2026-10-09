"use strict";

const fs = require("fs");
const crypto = require("crypto");
const { pipeline } = require("stream/promises");

// Append each verified piece in order; the caller also verifies the assembled file.
async function downloadDistributionFile(file, destination, downloadFile) {
  if (!file.chunks?.length) return downloadFile(file.url, destination, { maxBytes: file.size });
  await fs.promises.writeFile(destination, Buffer.alloc(0));
  let bytes = 0;
  try {
    for (const chunk of file.chunks) {
      const chunkPath = `${destination}.chunk`;
      try {
        await downloadFile(chunk.url, chunkPath, { maxBytes: chunk.size });
        const hash = crypto.createHash("sha256");
        const stat = await fs.promises.stat(chunkPath);
        for await (const data of fs.createReadStream(chunkPath)) hash.update(data);
        if (stat.size !== chunk.size || hash.digest("hex") !== chunk.sha256) {
          throw new Error(`Modpack chunk integrity check failed: ${file.path}`);
        }
        await pipeline(fs.createReadStream(chunkPath), fs.createWriteStream(destination, { flags: "a" }));
        bytes += stat.size;
      } finally {
        await fs.promises.rm(chunkPath, { force: true });
      }
    }
    return { bytesWritten: bytes };
  } catch (error) {
    await fs.promises.rm(destination, { force: true });
    throw error;
  }
}

module.exports = { downloadDistributionFile };
