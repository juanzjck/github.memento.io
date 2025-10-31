# Memento VR/AR (WebXR Prototype)

Lightweight WebXR playground that you can load in a headset or WebXR-capable mobile browser. It drops a reticle on detected planes and lets you tap to place glowing 3D markers—perfect for validating Memento interactions before investing in a native AR/VR build.

## Prerequisites

- A browser with WebXR + AR support (Chrome for Android, Oculus/Quest Browser, WebXR Viewer on iOS, etc.).
- A static file server (for quick tests: `npx http-server`, `npx serve`, or any hosting platform like Vercel/Netlify/GitHub Pages).

## Run Locally

```bash
cd memento-vr-ar
npx http-server -p 5173 .
```

Open the printed URL on the target device (e.g., `https://<your-ip>:5173`) and hit **Enter AR**.

## What You Get

- **WebXR hit testing** to anchor the reticle on detected surfaces.
- **Three.js scene** with hemispheric lighting and color-coded markers on tap.
- **DOM overlay instructions** so the user sees guidance while entering AR mode.

## Next Steps

- Swap in custom Memento assets or UI in `src/main.js`.
- Add spatial audio or emotion-driven feedback when placing anchors.
- Deploy to a static host so testers can open the experience without a local server.

With this, you have a portable AR prototype that lives outside the Expo app and can evolve independently toward a production headset experience.
