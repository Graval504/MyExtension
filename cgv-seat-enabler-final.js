
// ==UserScript==
// @name         CGV Seat Enabler (Final)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Enable disabled seats on CGV for educational purposes.
// @match        file://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- --- --- --- --- --- --- --- ---
    // 최종 해결책 (Final Solution)
    // --- --- --- --- --- --- --- --- ---
    //
    // 디버깅 결과, 비활성화된 좌석(<button>) 요소에는 이미 React의 onClick 이벤트 핸들러가 할당되어 있었습니다.
    // 단지 'disabled' HTML 속성 때문에 이벤트가 발생하지 않았던 것입니다.
    //
    // 따라서, 가장 간단하고 올바른 해결책은 이 'disabled' 속성만 제거하는 것입니다.
    // 이렇게 하면 버튼이 활성화되고, 기존에 할당된 React 이벤트 핸들러가 정상적으로 동작하게 됩니다.
    //

    // 1. 비활성화된 모든 좌석 요소를 찾습니다.
    const disabledSeats = document.querySelectorAll('.seatMap_seatDisabled__II0B_');

    if (disabledSeats.length === 0) {
        console.log('[CGV Seat Enabler] 활성화할 좌석이 없습니다.');
        return;
    }

    // 2. 각 좌석의 'disabled' 속성을 false로 설정하여 활성화합니다.
    disabledSeats.forEach(seat => {
        seat.disabled = false;
    });

    const successMessage = `[CGV Seat Enabler] ${disabledSeats.length}개의 좌석을 성공적으로 활성화했습니다.`;
    console.log(successMessage);
    alert(successMessage);

})();
