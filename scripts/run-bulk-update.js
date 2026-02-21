const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    page.on('console', msg => {
      // serialize args similar to Puppeteer's examples
      const args = msg.args();
      Promise.all(args.map(a => a.jsonValue())).then(vals => console.log('PAGE LOG:', ...vals)).catch(() => console.log('PAGE LOG:', msg.text()));
    });

    page.on('dialog', async dialog => {
      console.log('PAGE DIALOG:', dialog.message());
      try { await dialog.accept(); } catch (e) { console.warn('Failed to accept dialog', e); }
    });

    const url = 'http://localhost:5000/admin.html';
    console.log('Navigating to', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('Waiting for bulkUpdateStudentModes to be defined...');
    await page.waitForFunction(() => typeof window.bulkUpdateStudentModes === 'function', { timeout: 60000 });

    console.log('Invoking bulkUpdateStudentModes() in page context...');
    // Execute and wait for it to finish. The function returns a promise; we await it.
    const result = await page.evaluate(() => {
      try {
        return window.bulkUpdateStudentModes();
      } catch (err) {
        return Promise.reject(err && err.message ? err.message : String(err));
      }
    });

    console.log('bulkUpdateStudentModes resolved with:', result);

    await browser.close();
    console.log('Headless run complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error during headless run:', err);
    process.exit(2);
  }
})();
