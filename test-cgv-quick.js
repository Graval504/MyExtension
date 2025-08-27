const { chromium } = require('playwright');

async function quickTest() {
    console.log('🚀 Quick CGV Test...');
    
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    // Monitor network requests
    page.on('request', request => {
        const url = request.url();
        if (url.includes('seat') || url.includes('atkt') || url.includes('booking')) {
            console.log(`📡 API: ${request.method()} ${url}`);
        }
    });

    // Go to the seat selection page
    await page.goto('https://cgv.co.kr/cnm/selectVisitorCnt');
    
    // Wait for page to load
    await page.waitForTimeout(5000);
    
    // Inject monitoring
    await page.addScriptTag({
        content: `
            console.log('🔧 Monitoring script injected');
            
            // Track all clicks
            document.addEventListener('click', (e) => {
                console.log('🖱️ Click:', e.target.tagName, e.target.className, e.target.id);
                
                // Store click info globally so we can access it
                window.lastClick = {
                    tag: e.target.tagName,
                    className: e.target.className,
                    id: e.target.id,
                    text: e.target.textContent?.substring(0, 50),
                    onclick: e.target.getAttribute('onclick'),
                    timestamp: Date.now()
                };
            }, true);
            
            // Track all DOM changes
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        console.log('🎨 Class change:', mutation.target.tagName, 
                                  mutation.oldValue, '→', mutation.target.className);
                        
                        window.lastClassChange = {
                            tag: mutation.target.tagName,
                            oldClass: mutation.oldValue,
                            newClass: mutation.target.className,
                            timestamp: Date.now()
                        };
                    }
                });
            });
            
            observer.observe(document.body, {
                attributes: true,
                attributeOldValue: true,
                subtree: true
            });
        `
    });
    
    console.log('✅ Monitoring active! Click seats and watch the console...');
    console.log('🔍 Looking for seat elements...');
    
    // Check what elements exist
    const pageInfo = await page.evaluate(() => {
        const allElements = document.querySelectorAll('*');
        let seatLikeElements = [];
        
        for (let elem of allElements) {
            const classes = elem.className?.toString() || '';
            const id = elem.id || '';
            const onclick = elem.getAttribute('onclick') || '';
            
            if (classes.includes('seat') || 
                id.includes('seat') || 
                onclick.includes('seat') ||
                elem.tagName === 'svg' ||
                (elem.tagName === 'BUTTON' && classes) ||
                onclick.includes('selectSeat')) {
                
                seatLikeElements.push({
                    tag: elem.tagName,
                    class: classes,
                    id: id,
                    onclick: onclick.substring(0, 100),
                    text: elem.textContent?.substring(0, 30) || ''
                });
            }
        }
        
        return {
            totalElements: allElements.length,
            seatElements: seatLikeElements
        };
    });
    
    console.log(`📊 Found ${pageInfo.totalElements} total elements`);
    console.log(`🎯 Found ${pageInfo.seatElements.length} potential seat elements:`);
    
    pageInfo.seatElements.forEach((elem, i) => {
        console.log(`   ${i+1}. ${elem.tag} class="${elem.class}" id="${elem.id}"`);
        if (elem.onclick) {
            console.log(`      onclick: ${elem.onclick}...`);
        }
    });
    
    // Keep checking for interactions
    let checkCount = 0;
    const checkInterval = setInterval(async () => {
        try {
            const interactions = await page.evaluate(() => {
                const click = window.lastClick;
                const classChange = window.lastClassChange;
                
                // Clear them after reading
                window.lastClick = null;
                window.lastClassChange = null;
                
                return { click, classChange };
            });
            
            if (interactions.click) {
                console.log('🖱️ CLICK DETECTED:', interactions.click);
            }
            
            if (interactions.classChange) {
                console.log('🎨 CLASS CHANGE:', interactions.classChange);
            }
            
            checkCount++;
            if (checkCount > 300) { // Stop after 1 minute
                clearInterval(checkInterval);
                console.log('⏰ Test completed');
                await browser.close();
            }
            
        } catch (error) {
            // Page might be closed
        }
    }, 200);
    
    // Don't auto-close, let user interact
    console.log('💡 Click on seats in the browser window...');
    console.log('💡 The browser will stay open for testing');
}

quickTest().catch(console.error);