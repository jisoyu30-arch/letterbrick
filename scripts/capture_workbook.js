const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1900, height: 2400 } });
  const page = await ctx.newPage();
  const dir = 'C:/Users/njell/LetterBrick/public/images';
  for (let i = 1; i <= 4; i++) {
    const src = `file:///${dir}/workbook_interior_${i}.html`;
    const out = `${dir}/workbook_p${i}.png`;
    await page.goto(src, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: out, fullPage: true });
    console.log(`OK ${i}: ${out}`);
  }
  await browser.close();
})();
