const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  page.on('console', msg => {
    try {
      const text = msg.text();
      console.log('[PAGE]', msg.type(), text);
    } catch (e) {
      console.log('[PAGE]', msg.type(), '<unserializable console message>');
    }
  });

  page.on('pageerror', err => {
    console.error('[PAGE ERROR]', err.toString());
  });

  page.on('dialog', async dialog => {
    console.log('[DIALOG]', dialog.message());
    try { await dialog.accept(); } catch (e) { console.error('Dialog accept failed', e); }
  });

  try {
    const url = 'http://localhost:5000/admin.html';
    console.log('Opening', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // wait for the page function to be available and call it directly to avoid overlay/click issues
    await page.waitForFunction(() => typeof window.openAddEntryModal === 'function', { timeout: 20000 });
    await page.evaluate(() => { window.openAddEntryModal(); });
    console.log('Invoked openAddEntryModal()');

    // Wait for modal and teacher/student selects to populate
    await page.waitForSelector('#addEntryModal', { visible: true, timeout: 20000 });
    console.log('Modal visible');

    // Wait for teacher and student selects to have at least 2 options (first is placeholder)
    await page.waitForFunction(() => {
      const t = document.getElementById('adminEntryTeacher');
      const s = document.getElementById('adminEntryStudent');
      return t && s && t.options.length > 1 && s.options.length > 1;
    }, { timeout: 20000 });

    // Choose first real teacher and student
    await page.evaluate(() => {
      const t = document.getElementById('adminEntryTeacher');
      const s = document.getElementById('adminEntryStudent');
      if (t && t.options.length > 1) t.selectedIndex = 1;
      if (s && s.options.length > 1) s.selectedIndex = 1;
    });
    console.log('Selected teacher and student');

    // Fill date to today
    const today = new Date().toISOString().split('T')[0];
    await page.evaluate(d => { document.getElementById('adminEntryDate').value = d; }, today);

    // Fill times and classes
    await page.evaluate(() => {
      document.getElementById('adminEntryTimeFrom').value = '10:00';
      document.getElementById('adminEntryTimeTo').value = '11:00';
      document.getElementById('adminEntryClasses').value = '1';
      // choose sheet made yes
      const sheetYes = document.querySelector('input[name="adminEntrySheetMade"][value="yes"]');
      if (sheetYes) sheetYes.checked = true;
      // choose homework yes
      const hwYes = document.querySelector('input[name="adminEntryHomework"][value="yes"]');
      if (hwYes) hwYes.checked = true;
      document.getElementById('adminEntryTopic').value = 'Automated test topic';
    });

    console.log('Form filled — submitting');

    // Click Save Entry button
    await page.click('#addEntryModal button[type="submit"]');

    // Wait some time for save to process and for dialogs/logs
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('Finished test run');
  } catch (err) {
    console.error('Test run failed:', err);
  } finally {
    await browser.close();
  }

  process.exit(0);
})();
