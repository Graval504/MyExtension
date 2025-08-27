// ==UserScript==
// @name         CGV 예매 좌석 활성화 ULTIMATE
// @namespace    http://tampermonkey.net/
// @version      ULTIMATE
// @description  CGV 좌석 활성화 - 브라우저 레벨 가로채기 방식
// @author       You
// @match        *://www.cgv.co.kr/*
// @match        *://ticket.cgv.co.kr/*
// @match        *://cgv.co.kr/*
// @match        https://cgv.co.kr/cnm/selectVisitorCnt*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('🎬 CGV 좌석 활성화 ULTIMATE 시작');

    // 전략: React를 건드리지 않고 브라우저 이벤트만 조작
    
    const state = {
        seatElements: new Map(),  // 좌석명 -> 실제 DOM 요소
        initialized: false,
        clicking: false
    };

    // 1. 좌석 DOM 요소 수집 (React 건드리지 않음)
    function collectSeats() {
        const buttons = document.querySelectorAll('button[data-seatlocno]');
        let count = 0;
        
        buttons.forEach(button => {
            const seatName = button.querySelector('span')?.textContent;
            if (seatName) {
                state.seatElements.set(seatName, button);
                count++;
            }
        });
        
        console.log(`📊 좌석 수집: ${count}개`);
        return count;
    }

    // 2. disabled 속성만 제거 (React props 건드리지 않음)
    function enableSeatsVisually() {
        const disabledButtons = document.querySelectorAll('button[disabled][data-seatlocno], button.seatMap_seatDisabled__II0B_');
        let count = 0;
        
        disabledButtons.forEach(button => {
            button.removeAttribute('disabled');
            button.classList.remove('seatMap_seatDisabled__II0B_');
            count++;
        });
        
        if (count > 0) {
            console.log(`🔓 시각적 활성화: ${count}개`);
        }
        return count;
    }

    // 3. 클릭 가로채기 - 브라우저 레벨 (최상위)
    function interceptClicks() {
        // 캡처 단계에서 모든 클릭 가로채기
        document.addEventListener('click', function(e) {
            const button = e.target.closest('button[data-seatlocno]');
            if (!button) return;
            
            const seatName = button.querySelector('span')?.textContent;
            if (!seatName) return;
            
            // 원래 비활성화된 좌석인지 확인
            const wasDisabled = button.hasAttribute('data-was-disabled') || 
                              button.classList.contains('cgv-was-disabled');
            
            if (!wasDisabled) {
                // 원래 활성 좌석은 그대로 통과
                return;
            }
            
            // 비활성화된 좌석 클릭 처리
            console.log(`🎯 비활성화 좌석 클릭 감지: ${seatName}`);
            
            if (state.clicking) {
                console.log('⏳ 이미 처리 중...');
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }
            
            state.clicking = true;
            
            // 원본 이벤트 완전 차단
            e.preventDefault();
            e.stopImmediatePropagation();
            
            // 좌석이 실제로 선택 가능한지 확인 (중요!)
            if (button.disabled) {
                console.log(`❌ 좌석이 여전히 비활성화됨: ${seatName}`);
                state.clicking = false;
                return;
            }
            
            // 활성 좌석의 클릭을 시뮬레이션
            simulateActiveClick(button, seatName, e);
            
        }, true); // true = 캡처 단계 (최우선)
    }

    // 4. 활성 좌석 클릭 시뮬레이션
    function simulateActiveClick(button, seatName, originalEvent) {
        console.log(`🎭 활성 좌석 클릭 시뮬레이션: ${seatName}`);
        
        try {
            // 방법 1: React Fiber를 통한 onClick 실행
            const reactKey = Object.keys(button).find(key => key.startsWith('__react'));
            if (reactKey) {
                const fiber = button[reactKey];
                if (fiber?.memoizedProps?.onClick) {
                    console.log(`⚛️ React onClick 발견, 직접 실행`);
                    
                    // 이벤트 객체 생성
                    const clickEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: originalEvent.clientX,
                        clientY: originalEvent.clientY
                    });
                    
                    // 타겟 설정
                    Object.defineProperty(clickEvent, 'target', { value: button });
                    Object.defineProperty(clickEvent, 'currentTarget', { value: button });
                    
                    // React props 상태 확인 및 수정
                    if (fiber.memoizedProps.disabled) {
                        console.log(`🔧 React disabled 해제: ${seatName}`);
                        fiber.memoizedProps.disabled = false;
                    }
                    
                    // onClick 실행
                    fiber.memoizedProps.onClick(clickEvent);
                    console.log(`✅ React onClick 실행 성공: ${seatName}`);
                    return; // 성공 시 바로 종료
                }
            }
            
            // 방법 2: 활성 좌석과 비교하여 React 핸들러 복사
            const activeButton = document.querySelector('button[data-seatlocno]:not([disabled]):not(.seatMap_seatDisabled__II0B_):not([data-was-disabled])');
            if (activeButton) {
                const activeReactKey = Object.keys(activeButton).find(key => key.startsWith('__react'));
                if (activeReactKey) {
                    const activeFiber = activeButton[activeReactKey];
                    if (activeFiber?.memoizedProps?.onClick) {
                        console.log(`📋 활성 좌석 React 핸들러 복사: ${seatName}`);
                        
                        const clickEvent = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            clientX: originalEvent.clientX,
                            clientY: originalEvent.clientY
                        });
                        
                        Object.defineProperty(clickEvent, 'target', { value: button });
                        Object.defineProperty(clickEvent, 'currentTarget', { value: button });
                        
                        // 활성 좌석의 onClick을 우리 버튼에 적용
                        activeFiber.memoizedProps.onClick.call(button, clickEvent);
                        console.log(`✅ 활성 좌석 핸들러 실행 성공: ${seatName}`);
                        return;
                    }
                }
            }
            
            // 방법 3: 네이티브 클릭 이벤트 발생
            console.log(`🚀 네이티브 클릭 시도: ${seatName}`);
            const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: originalEvent.clientX,
                clientY: originalEvent.clientY
            });
            
            button.dispatchEvent(clickEvent);
            
            // 방법 4: 폴백 - 직접 클릭 (지연)
            setTimeout(() => {
                if (button && !button.disabled) {
                    console.log(`🔄 직접 클릭 폴백: ${seatName}`);
                    button.click();
                }
            }, 100);
            
        } catch (error) {
            console.error('클릭 시뮬레이션 실패:', error);
        } finally {
            // 처리 완료
            setTimeout(() => {
                state.clicking = false;
                console.log(`✅ 클릭 처리 완료: ${seatName}`);
            }, 300);
        }
    }

    // 5. full-modal-content 너비 확장 스타일 주입
    function injectModalWidthStyles(customWidth = null) {
        const existingStyle = document.getElementById('cgv-modal-width-enhancer');
        if (existingStyle) {
            existingStyle.remove();
        }

        const style = document.createElement('style');
        style.id = 'cgv-modal-width-enhancer';
        
        // 기본값: 100vw로 설정 (전체 화면 너비)
        const width = customWidth || '100vw';
        
        style.textContent = `
            /* CGV 좌석 선택 모달 콘텐츠 너비 확장 및 왼쪽 정렬 */
            .full-modal-content {
                max-width: ${width} !important;
                width: ${width} !important;
                margin: 0 !important;
                margin-left: 0 !important;
                padding: 0 !important;
                position: relative !important;
                left: 0 !important;
                transform: none !important;
            }
            
            /* 모달 컨테이너 왼쪽 정렬 */
            .full-modal-container {
                max-width: ${width} !important;
                width: ${width} !important;
                margin: 0 !important;
                margin-left: 0 !important;
                padding: 0 !important;
                position: relative !important;
                left: 0 !important;
                transform: none !important;
            }
            
            /* l-center 컨테이너 왼쪽 정렬 */
            .full-modal-container .l-center {
                max-width: ${width} !important;
                width: ${width} !important;
                margin: 0 !important;
                margin-left: 0 !important;
                padding: 0 !important;
                position: relative !important;
                left: 0 !important;
                transform: none !important;
            }
            
            /* CGV 모달 전체 왼쪽 정렬 */
            .cgv-modal .full-modal-container {
                justify-content: flex-start !important;
                align-items: flex-start !important;
                text-align: left !important;
            }
            
            /* 좌석맵 관련 컨테이너 너비 확장 */
            .seatMap_container__JuJ3A,
            .seatMap_seatWrap__7MnUS,
            .seatMap_seatInfoWrap__bBHC4 {
                max-width: none !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 10px !important;
            }
            
            /* 좌석 선택 영역 확장 */
            .cnms01540_container__jc9ml,
            .cnms01540_seatChoiceArea__SqCrl {
                max-width: none !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            
            /* 좌석 위치 래퍼 고정 위치 유지 */
            .seatMap_seatPositionWrap__v5y_3 {
                position: relative !important;
                top: 0 !important;
                transform: none !important;
                margin-top: 0 !important;
                padding-top: 38px !important;
            }
            
            /* 반응형 대응 */
            @media (max-width: 768px) {
                .full-modal-content,
                .full-modal-container,
                .full-modal-container .l-center {
                    max-width: 100vw !important;
                    width: 100vw !important;
                    margin: 0 !important;
                    margin-left: 0 !important;
                }
            }
        `;
        
        document.head.appendChild(style);
        console.log(`📐 full-modal-content 너비 설정 및 왼쪽 정렬: ${width}`);
        return width;
    }

    // 6. 비활성화된 좌석 마킹
    function markDisabledSeats() {
        const disabledButtons = document.querySelectorAll('button[disabled][data-seatlocno], button.seatMap_seatDisabled__II0B_');
        
        disabledButtons.forEach(button => {
            button.setAttribute('data-was-disabled', 'true');
            button.classList.add('cgv-was-disabled');
        });
        
        console.log(`🏷️ 비활성화 좌석 마킹: ${disabledButtons.length}개`);
    }

    // 6. 주기적 좌석 체크 및 활성화
    function setupPeriodicCheck() {
        setInterval(() => {
            if (state.clicking) return;
            
            // 새로 나타난 비활성화 좌석 처리
            markDisabledSeats();
            const activated = enableSeatsVisually();
            
            // 좌석 매핑 업데이트
            if (activated > 0) {
                collectSeats();
            }
            
        }, 1000); // 1초마다 체크
    }

    // 7. 초기화
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }
        
        setTimeout(() => {
            console.log('🚀 ULTIMATE 버전 초기화');
            
            // full-modal-content 너비 확장 적용
            injectModalWidthStyles();
            
            // 초기 설정
            markDisabledSeats();
            enableSeatsVisually();
            collectSeats();
            
            // 클릭 가로채기 설정
            interceptClicks();
            
            // 주기적 체크 시작
            setupPeriodicCheck();
            
            state.initialized = true;
            console.log('✅ ULTIMATE 버전 초기화 완료');
            
        }, 1500);
    }

    // 8. 디버깅 인터페이스
    window.cgvUltimate = {
        state,
        testClick: (seatName) => {
            const button = state.seatElements.get(seatName);
            if (button) {
                console.log(`🧪 테스트 클릭: ${seatName}`);
                const event = new MouseEvent('click', { bubbles: true, cancelable: true });
                button.dispatchEvent(event);
            } else {
                console.error('좌석을 찾을 수 없음:', seatName);
            }
        },
        refresh: () => {
            markDisabledSeats();
            enableSeatsVisually();
            collectSeats();
            console.log('🔄 새로고침 완료');
        },
        getSeats: () => Array.from(state.seatElements.keys()),
        getSeat: (name) => state.seatElements.get(name),
        
        // 모달 너비 조정 관련 함수들
        setModalWidth: (width) => {
            console.log(`📐 full-modal-content 너비 변경 및 왼쪽 정렬: ${width}`);
            return injectModalWidthStyles(width);
        },
        resetModalWidth: () => {
            console.log('📐 full-modal-content 너비 초기화 및 왼쪽 정렬');
            return injectModalWidthStyles('100vw');
        },
        getModalWidthPresets: () => ({
            compact: '80vw',
            normal: '90vw', 
            wide: '95vw',
            ultrawide: '98vw',
            fullwidth: '100vw'
        }),
        applyModalPreset: (preset) => {
            const presets = window.cgvUltimate.getModalWidthPresets();
            if (presets[preset]) {
                console.log(`📐 모달 프리셋 적용: ${preset} (${presets[preset]})`);
                return injectModalWidthStyles(presets[preset]);
            } else {
                console.error('잘못된 프리셋:', preset, '사용 가능한 프리셋:', Object.keys(presets));
            }
        },
        
        // 레거시 호환성을 위한 별칭
        setWidth: (width) => window.cgvUltimate.setModalWidth(width),
        resetWidth: () => window.cgvUltimate.resetModalWidth(),
        getWidthPresets: () => window.cgvUltimate.getModalWidthPresets(),
        applyPreset: (preset) => window.cgvUltimate.applyModalPreset(preset)
    };

    // 실행
    init();
    
    // ============================================================================
    // 엘리먼트 제거 모듈 (Element Removal Module)
    // 메인 좌석 활성화 기능과 독립적으로 작동
    // ============================================================================
    
    const elementRemovalState = {
        enabled: false,
        observer: null,
        stats: {
            removed: 0,
            lastRemoved: null
        },
        targetClasses: new Set(['mets01390_rightContentArea__gfYhZ']) // 기본 타겟
    };

    // 원하지 않는 엘리먼트 즉시 제거
    function removeUnwantedElements() {
        let removedCount = 0;
        
        elementRemovalState.targetClasses.forEach(className => {
            const elements = document.querySelectorAll(`.${className}`);
            elements.forEach(element => {
                if (element && element.parentNode) {
                    console.log(`🗑️ 엘리먼트 제거: .${className}`, element);
                    element.remove();
                    removedCount++;
                    elementRemovalState.stats.removed++;
                    elementRemovalState.stats.lastRemoved = {
                        className: className,
                        timestamp: new Date().toISOString(),
                        tagName: element.tagName,
                        innerHTML: element.innerHTML?.substring(0, 100) + '...'
                    };
                }
            });
        });
        
        if (removedCount > 0) {
            console.log(`🗑️ 총 ${removedCount}개 엘리먼트 제거됨`);
        }
        
        return removedCount;
    }

    // 동적으로 추가되는 엘리먼트 감지 및 제거
    function setupElementRemovalObserver() {
        if (elementRemovalState.observer) {
            elementRemovalState.observer.disconnect();
        }

        elementRemovalState.observer = new MutationObserver((mutations) => {
            if (!elementRemovalState.enabled) return;
            
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // 추가된 노드가 타겟 클래스를 가지고 있는지 확인
                            elementRemovalState.targetClasses.forEach(className => {
                                if (node.classList && node.classList.contains(className)) {
                                    console.log(`🎯 동적 추가된 타겟 엘리먼트 감지: .${className}`, node);
                                    node.remove();
                                    elementRemovalState.stats.removed++;
                                    elementRemovalState.stats.lastRemoved = {
                                        className: className,
                                        timestamp: new Date().toISOString(),
                                        tagName: node.tagName,
                                        innerHTML: node.innerHTML?.substring(0, 100) + '...',
                                        dynamic: true
                                    };
                                }
                                
                                // 자식 엘리먼트 중에 타겟이 있는지도 확인
                                const childTargets = node.querySelectorAll ? node.querySelectorAll(`.${className}`) : [];
                                childTargets.forEach(childTarget => {
                                    console.log(`🎯 동적 추가된 자식 타겟 엘리먼트 감지: .${className}`, childTarget);
                                    childTarget.remove();
                                    elementRemovalState.stats.removed++;
                                    elementRemovalState.stats.lastRemoved = {
                                        className: className,
                                        timestamp: new Date().toISOString(),
                                        tagName: childTarget.tagName,
                                        innerHTML: childTarget.innerHTML?.substring(0, 100) + '...',
                                        dynamic: true
                                    };
                                });
                            });
                        }
                    });
                }
            });
        });

        // 문서 전체를 감시
        elementRemovalState.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('👁️ 엘리먼트 제거 감시자 설정 완료');
    }

    // 엘리먼트 제거 기능 시작
    function startElementRemoval() {
        if (elementRemovalState.enabled) {
            console.log('⚠️ 엘리먼트 제거 기능이 이미 활성화됨');
            return;
        }
        
        elementRemovalState.enabled = true;
        console.log('🚀 엘리먼트 제거 기능 시작');
        console.log('🎯 제거 대상 클래스:', Array.from(elementRemovalState.targetClasses));
        
        // 즉시 제거
        removeUnwantedElements();
        
        // 동적 감시 시작
        setupElementRemovalObserver();
        
        // 주기적 체크 (보험용)
        elementRemovalState.checkInterval = setInterval(() => {
            if (elementRemovalState.enabled) {
                removeUnwantedElements();
            }
        }, 3000); // 3초마다
        
        console.log('✅ 엘리먼트 제거 기능 활성화 완료');
    }

    // 엘리먼트 제거 기능 중지
    function stopElementRemoval() {
        if (!elementRemovalState.enabled) {
            console.log('⚠️ 엘리먼트 제거 기능이 이미 비활성화됨');
            return;
        }
        
        elementRemovalState.enabled = false;
        
        if (elementRemovalState.observer) {
            elementRemovalState.observer.disconnect();
            elementRemovalState.observer = null;
        }
        
        if (elementRemovalState.checkInterval) {
            clearInterval(elementRemovalState.checkInterval);
            elementRemovalState.checkInterval = null;
        }
        
        console.log('🛑 엘리먼트 제거 기능 중지');
    }

    // 제거 대상 클래스 추가
    function addTargetClass(className) {
        if (!className || typeof className !== 'string') {
            console.error('❌ 유효하지 않은 클래스명:', className);
            return false;
        }
        
        elementRemovalState.targetClasses.add(className);
        console.log(`➕ 제거 대상 클래스 추가: ${className}`);
        console.log('🎯 현재 대상 클래스:', Array.from(elementRemovalState.targetClasses));
        
        // 활성화된 상태라면 즉시 제거 시도
        if (elementRemovalState.enabled) {
            const elements = document.querySelectorAll(`.${className}`);
            elements.forEach(element => {
                if (element && element.parentNode) {
                    console.log(`🗑️ 새 타겟 즉시 제거: .${className}`, element);
                    element.remove();
                    elementRemovalState.stats.removed++;
                }
            });
        }
        
        return true;
    }

    // 제거 대상 클래스 제거
    function removeTargetClass(className) {
        if (elementRemovalState.targetClasses.has(className)) {
            elementRemovalState.targetClasses.delete(className);
            console.log(`➖ 제거 대상 클래스 삭제: ${className}`);
            console.log('🎯 현재 대상 클래스:', Array.from(elementRemovalState.targetClasses));
            return true;
        } else {
            console.log(`⚠️ 제거할 클래스를 찾을 수 없음: ${className}`);
            return false;
        }
    }

    // ============================================================================
    // 기존 디버깅 인터페이스 확장
    // ============================================================================
    
    // 8. 디버깅 인터페이스 (엘리먼트 제거 기능 추가)
    window.cgvUltimate = {
        state,
        testClick: (seatName) => {
            const button = state.seatElements.get(seatName);
            if (button) {
                console.log(`🧪 테스트 클릭: ${seatName}`);
                const event = new MouseEvent('click', { bubbles: true, cancelable: true });
                button.dispatchEvent(event);
            } else {
                console.error('좌석을 찾을 수 없음:', seatName);
            }
        },
        refresh: () => {
            markDisabledSeats();
            enableSeatsVisually();
            collectSeats();
            console.log('🔄 새로고침 완료');
        },
        getSeats: () => Array.from(state.seatElements.keys()),
        getSeat: (name) => state.seatElements.get(name),
        
        // 모달 너비 조정 관련 함수들
        setModalWidth: (width) => {
            console.log(`📐 full-modal-content 너비 변경 및 왼쪽 정렬: ${width}`);
            return injectModalWidthStyles(width);
        },
        resetModalWidth: () => {
            console.log('📐 full-modal-content 너비 초기화 및 왼쪽 정렬');
            return injectModalWidthStyles('100vw');
        },
        getModalWidthPresets: () => ({
            compact: '80vw',
            normal: '90vw', 
            wide: '95vw',
            ultrawide: '98vw',
            fullwidth: '100vw'
        }),
        applyModalPreset: (preset) => {
            const presets = window.cgvUltimate.getModalWidthPresets();
            if (presets[preset]) {
                console.log(`📐 모달 프리셋 적용: ${preset} (${presets[preset]})`);
                return injectModalWidthStyles(presets[preset]);
            } else {
                console.error('잘못된 프리셋:', preset, '사용 가능한 프리셋:', Object.keys(presets));
            }
        },
        
        // 레거시 호환성을 위한 별칭
        setWidth: (width) => window.cgvUltimate.setModalWidth(width),
        resetWidth: () => window.cgvUltimate.resetModalWidth(),
        getWidthPresets: () => window.cgvUltimate.getModalWidthPresets(),
        applyPreset: (preset) => window.cgvUltimate.applyModalPreset(preset),
        
        // ============================================================================
        // 엘리먼트 제거 관련 함수들 (새로 추가)
        // ============================================================================
        removeElements: {
            // 제거 기능 시작/중지
            start: () => startElementRemoval(),
            stop: () => stopElementRemoval(),
            
            // 즉시 제거 실행
            removeNow: () => removeUnwantedElements(),
            
            // 대상 클래스 관리
            addTarget: (className) => addTargetClass(className),
            removeTarget: (className) => removeTargetClass(className),
            getTargets: () => Array.from(elementRemovalState.targetClasses),
            clearTargets: () => {
                elementRemovalState.targetClasses.clear();
                console.log('🗑️ 모든 제거 대상 클래스 삭제됨');
            },
            
            // 상태 및 통계
            isEnabled: () => elementRemovalState.enabled,
            getStats: () => ({
                enabled: elementRemovalState.enabled,
                totalRemoved: elementRemovalState.stats.removed,
                lastRemoved: elementRemovalState.stats.lastRemoved,
                targetClasses: Array.from(elementRemovalState.targetClasses),
                hasObserver: !!elementRemovalState.observer
            }),
            
            // 설정 초기화
            reset: () => {
                stopElementRemoval();
                elementRemovalState.stats.removed = 0;
                elementRemovalState.stats.lastRemoved = null;
                elementRemovalState.targetClasses.clear();
                elementRemovalState.targetClasses.add('mets01390_rightContentArea__gfYhZ');
                console.log('🔄 엘리먼트 제거 모듈 초기화 완료');
            },
            
            // 헬프
            help: () => {
                console.log(`
🗑️ 엘리먼트 제거 모듈 사용법:

기본 사용:
  cgvUltimate.removeElements.start()     - 제거 기능 시작 (자동 감시)
  cgvUltimate.removeElements.stop()      - 제거 기능 중지
  cgvUltimate.removeElements.removeNow() - 즉시 제거 실행

대상 관리:
  cgvUltimate.removeElements.addTarget('클래스명')     - 제거 대상 추가
  cgvUltimate.removeElements.removeTarget('클래스명')  - 제거 대상 삭제
  cgvUltimate.removeElements.getTargets()             - 현재 대상 목록
  cgvUltimate.removeElements.clearTargets()           - 모든 대상 삭제

상태 확인:
  cgvUltimate.removeElements.isEnabled()  - 활성화 상태
  cgvUltimate.removeElements.getStats()   - 통계 정보
  cgvUltimate.removeElements.reset()      - 모듈 초기화

예시:
  cgvUltimate.removeElements.addTarget('my-unwanted-class')
  cgvUltimate.removeElements.start()
                `);
            }
        }
    };
    
    // ============================================================================
    // 초기화 시 엘리먼트 제거 기능도 준비
    // ============================================================================
    
    // 기존 init 함수 실행 후 엘리먼트 제거 모듈 준비
    setTimeout(() => {
        console.log('🗑️ 엘리먼트 제거 모듈 준비 완료');
        console.log('💡 사용법: cgvUltimate.removeElements.help()');
        
        // 자동으로 엘리먼트 제거 기능 시작
        console.log('🚀 엘리먼트 제거 기능 자동 시작');
        startElementRemoval();
    }, 2000);

    // 실행
    init();
    
    console.log('💡 디버깅: cgvUltimate.testClick("J21")');
    console.log('📐 모달 너비 조정 및 왼쪽 정렬: cgvUltimate.setModalWidth("98vw")');
    console.log('📐 모달 프리셋 적용: cgvUltimate.applyModalPreset("ultrawide")');
    console.log('📐 기존 함수도 호환: cgvUltimate.setWidth("98vw")');
    console.log('🗑️ 엘리먼트 제거: cgvUltimate.removeElements.start()');

})();