
(function() {
    'use strict';

    console.log('[CGV Seat Enabler - Debug Mode]');

    // Function to find the React Props key
    function getReactPropKey() {
        const sampleElement = document.querySelector('.seatMap_seatNumber__JHck5');
        if (!sampleElement) return null;
        return Object.keys(sampleElement).find(key => key.startsWith('__reactProps$'));
    }

    const reactPropKey = getReactPropKey();
    if (!reactPropKey) {
        console.error('[CGV Seat Enabler] Could not find React properties on seat elements.');
        return;
    }
    console.log(`[CGV Seat Enabler] Found React prop key: ${reactPropKey}`);

    // Log props of a clickable seat
    const clickableSeat = document.querySelector('.seatMap_seatNormal__SojfU:not(.seatMap_seatDisabled__II0B_)');
    if (clickableSeat && clickableSeat[reactPropKey]) {
        console.log('[CGV Seat Enabler] Props of a CLICKABLE seat:', clickableSeat[reactPropKey]);
    } else {
        console.error('[CGV Seat Enabler] Could not find a clickable seat to inspect.');
    }

    // Log props of a disabled seat
    const disabledSeat = document.querySelector('.seatMap_seatDisabled__II0B_');
    if (disabledSeat && disabledSeat[reactPropKey]) {
        console.log('[CGV Seat Enabler] Props of a DISABLED seat:', disabledSeat[reactPropKey]);
    } else {
        console.error('[CGV Seat Enabler] Could not find a disabled seat to inspect.');
    }
    
    // I will still enable the seats, so the user can try clicking them.
    const allDisabledSeats = document.querySelectorAll('.seatMap_seatDisabled__II0B_');
    allDisabledSeats.forEach(seat => {
        seat.disabled = false;
        seat.classList.remove('seatMap_seatDisabled__II0B_');
    });
    console.log(`[CGV Seat Enabler] ${allDisabledSeats.length} seats have been enabled for inspection. Please check the console logs for prop objects and share them.`);

})();
