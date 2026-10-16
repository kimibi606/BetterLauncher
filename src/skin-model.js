"use strict";

// Render a static full-body portrait with a local 3D scene. Reuse one paused
// renderer, so account lists do not create animation loops or extra contexts.
(() => {
  let viewer = null;
  let webglUnavailable = false;
  let queue = Promise.resolve();
  function createViewer() {
    const canvas = document.createElement("canvas");
    const attributes = { alpha: true, antialias: true, preserveDrawingBuffer: true };
    if (!canvas.getContext("webgl2", attributes) && !canvas.getContext("webgl", attributes)) throw new Error("WebGL is unavailable.");
    const instance = new skinview3d.SkinViewer({
      canvas, width: 320, height: 576, pixelRatio: 1,
      preserveDrawingBuffer: true, renderPaused: true, enableControls: false,
      fov: 35, zoom: 1
    });
    instance.camera.position.set(-24, 10, 64);
    instance.adjustCameraDistance();
    instance.camera.lookAt(0, 0, 0);
    instance.globalLight.intensity = 2.8;
    instance.cameraLight.intensity = 1;
    const skin = instance.playerObject.skin;
    skin.head.rotation.set(0.02, 0.1, 0);
    skin.rightArm.rotation.set(-0.08, 0, 0.08);
    skin.leftArm.rotation.set(0.08, 0, -0.08);
    skin.rightLeg.rotation.x = 0.1;
    skin.leftLeg.rotation.x = -0.1;
    return instance;
  }
  function centerPortrait(source) {
    const snapshot = document.createElement("canvas");
    snapshot.width = 320;
    snapshot.height = 576;
    const context = snapshot.getContext("2d", { willReadFrequently: true });
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, 320, 576).data;
    let left = 320, right = -1, top = 576, bottom = -1;
    for (let y = 0; y < 576; y++) {
      for (let x = 0; x < 320; x++) {
        if (pixels[(y * 320 + x) * 4 + 3] <= 8) continue;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    if (right < left || bottom < top) throw new Error("Empty character portrait.");
    const portrait = document.createElement("canvas");
    portrait.width = 320;
    portrait.height = 576;
    portrait.getContext("2d").drawImage(snapshot,
      Math.round((320 - (right - left + 1)) / 2) - left,
      Math.round((576 - (bottom - top + 1)) / 2) - top);
    return portrait.toDataURL("image/png");
  }
  async function render(textureDataUrl, model) {
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(textureDataUrl) || textureDataUrl.length > 180000) throw new Error("Invalid skin texture.");
    const image = new Image();
    image.src = textureDataUrl;
    await image.decode();
    if (image.naturalWidth !== 64 || ![32, 64].includes(image.naturalHeight)) throw new Error("Invalid skin dimensions.");
    if (!viewer && !webglUnavailable) {
      try { viewer = createViewer(); } catch { webglUnavailable = true; }
    }
    if (!viewer) {
      const fallback = new Image();
      fallback.src = await window.minecraftSkinFallbackModel.render(textureDataUrl, model);
      await fallback.decode();
      return centerPortrait(fallback);
    }
    viewer.loadSkin(image, { model: model === "slim" ? "slim" : "default" });
    viewer.render();
    return centerPortrait(viewer.canvas);
  }
  window.minecraftSkinModel = Object.freeze({
    get renderer() { return viewer ? "webgl" : webglUnavailable ? "canvas" : "pending"; },
    render(textureDataUrl, model = "classic") {
      const request = queue.then(() => render(textureDataUrl, model));
      queue = request.catch(() => {});
      return request;
    }
  });
  window.addEventListener("beforeunload", () => {
    if (viewer) {
      const renderer = viewer.renderer;
      viewer.dispose();
      renderer.forceContextLoss();
      viewer = null;
    }
  });
})();
