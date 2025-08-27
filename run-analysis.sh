#!/bin/bash

echo "🎬 CGV Seat Analysis Tool"
echo "========================"
echo ""
echo "This tool will help you analyze CGV movie seat activation/deactivation logic."
echo ""
echo "Instructions:"
echo "1. The script will open a Chrome browser window"
echo "2. Navigate to CGV website (http://www.cgv.co.kr)"
echo "3. Go through the booking process to reach seat selection"
echo "4. Press Enter in the terminal when you're ready to start monitoring"
echo "5. Interact with seats while the tool monitors in the background"
echo "6. Press Enter again to generate the analysis report"
echo ""

# Make sure Playwright is installed
if ! npm list playwright &> /dev/null; then
    echo "📦 Installing Playwright..."
    npm install playwright
fi

# Check if Chromium is installed
if ! npx playwright --version &> /dev/null; then
    echo "🌐 Installing Chromium browser..."
    npx playwright install chromium
fi

echo "🚀 Starting CGV Seat Analyzer..."
node cgv-seat-analyzer.js