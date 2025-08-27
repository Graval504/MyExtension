// ==UserScript==
// @name         CGV 예매 좌석 활성화 v3 (최적화)
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  CGV에서 예매된 좌석을 다시 선택 가능하게 만들기 (최적화된 안정화 버전)
// @author       You
// @match        *://www.cgv.co.kr/*
// @match        *://ticket.cgv.co.kr/*
// @match        *://cgv.co.kr/*
// @match        https://cgv.co.kr/cnm/selectVisitorCnt*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('🎬 CGV 좌석 활성화 스크립트 v3 시작 (최적화 버전)');

    // 전역 상태 관리
    const state = {
        isProcessing: false,
        clickTarget: null,
        lastProcessTime: 0,
        processedSeats: new Set(),
        isInitialized: false
    };

    // 1. 단순한 좌석 활성화 (DOM만 수정)
    function enableSeatDOM(button) {
        if (!button || state.processedSeats.has(button)) return false;
        
        const seatName = button.querySelector('span')?.textContent;
        if (!seatName) return false;
        
        // DOM 속성만 수정
        button.removeAttribute('disabled');
        button.classList.remove('seatMap_seatDisabled__II0B_');
        button.setAttribute('data-cgv-enabled', 'true');
        
        state.processedSeats.add(button);
        console.log(`✅ 좌석 활성화: ${seatName}`);
        return true;
    }

    // 2. 초기 활성화 (페이지 로드 시 한 번만)
    function initialActivation() {
        if (state.isInitialized) return;
        
        console.log('🚀 초기 좌석 활성화 시작');
        
        const disabledButtons = document.querySelectorAll('button.seatMap_seatDisabled__II0B_');
        let count = 0;
        
        disabledButtons.forEach(button => {
            if (enableSeatDOM(button)) {
                count++;
            }
        });
        
        state.isInitialized = true;
        console.log(`📊 초기 활성화: ${count}개 좌석`);
    }

    // 3. React onClick 실행 함수
    function executeReactClick(button, originalEvent) {
        const seatName = button.querySelector('span')?.textContent;
        const reactKey = Object.keys(button).find(key => key.startsWith('__react'));
        
        if (!reactKey) {
            console.error('React Fiber를 찾을 수 없음:', seatName);
            return false;
        }
        
        const fiber = button[reactKey];
        if (!fiber?.memoizedProps?.onClick) {
            console.error('onClick 핸들러를 찾을 수 없음:', seatName);
            return false;
        }
        
        try {
            // React 상태 임시 수정
            if (fiber.memoizedProps.disabled) {
                fiber.memoizedProps.disabled = false;
            }
            
            // 클릭 이벤트 생성
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: originalEvent?.clientX || 0,
                clientY: originalEvent?.clientY || 0
            });
            
            // target 설정
            Object.defineProperty(clickEvent, 'target', {
                value: button,
                enumerable: true
            });
            Object.defineProperty(clickEvent, 'currentTarget', {
                value: button,
                enumerable: true
            });
            
            console.log(`🎯 React onClick 실행: ${seatName}`);
            fiber.memoizedProps.onClick(clickEvent);
            
            return true;
        } catch (error) {
            console.error('React onClick 실행 실패:', error);
            return false;
        }
    }

    // 4. 단순한 클릭 핸들러
    function setupClickHandler() {
        document.addEventListener('click', function(e) {
            // 처리 중이면 무시
            if (state.isProcessing) return;
            
            const button = e.target.closest('button[data-seatlocno]');
            if (!button) return;
            
            const seatName = button.querySelector('span')?.textContent;
            const isDisabled = button.disabled || button.classList.contains('seatMap_seatDisabled__II0B_');
            const isEnabled = button.getAttribute('data-cgv-enabled') === 'true';
            
            // 활성화된 좌석만 처리
            if (isEnabled && !isDisabled) {
                console.log(`🎯 활성화된 좌석 클릭: ${seatName}`);
                
                // 이벤트 차단
                e.preventDefault();
                e.stopImmediatePropagation();
                
                // 처리 시작
                state.isProcessing = true;
                state.clickTarget = button;
                
                // React onClick 실행
                const success = executeReactClick(button, e);
                
                // 처리 완료 (지연)
                setTimeout(() => {
                    state.isProcessing = false;
                    state.clickTarget = null;
                    console.log(`✅ 클릭 처리 완료: ${seatName} (${success ? '성공' : '실패'})`);
                }, 500); // CGV 렌더링 완료 대기
            }
            // 비활성화된 좌석 클릭 시 활성화만
            else if (isDisabled) {
                console.log(`🔓 비활성화 좌석 활성화: ${seatName}`);
                enableSeatDOM(button);
                
                // 활성화 후 클릭 재시도
                setTimeout(() => {
                    if (!state.isProcessing) {
                        button.click();
                    }
                }, 100);
            }
        }, true);
    }

    // 5. 최소한의 DOM 감시 (성능 최적화)
    function setupMinimalObserver() {
        let observerTimer = null;
        
        const observer = new MutationObserver(() => {
            // 처리 중이면 무시
            if (state.isProcessing) return;
            
            // 디바운싱 (1초에 한 번만 실행)
            clearTimeout(observerTimer);
            observerTimer = setTimeout(() => {
                const now = Date.now();
                if (now - state.lastProcessTime < 2000) return; // 2초 간격
                
                state.lastProcessTime = now;
                
                // 새로 생긴 비활성화된 좌석만 활성화
                const newDisabledSeats = document.querySelectorAll('button.seatMap_seatDisabled__II0B_:not([data-cgv-enabled])');
                
                if (newDisabledSeats.length > 0) {
                    console.log(`🔄 새 비활성화 좌석 ${newDisabledSeats.length}개 발견`);
                    newDisabledSeats.forEach(button => {
                        if (!state.processedSeats.has(button)) {
                            enableSeatDOM(button);
                        }
                    });
                }
            }, 1000);
        });
        
        // body 전체 감시 (간헐적)
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false // 속성 변경 감시 비활성화 (성능 향상)
        });
    }

    // 6. 초기화
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }
        
        // CGV 초기화 대기
        setTimeout(() => {
            console.log('🚀 스크립트 v3 초기화');
            
            // 초기 활성화
            initialActivation();
            
            // 클릭 핸들러 설정
            setupClickHandler();
            
            // 최소한의 DOM 감시
            setupMinimalObserver();
            
            console.log('✅ 스크립트 v3 초기화 완료');
        }, 1500);
    }

    // 실행
    init();
    
    // 디버깅용 전역 함수
    window.cgvSeatEnablerV3 = {
        state: state,
        enableSeat: enableSeatDOM,
        getInfo: () => ({
            processed: state.processedSeats.size,
            isProcessing: state.isProcessing,
            initialized: state.isInitialized
        }),
        reset: () => {
            state.processedSeats.clear();
            state.isProcessing = false;
            state.isInitialized = false;
            console.log('🔄 상태 초기화 완료');
        }
    };
    
    console.log('💡 디버깅: cgvSeatEnablerV3.getInfo()');

})();