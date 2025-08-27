// ==UserScript==
// @name Chzzk Enhanced VideoController
// @namespace http://tampermonkey.net/
// @version 1.0.0
// @description Chzzk 비디오 플레이어 확장 컨트롤러 - 향상된 키보드 단축키와 접근성 지원
// @match https://chzzk.naver.com/*
// @icon https://chzzk.naver.com/favicon.ico
// @grant GM.getValue
// @grant GM.setValue
// @grant unsafeWindow
// @run-at document-start
// @license MIT
// ==/UserScript==

(function() {
    'use strict';

    /* ═══════════════════════════════════════════════════════════════════════════
     * 🔧 의존성 및 설정
     * ═══════════════════════════════════════════════════════════════════════════
     */

    // 상수 정의
    const CONSTANTS = {
        VOLUME_STEP: 0.05,       // 키보드로 볼륨 조절 시 증감 단위 (5%)
        SEEK_STEP: 10,           // 시간 탐색 단위 (초)
        DEFAULT_QUALITY: 1080,   // 기본 선호 화질 (1080p)
    };

    // 설정 객체
    const CONFIG = {
        storageKeys: {
            autoUnmute: "chzzkAutoUnmute",
            debugLog: "chzzkDebugLog",
        },
        selectors: {
            video: 'video',
        },
    };

    /* ═══════════════════════════════════════════════════════════════════════════
     * 🛠️ 유틸리티 클래스들
     * ═══════════════════════════════════════════════════════════════════════════
     */

    /**
     * 로거 클래스
     */
    class Logger {
        constructor() {
            this.DEBUG = false;
        }

        async initialize() {
            this.DEBUG = await GM.getValue(CONFIG.storageKeys.debugLog, false);
        }

        info(...args) {
            if (this.DEBUG) console.log('[VideoController]', ...args);
        }

        error(...args) {
            if (this.DEBUG) console.error('[VideoController]', ...args);
        }

        warn(...args) {
            if (this.DEBUG) console.warn('[VideoController]', ...args);
        }
    }

    /**
     * DOM 유틸리티 클래스
     */
    class DOMUtils {
        static createElement(tag, attributes = {}, textContent = '') {
            const element = document.createElement(tag);
            
            Object.entries(attributes).forEach(([key, value]) => {
                if (key === 'style' && typeof value === 'object') {
                    Object.assign(element.style, value);
                } else if (key === 'className') {
                    element.className = value;
                } else {
                    element.setAttribute(key, value);
                }
            });

            if (textContent) {
                element.textContent = textContent;
            }

            return element;
        }
    }

    /* ═══════════════════════════════════════════════════════════════════════════
     * 🎮 Enhanced VideoController 클래스
     * ═══════════════════════════════════════════════════════════════════════════
     */

    /**
     * 🎮 VideoController 클래스 - 개선된 버전
     * 
     * 🆕 추가 개선사항:
     * 1. 디바운스/스로틀링을 통한 성능 최적화
     * 2. 더 많은 키보드 단축키 지원
     * 3. 시간 기반 탐색 (←/→ 키로 10초 건너뛰기)
     * 4. 상태 관리 개선
     * 5. 접근성 향상 (스크린 리더 지원)
     */
    class EnhancedVideoController {
        constructor(options = {}) {
            // 기본 옵션 설정
            this.volumeStep = options.volumeStep || CONSTANTS.VOLUME_STEP;
            this.seekStep = options.seekStep || CONSTANTS.SEEK_STEP;
            this.videoSelector = options.videoSelector || CONFIG.selectors.video;
            this.fullscreenBtnLabels = options.fullscreenBtnLabels || ['넓은 화면', '좁은 화면'];
            
            // 상태 관리
            this.isInitialized = false;
            this.lastVolumeChange = 0;
            this.lastSeekChange = 0;
            
            // 디바운스된 함수들 미리 생성
            this.debouncedVolumeDisplay = this.debounce(this.showVolumeTooltip.bind(this), 50);
            this.debouncedSeekDisplay = this.debounce(this.showSeekTooltip.bind(this), 50);
            
            // 이벤트 핸들러 바인딩
            this.boundHandleKeyDown = this.handleKeyDown.bind(this);
            this.boundHandleVisibilityChange = this.handleVisibilityChange.bind(this);
        }

        /**
         * 키보드 이벤트를 무시해야 하는 상황을 판단합니다
         */
        shouldSkipEvent(target) {
            return ['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable;
        }

        /**
         * 전체화면 토글 버튼을 찾습니다
         */
        getFullscreenToggleButton() {
            const selector = this.fullscreenBtnLabels
                .map(label => `button[aria-label="${label}"]`)
                .join(',');
            return document.querySelector(selector);
        }

        /**
         * 볼륨 변경 시 시각적 피드백을 제공합니다
         */
        showVolumeTooltip(percentage) {
            // 기존 툴팁 찾기
            let container = document.querySelector('.volume_tooltip');
            
            // 툴팁이 없으면 생성
            if (!container) {
                container = DOMUtils.createElement('div', {
                    className: 'volume_tooltip',
                    style: {
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(0, 0, 0, 0.8)',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        fontSize: '14px',
                        zIndex: '10000',
                        pointerEvents: 'none',
                        display: 'none'
                    }
                });
                document.body.appendChild(container);
            }

            // 툴팁 내용 업데이트
            container.style.display = 'inline-flex';
            container.style.alignItems = 'center';
            container.style.justifyContent = 'center';
            container.textContent = `🔊 ${percentage}%`;

            // 자동 숨김 타이머
            clearTimeout(container._tipTimer);
            container._tipTimer = setTimeout(() => {
                container.style.display = 'none';
            }, 800);
        }

        /**
         * 디바운스 유틸리티 함수
         * 연속된 호출을 제한하여 성능 최적화
         */
        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func.apply(this, args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        /**
         * 스로틀 유틸리티 함수
         * 일정 시간 간격으로만 실행되도록 제한
         */
        throttle(func, limit) {
            let inThrottle;
            return function executedFunction(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        }

        /**
         * 페이지 가시성 변경 핸들러
         * 백그라운드에서 돌아왔을 때 상태 복원
         */
        handleVisibilityChange() {
            if (!document.hidden && this.isInitialized) {
                // 페이지가 다시 활성화되었을 때 비디오 상태 확인
                this.validateVideoState();
            }
        }

        /**
         * 비디오 상태 검증 및 복원
         */
        async validateVideoState() {
            const video = document.querySelector(this.videoSelector);
            if (!video) return;

            try {
                // 음소거 상태 확인 및 복원
                const autoUnmute = await GM.getValue(CONFIG.storageKeys.autoUnmute, true);
                if (autoUnmute && video.muted) {
                    video.muted = false;
                    logger.info('음소거 상태 복원');
                }
            } catch (error) {
                logger.error('상태 복원 실패:', error);
            }
        }

        /**
         * 시간 탐색 툴팁 표시
         */
        showSeekTooltip(direction, seconds) {
            // 기존 툴팁 제거
            const existingTooltip = document.querySelector('.seek-tooltip');
            if (existingTooltip) {
                existingTooltip.remove();
            }

            // 새 툴팁 생성
            let displayText;
            if (typeof seconds === 'string') {
                displayText = seconds; // '처음으로', '끝으로' 등
            } else {
                displayText = `${direction > 0 ? '+' : ''}${seconds}초`;
            }

            const tooltip = DOMUtils.createElement('div', {
                className: 'seek-tooltip',
                style: {
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    fontSize: '14px',
                    zIndex: '10000',
                    pointerEvents: 'none'
                }
            }, `⏯️ ${displayText}`);

            document.body.appendChild(tooltip);

            // 2초 후 자동 제거
            setTimeout(() => {
                tooltip.remove();
            }, 2000);
        }

        /**
         * 확장된 비디오 액션들
         */
        getVideoActions() {
            return {
                // 기본 재생/정지
                Space: video => video.paused ? video.play() : video.pause(),
                k: video => video.paused ? video.play() : video.pause(),
                
                // 음소거 토글
                m: video => video.muted = !video.muted,
                
                // 전체화면 관련
                t: () => {
                    const button = this.getFullscreenToggleButton();
                    button?.click();
                },
                f: video => {
                    if (document.fullscreenElement) {
                        document.exitFullscreen();
                    } else if (video.requestFullscreen) {
                        video.requestFullscreen();
                    }
                },
                
                // 볼륨 조절 (스로틀링 적용)
                arrowup: this.throttle((video) => {
                    video.volume = Math.min(1, video.volume + this.volumeStep);
                    this.debouncedVolumeDisplay(Math.round(video.volume * 100));
                }, 100),
                
                arrowdown: this.throttle((video) => {
                    video.volume = Math.max(0, video.volume - this.volumeStep);
                    this.debouncedVolumeDisplay(Math.round(video.volume * 100));
                }, 100),
                
                // 🆕 시간 탐색 (좌우 화살표)
                arrowleft: this.throttle((video) => {
                    if (video.duration && !isNaN(video.duration)) {
                        video.currentTime = Math.max(0, video.currentTime - this.seekStep);
                        this.debouncedSeekDisplay(-1, this.seekStep);
                    }
                }, 200),
                
                arrowright: this.throttle((video) => {
                    if (video.duration && !isNaN(video.duration)) {
                        video.currentTime = Math.min(video.duration, video.currentTime + this.seekStep);
                        this.debouncedSeekDisplay(1, this.seekStep);
                    }
                }, 200),
                
                // 🆕 숫자 키로 퍼센트 점프 (0-9)
                digit0: video => this.seekToPercent(video, 0),
                digit1: video => this.seekToPercent(video, 10),
                digit2: video => this.seekToPercent(video, 20),
                digit3: video => this.seekToPercent(video, 30),
                digit4: video => this.seekToPercent(video, 40),
                digit5: video => this.seekToPercent(video, 50),
                digit6: video => this.seekToPercent(video, 60),
                digit7: video => this.seekToPercent(video, 70),
                digit8: video => this.seekToPercent(video, 80),
                digit9: video => this.seekToPercent(video, 90),
                
                // 🆕 재생 속도 조절
                ',': video => this.changePlaybackRate(video, -0.25), // 속도 감소
                '.': video => this.changePlaybackRate(video, 0.25),  // 속도 증가
                
                // 🆕 Home/End 키로 처음/끝으로 이동
                home: video => {
                    video.currentTime = 0;
                    this.showSeekTooltip(-1, '처음으로');
                },
                end: video => {
                    if (video.duration && !isNaN(video.duration)) {
                        video.currentTime = video.duration;
                        this.showSeekTooltip(1, '끝으로');
                    }
                }
            };
        }

        /**
         * 퍼센트 위치로 이동
         */
        seekToPercent(video, percent) {
            if (video.duration && !isNaN(video.duration)) {
                video.currentTime = (video.duration * percent) / 100;
                this.showSeekTooltip(0, `${percent}%`);
            }
        }

        /**
         * 재생 속도 변경
         */
        changePlaybackRate(video, delta) {
            const newRate = Math.max(0.25, Math.min(3, video.playbackRate + delta));
            video.playbackRate = newRate;
            
            // 속도 표시 툴팁
            const tooltip = DOMUtils.createElement('div', {
                className: 'speed-tooltip',
                style: {
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    background: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontSize: '14px',
                    zIndex: '10000'
                }
            }, `⚡ 재생 속도: ${newRate}x`);

            document.body.appendChild(tooltip);
            setTimeout(() => tooltip.remove(), 2000);
        }

        /**
         * 개선된 키 이벤트 핸들러
         */
        handleKeyDown(event) {
            // 무시 조건 확인
            if (this.shouldSkipEvent(event.target) || event.ctrlKey || event.altKey || event.metaKey) {
                return;
            }

            const video = document.querySelector(this.videoSelector);
            if (!video) return;

            // 키 정규화 (숫자 키 특별 처리)
            let key;
            if (event.code === 'Space') {
                key = 'Space';
            } else if (event.code.startsWith('Digit')) {
                key = event.code.toLowerCase(); // digit0, digit1, ...
            } else {
                key = event.key.toLowerCase();
            }

            const actions = this.getVideoActions();
            const action = actions[key];

            if (action) {
                try {
                    action(video);
                    event.preventDefault();
                    event.stopPropagation();
                    
                    // 접근성: 스크린 리더에 액션 알림
                    this.announceAction(key, video);
                    
                } catch (error) {
                    logger.error(`키보드 액션 실행 실패: ${error.message}`);
                }
            }
        }

        /**
         * 접근성: 스크린 리더에 액션 알림
         */
        announceAction(key, video) {
            let message = '';
            
            switch (key) {
                case 'Space':
                case 'k':
                    message = video.paused ? '재생됨' : '일시정지됨';
                    break;
                case 'm':
                    message = video.muted ? '음소거됨' : '음소거 해제됨';
                    break;
                case 'f':
                    message = document.fullscreenElement ? '전체화면 해제됨' : '전체화면됨';
                    break;
            }

            if (message) {
                // aria-live 영역에 메시지 추가 (스크린 리더가 읽음)
                this.announceToScreenReader(message);
            }
        }

        /**
         * 스크린 리더 알림 함수
         */
        announceToScreenReader(message) {
            let announcement = document.getElementById('video-controller-announcement');
            
            if (!announcement) {
                announcement = DOMUtils.createElement('div', {
                    id: 'video-controller-announcement',
                    'aria-live': 'polite',
                    style: {
                        position: 'absolute',
                        left: '-10000px',
                        width: '1px',
                        height: '1px',
                        overflow: 'hidden'
                    }
                });
                document.body.appendChild(announcement);
            }

            announcement.textContent = message;
        }

        /**
         * 초기화 메서드
         */
        async initialize() {
            if (this.isInitialized) return;
            
            // 이벤트 리스너 등록
            document.addEventListener('keydown', this.boundHandleKeyDown, true);
            document.addEventListener('visibilitychange', this.boundHandleVisibilityChange);
            
            // 초기 상태 검증
            await this.validateVideoState();
            
            this.isInitialized = true;
            logger.info('🎮 Enhanced VideoController 초기화 완료');
        }

        /**
         * 정리 메서드 (메모리 누수 방지)
         */
        destroy() {
            if (!this.isInitialized) return;
            
            // 이벤트 리스너 제거
            document.removeEventListener('keydown', this.boundHandleKeyDown, true);
            document.removeEventListener('visibilitychange', this.boundHandleVisibilityChange);
            
            // 툴팁 정리
            const tooltips = document.querySelectorAll('.seek-tooltip, .speed-tooltip, .volume_tooltip');
            tooltips.forEach(tooltip => tooltip.remove());
            
            // 스크린 리더 알림 요소 제거
            const announcement = document.getElementById('video-controller-announcement');
            if (announcement) {
                announcement.remove();
            }
            
            this.isInitialized = false;
            logger.info('🎮 Enhanced VideoController 정리 완료');
        }
    }

    /* ═══════════════════════════════════════════════════════════════════════════
     * 🚀 초기화 및 실행
     * ═══════════════════════════════════════════════════════════════════════════
     */

    // 전역 인스턴스
    const logger = new Logger();
    let videoController = null;

    /**
     * 스크립트 초기화
     */
    async function initializeScript() {
        try {
            // Logger 초기화
            await logger.initialize();
            
            // VideoController 생성
            videoController = new EnhancedVideoController();
            await videoController.initialize();
            
            // 페이지 언로드 시 정리 작업 등록
            window.addEventListener('beforeunload', () => {
                if (videoController) {
                    videoController.destroy();
                }
            });
            
            logger.info('🎮 Chzzk Enhanced VideoController 시작됨');
            
            // 사용법 안내 (한 번만)
            const showGuide = await GM.getValue('chzzkControllerGuideShown', false);
            if (!showGuide) {
                showKeyboardGuide();
                await GM.setValue('chzzkControllerGuideShown', true);
            }
            
        } catch (error) {
            console.error('❌ Chzzk Enhanced VideoController 초기화 실패:', error);
        }
    }

    /**
     * 키보드 단축키 가이드 표시
     */
    function showKeyboardGuide() {
        const guide = DOMUtils.createElement('div', {
            style: {
                position: 'fixed',
                top: '20px',
                right: '20px',
                background: 'rgba(0, 0, 0, 0.9)',
                color: 'white',
                padding: '16px',
                borderRadius: '8px',
                fontSize: '14px',
                zIndex: '10000',
                maxWidth: '300px',
                fontFamily: 'Arial, sans-serif'
            }
        });

        guide.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: #00f5ff;">🎮 Enhanced VideoController</h3>
            <div style="line-height: 1.4;">
                <strong>기본 조작:</strong><br>
                Space/K: 재생/정지<br>
                M: 음소거 토글<br>
                F: 전체화면<br>
                T: 극장모드<br><br>
                
                <strong>볼륨 & 탐색:</strong><br>
                ↑/↓: 볼륨 조절<br>
                ←/→: 10초 탐색<br>
                0-9: 퍼센트 점프<br>
                , / . : 속도 조절<br>
                Home/End: 처음/끝<br>
            </div>
            <button id="close-guide" style="margin-top: 10px; padding: 4px 8px; background: #00f5ff; color: black; border: none; border-radius: 4px; cursor: pointer;">확인</button>
        `;

        document.body.appendChild(guide);

        // 10초 후 또는 버튼 클릭 시 제거
        const closeGuide = () => guide.remove();
        document.getElementById('close-guide').addEventListener('click', closeGuide);
        setTimeout(closeGuide, 10000);
    }

    /**
     * DOM 준비 대기 및 초기화
     */
    function waitForDOMReady() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeScript);
        } else {
            initializeScript();
        }
    }

    // 스크립트 시작
    waitForDOMReady();

    // 콘솔에 시작 메시지
    console.log('%c🎮 Chzzk Enhanced VideoController v1.0.0', 
        'color: #00f5ff; font-weight: bold; font-size: 14px;');
    console.log('%c키보드 단축키로 비디오를 더 편리하게 조작하세요!', 
        'color: #87ceeb; font-size: 12px;');

})(); 