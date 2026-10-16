"use strict";

// Project the official skin texture locally. No player identifier or token is
// sent to a third-party avatar/rendering service.
window.minecraftSkinFallbackModel = Object.freeze({
  async render(textureDataUrl, model = "classic") {
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(textureDataUrl) || textureDataUrl.length > 180000) {
      throw new Error("Invalid skin texture.");
    }
    const texture = new Image();
    texture.src = textureDataUrl;
    await texture.decode();
    if (texture.naturalWidth !== 64 || ![32, 64].includes(texture.naturalHeight)) throw new Error("Invalid skin dimensions.");
    const modern = texture.naturalHeight === 64;
    let showHat = modern;
    if (!modern) {
      const legacy = document.createElement("canvas");
      legacy.width = 64; legacy.height = 32;
      const pixels = legacy.getContext("2d");
      pixels.drawImage(texture, 0, 0);
      const rgba = pixels.getImageData(32, 0, 32, 32).data;
      // Legacy RGB skins use an opaque unused region rather than a hat layer.
      showHat = rgba.some((value, index) => index % 4 === 3 && value < 128);
    }
    const arm = modern && model === "slim" ? 3 : 4;
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 576;
    const ctx = canvas.getContext("2d");
    ctx.scale(2, 2);
    ctx.imageSmoothingEnabled = false;
    const project = (x, y, z) => [80 + x * 7 - z * 3.5, 16 + y * 8 - z * 2];
    function face(uv, overlay, width, height, points, shade, mirror) {
      const tile = document.createElement("canvas");
      tile.width = width;
      tile.height = height;
      const paint = tile.getContext("2d");
      if (mirror) { paint.translate(width, 0); paint.scale(-1, 1); }
      paint.drawImage(texture, uv[0], uv[1], width, height, 0, 0, width, height);
      if (overlay) paint.drawImage(texture, overlay[0], overlay[1], width, height, 0, 0, width, height);
      if (shade) {
        paint.setTransform(1, 0, 0, 1, 0, 0);
        paint.globalCompositeOperation = "source-atop";
        paint.fillStyle = "rgba(0,0,0," + shade + ")";
        paint.fillRect(0, 0, width, height);
      }
      const [origin, horizontal, , vertical] = points;
      ctx.save();
      ctx.transform((horizontal[0] - origin[0]) / width, (horizontal[1] - origin[1]) / width,
        (vertical[0] - origin[0]) / height, (vertical[1] - origin[1]) / height, origin[0], origin[1]);
      ctx.drawImage(tile, 0, 0);
      ctx.restore();
    }
    function box(x, y, z, w, h, d, uv, overlay, mirror = false) {
      const p = (dx, dy, dz) => project(x + dx, y + dy, z + dz);
      face(uv.top, overlay?.top, w, d, [p(0,0,d), p(w,0,d), p(w,0,0), p(0,0,0)], 0, mirror);
      face(uv.side, overlay?.side, d, h, [p(0,0,d), p(0,0,0), p(0,h,0), p(0,h,d)], 0.22, mirror);
      face(uv.front, overlay?.front, w, h, [p(0,0,0), p(w,0,0), p(w,h,0), p(0,h,0)], 0.04, mirror);
    }
    const uv = (x, y) => ({ top: [x,y], front: [x,y+4], side: [x-4,y+4] });
    // Far limbs, torso, near limb and head, in painter's order.
    box(4, 8, -2, arm, 12, 4, modern ? uv(36,48,arm) : uv(44,16,arm), modern ? uv(52,48,arm) : null, !modern);
    box(0, 20, -2, 4, 12, 4, modern ? uv(20,48,4) : uv(4,16,4), modern ? uv(4,48,4) : null, !modern);
    box(-4, 20, -2, 4, 12, 4, uv(4,16,4), modern ? uv(4,32,4) : null);
    box(-4, 8, -2, 8, 12, 4, uv(20,16,8), modern ? uv(20,32,8) : null);
    box(-4-arm, 8, -2, arm, 12, 4, uv(44,16,arm), modern ? uv(44,32,arm) : null);
    box(-4, 0, -4, 8, 8, 8, { top:[8,0], front:[8,8], side:[0,8] }, showHat ? { top:[40,0], front:[40,8], side:[32,8] } : null);
    return canvas.toDataURL("image/png");
  }
});
