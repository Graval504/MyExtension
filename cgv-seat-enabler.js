// ==UserScript==
// @name         CGV 예매 좌석 활성화
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  CGV에서 예매된 좌석을 다시 선택 가능하게 만들기
// @author       You
// @match        *://www.cgv.co.kr/*
// @match        *://ticket.cgv.co.kr/*
// @match        *://cgv.co.kr/*
// @match        https://cgv.co.kr/cnm/selectVisitorCnt*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('🎬 CGV 좌석 활성화 스크립트 시작');

    // 1. 좌석 활성화 함수
    function enableAllSeats() {
        // 비활성화된 버튼형 좌석들 활성화
        const disabledButtons = document.querySelectorAll('button.seatMap_seatDisabled__II0B_');
        
        disabledButtons.forEach(button => {
            // disabled 속성 제거
            button.removeAttribute('disabled');
            
            // 비활성화 클래스 제거
            button.classList.remove('seatMap_seatDisabled__II0B_');
            
            // 시각적 표시를 위해 커스텀 클래스 추가 (선택사항)
            button.classList.add('cgv-reactivated-seat');
            
            // 기존 스타일 속성 보존 (position 관련)
            const originalStyle = button.getAttribute('style');
            if (originalStyle && !originalStyle.includes('opacity')) {
                button.setAttribute('style', originalStyle);
            }
            
            console.log(`✅ 좌석 활성화: ${button.querySelector('span')?.textContent}`);
        });

        // 미니맵 좌석들도 활성화 (span 태그)
        const disabledSpans = document.querySelectorAll('span.seatMainMap_seatDisabled__Wlva3');
        
        disabledSpans.forEach(span => {
            span.classList.remove('seatMainMap_seatDisabled__Wlva3');
            span.classList.add('cgv-reactivated-minimap');
            
            // 기존 스타일 속성 보존
            const originalStyle = span.getAttribute('style');
            if (originalStyle) {
                span.setAttribute('style', originalStyle);
            }
        });

        return {buttons: disabledButtons.length, spans: disabledSpans.length};
    }

    // 2. 이벤트 위임 패턴 인터셉트
    function interceptSeatClicks() {
        // 부모 컨테이너 찾기
        const findContainer = () => {
            return document.querySelector('[class*="seatMap"]')?.parentElement || 
                   document.querySelector('div[class*="seat"]')?.parentElement ||
                   document.body;
        };

        const container = findContainer();
        
        // 클릭된 좌석 추적 (좌석명 기반)
        const clickedSeats = new Map();
        
        // 캡처 단계에서 이벤트 가로채기 (이벤트 위임 우회)
        container.addEventListener('click', function(e) {
            // 실제 클릭된 요소 찾기
            const clickedElement = e.target;
            const button = clickedElement.closest('button[data-seatlocno]');
            
            // 모든 예매된 좌석 처리 (cgv-reactivated-seat 클래스 여부 관계없이)
            if (button && button.getAttribute('data-seatlocno')) {
                const seatName = button.querySelector('span')?.textContent;
                const currentLocNo = button.getAttribute('data-seatlocno');
                
                // 좌석명 기반으로 이전 locNo 추적
                const previousLocNo = clickedSeats.get(seatName);
                if (previousLocNo && previousLocNo !== currentLocNo) {
                    console.log(`🔄 좌석 ID 변경 감지: ${seatName} (${previousLocNo} → ${currentLocNo})`);
                }
                clickedSeats.set(seatName, currentLocNo);
                
                // 좌석이 비활성화되어 있으면 활성화
                if (button.disabled || button.classList.contains('seatMap_seatDisabled__II0B_')) {
                    button.removeAttribute('disabled');
                    button.classList.remove('seatMap_seatDisabled__II0B_');
                    button.classList.add('cgv-reactivated-seat');
                    
                    // 좌석명에 data 속성 추가 (추적용)
                    button.setAttribute('data-seat-name', seatName);
                    console.log('🔄 좌석 재활성화:', seatName);
                }
                
                // cgv-reactivated-seat 클래스가 있는 경우만 특별 처리
                if (button.classList.contains('cgv-reactivated-seat')) {
                    // CGV 그룹 선택 모드 감지
                    const isGroupMode = document.querySelector('.seat-group-selection-active') ||
                                      document.querySelector('[class*="group"][class*="select"]') ||
                                      Array.from(document.querySelectorAll('button[data-seatlocno]'))
                                          .some(b => b.style.outline?.includes('green') || 
                                                   b.style.border?.includes('green'));
                    
                    if (isGroupMode) {
                        console.log('📦 그룹 선택 모드 감지 - 이벤트 전파 허용');
                        // 그룹 모드에서는 stopPropagation 하지 않음
                    } else {
                        e.stopPropagation(); // 일반 모드에서만 버블링 중지
                    }
                    
                    // 좌석 정보 추출 (좌석명 포함)
                    const seatInfo = {
                        locNo: currentLocNo,
                        seatName: seatName,
                        position: {
                            top: button.style.top,
                            left: button.style.left
                        }
                    };
                    
                    console.log('🎯 재활성화된 좌석 클릭:', seatInfo);
                    
                    // 커스텀 좌석 선택 처리
                    handleSeatSelection(button, seatInfo);
                }
            }
        }, true); // true = 캡처 단계에서 실행
        
        // 좌석 추적 정보를 전역으로 노출 (디버깅용)
        window.cgvSeatTracker = clickedSeats;
    }

    // 3. 좌석 선택 처리
    function handleSeatSelection(button, seatInfo) {
        // CGV의 초록색 그룹 박스 체크
        const hasGroupBox = button.closest('.seat-group-box') || 
                           button.querySelector('.seat-group-indicator') ||
                           button.style.outline?.includes('green') ||
                           button.style.border?.includes('green');
        
        if (hasGroupBox) {
            console.log('⚠️ 그룹 좌석 감지 - 특별 처리 필요');
            // 그룹 좌석인 경우 즉시 통합 시도
            attemptCGVIntegration(seatInfo);
            return;
        }
        
        // 선택 상태 토글 (시각적 피드백 제거)
        // button.classList.toggle('seat-selected');
        
        // outline 스타일 제거 (CGV와 충돌 방지)
        // button.style.outline = '';
        
        // 좌석 선택 이벤트 발생 (다른 스크립트와 연동 가능)
        window.dispatchEvent(new CustomEvent('cgvSeatSelected', {
            detail: seatInfo
        }));
        
        // 기존 CGV 시스템과 통합 시도
        attemptCGVIntegration(seatInfo);
    }

    // 4. CGV 시스템과 통합 시도
    function attemptCGVIntegration(seatInfo) {
        // 좌석명으로 정확한 버튼 찾기 (data-seatlocno는 변경될 수 있음)
        let button = document.querySelector(`[data-seatlocno="${seatInfo.locNo}"]`);
        
        // data-seatlocno가 변경된 경우 좌석명으로 재검색
        if (!button || button.querySelector('span')?.textContent !== seatInfo.seatName) {
            console.log('⚠️ 좌석 ID 변경 감지, 좌석명으로 재검색:', seatInfo.seatName);
            button = Array.from(document.querySelectorAll('button[data-seatlocno]'))
                .find(b => b.querySelector('span')?.textContent === seatInfo.seatName);
            
            if (button) {
                // 새로운 locNo 업데이트
                seatInfo.locNo = button.getAttribute('data-seatlocno');
                console.log('✅ 새 좌석 ID 발견:', seatInfo.locNo);
            }
        }
        
        if (!button) {
            console.error('❌ 좌석을 찾을 수 없음:', seatInfo.seatName);
            return;
        }
        
        // React 컴포넌트 처리
        const reactKey = Object.keys(button).find(key => key.startsWith('__react'));
        
        if (reactKey) {
            console.log('⚛️ React 컴포넌트 감지 - 고급 통합 시도');
            
            // 1. React Fiber 노드 접근
            const fiber = button[reactKey];
            console.log('Fiber node:', fiber);
            
            // 2. onClick 핸들러 직접 찾기
            let currentFiber = fiber;
            while (currentFiber) {
                if (currentFiber.memoizedProps?.onClick) {
                    console.log('✅ onClick 핸들러 발견!');
                    console.log('Props 상태:', currentFiber.memoizedProps);
                    
                    // disabled 속성 우회
                    if (currentFiber.memoizedProps.disabled) {
                        console.log('🔓 disabled 속성 우회 중...');
                        
                        // props 복사 및 수정
                        const originalProps = currentFiber.memoizedProps;
                        const modifiedProps = { ...originalProps, disabled: false };
                        
                        // 임시로 props 변경
                        currentFiber.memoizedProps = modifiedProps;
                        currentFiber.pendingProps = modifiedProps;
                    }
                    
                    try {
                        // 실제 클릭 이벤트 생성
                        const clickEvent = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            clientX: button.getBoundingClientRect().left + 10,
                            clientY: button.getBoundingClientRect().top + 10,
                            buttons: 1,
                            button: 0
                        });
                        
                        // React SyntheticEvent 속성 추가
                        clickEvent.persist = () => {};
                        clickEvent.isPropagationStopped = () => false;
                        clickEvent.isDefaultPrevented = () => false;
                        
                        // target 속성 설정
                        Object.defineProperty(clickEvent, 'target', {
                            value: button,
                            enumerable: true
                        });
                        
                        Object.defineProperty(clickEvent, 'currentTarget', {
                            value: button,
                            enumerable: true
                        });
                        
                        // onClick 핸들러 직접 호출
                        console.log('🚀 onClick 핸들러 실행 중...');
                        const result = currentFiber.memoizedProps.onClick(clickEvent);
                        console.log('실행 결과:', result);
                        
                        // 상위 컴포넌트 상태 업데이트 트리거
                        if (currentFiber.return?.memoizedProps?.onSeatClick) {
                            console.log('🎯 상위 컴포넌트 onSeatClick 발견!');
                            currentFiber.return.memoizedProps.onSeatClick(seatInfo.locNo);
                        }
                        
                        return;
                    } catch (e) {
                        console.error('onClick 실행 실패:', e);
                        console.error('에러 스택:', e.stack);
                    }
                }
                currentFiber = currentFiber.return || currentFiber.alternate;
            }
            
            // 3. React 이벤트 풀 우회
            const internalKey = Object.keys(button).find(key => 
                key.startsWith('__reactInternalInstance') || 
                key.startsWith('__reactFiber')
            );
            
            if (internalKey) {
                const instance = button[internalKey];
                
                // 상태 업데이트 시도
                if (instance.memoizedState) {
                    console.log('현재 상태:', instance.memoizedState);
                }
                
                // 부모 컴포넌트의 메서드 찾기
                let parent = instance.return;
                while (parent) {
                    if (parent.memoizedProps) {
                        const props = parent.memoizedProps;
                        // 좌석 선택 관련 메서드 찾기
                        const methods = ['onSeatClick', 'handleSeatSelection', 'selectSeat', 'onSelect'];
                        for (let method of methods) {
                            if (typeof props[method] === 'function') {
                                console.log(`📍 메서드 발견: ${method}`);
                                try {
                                    props[method](seatInfo.locNo);
                                    return;
                                } catch (e) {
                                    console.error(`${method} 실행 실패:`, e);
                                }
                            }
                        }
                    }
                    parent = parent.return;
                }
            }
            
            // 4. 합성 이벤트 시뮬레이션
            console.log('💫 합성 이벤트 시뮬레이션 시도');
            
            // 모든 가능한 이벤트 타입 시도
            const eventTypes = ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'];
            
            for (let eventType of eventTypes) {
                const event = new MouseEvent(eventType, {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    buttons: 1
                });
                
                // React의 이벤트 속성 추가
                Object.defineProperty(event, 'nativeEvent', {
                    value: event
                });
                
                button.dispatchEvent(event);
            }
            
            // 5. 활성 좌석의 동작 복제
            setTimeout(() => {
                const activeSeat = document.querySelector('.seatMap_seatNormal__SojfU:not(.seatMap_seatDisabled__II0B_):not(.cgv-reactivated-seat)');
                if (activeSeat) {
                    console.log('🎭 활성 좌석 동작 복제');
                    
                    // 활성 좌석의 이벤트 리스너 복사
                    const activeReactKey = Object.keys(activeSeat).find(key => key.startsWith('__react'));
                    if (activeReactKey) {
                        const activeFiber = activeSeat[activeReactKey];
                        if (activeFiber?.memoizedProps?.onClick) {
                            console.log('활성 좌석 onClick 발견, 적용 시도');
                            
                            // 재활성화된 좌석에 동일한 핸들러 적용
                            button.onclick = function(e) {
                                // 좌석 정보 변경
                                e.target = button;
                                e.currentTarget = button;
                                activeFiber.memoizedProps.onClick(e);
                            };
                            
                            // 즉시 클릭 시뮬레이션
                            button.click();
                        }
                    }
                }
            }, 100);
        }
        
        // 6. 전역 함수 찾기 (폴백)
        const possibleHandlers = [
            'selectSeat', 'onSeatClick', 'handleSeatSelection',
            'seatClick', 'chooseSeat', 'toggleSeat'
        ];
        
        for (let handler of possibleHandlers) {
            if (typeof window[handler] === 'function') {
                console.log(`🔗 전역 핸들러 발견: ${handler}`);
                try {
                    window[handler](seatInfo.locNo);
                } catch(e) {
                    console.warn(`핸들러 실행 실패: ${e.message}`);
                }
            }
        }
    }

    // 5. DOM 변경 감지 및 자동 재활성화
    function setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'attributes') {
                    const button = mutation.target;
                    
                    // 버튼이 다시 비활성화되면 즉시 재활성화
                    if (button.tagName === 'BUTTON' && button.getAttribute('data-seatlocno')) {
                        if (button.disabled || button.classList.contains('seatMap_seatDisabled__II0B_')) {
                            // React Fiber 상태도 함께 업데이트
                            const reactKey = Object.keys(button).find(key => key.startsWith('__react'));
                            if (reactKey) {
                                const fiber = button[reactKey];
                                if (fiber?.memoizedProps) {
                                    fiber.memoizedProps.disabled = false;
                                    fiber.pendingProps.disabled = false;
                                }
                            }
                            
                            button.removeAttribute('disabled');
                            button.classList.remove('seatMap_seatDisabled__II0B_');
                            button.classList.add('cgv-reactivated-seat');
                            console.log('🔁 자동 재활성화:', button.querySelector('span')?.textContent);
                        }
                    }
                }
            });
        });
        
        // 좌석 컨테이너 관찰
        const container = document.querySelector('[class*="seatMap"]')?.parentElement;
        if (container) {
            observer.observe(container, {
                attributes: true,
                subtree: true,
                attributeFilter: ['disabled', 'class']
            });
        }
    }

    // 6. 스타일 주입 (선택적) - 최소한의 스타일만 적용
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* 최소한의 스타일만 적용 - CGV 레이아웃 보존 */
            .cgv-reactivated-seat {
                opacity: 1 !important;
                cursor: pointer !important;
                filter: none !important;
                /* position, z-index 제거 - 레이아웃 깨짐 방지 */
            }
            
            /* 미니맵 투명도만 조정 */
            .cgv-reactivated-minimap {
                opacity: 0.8 !important;
            }
        `;
        document.head.appendChild(style);
    }

    // 7. 초기화
    function init() {
        // 페이지 로드 완료 대기
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }
        
        // 스타일 주입
        injectStyles();
        
        // 초기 활성화
        const result = enableAllSeats();
        console.log(`📊 활성화 결과: 버튼 ${result.buttons}개, 미니맵 ${result.spans}개`);
        
        // 이벤트 인터셉터 설정
        interceptSeatClicks();
        
        // DOM 감시자 설정
        setupMutationObserver();
        
        // 주기적 재활성화 (페이지가 동적으로 좌석을 비활성화하는 경우)
        setInterval(() => {
            enableAllSeats();
        }, 2000);
    }

    // 실행
    init();
    
    // 디버깅용 전역 함수 노출
    window.cgvSeatEnabler = {
        enableAll: enableAllSeats,
        getDisabledSeats: () => document.querySelectorAll('.seatMap_seatDisabled__II0B_'),
        getSelectedSeats: () => document.querySelectorAll('.seat-selected'),
        debugSeat: (seatName) => {
            const button = Array.from(document.querySelectorAll('button[data-seatlocno]'))
                .find(b => b.textContent.includes(seatName));
            if (button) {
                const reactKey = Object.keys(button).find(k => k.startsWith('__react'));
                const fiber = button[reactKey];
                console.log('Button:', button);
                console.log('Fiber:', fiber);
                console.log('Props:', fiber?.memoizedProps);
                console.log('onClick:', fiber?.memoizedProps?.onClick);
                
                // disabled false로 테스트
                if (fiber?.memoizedProps?.onClick) {
                    const testEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    });
                    
                    // disabled를 false로 변경하고 실행
                    const originalDisabled = fiber.memoizedProps.disabled;
                    fiber.memoizedProps.disabled = false;
                    
                    try {
                        console.log('테스트 클릭 실행...');
                        fiber.memoizedProps.onClick(testEvent);
                    } catch (e) {
                        console.error('테스트 실패:', e);
                    }
                    
                    // 원래 값으로 복원
                    fiber.memoizedProps.disabled = originalDisabled;
                }
            }
            return button;
        }
    };
    
    console.log('💡 팁: console에서 cgvSeatEnabler.enableAll() 실행 가능');

})();