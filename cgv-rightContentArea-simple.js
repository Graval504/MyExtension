/**
 * Simple function to remove CGV right content area with dynamic class suffix
 * Can be integrated into existing scripts
 */

function removeCGVRightContentArea() {
    // Remove elements with class pattern: mets01390_rightContentArea__*
    const elements = document.querySelectorAll('[class*="mets01390_rightContentArea__"]');
    
    elements.forEach(element => {
        console.log(`Removing element with class: ${element.className}`);
        element.remove();
    });
    
    return elements.length;
}

// Auto-execute when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeCGVRightContentArea);
} else {
    removeCGVRightContentArea();
}

// Set up mutation observer for dynamically added content
const observer = new MutationObserver(() => {
    removeCGVRightContentArea();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Expose function globally
window.removeCGVRightContentArea = removeCGVRightContentArea;