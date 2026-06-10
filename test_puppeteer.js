const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if(msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });
  
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  try {
    await page.goto('http://localhost:3000');
    await new Promise(r => setTimeout(r, 1000));
    // Click Arrow to go to Scene 2
    await page.evaluate(() => {
      if(typeof iniciarTransicao === 'function') {
        iniciarTransicao(4);
      }
    });
    await new Promise(r => setTimeout(r, 1000));
    console.log('Test complete');
  } catch (err) {
    console.error('Script Error:', err);
  }
  
  await browser.close();
})();
