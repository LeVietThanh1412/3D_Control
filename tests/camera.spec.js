// Real camera pipeline: getUserMedia -> <video> -> WebGL background texture + MediaPipe HandLandmarker (Tasks API).
// Chromium's fake webcam (--use-fake-device-for-media-stream) provides the frames, so this runs on any machine.
import { test, expect, chromium } from '@playwright/test';
import { appUrl, expectLiveFps, shot, status, watchErrors } from './helpers.js';
import { gpuArgs } from './runtime.js';

const VISION_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/';

// Exercise the public asset URLs with the actual pinned SDK, without depending on CDN availability in CI.
test.beforeEach(async ({ context, baseURL }) => {
  await context.route(`${VISION_CDN}**`, async (route) => {
    const asset = route.request().url().slice(VISION_CDN.length);
    const response = await route.fetch({ url: `${baseURL}/node_modules/@mediapipe/tasks-vision/${asset}` });
    await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': '*' } });
  });
});

test('camera + MediaPipe hand tracker run live on the webcam feed', async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.goto(appUrl('autostart=camera&n=200000'));
  await page.waitForFunction(() => window.wonderSnap?.status().camera?.running, null, { timeout: 90_000 });
  await page.waitForFunction(() => window.wonderSnap.status().camera.frames > 45, null, { timeout: 60_000 });
  let s = await status(page);
  console.log(s.camera, s.gl);
  expect(s.camera.running).toBe(true);
  expect(['GPU', 'CPU']).toContain(s.camera.delegate);
  expect(s.camera.videoW).toBeGreaterThan(0);
  expectLiveFps(s.camera.fps, 10);
  expect(s.pose).toBe('none');                                           // the fake feed has no hand in it
  await expect(page.locator('#bCam')).toHaveClass(/on/);
  await shot(page, 'cam-a-live-webcam-background');
  const initialFrames = s.frames, initialCameraFrames = s.camera.frames;

  await page.keyboard.press('Space');                                    // keyboard still works alongside the camera
  await page.waitForTimeout(1500);
  await shot(page, 'cam-b-sphere-over-webcam');
  await page.keyboard.press('f');
  await page.waitForTimeout(3000);
  s = await status(page);
  expect(s.state).toBe('formed');
  expect(s.frames).toBeGreaterThan(initialFrames);
  expect(s.camera.frames).toBeGreaterThan(initialCameraFrames);
  expectLiveFps(s.fps, 20);
  await shot(page, 'cam-c-wonder-over-webcam');

  await page.keyboard.press('c');                                        // camera off
  await page.waitForTimeout(300);
  expect((await status(page)).camera).toBeNull();
  noErrors();
});

test('camera works on a static project subpath without published node_modules', async ({ page, baseURL }) => {
  const noErrors = watchErrors(page), localPackages = [], models = [], cdnAssets = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/node_modules/')) localPackages.push(url);
    if (url.endsWith('/models/hand_landmarker.task')) models.push(new URL(url).pathname);
    if (url.startsWith(VISION_CDN)) cdnAssets.push(url.slice(VISION_CDN.length));
  });
  await page.context().route('**/node_modules/**', (route) => route.abort());
  await page.context().route('**/3D_Control/**', async (route) => {
    const url = new URL(route.request().url());
    url.pathname = url.pathname.replace(/^\/3D_Control\//, '/');
    await route.fulfill({ response: await route.fetch({ url: url.href }) });
  });

  await page.goto(`${baseURL}/3D_Control${appUrl('autostart=camera&n=20000&dpr=0.5')}`);
  await page.waitForFunction(() => window.wonderSnap?.status().camera?.running, null, { timeout: 90_000 });
  await page.waitForFunction(() => window.wonderSnap.status().camera.frames >= 5, null, { timeout: 60_000 });
  const s = await status(page);
  expect(s.camera.running).toBe(true);
  expect(['GPU', 'CPU']).toContain(s.camera.delegate);
  expect(s.camera.videoW).toBeGreaterThan(0);
  expect(localPackages).toEqual([]);
  expect(models).toContain('/3D_Control/models/hand_landmarker.task');
  expect(cdnAssets).toContain('vision_bundle.mjs');
  expect(cdnAssets.some((asset) => asset.startsWith('wasm/') && asset.endsWith('.wasm'))).toBe(true);
  await expect(page.locator('#bCam')).toHaveClass(/on/);
  await page.keyboard.press('c');
  expect((await status(page)).camera).toBeNull();
  noErrors();
});

test('camera denied: friendly message and the app keeps working without it', async ({ baseURL }) => {
  const browser = await chromium.launch({ args: gpuArgs });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, permissions: [] });
  const page = await context.newPage();
  await page.goto(`${baseURL}${appUrl('n=100000')}`);
  await page.click('#bStartCam');
  await expect(page.locator('#startMsg')).toContainText(/denied|No camera|Camera error/, { timeout: 30_000 });
  await shot(page, 'cam-d-permission-denied-message');
  await page.click('#bStartNoCam');
  await expect(page.locator('#start')).toBeHidden();
  await page.keyboard.press('Space');
  await page.waitForTimeout(800);
  expect((await page.evaluate(() => window.wonderSnap.status())).state).toBe('sphere');
  await browser.close();
});
