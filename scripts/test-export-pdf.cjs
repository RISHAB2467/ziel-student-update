const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  page.on('console', msg => {
    try { console.log('[PAGE]', msg.type(), msg.text()); } catch (e) { console.log('[PAGE]', msg.type(), '<unserializable>'); }
  });
  page.on('pageerror', err => console.error('[PAGE ERROR]', err.toString()));
  page.on('dialog', async d => { console.log('[DIALOG]', d.message()); try { await d.accept(); } catch(e){} });

  try {
    const url = 'http://localhost:5000/admin.html';
    console.log('Opening', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for report UI
    await page.waitForSelector('#timePeriodFilter', { timeout: 20000 });

    // Select student by typing and selecting from dropdown
    await page.evaluate(() => {
      document.getElementById('searchStudentReport').value = 'Mysha Kothari';
      // set hidden selectedStudentId to same name (app uses name)
      const hid = document.getElementById('selectedStudentId'); if(hid) hid.value = 'Mysha Kothari';
    });

    // Choose custom range
    await page.select('#timePeriodFilter', 'custom');
    await page.waitForFunction(() => window.onTimePeriodChange === undefined || document.getElementById('customTimeRange').style.display !== 'none', { timeout: 5000 });

    // Set from/to
    await page.evaluate(() => {
      document.getElementById('timePeriodCustomFrom').value = '2025-10-01';
      document.getElementById('timePeriodCustomTo').value = '2025-10-31';
    });

    // Wait a moment for onchange to fire
    await new Promise(r => setTimeout(r, 800));

    console.log('Invoking generateStudentPDF()');
    await page.evaluate(() => { window.generateStudentPDF(); });

    // wait for dialog or logs
    await new Promise(r => setTimeout(r, 4000));

    console.log('Done');
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await browser.close();
  }

  process.exit(0);
})();
