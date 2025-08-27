// ==UserScript==
// @name         CGV Right Content Area Remover
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Remove CGV right content area with dynamic class suffix
// @author       You
// @match        *://www.cgv.co.kr/*
// @match        *://cgv.co.kr/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('🗑️ CGV Right Content Area Remover 시작');

    /**
     * Remove elements with class pattern: mets01390_rightContentArea__*
     * Handles dynamic suffix that can change
     */
    function removeRightContentArea() {
        // Method 1: Using CSS selector with starts-with attribute
        const elements1 = document.querySelectorAll('div[class*="mets01390_rightContentArea__"]');
        
        // Method 2: Using more specific selector for exact match pattern
        const allDivs = document.querySelectorAll('div');
        const elements2 = Array.from(allDivs).filter(div => {
            return div.className.includes('mets01390_rightContentArea__');
        });

        // Combine both methods for maximum coverage
        const allElements = new Set([...elements1, ...elements2]);
        
        let removedCount = 0;
        allElements.forEach(element => {
            console.log(`🎯 Found element with class: ${element.className}`);
            element.remove();
            removedCount++;
        });

        if (removedCount > 0) {
            console.log(`✅ Removed ${removedCount} right content area element(s)`);
        } else {
            console.log('ℹ️ No right content area elements found');
        }

        return removedCount;
    }

    /**
     * React/Next.js 호환 고급 제거 함수 - 여러 전략 사용
     */
    function removeRightContentAreaAdvanced() {
        let removedCount = 0;

        // 전략 1: 직접적인 클래스명 패턴 매칭
        const strategy1Elements = document.querySelectorAll('[class*="mets01390_rightContentArea__"]');
        
        // 전략 2: 모든 div 체크하여 특정 패턴 찾기
        const allDivs = document.querySelectorAll('div');
        const strategy2Elements = [];
        
        allDivs.forEach(div => {
            const classList = div.classList;
            for (let className of classList) {
                if (className.startsWith('mets01390_rightContentArea__')) {
                    strategy2Elements.push(div);
                    break;
                }
            }
        });

        // 전략 3: 정규식을 사용한 클래스 매칭
        const strategy3Elements = [];
        allDivs.forEach(div => {
            const classNames = div.className;
            if (/mets01390_rightContentArea__[a-zA-Z0-9]+/.test(classNames)) {
                strategy3Elements.push(div);
            }
        });

        // 전략 4: 구체적인 클래스명으로 찾기 (현재 알고 있는 클래스)
        const strategy4Elements = document.querySelectorAll('.mets01390_rightContentArea__gfYhZ');

        // 전략 5: 부모 컨테이너에서 찾기
        const strategy5Elements = [];
        const pcPageContainer = document.querySelector('.mets01390_pcPage__Lpbde');
        if (pcPageContainer) {
            const rightAreas = pcPageContainer.querySelectorAll('[class*="rightContentArea"]');
            strategy5Elements.push(...rightAreas);
        }

        // 모든 전략 결과 합치기 및 중복 제거
        const allFoundElements = new Set([
            ...strategy1Elements,
            ...strategy2Elements,
            ...strategy3Elements,
            ...strategy4Elements,
            ...strategy5Elements
        ]);

        allFoundElements.forEach(element => {
            console.log(`🎯 요소 제거 중 - 클래스: ${element.className}`);
            
            // React가 다시 렌더링하지 못하도록 더 강력하게 제거
            try {
                // 1. 스타일로 숨김
                element.style.display = 'none !important';
                element.style.visibility = 'hidden !important';
                element.style.opacity = '0 !important';
                element.style.height = '0 !important';
                element.style.width = '0 !important';
                element.style.overflow = 'hidden !important';
                element.style.position = 'absolute !important';
                element.style.left = '-9999px !important';
                
                // 2. 클래스 제거
                element.className = 'cgv-removed-element';
                
                // 3. 내용 비움
                element.innerHTML = '';
                
                // 4. DOM에서 제거
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
                
                removedCount++;
                console.log(`✅ 요소 제거 완료`);
            } catch (error) {
                console.log(`❌ 요소 제거 실패:`, error);
            }
        });

        if (removedCount > 0) {
            console.log(`🎉 총 ${removedCount}개의 rightContentArea 요소를 제거했습니다`);
        } else {
            console.log(`ℹ️ rightContentArea 요소를 찾을 수 없습니다`);
        }

        return removedCount;
    }

    /**
     * React/Next.js 호환 메인 실행 함수
     */
    function init() {
        console.log('🚀 CGV Right Content Area Remover 초기화 시작');

        // 여러 단계로 DOM 준비 상태 확인
        function executeRemoval() {
            console.log('📍 제거 작업 실행 중...');
            const count = removeRightContentAreaAdvanced();
            
            if (count > 0) {
                console.log(`✨ ${count}개 요소 제거 성공`);
            }
            
            return count;
        }

        // 1단계: 즉시 실행 (이미 로드된 경우)
        executeRemoval();

        // 2단계: DOM 준비 완료 시
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                console.log('📄 DOMContentLoaded - 제거 작업 재실행');
                setTimeout(executeRemoval, 100);
            });
        }

        // 3단계: 페이지 완전 로드 시
        window.addEventListener('load', () => {
            console.log('🌐 Window Load - 제거 작업 재실행');
            setTimeout(executeRemoval, 200);
        });

        // 4단계: React 렌더링 완료 후 (지연 실행)
        setTimeout(() => {
            console.log('⚛️ React 렌더링 후 - 제거 작업 재실행');
            executeRemoval();
        }, 1000);

        // 5단계: Mutation Observer 설정 (동적 콘텐츠 감지)
        const observer = new MutationObserver((mutations) => {
            let shouldCheck = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // 추가된 노드나 자식에서 대상 클래스 확인
                            if (node.className && node.className.includes('mets01390_rightContentArea__')) {
                                shouldCheck = true;
                                console.log('🔍 새로운 rightContentArea 요소 감지됨');
                            } else if (node.querySelector && node.querySelector('[class*="mets01390_rightContentArea__"]')) {
                                shouldCheck = true;
                                console.log('🔍 하위에서 rightContentArea 요소 감지됨');
                            }
                        }
                    });
                }
            });
            
            if (shouldCheck) {
                // React 렌더링 완료를 기다린 후 제거
                setTimeout(executeRemoval, 50);
            }
        });

        // MutationObserver 시작
        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
            });
            console.log('👀 Mutation Observer 시작됨');
        } else {
            // body가 아직 없으면 잠시 후 다시 시도
            setTimeout(() => {
                if (document.body) {
                    observer.observe(document.body, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: ['class']
                    });
                    console.log('👀 Mutation Observer 시작됨 (지연)');
                }
            }, 500);
        }
        
        // 6단계: 주기적 체크 (백업)
        setInterval(() => {
            executeRemoval();
        }, 3000);

        console.log('⏰ 3초마다 주기적 체크 시작됨');
        console.log('🎬 CGV Right Content Area Remover 완전 활성화됨');
    }

    // Expose functions globally for manual use
    window.removeRightContentArea = removeRightContentArea;
    window.removeRightContentAreaAdvanced = removeRightContentAreaAdvanced;

    // Start the script
    init();

})();