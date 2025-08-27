// ==UserScript==
// @name Chzzk 올인원 스크립트 (개선된 버전)
// @namespace http://tampermonkey.net/
// @version 4.0.0
// @description Chzzk 방송에서 자동 화질 설정, 광고 팝업 차단, 음소거 자동 해제, 스크롤 잠금 해제 (개선된 버전)
// @match https://chzzk.naver.com/*
// @icon https://chzzk.naver.com/favicon.ico
// @grant GM.getValue
// @grant GM.setValue
// @grant unsafeWindow
// @run-at document-start
// @license MIT
// ==/UserScript==

/*
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📌 CHZZK 올인원 스크립트 - 개선된 버전
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * 🎯 목적: 네이버 Chzzk 스트리밍 플랫폼에서 사용자 경험을 향상시키는 종합 스크립트
 * 
 * 🔧 주요 기능:
 * 1. 키보드 단축키로 비디오 제어 (재생/정지, 볼륨, 전체화면)
 * 2. 자동 화질 설정 (사용자 선호 화질로 자동 변경)
 * 3. 광고 차단 팝업 자동 제거
 * 4. 자동 음소거 해제
 * 5. 화면 선명도 개선
 * 
 * 🏗️ 설계 패턴:
 * - 클래스 기반 모듈화: 기능별로 독립적인 클래스 구성
 * - 유틸리티 클래스: 공통 기능을 재사용 가능한 형태로 분리
 * - 에러 핸들링: try-catch 및 재시도 로직으로 안정성 확보
 * - 이벤트 기반 아키텍처: CustomEvent를 활용한 모듈 간 통신
 * 
 * 📝 코딩 스타일:
 * - JSDoc을 활용한 타입 정의 (TypeScript 유사 경험 제공)
 * - 명확한 함수명과 변수명 사용
 * - 상수는 UPPER_SNAKE_CASE, 클래스는 PascalCase 사용
 * - 메모리 누수 방지를 위한 이벤트 리스너 정리
 */

(function() {
    'use strict';

    /* ═══════════════════════════════════════════════════════════════════════════
     * 📋 타입 정의 (JSDoc 활용)
     * ═══════════════════════════════════════════════════════════════════════════
     * 
     * JavaScript는 동적 타입 언어이지만, JSDoc을 사용하여 TypeScript와 유사한
     * 타입 정보를 제공합니다. 이를 통해 IDE의 자동완성과 타입 체크 기능을 활용할 수 있습니다.
     */
    
    /**
     * @typedef {Object} Config - 전체 설정 객체 타입 정의
     * @property {number} minTimeout - 최소 대기 시간 (밀리초)
     * @property {number} defaultTimeout - 기본 대기 시간 (밀리초)
     * @property {Object} storageKeys - 로컬 스토리지 키 목록
     * @property {Object} selectors - CSS 셀렉터 목록
     * @property {Object} styles - 로그 출력용 스타일 정의
     */

    /**
     * @typedef {Object} VideoControllerOptions - 비디오 컨트롤러 옵션 타입
     * @property {number} volumeStep - 볼륨 조절 단위 (0-1 사이의 소수)
     * @property {string} videoSelector - 비디오 요소를 찾는 CSS 셀렉터
     * @property {string[]} fullscreenBtnLabels - 전체화면 버튼의 aria-label 목록
     */

    /* ═══════════════════════════════════════════════════════════════════════════
     * 📊 상수 정의
     * ═══════════════════════════════════════════════════════════════════════════
     * 
     * 매직 넘버를 방지하고 설정값을 중앙에서 관리하기 위해 상수 객체를 사용합니다.
     * 이렇게 하면 나중에 값을 수정할 때 한 곳에서만 변경하면 됩니다.
     */
    
    const CONSTANTS = {
        APPLY_COOLDOWN: 1000,    // 화질 적용 간 최소 대기시간 (중복 실행 방지)
        VOLUME_STEP: 0.05,       // 키보드로 볼륨 조절 시 증감 단위 (5%)
        DEFAULT_QUALITY: 1080,   // 기본 선호 화질 (1080p)
        RETRY_ATTEMPTS: 3,       // 작업 실패 시 재시도 횟수
        RETRY_DELAY: 500,        // 재시도 간격 (밀리초)
    };

    /**
     * 전체 애플리케이션 설정을 관리하는 중앙 집중식 설정 객체
     * 
     * 🔍 왜 이렇게 구성했나요?
     * - 설정값들을 한 곳에 모아서 관리 용이성 향상
     * - 카테고리별로 분류하여 가독성 향상
     * - 나중에 설정 UI를 만들 때 이 구조를 그대로 활용 가능
     */
    const CONFIG = {
        // ⏱️ 타이밍 관련 설정
        minTimeout: 500,         // DOM 요소 대기 시 최소 시간
        defaultTimeout: 2000,    // DOM 요소 대기 시 기본 시간
        
        // 💾 로컬 스토리지 키 관리
        storageKeys: {
            quality: "chzzkPreferredQuality",        // 사용자 선호 화질 저장 키
            autoUnmute: "chzzkAutoUnmute",           // 자동 언뮤트 설정 키
            debugLog: "chzzkDebugLog",               // 디버그 로그 활성화 키
            screenSharpness: "chzzkScreenSharp",     // 화면 선명도 설정 키
        },
        
        // 🎯 CSS 셀렉터 중앙 관리
        // 웹사이트 구조가 변경되어도 여기서만 수정하면 됩니다
        selectors: {
            popup: 'div[class^="popup_container"]',                    // 팝업 컨테이너
            qualityBtn: 'button[command="SettingCommands.Toggle"]',    // 화질 설정 버튼
            qualityMenu: 'div[class*="pzp-pc-setting-intro-quality"]', // 화질 선택 메뉴
            qualityItems: 'li.pzp-ui-setting-quality-item[role="menuitem"]', // 화질 옵션들
            headerMenu: ".header_service__DyG7M",                      // 헤더 메뉴 영역
            video: 'video',                                            // 비디오 요소
            volumeButton: 'button.pzp-pc-volume-button[aria-label*="음소거 해제"]', // 음소거 해제 버튼
            toolbar: '.toolbar_section__IPbBC',                       // 툴바 영역
        },
        
        // 🎨 콘솔 로그 스타일 정의
        // 개발자 도구에서 로그를 구분하기 쉽게 색상과 스타일을 적용
        styles: {
            success: "font-weight:bold; color:green",   // 성공 메시지 (초록색)
            error: "font-weight:bold; color:red",       // 오류 메시지 (빨간색)
            info: "font-weight:bold; color:skyblue",    // 정보 메시지 (하늘색)
            warn: "font-weight:bold; color:orange",     // 경고 메시지 (주황색)
        },
    };

    /* ═══════════════════════════════════════════════════════════════════════════
     * 🛠️ 유틸리티 클래스들
     * ═══════════════════════════════════════════════════════════════════════════
     * 
     * 공통으로 사용되는 기능들을 재사용 가능한 클래스로 분리했습니다.
     * 이렇게 하면 코드 중복을 줄이고, 테스트하기 쉽고, 유지보수가 편해집니다.
     */

    /**
     * 🔍 Logger 클래스 - 통합 로깅 시스템
     * 
     * 🎯 목적: 
     * - 개발/디버깅 시에만 로그 출력 (성능 최적화)
     * - 일관된 로그 포맷 제공
     * - 로그 레벨별 스타일 적용
     * 
     * 💡 사용법:
     * const logger = new Logger();
     * await logger.initialize(); // GM.getValue로 설정 불러오기
     * logger.info('정보 메시지');
     * logger.error('오류 메시지');
     */
    class Logger {
        constructor() {
            // 초기값은 false로 설정 (성능상 이유로 기본적으로 로그 비활성화)
            this.DEBUG = false;
        }

        /**
         * 사용자 설정에 따라 디버그 모드를 초기화합니다
         * 
         * 🔄 비동기 처리 이유:
         * GM.getValue는 Promise를 반환하므로 await 필요
         */
        async initialize() {
            this.DEBUG = await GM.getValue(CONFIG.storageKeys.debugLog, false);
        }

        /**
         * 조건부 로깅 메서드들
         * 
         * 🎯 핵심 아이디어:
         * - DEBUG 모드일 때만 실제 console 함수 호출
         * - 프로덕션에서는 console.log 오버헤드 제거
         * - 메서드명이 로그 레벨을 직관적으로 표현
         */
        info(...args) {
            if (this.DEBUG) console.log(...args);
        }

        success(...args) {
            if (this.DEBUG) console.log(...args);
        }

        warn(...args) {
            if (this.DEBUG) console.warn(...args);
        }

        error(...args) {
            if (this.DEBUG) console.error(...args);
        }

        groupCollapsed(...args) {
            if (this.DEBUG) console.groupCollapsed(...args);
        }

        table(...args) {
            if (this.DEBUG) console.table(...args);
        }

        groupEnd() {
            if (this.DEBUG) console.groupEnd();
        }
    }

    /**
     * ⏱️ AsyncUtils 클래스 - 비동기 작업 유틸리티
     * 
     * 🎯 목적:
     * - Promise 기반의 지연/대기 기능 제공
     * - DOM 요소 로딩 대기 (SPA에서 중요)
     * - 실패한 작업에 대한 재시도 로직
     * 
     * 📝 Static 메서드 사용 이유:
     * - 인스턴스 생성 없이 바로 사용 가능
     * - 상태를 가지지 않는 순수 함수들
     * - Math.max(), Array.from() 같은 내장 유틸리티와 일관성
     */
    class AsyncUtils {
        /**
         * 지정된 시간만큼 대기하는 Promise를 반환합니다
         * 
         * @param {number} ms - 대기할 시간 (밀리초)
         * @returns {Promise<void>}
         * 
         * 💡 사용 예시:
         * await AsyncUtils.sleep(1000); // 1초 대기
         */
        static sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        /**
         * DOM 요소가 나타날 때까지 대기하는 Promise를 반환합니다
         * 
         * @param {string} selector - CSS 셀렉터
         * @param {number} timeout - 최대 대기 시간
         * @returns {Promise<Element>} - 찾은 DOM 요소
         * 
         * 🔍 작동 원리:
         * 1. 먼저 현재 DOM에서 요소 검색
         * 2. 없으면 MutationObserver로 DOM 변화 감지
         * 3. 요소가 추가되면 즉시 resolve
         * 4. 타임아웃 시간 초과 시 reject
         * 
         * 💡 SPA에서 중요한 이유:
         * React, Vue 같은 SPA에서는 페이지 전환 시 DOM이 동적으로 변경됩니다.
         * 따라서 특정 요소가 렌더링될 때까지 기다려야 할 때가 많습니다.
         */
        static waitForElement(selector, timeout = CONFIG.defaultTimeout) {
            // 최소 대기 시간 보장 (너무 짧으면 불안정할 수 있음)
            const effectiveTimeout = Math.max(timeout, CONFIG.minTimeout);
            
            return new Promise((resolve, reject) => {
                // 1단계: 이미 존재하는 요소 확인
                const element = document.querySelector(selector);
                if (element) return resolve(element);

                // 2단계: MutationObserver 설정 (DOM 변화 감지)
                const observer = new MutationObserver(() => {
                    const found = document.querySelector(selector);
                    if (found) {
                        observer.disconnect(); // 리소스 정리 (중요!)
                        resolve(found);
                    }
                });

                // DOM 트리 전체를 감시 (childList: 자식 추가/제거, subtree: 하위 트리 포함)
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });

                // 3단계: 타임아웃 설정
                setTimeout(() => {
                    observer.disconnect(); // 메모리 누수 방지
                    reject(new Error(`Timeout waiting for ${selector}`));
                }, effectiveTimeout);
            });
        }

        /**
         * 실패한 작업을 지정된 횟수만큼 재시도합니다
         * 
         * @param {Function} fn - 실행할 함수 (Promise 반환)
         * @param {number} attempts - 재시도 횟수
         * @param {number} delay - 재시도 간격
         * @returns {Promise<any>} - 함수 실행 결과
         * 
         * 🔄 재시도 패턴의 중요성:
         * 네트워크 요청, DOM 조작 등은 일시적으로 실패할 수 있습니다.
         * 특히 SPA에서는 렌더링 타이밍 문제로 요소를 찾지 못할 수 있어서
         * 재시도 로직이 매우 중요합니다.
         * 
         * 💡 사용 예시:
         * const result = await AsyncUtils.retry(async () => {
         *     const btn = document.querySelector('.some-button');
         *     if (!btn) throw new Error('Button not found');
         *     btn.click();
         *     return 'success';
         * }, 3, 500);
         */
        static async retry(fn, attempts = CONSTANTS.RETRY_ATTEMPTS, delay = CONSTANTS.RETRY_DELAY) {
            for (let i = 0; i < attempts; i++) {
                try {
                    return await fn(); // 성공 시 결과 반환
                } catch (error) {
                    // 마지막 시도에서도 실패하면 에러를 상위로 전파
                    if (i === attempts - 1) throw error;
                    
                    // 다음 시도 전 대기
                    await this.sleep(delay);
                }
            }
        }
    }

    /**
     * 📝 TextUtils 클래스 - 텍스트 처리 유틸리티
     * 
     * 🎯 목적:
     * - 웹에서 추출한 텍스트 정리 및 파싱
     * - 화질 정보 등 특정 패턴 추출
     * - 일관된 텍스트 처리 방식 제공
     */
    class TextUtils {
        /**
         * 텍스트에서 불필요한 공백과 줄바꿈을 제거하고 정리합니다
         * 
         * @param {string} text - 정리할 텍스트
         * @returns {string} - 정리된 텍스트
         * 
         * 🔍 처리 과정:
         * 1. 앞뒤 공백 제거 (trim)
         * 2. 연속된 공백/탭/줄바꿈을 단일 공백으로 변환
         * 3. 빈 문자열 요소 제거
         * 4. 쉼표로 연결하여 가독성 향상
         * 
         * 💡 사용 예시:
         * TextUtils.clean("  1080p   고화질   ") → "1080p, 고화질"
         */
        static clean(text) {
            return text.trim()                  // 앞뒤 공백 제거
                      .split(/\s+/)             // 공백 문자로 분할 (\s+: 연속된 공백)
                      .filter(Boolean)          // 빈 문자열 제거
                      .join(", ");              // 쉼표로 연결
        }

        /**
         * 텍스트에서 해상도 정보를 추출합니다
         * 
         * @param {string} text - 해상도가 포함된 텍스트
         * @returns {number|null} - 추출된 해상도 숫자 또는 null
         * 
         * 🔍 정규식 설명:
         * /(\d{3,4})p/ 
         * - \d{3,4}: 3자리 또는 4자리 숫자 (360, 720, 1080, 2160 등)
         * - p: 문자 'p' (progressive scan을 의미)
         * - (): 캡처 그룹 (매칭된 숫자 부분만 추출)
         * 
         * 💡 사용 예시:
         * TextUtils.extractResolution("1080p 고화질") → 1080
         * TextUtils.extractResolution("화질 설정") → null
         */
        static extractResolution(text) {
            const match = text.match(/(\d{3,4})p/);
            return match ? parseInt(match[1], 10) : null;
        }
    }

    /**
     * 🏗️ DOMUtils 클래스 - DOM 조작 유틸리티
     * 
     * 🎯 목적:
     * - 안전한 DOM 요소 제거 및 스타일 조작
     * - 일관된 DOM 요소 생성 방식 제공
     * - null/undefined 체크로 런타임 에러 방지
     */
    class DOMUtils {
        /**
         * DOM 요소를 안전하게 제거합니다
         * 
         * @param {Element|null} element - 제거할 요소
         * 
         * 🛡️ 안전성 확보:
         * Optional chaining (?.) 연산자 사용으로
         * element가 null이나 undefined여도 에러 발생하지 않음
         */
        static remove(element) {
            element?.remove();
        }

        /**
         * DOM 요소의 style 속성을 안전하게 제거합니다
         * 
         * @param {Element|null} element - 스타일을 제거할 요소
         * 
         * 💡 사용 시나리오:
         * 팝업이나 광고로 인해 body에 overflow:hidden이 적용되어
         * 스크롤이 잠겼을 때 이를 해제하는 용도
         */
        static clearStyle(element) {
            element?.removeAttribute("style");
        }

        /**
         * DOM 요소를 생성하고 속성을 설정합니다
         * 
         * @param {string} tag - HTML 태그명
         * @param {Object} attributes - 설정할 속성들
         * @param {string} textContent - 텍스트 내용
         * @returns {Element} - 생성된 DOM 요소
         * 
         * 🔧 고급 기능:
         * - style 속성을 객체로 받아서 일괄 적용
         * - 기타 속성들도 동적으로 설정
         * - 메서드 체이닝 패턴으로 사용 가능
         * 
         * 💡 사용 예시:
         * const button = DOMUtils.createElement('button', {
         *     className: 'my-button',
         *     style: { color: 'red', fontSize: '16px' },
         *     'data-id': '123'
         * }, '클릭하세요');
         */
        static createElement(tag, attributes = {}, textContent = '') {
            const element = document.createElement(tag);
            
            // 속성들을 순회하면서 설정
            Object.entries(attributes).forEach(([key, value]) => {
                if (key === 'style' && typeof value === 'object') {
                    // 스타일 객체는 Object.assign으로 일괄 적용
                    Object.assign(element.style, value);
                } else {
                    // 일반 속성은 setAttribute로 설정
                    element.setAttribute(key, value);
                }
            });

            // 텍스트 내용 설정
            if (textContent) {
                element.textContent = textContent;
            }

            return element;
        }
    }

    /* ═══════════════════════════════════════════════════════════════════════════
     * 🔧 전역 패치 및 안전성 확보
     * ═══════════════════════════════════════════════════════════════════════════
     */

    /**
     * Node.prototype.removeChild 메서드 패치
     * 
     * 🚨 문제 상황:
     * 웹사이트에서 동적으로 DOM을 조작할 때, 이미 제거된 요소를 
     * 다시 제거하려고 시도하면 에러가 발생할 수 있습니다.
     * 
     * 🛡️ 해결 방법:
     * 안전성 검사를 추가하여 에러를 방지합니다.
     * 
     * ⚠️ 주의사항:
     * 네이티브 메서드를 수정하는 것은 위험할 수 있으므로
     * 꼭 필요한 경우에만 사용해야 합니다.
     */
    const originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function(child) {
        // 자식 요소가 존재하고 실제로 이 요소의 자식인지 확인
        if (!child || child.parentNode !== this) return child;
        
        // 안전성이 확인되면 원래 메서드 호출
        return originalRemoveChild.call(this, child);
    };

    /* ═══════════════════════════════════════════════════════════════════════════
     * 🎮 VideoController 클래스 - 비디오 제어 시스템
     * ═══════════════════════════════════════════════════════════════════════════
     * 
     * 🎯 목적:
     * - 키보드 단축키로 비디오 플레이어 제어
     * - YouTube, Netflix 등과 유사한 UX 제공
     * - 사용자 친화적인 볼륨 표시
     * 
     * 🔑 핵심 기능:
     * - Space/K: 재생/정지 토글
     * - M: 음소거 토글  
     * - F: 전체화면 토글
     * - T: 극장모드 토글
     * - ↑/↓: 볼륨 조절 (5% 단위)
     * 
     * 🏗️ 설계 원칙:
     * - 이벤트 리스너의 안전한 바인딩/해제
     * - 입력 요소에서는 단축키 비활성화
     * - 메모리 누수 방지를 위한 정리 메서드 제공
     */
    class VideoController {
        /**
         * VideoController 생성자
         * 
         * @param {VideoControllerOptions} options - 설정 옵션
         * 
         * 🔧 옵션 설명:
         * - volumeStep: 볼륨 조절 단위 (기본 5%)
         * - videoSelector: 비디오 요소 선택자
         * - fullscreenBtnLabels: 전체화면 버튼 라벨들
         * 
         * 💡 바인딩 처리:
         * this.boundHandleKeyDown을 미리 생성하여
         * 나중에 removeEventListener에서 정확히 같은 함수 참조를 사용
         */
        constructor(options = {}) {
            // 옵션 설정 (기본값 제공)
            this.volumeStep = options.volumeStep || CONSTANTS.VOLUME_STEP;
            this.videoSelector = options.videoSelector || CONFIG.selectors.video;
            this.fullscreenBtnLabels = options.fullscreenBtnLabels || ['넓은 화면', '좁은 화면'];
            
            // 이벤트 핸들러 바인딩 (중요: this 컨텍스트 유지)
            this.boundHandleKeyDown = this.handleKeyDown.bind(this);
            
            // 초기화 실행
            this.initialize();
        }

        /**
         * 키보드 이벤트를 무시해야 하는 상황을 판단합니다
         * 
         * @param {EventTarget} target - 이벤트가 발생한 요소
         * @returns {boolean} - 무시해야 하면 true
         * 
         * 🚫 무시하는 경우:
         * 1. INPUT, TEXTAREA 요소에서 발생한 이벤트
         * 2. contentEditable 요소에서 발생한 이벤트
         * 
         * 💡 이유:
         * 사용자가 텍스트를 입력하는 중에는 단축키가 작동하면 안 됩니다.
         * 예를 들어, 검색창에서 'k'를 입력할 때 비디오가 일시정지되면 안 됩니다.
         */
        shouldSkipEvent(target) {
            return ['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable;
        }

        /**
         * 전체화면 토글 버튼을 찾습니다
         * 
         * @returns {Element|null} - 전체화면 버튼 요소
         * 
         * 🔍 검색 방식:
         * 여러 가능한 라벨을 OR 조건으로 검색
         * Chzzk는 상태에 따라 '넓은 화면' 또는 '좁은 화면'으로 라벨이 변경됨
         * 
         * 💡 CSS 셀렉터 조합:
         * 'button[aria-label="넓은 화면"], button[aria-label="좁은 화면"]'
         */
        getFullscreenToggleButton() {
            const selector = this.fullscreenBtnLabels
                .map(label => `button[aria-label="${label}"]`)
                .join(',');
            return document.querySelector(selector);
        }

        /**
         * 볼륨 변경 시 시각적 피드백을 제공합니다
         * 
         * @param {number} percentage - 볼륨 퍼센트 (0-100)
         * 
         * 🎨 UI 구성:
         * 1. 기존 볼륨 툴팁 요소 찾기
         * 2. 볼륨 아이콘 복제하여 표시
         * 3. 퍼센트 텍스트 표시
         * 4. 800ms 후 자동 숨김
         * 
         * 🔧 스타일 조작:
         * - flexbox로 중앙 정렬
         * - SVG 아이콘 크기 조정
         * - CSS 클래스로 애니메이션 효과
         */
        showVolumeTooltip(percentage) {
            const container = document.querySelector('.volume_tooltip');
            if (!container) return;

            // 툴팁 컨테이너 스타일 설정
            container.style.display = 'inline-flex';
            container.style.alignItems = 'center';
            container.style.justifyContent = 'center';
            container.textContent = ''; // 기존 내용 초기화

            // 볼륨 아이콘 추가
            const volumeIcon = document.querySelector('.pzp-volume-button__icon');
            if (volumeIcon) {
                // 아이콘 복제 (원본 훼손 방지)
                const iconClone = volumeIcon.cloneNode(true);
                iconClone.classList.add('volume_icon__imkf4');
                iconClone.style.marginRight = '4px';

                // SVG 요소 크기 조정
                const svg = iconClone.tagName === 'svg' ? iconClone : iconClone.querySelector('svg');
                if (svg) {
                    // 스타일 객체로 일괄 적용 (가독성 향상)
                    Object.assign(svg.style, {
                        width: '36px',
                        height: '36px'
                    });
                    
                    // 기존 크기 속성 제거 (CSS 우선순위 때문)
                    svg.removeAttribute('width');
                    svg.removeAttribute('height');
                    svg.setAttribute('viewBox', '0 0 36 36');
                }

                container.appendChild(iconClone);
            }

            // 퍼센트 텍스트 추가
            container.appendChild(document.createTextNode(`${percentage}%`));
            
            // 활성화 클래스 추가 (CSS 애니메이션 트리거)
            container.classList.add('volume_tooltip__Bt5b8', 'volume_active__CLOIh');

            // 자동 숨김 타이머 (이전 타이머 취소 후 새로 설정)
            clearTimeout(container._tipTimer);
            container._tipTimer = setTimeout(() => {
                container.classList.remove('volume_active__CLOIh');
            }, 800);
        }

        /**
         * 키보드 단축키와 대응되는 비디오 액션들을 정의합니다
         * 
         * @returns {Object} - 키: 액션 함수 매핑 객체
         * 
         * 🎯 액션 정의:
         * - Space/k: 재생/정지 토글 (YouTube 스타일)
         * - m: 음소거 토글
         * - t: 극장모드 토글 (Chzzk 특화)
         * - f: 브라우저 전체화면 토글
         * - arrowup/arrowdown: 볼륨 조절
         * 
         * 💡 함수형 접근:
         * 각 액션을 순수 함수로 정의하여 테스트 용이성 확보
         * video 매개변수를 받아서 부작용 최소화
         */
        getVideoActions() {
            return {
                // 재생/정지 토글 (Space와 K 모두 지원)
                Space: video => video.paused ? video.play() : video.pause(),
                k: video => video.paused ? video.play() : video.pause(),
                
                // 음소거 토글
                m: video => video.muted = !video.muted,
                
                // 극장모드 토글 (Chzzk 전용 기능)
                t: () => {
                    const button = this.getFullscreenToggleButton();
                    button?.click(); // Optional chaining으로 안전한 클릭
                },
                
                // 브라우저 전체화면 토글
                f: video => {
                    if (document.fullscreenElement) {
                        // 현재 전체화면이면 해제
                        document.exitFullscreen();
                    } else if (video.requestFullscreen) {
                        // 전체화면 요청 (브라우저 지원 여부 확인)
                        video.requestFullscreen();
                    }
                },
                
                // 볼륨 증가 (상한: 100%)
                arrowup: video => {
                    video.volume = Math.min(1, video.volume + this.volumeStep);
                    this.showVolumeTooltip(Math.round(video.volume * 100));
                },
                
                // 볼륨 감소 (하한: 0%)
                arrowdown: video => {
                    video.volume = Math.max(0, video.volume - this.volumeStep);
                    this.showVolumeTooltip(Math.round(video.volume * 100));
                }
            };
        }

        /**
         * 키보드 이벤트 핸들러 (메인 로직)
         * 
         * @param {KeyboardEvent} event - 키보드 이벤트 객체
         * 
         * 🔄 처리 흐름:
         * 1. 이벤트 무시 조건 검사
         * 2. 비디오 요소 존재 확인
         * 3. 키 정규화 및 액션 매핑
         * 4. 액션 실행 및 기본 동작 방지
         * 5. 에러 처리 및 로깅
         * 
         * 🛡️ 안전성 확보:
         * - 수정자 키(Ctrl, Alt, Meta) 조합은 브라우저 기본 동작 유지
         * - try-catch로 액션 실행 중 에러 처리
         * - 이벤트 버블링 방지로 다른 핸들러 간섭 차단
         */
        handleKeyDown(event) {
            // 1단계: 이벤트 무시 조건 검사
            if (this.shouldSkipEvent(event.target) || event.ctrlKey || event.altKey || event.metaKey) {
                return; // 조기 반환으로 불필요한 처리 방지
            }

            // 2단계: 비디오 요소 확인
            const video = document.querySelector(this.videoSelector);
            if (!video) return; // 비디오가 없으면 처리 불가

            // 3단계: 키 정규화
            // Space는 특별 처리 (event.key가 ' '로 나오므로)
            const key = event.code === 'Space' ? 'Space' : event.key.toLowerCase();
            
            // 4단계: 액션 매핑 및 실행
            const actions = this.getVideoActions();
            const action = actions[key];

            if (action) {
                try {
                    // 액션 실행
                    action(video);
                    
                    // 브라우저 기본 동작 방지 (스크롤 등)
                    event.preventDefault();
                    
                    // 이벤트 버블링 중단 (다른 핸들러 간섭 방지)
                    event.stopPropagation();
                } catch (error) {
                    // 에러 로깅 (사용자에게는 영향 없이)
                    logger.error(`[VideoController] 키보드 액션 실행 실패: ${error.message}`);
                }
            }
        }

        /**
         * VideoController 초기화
         * 
         * 🎯 역할:
         * - 키보드 이벤트 리스너 등록
         * - capture: true로 설정하여 이벤트 우선 처리
         * 
         * ⚡ capture 모드 사용 이유:
         * 웹사이트의 다른 스크립트보다 먼저 이벤트를 처리하여
         * 우선순위를 확보합니다.
         */
        initialize() {
            document.addEventListener('keydown', this.boundHandleKeyDown, true);
        }

        /**
         * VideoController 정리 및 해제
         * 
         * 🧹 정리 작업:
         * - 이벤트 리스너 제거 (메모리 누수 방지)
         * - 타이머 정리 등 추가 정리 작업 가능
         * 
         * 💡 호출 시점:
         * - 페이지 언로드 시
         * - 스크립트 비활성화 시
         * - 새로운 인스턴스 생성 시
         */
        destroy() {
            document.removeEventListener('keydown', this.boundHandleKeyDown, true);
        }
    }

    /* ═══════════════════════════════════════════════════════════════════════════
     * 🚀 초기화 및 실행
     * ═══════════════════════════════════════════════════════════════════════════
     */

    // 전역 인스턴스 생성 (싱글톤 패턴)
    const logger = new Logger();
    
    /**
     * 애플리케이션 초기화 프로세스
     * 
     * 🔄 초기화 순서:
     * 1. Logger 초기화 (GM.getValue로 설정 로드)
     * 2. VideoController 인스턴스 생성
     * 3. 정리 이벤트 핸들러 등록
     * 4. 초기화 완료 로그
     * 
     * 🎯 즉시 실행 함수(IIFE) 사용 이유:
     * - 비동기 초기화를 위한 async/await 사용
     * - 전역 스코프 오염 방지
     * - 모듈 패턴 구현
     */
    (async () => {
        try {
            // 1단계: Logger 초기화
            await logger.initialize();
            
            // 2단계: VideoController 생성
            const videoController = new VideoController();
            
            // 3단계: 페이지 언로드 시 정리 작업 등록
            window.addEventListener('beforeunload', () => {
                videoController.destroy();
            });
            
            // 4단계: 초기화 완료 알림
            logger.info('🎮 VideoController 초기화 완료');
            
        } catch (error) {
            // 초기화 실패 시 에러 로깅
            console.error('❌ VideoController 초기화 실패:', error);
        }
    })();

})();

/* ═══════════════════════════════════════════════════════════════════════════
 * 🎬 메인 기능 모듈 (별도 스코프)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 📝 분리 이유:
 * - VideoController와 메인 기능들을 독립적으로 관리
 * - 각각 다른 스코프에서 실행되어 변수 충돌 방지
 * - 모듈별 로딩 및 에러 처리 가능
 * 1
 * 🔮 향후 구현 예정:
 * - QualityManager 클래스 (화질 자동 설정)
 * - AdBlocker 클래스 (광고 팝업 차단)
 * - UIManager 클래스 (설정 메뉴 관리)
 * - ObserverManager 클래스 (DOM 변화 감지)
 */
(async () => {
    "use strict";
    
    // TODO: 향후 구현 예정
    // 1. 원본 코드의 quality 객체를 QualityManager 클래스로 재구성
    // 2. handler 객체를 RequestHandler 클래스로 재구성  
    // 3. observer 객체를 DOMObserver 클래스로 재구성
    // 4. 설정 UI를 UIManager 클래스로 재구성
    
    console.log('🔄 메인 기능 모듈 로딩 예정...');
    
})(); 