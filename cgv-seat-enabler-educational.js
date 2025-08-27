// ==UserScript==
// @name         CGV Seat Enabler (Educational) v2
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Enable disabled seats on CGV for educational purposes by re-assigning React event handlers.
// @match        file://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- --- --- --- --- --- --- --- ---
    // 1. React 속성 키 찾기
    // --- --- --- --- --- --- --- --- ---
    // React는 DOM 요소에 __reactProps$xxxx 와 같은 동적인 키를 사용하여 내부 속성을 저장합니다.
    // 먼저 페이지의 좌석 요소 중 하나를 샘플로 선택하여 이 키가 무엇인지 알아냅니다.
    const sampleSeat = document.querySelector('.seatMap_seatNumber__JHck5');
    if (!sampleSeat) {
        console.error('[CGV Seat Enabler] 좌석 요소를 찾을 수 없습니다.');
        return;
    }
    const reactPropKey = Object.keys(sampleSeat).find(key => key.startsWith('__reactProps$'));
    if (!reactPropKey) {
        console.error('[CGV Seat Enabler] 좌석 요소에서 React 속성을 찾을 수 없습니다.');
        return;
    }
    console.log(`[CGV Seat Enabler] 찾은 React 속성 키: ${reactPropKey}`);

    // --- --- --- --- --- --- --- --- ---
    // 2. 실제 onClick 이벤트 핸들러 가져오기
    // --- --- --- --- --- --- --- --- ---
    // 비활성화된 좌석에는 onClick 핸들러가 없을 수 있으므로, 선택 가능한 일반 좌석에서 핸들러를 "빌려옵니다".
    const clickableSeat = document.querySelector('.seatMap_seatNormal__SojfU:not(.seatMap_seatDisabled__II0B_)');
    if (!clickableSeat || !clickableSeat[reactPropKey] || typeof clickableSeat[reactPropKey].onClick !== 'function') {
        console.error('[CGV Seat Enabler] 클릭 가능한 좌석 또는 onClick 핸들러를 찾을 수 없습니다.');
        // 페이지가 완전히 로드되지 않았을 수 있으므로, 잠시 후 다시 시도합니다.
        setTimeout(arguments.callee, 500);
        return;
    }
    const onClickHandler = clickableSeat[reactPropKey].onClick;
    console.log('[CGV Seat Enabler] onClick 핸들러를 성공적으로 찾았습니다.');

    // --- --- --- --- --- --- --- --- ---
    // 3. 비활성화된 좌석 활성화 및 핸들러 재할당
    // --- --- --- --- --- --- --- --- ---
    const disabledSeats = document.querySelectorAll('.seatMap_seatDisabled__II0B_');
    if (disabledSeats.length === 0) {
        console.log('[CGV Seat Enabler] 비활성화된 좌석이 없습니다.');
        return;
    }

    disabledSeats.forEach(seat => {
        // disabled 속성과 클래스를 제거하여 좌석을 활성화합니다.
        seat.disabled = false;
        seat.classList.remove('seatMap_seatDisabled__II0B_');

        // 좌석의 React 속성에 직접 접근하여, 빌려온 onClick 핸들러를 할당합니다.
        // 이렇게 하면 이 좌석을 클릭했을 때 React가 정상적으로 처리하게 됩니다.
        if (seat[reactPropKey]) {
            seat[reactPropKey].onClick = onClickHandler;
        } else {
            console.warn('[CGV Seat Enabler] 좌석에서 React 속성을 찾을 수 없어 핸들러를 할당하지 못했습니다:', seat);
        }
    });

    const successMessage = `[CGV Seat Enabler] 비활성화된 ${disabledSeats.length}개의 좌석을 성공적으로 활성화했습니다. 이제 회색 좌석을 클릭하여 선택할 수 있습니다.`;
    console.log(successMessage);
    alert(successMessage);

})();