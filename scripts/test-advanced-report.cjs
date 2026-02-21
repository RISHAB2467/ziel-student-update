const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2] || 'http://localhost:5000/admin.html';
  const queryStr = process.argv[3] || 'a';
  console.log('[TEST] Opening', url);

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    console.log('[PAGE]', msg.type().toUpperCase(), text);
  });
  page.on('dialog', async dialog => {
    console.log('[DIALOG]', dialog.message());
    await dialog.dismiss();
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for the button and content container
    await page.waitForSelector('#btnViewTeacherDetail', { timeout: 10000 });
    await page.waitForSelector('#advancedReportContent', { timeout: 10000 });

    // Set a short query into search (use evaluate to avoid clickability issues)
    await page.evaluate((q) => {
      const el = document.getElementById('advancedTeacherSearch');
      if (el) {
        el.value = q;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, queryStr);

    // Click view detail via DOM to avoid Puppeteer clickability errors
    await page.evaluate(() => {
      const btn = document.getElementById('btnViewTeacherDetail');
      if (btn) btn.click();
    });

    // Wait briefly and then dump debug DOM content so we can inspect snapshot/matched values
    await new Promise(res => setTimeout(res, 2500));
    const advancedText = await page.$eval('#advancedReportContent', el => el.innerText);
    console.log('[TEST] advancedReportContent:', advancedText.replace(/\n/g, ' | '));
    const debugExists = await page.$('#teacherDetailDebug') || await page.$('#teacherDetailDebugFinal');
    if (debugExists) {
      const selector = (await page.$('#teacherDetailDebug')) ? '#teacherDetailDebug' : '#teacherDetailDebugFinal';
      const debugText = await page.$eval(selector, el => el.innerText);
      console.log('[TEST] Debug area:', debugText.replace(/\n/g, ' | '));
    } else {
      console.log('[TEST] Debug area not found in DOM');
    }

    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('[TEST] Error running test:', err);
    await browser.close();
    process.exit(3);
  }
})();
