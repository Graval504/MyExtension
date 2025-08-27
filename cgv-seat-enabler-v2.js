// ==UserScript==
// @name         CGV 예매 좌석 활성화 v2
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  CGV에서 예매된 좌석을 다시 선택 가능하게 만들기 (안정화 버전)
// @author       You
// @match        *://www.cgv.co.kr/*
// @match        *://ticket.cgv.co.kr/*
// @match        *://cgv.co.kr/*
// @match        https://cgv.co.kr/cnm/selectVisitorCnt*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('🎬 CGV 좌석 활성화 스크립트 v2 시작');

    // 좌석 상태 추적
    const seatTracker = {
        activatedSeats: new Set(),  // 활성화한 좌석들
        processingSeats: new Set(), // 처리 중인 좌석들
        seatMapping: new Map()      // 좌석명 -> locNo 매핑
    };

    // 1. 좌석 활성화 함수 (개선됨)
    function enableSeat(button) {
        const seatName = button.querySelector('span')?.textContent;
        const locNo = button.getAttribute('data-seatlocno');
        
        // 이미 처리 중이면 스킵
        if (seatTracker.processingSeats.has(seatName)) {
            return false;
        }
        
        // 처리 시작
        seatTracker.processingSeats.add(seatName);
        
        // DOM 수정
        button.removeAttribute('disabled');
        button.classList.remove('seatMap_seatDisabled__II0B_');
        
        // React Fiber 수정
        const reactKey = Object.keys(button).find(key => key.startsWith('__react'));
        if (reactKey) {
            const fiber = button[reactKey];
            if (fiber?.memoizedProps?.disabled) {
                // props 복사본 생성
                const newProps = { ...fiber.memoizedProps, disabled: false };
                fiber.memoizedProps = newProps;
                fiber.pendingProps = newProps;
            }
        }
        
        // 추적 정보 업데이트
        seatTracker.activatedSeats.add(seatName);
        seatTracker.seatMapping.set(seatName, locNo);
        
        // 처리 완료
        setTimeout(() => {
            seatTracker.processingSeats.delete(seatName);
        }, 100);
        
        console.log(`✅ 좌석 활성화: ${seatName}`);
        return true;
    }

    // 2. 초기 활성화 (페이지 로드 시)
    function initialActivation() {
        const disabledButtons = document.querySelectorAll('button.seatMap_seatDisabled__II0B_');
        let count = 0;
        
        disabledButtons.forEach(button => {
            if (enableSeat(button)) {
                count++;
            }
        });
        
        console.log(`📊 초기 활성화: ${count}개 좌석`);
    }

    // 3. 클릭 핸들러 (단순화)
    function setupClickHandler() {
        // 이벤트 위임 사용
        document.addEventListener('click', function(e) {
            const button = e.target.closest('button[data-seatlocno]');
            
            if (!button) return;
            
            const seatName = button.querySelector('span')?.textContent;
            const reactKey = Object.keys(button).find(key => key.startsWith('__react'));
            const fiber = button ? button[reactKey] : null;
            
            // React props 확인
            const isReactDisabled = fiber?.memoizedProps?.disabled === true;
            const isDOMDisabled = button.disabled || button.classList.contains('seatMap_seatDisabled__II0B_');
            
            // 활성화한 좌석 클릭 처리
            if (seatTracker.activatedSeats.has(seatName)) {
                console.log(`🎯 활성화된 좌석 클릭: ${seatName} (locNo: ${button.getAttribute('data-seatlocno')})`);
                
                // 좌석 정확성 검증
                const currentLocNo = button.getAttribute('data-seatlocno');
                const storedLocNo = seatTracker.seatMapping.get(seatName);
                
                if (storedLocNo && currentLocNo !== storedLocNo) {
                    console.warn(`⚠️ 좌석 ID 불일치 감지: ${seatName} (저장됨: ${storedLocNo}, 현재: ${currentLocNo})`);
                    
                    // 좌석 매핑 업데이트
                    seatTracker.seatMapping.set(seatName, currentLocNo);
                    
                    // DOM이 변경 중인지 체크 (100ms 대기 후 재시도)
                    setTimeout(() => {
                        const updatedButton = Array.from(document.querySelectorAll('button[data-seatlocno]'))
                            .find(b => b.querySelector('span')?.textContent === seatName);
                        
                        if (updatedButton && updatedButton !== button) {
                            console.log(`🔄 정확한 버튼으로 재시도: ${seatName}`);
                            updatedButton.click();
                            return;
                        }
                    }, 100);
                }
                
                // 이벤트 전파 중지 (CGV의 기본 동작 방지)
                e.preventDefault();
                e.stopImmediatePropagation();
                
                // 클릭 직전 좌석 재확인
                const finalCheck = Array.from(document.querySelectorAll('button[data-seatlocno]'))
                    .find(b => b.querySelector('span')?.textContent === seatName);
                
                if (finalCheck && finalCheck !== button) {
                    console.log(`🎯 최종 검증: 올바른 버튼으로 변경 ${seatName}`);
                    // 올바른 버튼으로 클릭 이벤트 전달
                    finalCheck.dispatchEvent(new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: e.clientX,
                        clientY: e.clientY
                    }));
                    return;
                }
                
                // React onClick 직접 실행
                if (fiber?.memoizedProps?.onClick) {
                    try {
                        // 클릭 이벤트 생성 (React 친화적)
                        const clickEvent = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            clientX: e.clientX,
                            clientY: e.clientY
                        });
                        
                        // target 설정 (정확한 버튼으로)
                        Object.defineProperty(clickEvent, 'target', {
                            value: button,
                            enumerable: true
                        });
                        Object.defineProperty(clickEvent, 'currentTarget', {
                            value: button,
                            enumerable: true
                        });
                        
                        console.log(`🚀 onClick 실행 시도: ${seatName} → ${button.getAttribute('data-seatlocno')}`);
                        
                        // React 상태 동기화 체크
                        if (fiber.memoizedProps.disabled) {
                            console.log('🔧 React props disabled 강제 해제');
                            fiber.memoizedProps.disabled = false;
                            fiber.pendingProps.disabled = false;
                        }
                        
                        fiber.memoizedProps.onClick(clickEvent);
                        console.log(`✅ onClick 실행 완료: ${seatName}`);
                        
                    } catch (error) {
                        console.error('onClick 실행 실패:', error);
                        
                        // 폴백: 정확한 버튼 재검색 후 클릭
                        const fallbackButton = Array.from(document.querySelectorAll('button[data-seatlocno]'))
                            .find(b => b.querySelector('span')?.textContent === seatName);
                        
                        if (fallbackButton) {
                            console.log(`🔄 폴백 클릭: ${seatName}`);
                            fallbackButton.click();
                        }
                    }
                }
                
                // 재활성화 체크 (CGV가 다시 비활성화할 경우 대비)
                setTimeout(() => {
                    if (button.disabled || button.classList.contains('seatMap_seatDisabled__II0B_')) {
                        console.log(`🔄 재활성화: ${seatName}`);
                        enableSeat(button);
                    }
                }, 100);
            }
            // 비활성화된 좌석 클릭 시
            else if (isDOMDisabled || isReactDisabled) {
                e.preventDefault();
                e.stopImmediatePropagation();
                
                console.log(`🔓 비활성화 좌석 클릭: ${seatName}`);
                
                // 좌석 활성화
                enableSeat(button);
                
                // 활성화 후 클릭 재시도
                setTimeout(() => {
                    if (fiber?.memoizedProps?.onClick) {
                        try {
                            const clickEvent = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            });
                            fiber.memoizedProps.onClick(clickEvent);
                        } catch (error) {
                            console.error('재시도 실패:', error);
                        }
                    }
                }, 50);
            }
        }, true); // 캡처 단계
    }

    // 4. DOM 변경 감지 (최적화)
    function setupMutationObserver() {
        let debounceTimer = null;
        
        const observer = new MutationObserver((mutations) => {
            // 디바운싱으로 과도한 처리 방지
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                // 활성화했던 좌석들 재확인
                seatTracker.activatedSeats.forEach(seatName => {
                    // 좌석명으로 버튼 찾기
                    const button = Array.from(document.querySelectorAll('button[data-seatlocno]'))
                        .find(b => b.querySelector('span')?.textContent === seatName);
                    
                    if (button && (button.disabled || button.classList.contains('seatMap_seatDisabled__II0B_'))) {
                        console.log(`🔁 자동 재활성화: ${seatName}`);
                        enableSeat(button);
                    }
                });
            }, 100);
        });
        
        // 좌석 컨테이너 관찰
        const container = document.querySelector('[class*="seatMap"]')?.parentElement || document.body;
        observer.observe(container, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['disabled', 'class']
        });
    }

    // 5. 정기적 체크 (안전장치)
    function setupPeriodicCheck() {
        setInterval(() => {
            // 활성화했던 좌석들이 여전히 활성 상태인지 확인
            seatTracker.activatedSeats.forEach(seatName => {
                const button = Array.from(document.querySelectorAll('button[data-seatlocno]'))
                    .find(b => b.querySelector('span')?.textContent === seatName);
                
                if (button && (button.disabled || button.classList.contains('seatMap_seatDisabled__II0B_'))) {
                    if (!seatTracker.processingSeats.has(seatName)) {
                        console.log(`⏰ 정기 재활성화: ${seatName}`);
                        enableSeat(button);
                    }
                }
            });
        }, 2000);
    }

    // 6. 초기화
    function init() {
        // 페이지 로드 대기
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }
        
        // 약간의 지연 후 시작 (CGV 초기화 대기)
        setTimeout(() => {
            console.log('🚀 스크립트 초기화 시작');
            
            // 초기 활성화
            initialActivation();
            
            // 이벤트 핸들러 설정
            setupClickHandler();
            
            // DOM 감시 설정
            setupMutationObserver();
            
            // 정기 체크 설정
            setupPeriodicCheck();
            
            console.log('✅ 스크립트 초기화 완료');
        }, 1000);
    }

    // 실행
    init();
    
    // 디버깅용 전역 노출
    window.cgvSeatEnablerV2 = {
        tracker: seatTracker,
        enableSeat: enableSeat,
        enableAll: initialActivation,
        getSeatInfo: (seatName) => {
            const button = Array.from(document.querySelectorAll('button[data-seatlocno]'))
                .find(b => b.querySelector('span')?.textContent === seatName);
            
            if (button) {
                return {
                    name: seatName,
                    locNo: button.getAttribute('data-seatlocno'),
                    disabled: button.disabled,
                    classes: button.className,
                    activated: seatTracker.activatedSeats.has(seatName)
                };
            }
            return null;
        }
    };
    
    console.log('💡 디버깅: cgvSeatEnablerV2.getSeatInfo("A1")');
})();