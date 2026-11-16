import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:5174/warchess/';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.click('button[data-start="totalwar"]');
await page.waitForSelector('.campaign-root', { timeout: 15000 });
assert(await page.locator('.campaign-root').count(), 'editor mounted');
assert(await page.locator('text=Total war editor').count(), 'title');

await page.click('button[data-tool="draw"]');

const svg = page.locator('svg.cm-svg');
const box = await svg.boundingBox();
assert(box, 'svg box');

async function clickSvg(nx, ny) {
  await page.mouse.click(box.x + box.width * nx, box.y + box.height * ny);
}

// Draw a rectangle region in Iberia-ish area of the map
await clickSvg(0.22, 0.55);
await clickSvg(0.32, 0.55);
await clickSvg(0.32, 0.68);
await clickSvg(0.22, 0.68);
await clickSvg(0.22, 0.55); // close

await page.waitForTimeout(200);
assert((await page.locator('.cm-region').count()) >= 1, 'region created');

await page.click('button[data-settle="capital"]');
await page.waitForSelector('select[data-field="capital-key"]');
await page.selectOption('select[data-field="capital-key"]', 'madrid');
assert(await page.locator('.cm-capital').count(), 'capital mark');

await page.click('button[data-settle="village"]');
assert(await page.locator('.cm-village').count(), 'village mark');
await page.click('button[data-settle="none"]');
assert((await page.locator('.cm-village').count()) === 0, 'none clears pin');
await page.click('button[data-settle="capital"]');

await page.click('button[data-faction-add]');
await page.selectOption('select[data-field="owner"]', { index: 1 });

// Second region for sea route
await page.click('button[data-tool="draw"]');
await clickSvg(0.55, 0.58);
await clickSvg(0.65, 0.58);
await clickSvg(0.65, 0.70);
await clickSvg(0.55, 0.70);
await clickSvg(0.55, 0.58);
await page.waitForTimeout(200);

await page.click('button[data-tool="sea-blue"]');
await clickSvg(0.27, 0.60); // first region
await clickSvg(0.45, 0.75); // stop in sea
await clickSvg(0.60, 0.64); // second region
await page.waitForTimeout(200);
assert((await page.locator('.cm-sea-link.blue').count()) >= 1, 'blue sea links');
assert((await page.locator('.cm-sea-node.stop').count()) >= 1, 'sea stop');

// Third region so red can branch from the stop without reusing a blue edge
await page.click('button[data-tool="draw"]');
await clickSvg(0.40, 0.40);
await clickSvg(0.50, 0.40);
await clickSvg(0.50, 0.50);
await clickSvg(0.40, 0.50);
await clickSvg(0.40, 0.40);
await page.waitForTimeout(200);

await page.click('button[data-tool="sea-red"]');
const stopBox = await page.locator('.cm-sea-node.stop').first().boundingBox();
assert(stopBox, 'stop box');
await page.mouse.click(stopBox.x + stopBox.width / 2, stopBox.y + stopBox.height / 2);
await clickSvg(0.45, 0.45);
await page.waitForTimeout(300);
const redN = await page.locator('.cm-sea-link.red').count();
const status = await page.locator('.cm-status').textContent();
assert(redN >= 1, `red branch (got ${redN}, status=${status})`);

await page.fill('.cm-name', 'Europe test');
const [saveRes] = await Promise.all([
  page.waitForResponse((r) => r.url().includes('campaign-api.php') && r.request().method() === 'POST'),
  page.click('button[data-save]'),
]);
assert(saveRes.ok(), `save http ${saveRes.status()}`);
const saveJson = await saveRes.json();
assert(saveJson.ok, 'save ok');
assert((saveJson.map.regions || []).length >= 2, 'saved regions');

await page.click('button[data-back]');
await page.waitForSelector('button[data-start="totalwar"]');
await page.click('button[data-start="totalwar"]');
await page.waitForSelector('.campaign-root');
await page.waitForTimeout(500);
assert((await page.locator('.cm-region').count()) >= 2, 'regions reloaded');
assert(await page.inputValue('.cm-name'), 'Europe test');

console.log('repro-campaign-editor: ok');
await browser.close();
