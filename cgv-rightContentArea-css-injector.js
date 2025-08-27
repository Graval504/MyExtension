// ==UserScript==
// @name         CGV Right Content Area CSS Injector
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  CSS 주입으로 CGV right content area 제거 (더 강력함)
// @author       You
// @match        *://www.cgv.co.kr/*
// @match        *://cgv.co.kr/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('🎨 CGV Right Content Area CSS Injector 시작');

    /**
     * CSS 스타일을 주입하여 rightContentArea 숨김
     * React가 다시 렌더링해도 CSS는 계속 적용됨
     */
    function injectRemovalCSS() {
        // 이미 주입되었는지 확인
        if (document.getElementById('cgv-rightContentArea-remover-css')) {
            console.log('ℹ️ CSS 이미 주입됨');
            return;
        }

        const css = `
            /* CGV Right Content Area 제거 CSS */
            
            /* 메인 타겟: mets01390_rightContentArea__* 패턴 */
            div[class*="mets01390_rightContentArea__"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                width: 0 !important;
                max-height: 0 !important;
                max-width: 0 !important;
                min-height: 0 !important;
                min-width: 0 !important;
                overflow: hidden !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
                z-index: -1 !important;
                pointer-events: none !important;
                transform: scale(0) !important;
            }

            /* 추가 보안: 구체적인 클래스명 */
            .mets01390_rightContentArea__gfYhZ {
                display: none !important;
            }

            /* 부모 컨테이너에서 rightContentArea 찾기 */
            .mets01390_pcPage__Lpbde div[class*="rightContentArea"] {
                display: none !important;
            }

            /* 더 넓은 범위로 잡기 */
            div[class^="mets01390_rightContentArea__"] {
                display: none !important;
            }

            /* QR 코드나 광고 영역이 포함된 경우 */
            div[class*="rightContentArea"] div[class*="qrcode"],
            div[class*="rightContentArea"] div[class*="banner"],
            div[class*="rightContentArea"] div[class*="Ad"] {
                display: none !important;
            }

            /* 애니메이션도 무력화 */
            div[class*="mets01390_rightContentArea__"] * {
                animation: none !important;
                transition: none !important;
            }

            /* React가 인라인 스타일로 다시 보이게 하려고 해도 막기 */
            div[class*="mets01390_rightContentArea__"][style] {
                display: none !important;
            }
        `;

        // CSS 스타일 요소 생성
        const styleElement = document.createElement('style');
        styleElement.id = 'cgv-rightContentArea-remover-css';
        styleElement.type = 'text/css';
        styleElement.textContent = css;

        // head에 추가
        const head = document.head || document.getElementsByTagName('head')[0];
        if (head) {
            head.appendChild(styleElement);
            console.log('✅ CSS 주입 완료');
        } else {
            // head가 없으면 잠시 후 다시 시도
            setTimeout(() => {
                const head = document.head || document.getElementsByTagName('head')[0];
                if (head) {
                    head.appendChild(styleElement);
                    console.log('✅ CSS 주입 완료 (지연)');
                }
            }, 100);
        }
    }

    /**
     * CSS 주입과 함께 DOM 제거도 병행
     */
    function hybridRemoval() {
        // 1. CSS 주입
        injectRemovalCSS();

        // 2. DOM 요소도 직접 제거
        const elements = document.querySelectorAll('[class*="mets01390_rightContentArea__"]');
        let removedCount = 0;

        elements.forEach(element => {
            try {
                element.remove();
                removedCount++;
                console.log(`🗑️ DOM 요소 제거: ${element.className}`);
            } catch (error) {
                console.log(`⚠️ DOM 제거 실패 (CSS로 숨김 처리됨):`, error);
            }
        });

        if (removedCount > 0) {
            console.log(`🎉 ${removedCount}개 요소 제거 완료`);
        }

        return removedCount;
    }

    /**
     * 초기화
     */
    function init() {
        console.log('🚀 CSS Injector 초기화');

        // 즉시 실행
        hybridRemoval();

        // DOM 준비 시
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', hybridRemoval);
        }

        // 페이지 로드 완료 시
        window.addEventListener('load', hybridRemoval);

        // React 렌더링 후
        setTimeout(hybridRemoval, 1000);

        // MutationObserver로 동적 콘텐츠 감지
        const observer = new MutationObserver(() => {
            hybridRemoval();
        });

        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }

        // 주기적 체크
        setInterval(hybridRemoval, 2000);

        console.log('🎭 CSS Injector 완전 활성화');
    }

    // 전역 함수로 노출
    window.injectRightContentAreaCSS = injectRemovalCSS;
    window.hybridRemoveRightContentArea = hybridRemoval;

    // 시작
    init();

})();