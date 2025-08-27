const { chromium } = require('playwright');
const fs = require('fs');

class CGVSeatAnalyzer {
    constructor() {
        this.browser = null;
        this.page = null;
        this.events = [];
        this.seatStates = new Map();
    }

    async initialize() {
        console.log('🚀 Initializing CGV Seat Analyzer...');
        
        // Launch browser in non-headless mode so you can interact
        this.browser = await chromium.launch({ 
            headless: false,
            slowMo: 100 // Slow down actions for better observation
        });
        
        this.page = await this.browser.newPage();
        
        // Enable console logging
        this.page.on('console', msg => {
            console.log(`🖥️  Console: ${msg.text()}`);
        });
        
        // Monitor network requests for seat-related API calls
        this.page.on('request', request => {
            const url = request.url();
            if (url.includes('seat') || url.includes('booking') || url.includes('reservation')) {
                console.log(`📡 API Request: ${request.method()} ${url}`);
                this.events.push({
                    type: 'api_request',
                    timestamp: Date.now(),
                    method: request.method(),
                    url: url,
                    data: request.postData()
                });
            }
        });

        // Monitor responses
        this.page.on('response', response => {
            const url = response.url();
            if (url.includes('seat') || url.includes('booking') || url.includes('reservation')) {
                console.log(`📥 API Response: ${response.status()} ${url}`);
                this.events.push({
                    type: 'api_response',
                    timestamp: Date.now(),
                    status: response.status(),
                    url: url
                });
            }
        });
        
        console.log('✅ Browser initialized. Ready to analyze CGV seat logic.');
    }

    async navigateToCGV() {
        console.log('🎬 Navigating to CGV seat selection page...');
        
        try {
            // Go directly to the provided URL
            await this.page.goto('https://cgv.co.kr/cnm/selectVisitorCnt', {
                waitUntil: 'networkidle',
                timeout: 30000
            });
            
            console.log('✅ Successfully loaded CGV seat selection page');
            console.log('📍 Analyzing page structure...');
            
            // Wait a bit for dynamic content to load
            await this.page.waitForTimeout(3000);
            
            // Try to find seat elements
            const seatInfo = await this.page.evaluate(() => {
                const possibleSelectors = [
                    '.seat',
                    '.seat-item', 
                    '.seat-button',
                    '[data-seat]',
                    '[class*="seat"]',
                    '[id*="seat"]',
                    '.cinema-seat',
                    '.booking-seat',
                    'button[onclick*="seat"]',
                    'td[onclick*="seat"]',
                    'div[onclick*="seat"]',
                    'span[onclick*="seat"]'
                ];
                
                let foundElements = [];
                possibleSelectors.forEach(selector => {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        foundElements.push({
                            selector: selector,
                            count: elements.length,
                            sample: elements[0] ? {
                                tagName: elements[0].tagName,
                                className: elements[0].className,
                                id: elements[0].id,
                                innerHTML: elements[0].innerHTML.substring(0, 100)
                            } : null
                        });
                    }
                });
                
                return {
                    url: window.location.href,
                    title: document.title,
                    foundSelectors: foundElements,
                    allClickableElements: document.querySelectorAll('button, td[onclick], div[onclick], span[onclick], a[onclick]').length
                };
            });
            
            console.log('🔍 Page Analysis Results:');
            console.log(`   URL: ${seatInfo.url}`);
            console.log(`   Title: ${seatInfo.title}`);
            console.log(`   Total clickable elements: ${seatInfo.allClickableElements}`);
            console.log('   Found seat-related elements:');
            
            if (seatInfo.foundSelectors.length > 0) {
                seatInfo.foundSelectors.forEach(info => {
                    console.log(`     ${info.selector}: ${info.count} elements`);
                    if (info.sample) {
                        console.log(`       Sample: <${info.sample.tagName} class="${info.sample.className}" id="${info.sample.id}">`);
                    }
                });
            } else {
                console.log('     ❌ No obvious seat elements found with standard selectors');
                console.log('     💡 Will monitor ALL clickable elements for seat interactions');
            }
            
        } catch (error) {
            console.error('❌ Failed to load CGV page:', error.message);
            console.log('📍 Please navigate to the seat selection page manually');
        }
        
        console.log('');
        console.log('💡 Ready to start monitoring. Press Enter to begin...');
    }

    async startSeatMonitoring() {
        console.log('🔍 Starting seat interaction monitoring...');
        
        // Inject enhanced monitoring script into the page
        await this.page.addScriptTag({
            content: `
                console.log('🔧 Injecting CGV-specific monitoring script...');
                
                // Store original functions to detect overrides
                window.originalFunctions = {};
                
                // Monitor ALL DOM changes, not just seat-specific
                const universalObserver = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        const target = mutation.target;
                        
                        // Log any class changes that might indicate seat state
                        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                            window.classChange = {
                                element: target.outerHTML.substring(0, 300),
                                tagName: target.tagName,
                                className: target.className,
                                id: target.id,
                                oldClass: mutation.oldValue,
                                newClass: target.className,
                                timestamp: Date.now()
                            };
                        }
                        
                        // Log any attribute changes
                        if (mutation.type === 'attributes') {
                            window.attributeChange = {
                                element: target.outerHTML.substring(0, 200),
                                tagName: target.tagName,
                                attributeName: mutation.attributeName,
                                oldValue: mutation.oldValue,
                                newValue: target.getAttribute(mutation.attributeName),
                                timestamp: Date.now()
                            };
                        }
                    });
                });

                // Observe ALL changes in the document
                universalObserver.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeOldValue: true
                });

                // Monitor ALL clicks and look for patterns
                document.addEventListener('click', (event) => {
                    const target = event.target;
                    const rect = target.getBoundingClientRect();
                    
                    window.anyClick = {
                        element: target.outerHTML.substring(0, 300),
                        tagName: target.tagName,
                        className: target.className,
                        id: target.id,
                        innerText: target.innerText?.substring(0, 50) || '',
                        onclick: target.onclick?.toString() || '',
                        dataset: {...target.dataset},
                        attributes: Array.from(target.attributes).reduce((acc, attr) => {
                            acc[attr.name] = attr.value;
                            return acc;
                        }, {}),
                        position: {
                            x: event.clientX,
                            y: event.clientY,
                            elementRect: {
                                top: rect.top,
                                left: rect.left,
                                width: rect.width,
                                height: rect.height
                            }
                        },
                        timestamp: Date.now()
                    };
                    
                    console.log('🖱️ Click detected:', target.tagName, target.className || target.id);
                }, true);

                // Monitor form changes
                document.addEventListener('change', (event) => {
                    const target = event.target;
                    window.formChange = {
                        element: target.outerHTML.substring(0, 200),
                        tagName: target.tagName,
                        name: target.name,
                        value: target.value,
                        type: target.type,
                        timestamp: Date.now()
                    };
                });

                // Intercept common JavaScript functions that might be used for seat selection
                const originalSetTimeout = window.setTimeout;
                const originalSetInterval = window.setInterval;
                const originalFetch = window.fetch;
                
                // Intercept setTimeout calls (often used for UI updates)
                window.setTimeout = function(callback, delay) {
                    const wrappedCallback = function() {
                        window.timeoutExecution = {
                            timestamp: Date.now(),
                            delay: delay,
                            callback: callback.toString().substring(0, 200)
                        };
                        return callback.apply(this, arguments);
                    };
                    return originalSetTimeout.call(this, wrappedCallback, delay);
                };

                // Intercept fetch calls (API calls)
                if (window.fetch) {
                    window.fetch = function() {
                        window.fetchCall = {
                            url: arguments[0],
                            options: arguments[1],
                            timestamp: Date.now()
                        };
                        console.log('🌐 Fetch intercepted:', arguments[0]);
                        return originalFetch.apply(this, arguments);
                    };
                }

                // Look for jQuery if it exists
                if (window.$ || window.jQuery) {
                    const $ = window.$ || window.jQuery;
                    const originalOn = $.fn.on;
                    
                    $.fn.on = function(events, selector, data, handler) {
                        console.log('📎 jQuery event binding:', events, selector);
                        return originalOn.apply(this, arguments);
                    };
                }

                console.log('✅ Universal monitoring active - all interactions will be logged');
            `
        });

        // Poll for ALL types of changes
        setInterval(async () => {
            try {
                // Check for any clicks
                const anyClick = await this.page.evaluate(() => {
                    if (window.anyClick) {
                        const click = window.anyClick;
                        window.anyClick = null;
                        return click;
                    }
                    return null;
                });

                if (anyClick) {
                    console.log('🖱️  Click Detected:');
                    console.log(`   Element: ${anyClick.tagName} ${anyClick.className || anyClick.id}`);
                    console.log(`   Text: ${anyClick.innerText}`);
                    if (anyClick.onclick) {
                        console.log(`   OnClick: ${anyClick.onclick.substring(0, 100)}...`);
                    }
                    if (Object.keys(anyClick.dataset).length > 0) {
                        console.log(`   Dataset:`, anyClick.dataset);
                    }
                    console.log(`   Position: (${anyClick.position.x}, ${anyClick.position.y})`);
                    console.log('');
                    
                    this.events.push({
                        type: 'click_detected',
                        timestamp: anyClick.timestamp,
                        data: anyClick
                    });
                }

                // Check for class changes
                const classChange = await this.page.evaluate(() => {
                    if (window.classChange) {
                        const change = window.classChange;
                        window.classChange = null;
                        return change;
                    }
                    return null;
                });

                if (classChange) {
                    console.log('🎨 Class Change Detected:');
                    console.log(`   Element: ${classChange.tagName} ${classChange.id}`);
                    console.log(`   Old Class: "${classChange.oldClass}"`);
                    console.log(`   New Class: "${classChange.newClass}"`);
                    console.log('');
                    
                    this.events.push({
                        type: 'class_change',
                        timestamp: classChange.timestamp,
                        data: classChange
                    });
                }

                // Check for attribute changes
                const attrChange = await this.page.evaluate(() => {
                    if (window.attributeChange) {
                        const change = window.attributeChange;
                        window.attributeChange = null;
                        return change;
                    }
                    return null;
                });

                if (attrChange && attrChange.attributeName !== 'class') { // Avoid duplicate class change logs
                    console.log('📝 Attribute Change Detected:');
                    console.log(`   Element: ${attrChange.tagName}`);
                    console.log(`   Attribute: ${attrChange.attributeName}`);
                    console.log(`   Old Value: "${attrChange.oldValue}"`);
                    console.log(`   New Value: "${attrChange.newValue}"`);
                    console.log('');
                    
                    this.events.push({
                        type: 'attribute_change',
                        timestamp: attrChange.timestamp,
                        data: attrChange
                    });
                }

                // Check for form changes
                const formChange = await this.page.evaluate(() => {
                    if (window.formChange) {
                        const change = window.formChange;
                        window.formChange = null;
                        return change;
                    }
                    return null;
                });

                if (formChange) {
                    console.log('📋 Form Change Detected:');
                    console.log(`   Element: ${formChange.tagName} name="${formChange.name}"`);
                    console.log(`   Type: ${formChange.type}`);
                    console.log(`   Value: "${formChange.value}"`);
                    console.log('');
                    
                    this.events.push({
                        type: 'form_change',
                        timestamp: formChange.timestamp,
                        data: formChange
                    });
                }

                // Check for setTimeout executions
                const timeoutExec = await this.page.evaluate(() => {
                    if (window.timeoutExecution) {
                        const exec = window.timeoutExecution;
                        window.timeoutExecution = null;
                        return exec;
                    }
                    return null;
                });

                if (timeoutExec) {
                    console.log('⏱️  Timeout Execution:');
                    console.log(`   Delay: ${timeoutExec.delay}ms`);
                    console.log(`   Callback: ${timeoutExec.callback}...`);
                    console.log('');
                    
                    this.events.push({
                        type: 'timeout_execution',
                        timestamp: timeoutExec.timestamp,
                        data: timeoutExec
                    });
                }

                // Check for fetch calls
                const fetchCall = await this.page.evaluate(() => {
                    if (window.fetchCall) {
                        const call = window.fetchCall;
                        window.fetchCall = null;
                        return call;
                    }
                    return null;
                });

                if (fetchCall) {
                    console.log('🌐 Fetch Call Detected:');
                    console.log(`   URL: ${fetchCall.url}`);
                    if (fetchCall.options) {
                        console.log(`   Options:`, fetchCall.options);
                    }
                    console.log('');
                    
                    this.events.push({
                        type: 'fetch_call',
                        timestamp: fetchCall.timestamp,
                        data: fetchCall
                    });
                }

            } catch (error) {
                // Ignore errors during polling
            }
        }, 200); // Faster polling for better detection
    }

    async analyzeCurrentSeats() {
        console.log('🔬 Analyzing current seat layout...');
        
        const seatAnalysis = await this.page.evaluate(() => {
            // Find all seat-like elements
            const seatSelectors = [
                '[class*="seat"]',
                '[data-seat]',
                '.seat',
                '.seat-item',
                '.seat-button'
            ];
            
            let allSeats = [];
            seatSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                allSeats = [...allSeats, ...Array.from(elements)];
            });
            
            // Remove duplicates
            allSeats = allSeats.filter((seat, index, self) => 
                self.indexOf(seat) === index
            );
            
            return allSeats.map(seat => ({
                tagName: seat.tagName,
                className: seat.className,
                id: seat.id,
                innerHTML: seat.innerHTML.substring(0, 100),
                dataset: {...seat.dataset},
                attributes: Array.from(seat.attributes).reduce((acc, attr) => {
                    acc[attr.name] = attr.value;
                    return acc;
                }, {}),
                computedStyle: {
                    display: window.getComputedStyle(seat).display,
                    visibility: window.getComputedStyle(seat).visibility,
                    backgroundColor: window.getComputedStyle(seat).backgroundColor,
                    color: window.getComputedStyle(seat).color
                }
            }));
        });
        
        console.log(`📊 Found ${seatAnalysis.length} seat elements`);
        seatAnalysis.forEach((seat, index) => {
            console.log(`   Seat ${index + 1}:`);
            console.log(`     Tag: ${seat.tagName}`);
            console.log(`     Class: ${seat.className}`);
            console.log(`     ID: ${seat.id}`);
            if (Object.keys(seat.dataset).length > 0) {
                console.log(`     Data:`, seat.dataset);
            }
            console.log('');
        });
        
        return seatAnalysis;
    }

    async generateReport() {
        console.log('📋 Generating analysis report...');
        
        const report = {
            timestamp: new Date().toISOString(),
            events: this.events,
            summary: {
                totalEvents: this.events.length,
                seatClicks: this.events.filter(e => e.type === 'seat_click').length,
                stateChanges: this.events.filter(e => e.type === 'seat_state_change').length,
                apiCalls: this.events.filter(e => e.type.includes('api')).length
            },
            patterns: this.analyzePatterns()
        };
        
        const filename = `cgv-seat-analysis-${Date.now()}.json`;
        fs.writeFileSync(filename, JSON.stringify(report, null, 2));
        console.log(`💾 Report saved to ${filename}`);
        
        return report;
    }

    analyzePatterns() {
        const patterns = {
            seatStateTransitions: {},
            clickToStateDelay: [],
            apiCallPatterns: []
        };
        
        // Analyze state transitions
        this.events.forEach(event => {
            if (event.type === 'seat_state_change') {
                const oldClass = event.data.oldValue || 'unknown';
                const newClass = event.data.className || 'unknown';
                const transition = `${oldClass} → ${newClass}`;
                
                patterns.seatStateTransitions[transition] = 
                    (patterns.seatStateTransitions[transition] || 0) + 1;
            }
        });
        
        return patterns;
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// Main execution
async function main() {
    const analyzer = new CGVSeatAnalyzer();
    
    try {
        await analyzer.initialize();
        await analyzer.navigateToCGV();
        
        // Wait for user to navigate to seat selection page
        console.log('Waiting for you to reach the seat selection page...');
        console.log('Press Enter when ready to start monitoring:');
        
        process.stdin.once('data', async () => {
            await analyzer.startSeatMonitoring();
            await analyzer.analyzeCurrentSeats();
            
            console.log('🎯 Monitoring active! Interact with seats and watch the analysis.');
            console.log('Press Enter again to generate final report:');
            
            process.stdin.once('data', async () => {
                const report = await analyzer.generateReport();
                console.log('📊 Analysis complete!');
                console.log(JSON.stringify(report.summary, null, 2));
                await analyzer.cleanup();
                process.exit(0);
            });
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
        await analyzer.cleanup();
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = CGVSeatAnalyzer;