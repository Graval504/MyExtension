// ==UserScript==
// @name Chzzk 올인원 스크립트 (Auto Quality + Ad Popup Removal + Unmute)
// @namespace http://tampermonkey.net/
// @version 3.7.1
// @description Chzzk 방송에서 자동 화질 설정, 광고 팝업 차단, 음소거 자동 해제, 스크롤 잠금 해제
// @match https://chzzk.naver.com/*
// @icon  https://chzzk.naver.com/favicon.ico
// @grant GM.getValue
// @grant GM.setValue
// @grant unsafeWindow
// @run-at document-start
// @license MIT
// @downloadURL https://update.greasyfork.org/scripts/534791/Chzzk%20%EC%98%AC%EC%9D%B8%EC%9B%90%20%EC%8A%A4%ED%81%AC%EB%A6%BD%ED%8A%B8%20%28Auto%20Quality%20%2B%20Ad%20Popup%20Removal%20%2B%20Unmute%29.user.js
// @updateURL https://update.greasyfork.org/scripts/534791/Chzzk%20%EC%98%AC%EC%9D%B8%EC%9B%90%20%EC%8A%A4%ED%81%AC%EB%A6%BD%ED%8A%B8%20%28Auto%20Quality%20%2B%20Ad%20Popup%20Removal%20%2B%20Unmute%29.meta.js
// ==/UserScript==
(function () {
    const originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function (child) {
        if (!child || child.parentNode !== this) return child;
        return originalRemoveChild.call(this, child);
    };

    class VideoController {
        constructor({ volumeStep = 0.05, videoSelector = 'video', fullscreenBtnLabels = ['넓은 화면', '좁은 화면'] } = {}) {
            this.volumeStep = volumeStep;
            this.videoSelector = videoSelector;
            this.fullscreenBtnLabels = fullscreenBtnLabels;
            this.init();
        }

        skip(target) {
            return ['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable;
        }

        getToggleBtn() {
            const selector = this.fullscreenBtnLabels
                .map(label => `button[aria-label="${label}"]`)
                .join(',');
            return document.querySelector(selector);
        }
        showVolumeTooltip(pct) {
            const container = document.querySelector('.volume_tooltip');
            if (!container) return;
            container.style.display = 'inline-flex';
            container.style.alignItems = 'center';
            container.style.justifyContent = 'center';

            container.textContent = '';

            const btnIcon = document.querySelector('.pzp-volume-button__icon');
            if (btnIcon) {
                const iconClone = btnIcon.cloneNode(true);
                iconClone.classList.add('volume_icon__imkf4');

                iconClone.style.marginRight = '4px';

                const svg = iconClone.tagName === 'svg'
                    ? iconClone
                    : iconClone.querySelector('svg');
                if (svg) {
                    svg.removeAttribute('width');
                    svg.removeAttribute('height');
                    svg.setAttribute('viewBox', '0 0 36 36');
                    svg.style.width = '36px';
                    svg.style.height = '36px';
                }

                container.appendChild(iconClone);
            }

            const textNode = document.createTextNode(pct + '%');
            container.appendChild(textNode);

            container.classList.add('volume_tooltip__Bt5b8', 'volume_active__CLOIh');
            clearTimeout(container._tipTimer);
            container._tipTimer = setTimeout(() => {
                container.classList.remove('volume_active__CLOIh');
            }, 800);
        }

        actions = {
            Space: video => video.paused ? video.play() : video.pause(),
            k: video => video.paused ? video.play() : video.pause(),
            m: video => video.muted = !video.muted,
            t: () => {
                const btn = this.getToggleBtn();
                btn && btn.click();
            },
            f: video => {
                if (document.fullscreenElement) document.exitFullscreen();
                else if (video.requestFullscreen) video.requestFullscreen();
            },
            arrowup: video => {
                video.volume = Math.min(1, video.volume + this.volumeStep);
                this.showVolumeTooltip(Math.round(video.volume * 100));
            },
            arrowdown: video => {
                video.volume = Math.max(0, video.volume - this.volumeStep);
                this.showVolumeTooltip(Math.round(video.volume * 100));
            }
        };

        handleKeyDown = e => {
            if (this.skip(e.target) || e.ctrlKey || e.altKey || e.metaKey) return;

            const video = document.querySelector(this.videoSelector);
            if (!video) return;
            const key = e.code === 'Space' ? 'Space' : e.key.toLowerCase();
            const action = this.actions[key];
            if (action) {
                action(video);
                e.preventDefault();
                e.stopPropagation();
            }
        }
        init() {
            document.addEventListener('keydown', this.handleKeyDown, true);
        }
    }
    new VideoController();
})();

(async () => {
    "use strict";
    const APPLY_COOLDOWN = 1000;
    const CONFIG = {
        minTimeout: 500,
        defaultTimeout: 2000,
        storageKeys: {
            quality: "chzzkPreferredQuality",
            autoUnmute: "chzzkAutoUnmute",
            debugLog: "chzzkDebugLog",
            screenSharpness: "chzzkScreenSharp",
        },
        selectors: {
            popup: 'div[class^="popup_container"]',
            qualityBtn: 'button[command="SettingCommands.Toggle"]',
            qualityMenu: 'div[class*="pzp-pc-setting-intro-quality"]',
            qualityItems: 'li.pzp-ui-setting-quality-item[role="menuitem"]',
            headerMenu: ".header_service__DyG7M",
        },
        styles: {
            success: "font-weight:bold; color:green",
            error: "font-weight:bold; color:red",
            info: "font-weight:bold; color:skyblue",
            warn: "font-weight:bold; color:orange",
        },
    };

    const common = {
        regex: {
            adBlockDetect: /광고\s*차단\s*프로그램.*사용\s*중/i,
        },
        async: {
            sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
            waitFor: (selector, timeout = CONFIG.defaultTimeout) => {
                const effective = Math.max(timeout, CONFIG.minTimeout);
                return new Promise((resolve, reject) => {
                    const el = document.querySelector(selector);
                    if (el) return resolve(el);
                    const mo = new MutationObserver(() => {
                        const found = document.querySelector(selector);
                        if (found) {
                            mo.disconnect();
                            resolve(found);
                        }
                    });
                    mo.observe(document.body, {
                        childList: true,
                        subtree: true
                    });
                    setTimeout(() => {
                        mo.disconnect();
                        reject(new Error("Timeout waiting for " + selector));
                    }, effective);
                });
            },
        },
        text: {
            clean: (txt) => txt.trim().split(/\s+/).filter(Boolean).join(", "),
            extractResolution: (txt) => {
                const m = txt.match(/(\d{3,4})p/);
                return m ? parseInt(m[1], 10) : null;
            },
        },
        dom: {
            remove: (el) => el?.remove(),
            clearStyle: (el) => el?.removeAttribute("style"),
        },
        log: {
            DEBUG: true,
            info: (...args) => common.log.DEBUG && console.log(...args),
            success: (...args) => common.log.DEBUG && console.log(...args),
            warn: (...args) => common.log.DEBUG && console.warn(...args),
            error: (...args) => common.log.DEBUG && console.error(...args),
            groupCollapsed: (...args) => common.log.DEBUG && console.groupCollapsed(...args),
            table: (...args) => common.log.DEBUG && console.table(...args),
            groupEnd: (...args) => common.log.DEBUG && console.groupEnd(...args),
        },
        observeElement: (selector, callback, once = true) => {
            const mo = new MutationObserver(() => {
                const el = document.querySelector(selector);
                if (el) callback(el);
                if (once) mo.disconnect();
            });
            mo.observe(document.body, {
                childList: true,
                subtree: true
            });
            const initial = document.querySelector(selector);
            if (initial) {
                callback(initial);
                if (once) mo.disconnect();
            }
        },
    };
    async function addHeaderMenu() {
        const toolbar = await common.async.waitFor('.toolbar_section__IPbBC');
        if (!toolbar || toolbar.querySelector('.allinone-settings-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'toolbar_item__Kbygr allinone-settings-wrapper';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'toolbar_item__Kbygr allinone-settings-button';
        btn.innerHTML =
        `
        <svg class="toolbar_icon__Nh7GG" width="40" height="40" color="inherit" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <g transform="translate(8,8)">
        <path d="M4.5 12a7.5 7.5 0 0 0 15 0m-15 0a7.5 7.5 0 1 1 15 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077 1.41-.513m14.095-5.13 1.41-.513M5.106 17.785l1.15-.964m11.49-9.642 1.149-.964M7.501 19.795l.75-1.3m7.5-12.99.75-1.3m-6.063 16.658.26-1.477m2.605-14.772.26-1.477m0 17.726-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205 12 12m6.894 5.785-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495"></path></svg>
        <span class="toolbar_label__3AENG">올인원 환경설정</span>
        `;

        wrapper.appendChild(btn);

        const profileItem = toolbar.querySelector('.toolbar_profile__k50kI');
        if (profileItem) toolbar.insertBefore(wrapper, profileItem);
        else toolbar.appendChild(wrapper);

        const menu = document.createElement('div');
        menu.className = 'allinone-settings-menu';
        Object.assign(menu.style, {
            position: 'absolute',
            background: 'var(--color-bg-layer-02)',
            borderRadius: '10px',
            boxShadow: '0 8px 20px var(--color-shadow-layer01-02), 0 0 1px var(--color-shadow-layer01-01)',
            color: 'var(--color-content-03)',
            overflow: 'auto',
            padding: '18px',
            right: '10px',
            top: 'calc(100% + 7px)',
            width: '240px',
            zIndex: 13000,
        });
        const helpContent = document.createElement('div');
        helpContent.className = 'allinone-help-content';
        Object.assign(helpContent.style, {
            display: 'none',
            margin: '4px 0',
            padding: '4px 8px 4px 34px',
            fontFamily: 'Sandoll Nemony2, Apple SD Gothic NEO, Helvetica Neue, Helvetica, NanumGothic, Malgun Gothic, gulim, noto sans, Dotum, sans-serif',
            fontSize: '14px',
            color: 'var(--color-content-03)',
            whiteSpace: 'pre-wrap',
        });
        helpContent.innerHTML =
            '<h2 style="color: var(--color-content-chzzk-02); margin-bottom:6px;">메뉴 사용법</h2>' +
            '<div style="white-space:pre-wrap; line-height:1.4; font-size:14px; color:inherit;">' +
            '<strong style="display:block; font-weight:600; margin:6px 0 2px;">1. 자동 언뮤트</strong>' +
            '방송이 시작되면 자동으로 음소거를 해제합니다. 간헐적으로 음소거 상태로 전환되는 문제를 보완하기 위해 추가된 기능입니다.\n\n' +
            '<strong style="display:block; font-weight:600; margin:6px 0 2px;">2. 선명한 화면</strong>' +
            '“선명한 화면 2.0” 옵션을 활성화하면 개발자가 제작한 외부 스크립트를 적용하여, 기본 제공되는 선명도 기능을 대체합니다.' +
            '</div>';
        const helpBtn = document.createElement('button');
        helpBtn.className = 'allinone-settings-item';
        helpBtn.style.display = 'flex';
        helpBtn.style.alignItems = 'center';
        helpBtn.style.margin = '8px 0';
        helpBtn.style.padding = '4px 8px';
        helpBtn.style.fontFamily = 'Sandoll Nemony2, Apple SD Gothic NEO, Helvetica Neue, Helvetica, NanumGothic, Malgun Gothic, gulim, noto sans, Dotum, sans-serif';
        helpBtn.style.fontSize = '14px';
        helpBtn.style.color = 'inherit';
        helpBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:10px;" color="inherit">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 1 1 5.82 1c-.5 1.3-2.91 2-2.91 2"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <span style="margin-left:8px">도움말</span>
        `;
        helpBtn.addEventListener('click', () => {
            helpContent.style.display = helpContent.style.display === 'none' ? 'block' : 'none';
        });

        menu.appendChild(helpBtn);
        menu.appendChild(helpContent);
        const unmuteSvgOff = `<svg class="profile_layer_icon__7g3e-" xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"/></svg>`;
        const unmuteSvgOn = `<svg class="profile_layer_icon__7g3e-" xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"/></svg>`;
        const sharpSvg = `<svg class="profile_layer_icon__7g3e-" xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125Z"/></svg>`;

        const items = [{
            key: CONFIG.storageKeys.autoUnmute,
            svg: unmuteSvgOff,
            onSvg: unmuteSvgOn,
            label: '자동 언뮤트'
        },
        {
            key: CONFIG.storageKeys.screenSharpness,
            svg: sharpSvg,
            onSvg: sharpSvg,
            label: '선명한 화면 2.0'
        },
        ];
        items.forEach(item => {
            const itemBtn = document.createElement('button');
            itemBtn.className = 'allinone-settings-item';
            itemBtn.style.display = 'flex';
            itemBtn.style.alignItems = 'center';
            itemBtn.style.margin = '8px 0';
            itemBtn.style.padding = '4px 8px';
            itemBtn.style.fontFamily = 'Sandoll Nemony2, Apple SD Gothic NEO, Helvetica Neue, Helvetica, NanumGothic, Malgun Gothic, gulim, noto sans, Dotum, sans-serif';
            itemBtn.style.fontSize = '14px';
            itemBtn.style.color = 'inherit';
            itemBtn.innerHTML = `
            ${item.svg}
            <span style="margin-left:8px">${item.label}${item.key ? ' <span class="state-text">OFF</span>' : ''}</span>
            `;

            if (!item.key) {
                itemBtn.style.opacity = '1';
                itemBtn.addEventListener('click', item.onClick);
            } else {
                GM.getValue(item.key, false).then(active => {
                    itemBtn.style.opacity = active ? '1' : '0.4';
                    if (active) itemBtn.querySelector('svg').outerHTML = item.onSvg;
                    const stateSpan = itemBtn.querySelector('.state-text');
                    stateSpan.textContent = active ? 'ON' : 'OFF';
                });
                itemBtn.addEventListener('click', async () => {
                    const active = await GM.getValue(item.key, false);
                    const newActive = !active;

                    await GM.setValue(item.key, newActive);

                    setTimeout(() => {
                        location.reload();
                    }, 100);
                });
            }

            menu.appendChild(itemBtn);
        });

        document.body.appendChild(menu);

        btn.addEventListener('click', e => {
            e.stopPropagation();
            const rect = btn.getBoundingClientRect();
            menu.style.top = `${rect.bottom + 4}px`;
            menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
        });

        document.addEventListener('click', e => {
            if (!menu.contains(e.target) && e.target !== btn)
                menu.style.display = 'none';
        });
    }

    window.addHeaderMenu = addHeaderMenu;

    window.toggleDebugLogs = async () => {
        const key = CONFIG.storageKeys.debugLog;
        const current = await GM.getValue(key, false);
        const next = !current;
        await GM.setValue(key, next);
        common.log.DEBUG = next;
        console.log(`🛠️ Debug logs ${next ? 'ENABLED' : 'DISABLED'}`);
    };

    window.toggleDebugLogs = async () => {
        const key = CONFIG.storageKeys.debugLog;
        const current = await GM.getValue(key, false);
        const next = !current;
        await GM.setValue(key, next);
        common.log.DEBUG = next;
        console.log(`🛠️ Debug logs ${next ? 'ENABLED' : 'DISABLED'}`);
    };

    const quality = {
        observeManualSelect() {
            document.body.addEventListener(
                "click",
                async (e) => {
                    const li = e.target.closest('li[class*="quality"]');
                    if (!li) return;
                    const raw = li.textContent;
                    const res = common.text.extractResolution(raw);
                    if (res) {
                        await GM.setValue(CONFIG.storageKeys.quality, res);
                        common.log.groupCollapsed("%c💾 [Quality] 수동 화질 저장됨", CONFIG.styles.success);
                        common.log.table([{ "선택 해상도": res, 원본: common.text.clean(raw) }]);
                        common.log.groupEnd();
                    }
                }, {
                capture: true
            }
            );
        },

        async getPreferred() {
            const stored = await GM.getValue(CONFIG.storageKeys.quality, 1080);
            return parseInt(stored, 10);
        },

        async applyPreferred() {
            const now = Date.now();
            if (this._applying || now - this._lastApply < APPLY_COOLDOWN) return;
            this._applying = true;
            this._lastApply = now;

            const target = await this.getPreferred();
            let cleaned = "(선택 실패)", pick = null;
            try {
                const btn = await common.async.waitFor(CONFIG.selectors.qualityBtn);
                btn.click();
                const menu = await common.async.waitFor(CONFIG.selectors.qualityMenu);
                menu.click();
                await common.async.sleep(CONFIG.minTimeout);

                const items = Array.from(
                    document.querySelectorAll(CONFIG.selectors.qualityItems)
                );
                pick =
                    items.find(
                        (i) => common.text.extractResolution(i.textContent) === target
                    ) ||
                    items.find((i) => /\d+p/.test(i.textContent)) ||
                    items[0];
                cleaned = pick ? common.text.clean(pick.textContent) : cleaned;
                if (pick)
                    pick.dispatchEvent(new KeyboardEvent("keydown", {
                        key: "Enter"
                    }));
                else common.log.warn("[Quality] 화질 항목을 찾지 못함");
            } catch (e) {
                common.log.error(`[Quality] 선택 실패: ${e.message}`);
            }
            common.log.groupCollapsed("%c⚙️ [Quality] 자동 화질 적용", CONFIG.styles.info);
            common.log.table([{ "대상 해상도": target }]);
            common.log.table([{ "선택 화질": cleaned, "선택 방식": pick ? "자동" : "없음" }]);
            common.log.groupEnd();
            this._applying = false;
        },
    };

    const handler = {
        interceptXHR() {
            const oOpen = XMLHttpRequest.prototype.open;
            const oSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.open = function (m, u, ...a) {
                this._url = u;
                return oOpen.call(this, m, u, ...a);
            };
            XMLHttpRequest.prototype.send = function (body) {
                if (this._url?.includes("live-detail")) {
                    this.addEventListener("readystatechange", () => {
                        if (this.readyState === 4 && this.status === 200) {
                            try {
                                const data = JSON.parse(this.responseText);
                                if (data.content?.p2pQuality) {
                                    data.content.p2pQuality = [];
                                    const mod = JSON.stringify(data);
                                    Object.defineProperty(this, "responseText", {
                                        value: mod
                                    });
                                    Object.defineProperty(this, "response", {
                                        value: mod
                                    });
                                    setTimeout(() => quality.applyPreferred(), CONFIG.minTimeout);
                                }
                            } catch (e) {
                                common.log.error(`[XHR] JSON 파싱 오류: ${e.message}`);
                            }
                        }
                    });
                }
                return oSend.call(this, body);
            };
            common.log.info("[XHR] live-detail 요청 감시 시작");
        },
        trackURLChange() {
            let lastUrl = location.href;
            let lastId = null;

            const getId = (url) => (url.match(/live\/([\w-]+)/) ?? [])[1] || null;

            const onUrlChange = () => {
                const currentUrl = location.href;
                if (currentUrl === lastUrl) return;

                lastUrl = currentUrl;

                const id = getId(currentUrl);
                if (!id) {
                    common.log.info("[URLChange] 방송 ID 없음");
                } else if (id !== lastId) {
                    lastId = id;
                    setTimeout(() => {
                        quality.applyPreferred();
                        injectSharpnessScript();
                    }, CONFIG.minTimeout);
                } else {
                    common.log.warn(`[URLChange] 같은 방송(${id}), 스킵`);
                }
                const svg = document.getElementById("sharpnessSVGContainer");
                const style = document.getElementById("sharpnessStyle");
                if (svg) svg.remove();
                if (style) style.remove();
                if (window.sharpness) {
                    window.sharpness.init();
                    window.sharpness.observeMenus();
                }
            };
            ["pushState", "replaceState"].forEach((method) => {
                const original = history[method];
                history[method] = function (...args) {
                    const result = original.apply(this, args);
                    window.dispatchEvent(new Event("locationchange"));
                    return result;
                };
            });
            window.addEventListener("popstate", () =>
                window.dispatchEvent(new Event("locationchange"))
            );
            window.addEventListener("locationchange", onUrlChange);
        },
    };

    const observer = {
        start() {
            const mo = new MutationObserver((muts) => {
                for (const mut of muts) {
                    for (const node of mut.addedNodes) {
                        if (node.nodeType !== 1) continue;
                        this.tryRemoveAdPopup(node);
                        let vid = null;
                        if (node.tagName === "VIDEO") vid = node;
                        else if (node.querySelector?.("video"))
                            vid = node.querySelector("video");
                        if (/^\/live\/[^/]+/.test(location.pathname) && vid) {
                            this.unmuteAll(vid);
                            checkAndFixLowQuality(vid);

                            (async () => {
                                await new Promise((resolve) => {
                                    const waitForReady = () => {
                                        if (vid.readyState >= 4) return resolve();
                                        setTimeout(waitForReady, 100);
                                    };
                                    waitForReady();
                                });

                                try {
                                    await vid.play();
                                    common.log.success("%c▶️ [AutoPlay] 재생 성공", CONFIG.styles.info);
                                } catch (e) {
                                    common.log.error(`⚠️ [AutoPlay] 재생 실패: ${e.message}`);
                                }
                            })();
                        }
                    }
                }
                if (document.body.style.overflow === "hidden") {
                    common.dom.clearStyle(document.body);
                    common.log.info("[BodyStyle] overflow:hidden 제거됨");
                }
            });
            mo.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["style"],
            });
            common.log.info("[Observer] 통합 감시 시작");
        },

        async unmuteAll(video) {
            const autoUnmute = await GM.getValue(CONFIG.storageKeys.autoUnmute, true);
            if (!autoUnmute) return common.log.info("[Unmute] 설정에 따라 스킵");
            if (video.muted) {
                video.muted = false;
                common.log.success("[Unmute] video.muted 해제");
            }
            const btn = document.querySelector('button.pzp-pc-volume-button[aria-label*="음소거 해제"]');
            if (btn) {
                btn.click();
                common.log.success("[Unmute] 버튼 클릭");
            }
        },

        async tryRemoveAdPopup(node) {
            try {
                const txt = node.innerText || "";
                if (common.regex.adBlockDetect.test(txt)) {
                    const cont = node.closest(CONFIG.selectors.popup) || node;
                    cont.remove();
                    common.dom.clearStyle(document.body);
                    common.log.groupCollapsed("%c✅ [AdPopup] 제거 성공", CONFIG.styles.success);
                    common.log.table([{ "제거된 텍스트": txt.slice(0, 100), 클래스: cont.className }]);
                    common.log.groupEnd();
                }
            } catch (e) {
                common.log.error(`[AdPopup] 제거 실패: ${e.message}`);
            }
        },
    };

    async function checkAndFixLowQuality(video) {
        if (!video || video.__checkedAlready) return;
        video.__checkedAlready = true;

        await common.async.sleep(CONFIG.defaultTimeout);

        let height = video.videoHeight || 0;
        if (height === 0) {
            await common.async.sleep(1000);
            height = video.videoHeight || 0;
        }
        if (height === 0) {
            return;
        }

        if (height <= 360) {
            const preferred = await quality.getPreferred();
            if (preferred !== height) {
                common.log.warn(
                    `[QualityCheck] 저화질(${height}p) 감지, ${preferred}p로 복구`
                );
                await quality.applyPreferred();
            } else {
                common.log.warn(
                    "[QualityCheck] 현재 해상도가 사용자 선호값과 동일하여 복구 생략"
                );
            }
        }
    }

    async function setDebugLogging() {
        common.log.DEBUG = await GM.getValue(CONFIG.storageKeys.debugLog, false);
    }

    async function injectSharpnessScript() {
        const enabled = await GM.getValue(CONFIG.storageKeys.screenSharpness, false);
        if (!enabled) return;
        const script = document.createElement("script");
        script.src = "https://update.greasyfork.org/scripts/534918/Chzzk%20%EC%84%A0%EB%AA%85%ED%95%9C%20%ED%99%94%EB%A9%B4%20%EC%97%85%EA%B7%B8%EB%A0%88%EC%9D%B4%EB%93%9C.user.js";
        script.async = true;
        document.head.appendChild(script);
        common.log.success("%c[Sharpness] 외부 스크립트 삽입 완료", CONFIG.styles.info);
    }

    async function init() {
        await setDebugLogging();
        if (document.body.style.overflow === "hidden") {
            common.dom.clearStyle(document.body);
            common.log.success("[Init] overflow 잠금 해제");
        }
        if ((await GM.getValue(CONFIG.storageKeys.quality)) === undefined) {
            await GM.setValue(CONFIG.storageKeys.quality, 1080);
            common.log.success("[Init] 기본 화질 1080 저장");
        }
        if ((await GM.getValue(CONFIG.storageKeys.autoUnmute)) === undefined) {
            await GM.setValue(CONFIG.storageKeys.autoUnmute, true);
            common.log.success("[Init] 기본 언뮤트 ON 저장");
        }
        await addHeaderMenu();
        common.observeElement(
            CONFIG.selectors.headerMenu,
            () => {
                addHeaderMenu().catch(console.error);
            }, false);

        await quality.applyPreferred();
        await injectSharpnessScript();
    }

    function onDomReady() {
        console.log("%c🔔 [ChzzkHelper] 스크립트 시작", CONFIG.styles.info);
        quality.observeManualSelect();
        observer.start();
        init().catch(console.error);
    }

    handler.interceptXHR();
    handler.trackURLChange();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", onDomReady);
    } else {
        onDomReady();
    }
})();