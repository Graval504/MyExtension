/**
 * 🎯 QualityManager 클래스 - 화질 자동 설정 시스템
 * 
 * 🔧 주요 기능:
 * 1. 사용자 선호 화질 자동 적용
 * 2. 수동 화질 선택 감지 및 저장
 * 3. 저화질 감지 시 자동 복구
 * 4. P2P 화질 비활성화
 * 5. 상태 기반 재시도 로직
 */
class QualityManager extends EventTarget {
    constructor(config, logger, asyncUtils) {
        super();
        
        this.config = config;
        this.logger = logger;
        this.asyncUtils = asyncUtils;
        
        // 상태 관리
        this.isApplying = false;
        this.lastApplyTime = 0;
        this.applyCooldown = 1000;
        this.retryCount = 0;
        this.maxRetries = 3;
        
        // 이벤트 핸들러 바인딩
        this.boundHandleManualSelect = this.handleManualSelect.bind(this);
        
        this.initialize();
    }

    /**
     * QualityManager 초기화
     */
    async initialize() {
        try {
            // 수동 화질 선택 감지 설정
            this.observeManualSelect();
            
            // 기본 화질 설정이 없으면 생성
            const currentQuality = await GM.getValue(this.config.storageKeys.quality);
            if (currentQuality === undefined) {
                await GM.setValue(this.config.storageKeys.quality, CONSTANTS.DEFAULT_QUALITY);
                this.logger.success('[QualityManager] 기본 화질 1080p 설정됨');
            }
            
            this.logger.info('🎯 QualityManager 초기화 완료');
            
        } catch (error) {
            this.logger.error('[QualityManager] 초기화 실패:', error);
        }
    }

    /**
     * 수동 화질 선택 감지 및 저장
     */
    observeManualSelect() {
        document.body.addEventListener('click', this.boundHandleManualSelect, {
            capture: true,
            passive: true
        });
    }

    /**
     * 수동 화질 선택 핸들러
     */
    async handleManualSelect(event) {
        try {
            const qualityItem = event.target.closest('li[class*="quality"]');
            if (!qualityItem) return;

            const rawText = qualityItem.textContent;
            const resolution = TextUtils.extractResolution(rawText);
            
            if (resolution) {
                await GM.setValue(this.config.storageKeys.quality, resolution);
                
                this.logger.groupCollapsed('💾 [Quality] 수동 화질 저장됨', this.config.styles.success);
                this.logger.table([{ 
                    '선택 해상도': resolution, 
                    '원본 텍스트': TextUtils.clean(rawText) 
                }]);
                this.logger.groupEnd();

                // 이벤트 발생 (다른 모듈에서 구독 가능)
                this.dispatchEvent(new CustomEvent('qualityChanged', {
                    detail: { resolution, source: 'manual' }
                }));
            }
        } catch (error) {
            this.logger.error('[QualityManager] 수동 선택 처리 실패:', error);
        }
    }

    /**
     * 사용자 선호 화질 조회
     */
    async getPreferredQuality() {
        try {
            const stored = await GM.getValue(this.config.storageKeys.quality, CONSTANTS.DEFAULT_QUALITY);
            const quality = parseInt(stored, 10);
            
            // 유효성 검증
            if (isNaN(quality) || quality < 360 || quality > 4320) {
                this.logger.warn('[QualityManager] 잘못된 화질값, 기본값으로 복원:', stored);
                await GM.setValue(this.config.storageKeys.quality, CONSTANTS.DEFAULT_QUALITY);
                return CONSTANTS.DEFAULT_QUALITY;
            }
            
            return quality;
        } catch (error) {
            this.logger.error('[QualityManager] 선호 화질 조회 실패:', error);
            return CONSTANTS.DEFAULT_QUALITY;
        }
    }

    /**
     * 선호 화질 자동 적용 (메인 기능)
     */
    async applyPreferredQuality() {
        // 중복 실행 방지
        const now = Date.now();
        if (this.isApplying || (now - this.lastApplyTime) < this.applyCooldown) {
            this.logger.info('[QualityManager] 쿨다운 중, 스킵');
            return;
        }

        this.isApplying = true;
        this.lastApplyTime = now;

        try {
            const targetQuality = await this.getPreferredQuality();
            let selectedQuality = null;
            let selectedText = '(선택 실패)';

            // 화질 적용 시도
            const result = await this.asyncUtils.retry(async () => {
                return await this.performQualitySelection(targetQuality);
            }, this.maxRetries, 500);

            selectedQuality = result.quality;
            selectedText = result.text;

            // 결과 로깅
            this.logger.groupCollapsed('⚙️ [Quality] 자동 화질 적용', this.config.styles.info);
            this.logger.table([{ '대상 화질': `${targetQuality}p` }]);
            this.logger.table([{ 
                '적용된 화질': selectedText, 
                '적용 방식': selectedQuality ? '자동' : '실패' 
            }]);
            this.logger.groupEnd();

            // 이벤트 발생
            this.dispatchEvent(new CustomEvent('qualityApplied', {
                detail: { 
                    target: targetQuality, 
                    applied: selectedQuality,
                    success: !!selectedQuality
                }
            }));

        } catch (error) {
            this.logger.error(`[QualityManager] 화질 적용 실패: ${error.message}`);
            
            this.dispatchEvent(new CustomEvent('qualityError', {
                detail: { error: error.message }
            }));
            
        } finally {
            this.isApplying = false;
        }
    }

    /**
     * 실제 화질 선택 수행
     */
    async performQualitySelection(targetQuality) {
        // 1단계: 화질 설정 버튼 클릭
        const qualityButton = await this.asyncUtils.waitForElement(
            this.config.selectors.qualityBtn, 
            this.config.defaultTimeout
        );
        
        qualityButton.click();
        await this.asyncUtils.sleep(this.config.minTimeout);

        // 2단계: 화질 메뉴 클릭
        const qualityMenu = await this.asyncUtils.waitForElement(
            this.config.selectors.qualityMenu,
            this.config.defaultTimeout
        );
        
        qualityMenu.click();
        await this.asyncUtils.sleep(this.config.minTimeout);

        // 3단계: 화질 옵션들 조회
        const qualityItems = Array.from(
            document.querySelectorAll(this.config.selectors.qualityItems)
        );

        if (qualityItems.length === 0) {
            throw new Error('화질 옵션을 찾을 수 없음');
        }

        // 4단계: 최적 화질 선택
        const selectedItem = this.findBestQualityMatch(qualityItems, targetQuality);
        
        if (!selectedItem) {
            throw new Error('적합한 화질 옵션을 찾을 수 없음');
        }

        // 5단계: 화질 적용
        selectedItem.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true
        }));

        const selectedText = TextUtils.clean(selectedItem.textContent);
        const selectedQuality = TextUtils.extractResolution(selectedItem.textContent);

        return {
            quality: selectedQuality,
            text: selectedText
        };
    }

    /**
     * 최적의 화질 매치 찾기
     */
    findBestQualityMatch(qualityItems, targetQuality) {
        // 1순위: 정확한 해상도 매치
        let exactMatch = qualityItems.find(item => {
            const resolution = TextUtils.extractResolution(item.textContent);
            return resolution === targetQuality;
        });

        if (exactMatch) {
            this.logger.info(`[QualityManager] 정확한 매치 발견: ${targetQuality}p`);
            return exactMatch;
        }

        // 2순위: 가장 가까운 해상도 (아래쪽 우선)
        const qualityWithResolutions = qualityItems
            .map(item => ({
                element: item,
                resolution: TextUtils.extractResolution(item.textContent) || 0,
                text: item.textContent
            }))
            .filter(item => item.resolution > 0)
            .sort((a, b) => Math.abs(a.resolution - targetQuality) - Math.abs(b.resolution - targetQuality));

        if (qualityWithResolutions.length > 0) {
            const nearest = qualityWithResolutions[0];
            this.logger.info(`[QualityManager] 가장 가까운 화질 선택: ${nearest.resolution}p`);
            return nearest.element;
        }

        // 3순위: 해상도 패턴이 있는 첫 번째 항목
        const anyQualityItem = qualityItems.find(item => /\d+p/.test(item.textContent));
        if (anyQualityItem) {
            this.logger.warn('[QualityManager] 임의의 화질 옵션 선택');
            return anyQualityItem;
        }

        // 4순위: 첫 번째 항목
        this.logger.warn('[QualityManager] 기본 첫 번째 옵션 선택');
        return qualityItems[0];
    }

    /**
     * 저화질 감지 및 복구
     */
    async checkAndFixLowQuality(video) {
        if (!video || video.__qualityChecked) return;
        
        // 중복 체크 방지
        video.__qualityChecked = true;

        try {
            // 비디오 로딩 대기
            await this.asyncUtils.sleep(this.config.defaultTimeout);

            let videoHeight = video.videoHeight || 0;
            
            // 한 번 더 대기 후 재확인
            if (videoHeight === 0) {
                await this.asyncUtils.sleep(1000);
                videoHeight = video.videoHeight || 0;
            }

            if (videoHeight === 0) {
                this.logger.warn('[QualityManager] 비디오 높이를 감지할 수 없음');
                return;
            }

            // 저화질 감지 (360p 이하)
            if (videoHeight <= 360) {
                const preferredQuality = await this.getPreferredQuality();
                
                if (preferredQuality > videoHeight) {
                    this.logger.warn(
                        `[QualityManager] 저화질(${videoHeight}p) 감지, ${preferredQuality}p로 복구 시도`
                    );
                    
                    // 자동 복구 시도
                    await this.applyPreferredQuality();
                    
                    this.dispatchEvent(new CustomEvent('lowQualityDetected', {
                        detail: { 
                            detected: videoHeight, 
                            preferred: preferredQuality 
                        }
                    }));
                } else {
                    this.logger.info('[QualityManager] 현재 화질이 선호 설정과 일치함');
                }
            } else {
                this.logger.info(`[QualityManager] 적절한 화질 확인됨: ${videoHeight}p`);
            }

        } catch (error) {
            this.logger.error('[QualityManager] 화질 체크 실패:', error);
        }
    }

    /**
     * P2P 화질 비활성화 (원본 기능)
     */
    disableP2PQuality(responseData) {
        try {
            if (responseData.content?.p2pQuality) {
                responseData.content.p2pQuality = [];
                this.logger.info('[QualityManager] P2P 화질 비활성화됨');
                return true;
            }
            return false;
        } catch (error) {
            this.logger.error('[QualityManager] P2P 비활성화 실패:', error);
            return false;
        }
    }

    /**
     * 정리 메서드
     */
    destroy() {
        // 이벤트 리스너 제거
        document.body.removeEventListener('click', this.boundHandleManualSelect, {
            capture: true
        });
        
        this.logger.info('🎯 QualityManager 정리 완료');
    }
} 