const puppeteer = require('puppeteer');

(async () => {
  console.log('Starting Puppeteer test...');
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
    console.log('Browser launched successfully');
    
    const page = await browser.newPage();
    console.log('Page created successfully');
    
    await page.setContent('<h1>Test PDF</h1>');
    console.log('Content set successfully');
    
    const pdf = await page.pdf({ format: 'A4' });
    console.log('PDF generated successfully, size:', pdf.length, 'bytes');
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }
  }
})();