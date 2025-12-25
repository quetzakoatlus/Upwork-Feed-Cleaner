// ==UserScript==
// @name         Upwork Insight Pro
// @namespace    http://tampermonkey.net/
// @version      13.13
// @description  A powerful, all-in-one userscript that enhances the Upwork "Search" and "Job Feed" experience. It provides real-time client statistics, advanced filtering (by country, budget, proposals), and integrates Google Gemini AI to analyze job descriptions instantly.
// @author       You
// @match        https://www.upwork.com/nx/search/jobs/*
// @match        https://www.upwork.com/ab/search/jobs/*
// @match        https://www.upwork.com/nx/find-work/*
// @match        https://www.upwork.com/ab/find-work/*
// @connect      generativelanguage.googleapis.com
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // --- 🔧 CONFIGURABLE SELECTORS ---
    const SELECTORS = {
        jobPage: {
            description: '.job-description, [data-test="job-description-text"]',
            clientStatsItem: '.ca-item',
            statTitle: '.title',
            statValue: '.value'
        },
        search: {
            tile: 'article[data-test="JobTile"]',
            titleLink: 'h2.job-tile-title a, h2 a',
            paymentUnverifiedIcon: '.air3-icon-payment-unverified',
            location: '[data-test="location"]'
        },
        feed: {
            tile: 'section.air3-card-section',
            titleLink: 'h3.job-tile-title a',
            budget: '[data-test="budget"]',
            proposals: '[data-test="proposals"]',
            country: '[data-test="client-country"]',
            paymentUnverifiedIcon: '.is-unverified'
        },
        sliderPanel: '.air3-slider-content, .air3-slider'
    };

    // --- ⏱️ TIMING ---
    const TIMING = {
        SCAN_MIN_MS: 2000,
        SCAN_MAX_MS: 3000,
        REACTION_MIN_MS: 100,
        REACTION_MAX_MS: 500,
        HOVER_EXPAND_MS: 1000,
        UI_BUFFER_MS: 50
    };

    // --- DEFAULTS ---
    const DEFAULTS = {
        API_KEY: '',
        MIN_HOURLY: 35,
        MIN_FIXED: 100,
        TH_HOURLY_GOOD: 35,
        TH_HOURLY_BAD: 20,
        TH_INTV_GOOD: 0,
        TH_INTV_WARN: 5,
        BAD_COUNTRIES: "India, Pakistan, Bangladesh, Kenya, Nigeria, Philippines, Egypt, Vietnam, Nepal",
        MAX_PROPOSALS: "20 to 50, 50+",
        TITLE_KEYWORDS: "",
        AI_PROMPT: "Evaluate this job from the perspective of a senior freelancer. Is there scope creep? Is the budget realistic?",
        AI_MODEL: "gemini-2.0-flash-exp",
        THEME: 'dark',
        PAYMENT_FILTER: false
    };

    // --- SETTINGS ---
    const SETTINGS = {
        apiKey: GM_getValue('apiKey', DEFAULTS.API_KEY),
        minHourly: GM_getValue('minHourly', DEFAULTS.MIN_HOURLY),
        minFixed: GM_getValue('minFixed', DEFAULTS.MIN_FIXED),
        thHourlyGood: GM_getValue('thHourlyGood', DEFAULTS.TH_HOURLY_GOOD),
        thHourlyBad: GM_getValue('thHourlyBad', DEFAULTS.TH_HOURLY_BAD),
        thIntvGood: GM_getValue('thIntvGood', DEFAULTS.TH_INTV_GOOD),
        thIntvWarn: GM_getValue('thIntvWarn', DEFAULTS.TH_INTV_WARN),
        badCountries: GM_getValue('badCountries', DEFAULTS.BAD_COUNTRIES).split(',').map(s => s.trim()).filter(s => s),
        maxProposals: GM_getValue('maxProposals', DEFAULTS.MAX_PROPOSALS).split(',').map(s => s.trim()).filter(s => s),
        titleKeywords: GM_getValue('titleKeywords', DEFAULTS.TITLE_KEYWORDS).split(',').map(s => s.trim().toLowerCase()).filter(s => s),
        aiPrompt: GM_getValue('customPrompt', DEFAULTS.AI_PROMPT),
        aiModel: GM_getValue('selectedModel', DEFAULTS.AI_MODEL),
        paymentFilter: GM_getValue('paymentFilter', DEFAULTS.PAYMENT_FILTER),
        panelTop: GM_getValue('panelTop', '120px'),
        panelLeft: GM_getValue('panelLeft', 'calc(100vw - 380px)'),
        isOpen: GM_getValue('isOpen', true),
        theme: GM_getValue('theme', DEFAULTS.THEME)
    };

    const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    // --- UI MANAGER ---
    const UI = {
        injectStyles: () => {
            if (document.getElementById('ui-pro-styles')) return;
            const s = document.createElement('style');
            s.id = 'ui-pro-styles';
            s.textContent = `
                :root {
                    --ui-bg: #0f172a; --ui-bg-input: #1e293b; --ui-border: #334155;
                    --ui-text-main: #ffffff; --ui-text-muted: #cbd5e1;
                    --ui-btn-bg: #10b981; --ui-btn-text: #ffffff; --ui-shadow: 0 10px 50px rgba(0,0,0,0.7);
                    --c-green: #059669; --c-red: #e11d48; --c-blue: #2563eb;
                    --c-orange: #d97706; --c-dark: #334155; --c-yellow: #ca8a04;
                }
                body[data-ui-theme="light"] {
                    --ui-bg: #ffffff; --ui-bg-input: #f1f5f9; --ui-border: #cbd5e1;
                    --ui-text-main: #020617; --ui-text-muted: #475569;
                    --ui-btn-bg: #059669; --ui-btn-text: #ffffff; --ui-shadow: 0 10px 30px rgba(0,0,0,0.15);
                    --c-green: #166534; --c-red: #be123c; --c-blue: #1e40af;
                    --c-orange: #b45309; --c-dark: #475569; --c-yellow: #a16207;
                }
                #ui-dock-icon { position: fixed; bottom: 30px; right: 30px; width: 60px; height: 60px; border-radius: 50%; background: var(--ui-btn-bg); color: var(--ui-btn-text); display: flex; align-items: center; justify-content: center; font-size: 28px; cursor: pointer; z-index: 999999; box-shadow: 0 4px 15px rgba(0,0,0,0.4); transition: transform 0.2s; }
                #ui-dock-icon:hover { transform: scale(1.1); }
                #ui-floating-panel { position: fixed; width: 340px; background: var(--ui-bg); border: 1px solid var(--ui-border); border-radius: 12px; z-index: 999999; box-shadow: var(--ui-shadow); color: var(--ui-text-main); font-family: sans-serif; display: none; flex-direction: column; max-height: 85vh; overflow: hidden; }
                #ui-floating-panel.visible { display: flex; }
                .ui-drag-handle { background: var(--ui-bg-input); padding: 14px; cursor: move; font-size: 11px; font-weight: 800; color: var(--ui-btn-bg); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--ui-border); }
                .ui-panel-scroll { padding: 0; overflow-y: auto; display: flex; flex-direction: column; }

                /* SCOPED STYLES TO #ui-floating-panel */
                #ui-floating-panel details { border-bottom: 1px solid var(--ui-border); }
                #ui-floating-panel details:last-of-type { border-bottom: none; }
                #ui-floating-panel summary { padding: 12px 15px; cursor: pointer; font-size: 11px; font-weight: 900; color: var(--ui-text-muted); display: flex; justify-content: space-between; letter-spacing: 0.5px; }
                #ui-floating-panel .ui-acc-content { padding: 15px; border-top: 1px solid var(--ui-border); }
                #ui-floating-panel label { font-size: 10px; color: var(--ui-text-muted); font-weight: 800; margin-bottom: 5px; display: block; letter-spacing: 0.5px; }

                /* Scoped Inputs */
                #ui-floating-panel input:not([type="checkbox"]),
                #ui-floating-panel textarea,
                #ui-floating-panel select { background: var(--ui-bg-input); border: 1px solid var(--ui-border); color: var(--ui-text-main); border-radius: 6px; padding: 10px; font-size: 11px; width: 100%; box-sizing: border-box; }

                #ui-floating-panel input:focus,
                #ui-floating-panel textarea:focus { border-color: var(--ui-btn-bg); outline: none; }
                #ui-floating-panel textarea { resize: none; overflow-y: hidden; min-height: 40px; font-family: sans-serif; line-height: 1.4; transition: height 0.1s; }

                .ui-btn-save { background: var(--ui-btn-bg); color: var(--ui-btn-text); border: none; padding: 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 11px; width: 100%; margin: 15px 0; letter-spacing: 0.5px; }

                /* CUSTOM TOOLTIPS */
                [data-tooltip] { position: relative; cursor: help; }
                [data-tooltip]:hover::after { content: attr(data-tooltip); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%) translateY(-5px); background: #000; color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 10px; font-weight: 500; white-space: pre-wrap; width: 200px; text-align: center; z-index: 1000000; box-shadow: 0 4px 15px rgba(0,0,0,0.5); border: 1px solid #333; line-height: 1.4; pointer-events: none; }
                [data-tooltip]:hover::before { content: ''; position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%) translateY(5px); border: 5px solid transparent; border-top-color: #000; pointer-events: none; }

                .ui-is-collapsed { border: 1px dashed var(--ui-border) !important; opacity: 0.7; margin-bottom: 10px !important; padding-bottom: 0 !important; height: auto !important; overflow: hidden !important; }
                .ui-temp-expand { opacity: 1 !important; border: 1px solid var(--ui-btn-bg) !important; box-shadow: 0 5px 20px rgba(0,0,0,0.3); }
                .ui-is-collapsed:not(.ui-temp-expand) > *:not(.ui-warning-label) { display: none !important; }
                .ui-warning-label { background: var(--ui-bg); border: 1px solid var(--ui-border); color: var(--ui-text-muted); padding: 10px 14px; border-radius: 8px; font-size: 11px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-weight: bold; }

                .ui-dash-outer { margin: 12px 0; display: flex; flex-direction: column; gap: 8px; width: 100%; }
                .ui-dash-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; }
                .ui-card { padding: 8px 2px; border-radius: 6px; text-align: center; cursor: help; }
                .ui-card b { font-size: 11px; color: #fff; display: block; font-weight: 900; }
                .ui-card span { font-size: 8px; color: rgba(255,255,255,0.95); font-weight: bold; display: block; margin-top: 3px; letter-spacing: 0.3px; }
                .ui-ai-row { background: rgba(37, 99, 235, 0.1); border: 1px solid var(--c-blue); border-radius: 8px; padding: 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; }

                .ui-checkbox-wrapper { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer; font-size: 11px; font-weight: bold; color: var(--ui-text-muted); }
                .ui-checkbox-wrapper input[type="checkbox"] { width: auto; margin: 0; cursor: pointer; accent-color: var(--ui-btn-bg); transform: scale(1.1); }
            `;
            document.head.appendChild(s);
        },
        autoResize: (el) => { if (!el) return; el.style.height = 'auto'; el.style.height = (el.scrollHeight) + 'px'; },
        toggleTheme: () => {
            const next = SETTINGS.theme === 'dark' ? 'light' : 'dark';
            SETTINGS.theme = next;
            GM_setValue('theme', next);
            document.body.setAttribute('data-ui-theme', next);
        },
        toggle: (open) => {
            const panel = document.getElementById('ui-floating-panel');
            if (panel) {
                if (open) panel.classList.add('visible');
                else panel.classList.remove('visible');
                GM_setValue('isOpen', open);
                if(open) setTimeout(() => { panel.querySelectorAll('textarea').forEach(UI.autoResize); }, TIMING.UI_BUFFER_MS);
            }
        },
        init: () => {
            if (document.getElementById('ui-dock-icon')) return;
            UI.injectStyles();
            document.body.setAttribute('data-ui-theme', SETTINGS.theme);

            const icon = document.createElement('div'); icon.id = 'ui-dock-icon'; icon.innerHTML = '🧠';
            icon.onclick = () => UI.toggle(!document.getElementById('ui-floating-panel').classList.contains('visible'));
            document.body.appendChild(icon);

            const panel = document.createElement('div'); panel.id = 'ui-floating-panel';
            let top = SETTINGS.panelTop; let left = SETTINGS.panelLeft;
            if (parseInt(top) < 0 || parseInt(left) < 0) { top = '100px'; left = 'auto'; panel.style.right = '20px'; }
            else { panel.style.top = top; panel.style.left = left; }

            panel.innerHTML = `
                <div class="ui-drag-handle">
                    <span>UPWORK UNIFIED v13.13</span>
                    <div style="display:flex; gap:12px; align-items:center;">
                        <span id="ui-theme-icon" style="cursor:pointer;">${SETTINGS.theme === 'dark' ? '🌙' : '☀️'}</span>
                        <span id="ui-panel-hide-btn" style="cursor:pointer; font-size:16px;">×</span>
                    </div>
                </div>
                <div class="ui-panel-scroll">
                    <details open>
                        <summary>Filters (Hide Jobs)</summary>
                        <div class="ui-acc-content">
                            <div style="display:flex; gap:15px; margin-bottom:15px;">
                                <div style="flex:1"><label data-tooltip="Jobs paying less than this hourly rate will be hidden.">Min. Hourly Rate</label><input type="number" id="ui-min-hourly" value="${SETTINGS.minHourly}"></div>
                                <div style="flex:1"><label data-tooltip="Fixed-price jobs with a budget lower than this will be hidden.">Min. Budget</label><input type="number" id="ui-min-fixed" value="${SETTINGS.minFixed}"></div>
                            </div>
                            <div style="margin-bottom:15px;"><label data-tooltip="Hide jobs that already have this many proposals. Comma separated. Example: '20 to 50, 50+'">Proposal Filter</label><input type="text" id="ui-max-proposals" value="${GM_getValue('maxProposals', DEFAULTS.MAX_PROPOSALS)}"></div>
                            <div style="margin-bottom:15px;"><label data-tooltip="Enter country names (comma separated) to hide jobs from these locations.">Exclude Countries</label><textarea id="ui-bad-countries">${GM_getValue('badCountries', DEFAULTS.BAD_COUNTRIES)}</textarea></div>
                            <div style="margin-bottom:15px;"><label data-tooltip="Jobs containing these words in the Title will be hidden.">Exclude Keywords</label><textarea id="ui-title-keywords">${GM_getValue('titleKeywords', DEFAULTS.TITLE_KEYWORDS)}</textarea></div>
                            <label class="ui-checkbox-wrapper" data-tooltip="If checked, hides all jobs where the client's payment method is unverified."><input type="checkbox" id="ui-payment-filter" ${SETTINGS.paymentFilter ? 'checked' : ''}>Verified Payment Only</label>
                            <button class="ui-btn-save" id="ui-save-btn">Save & Apply</button>
                        </div>
                    </details>
                    <details>
                        <summary data-tooltip="Set the numbers that determine if a job badge turns Green (Good) or Red (Bad).">Color Rules</summary>
                        <div class="ui-acc-content">
                            <div style="display:flex; gap:15px; margin-bottom:10px;">
                                <div style="flex:1"><label title="If pay is higher than this, it turns GREEN.">🟢 Client Avg Hourly Rate ></label><input type="number" id="ui-th-hourly-good" value="${SETTINGS.thHourlyGood}"></div>
                                <div style="flex:1"><label title="If pay is lower than this, it turns RED.">🔴 Client Avg Hourly Rate <</label><input type="number" id="ui-th-hourly-bad" value="${SETTINGS.thHourlyBad}"></div>
                            </div>
                            <div style="display:flex; gap:15px; margin-bottom:15px;">
                                <div style="flex:1">
                                    <label title="If interviews are less than (or equal to) this, it turns GREEN.">🟢 Interviewing <</label>
                                    <input type="number" id="ui-th-intv-good" value="${SETTINGS.thIntvGood}">
                                </div>
                                <div style="flex:1">
                                    <label title="If interviews are less than this (but more than Green), it turns ORANGE.">🟠 Interviewing <</label>
                                    <input type="number" id="ui-th-intv-warn" value="${SETTINGS.thIntvWarn}">
                                </div>
                            </div>
                            <button class="ui-btn-save" id="ui-save-btn-2">Save Rules</button>
                        </div>
                    </details>
                    <details>
                        <summary>AI Configuration</summary>
                        <div class="ui-acc-content">
                            <div style="margin-bottom:15px;"><label data-tooltip="Your Google Gemini API Key. Stored locally in your browser.">Gemini API Key</label><input type="password" id="ui-api-key" value="${SETTINGS.apiKey}" placeholder="Enter API Key"></div>
                            <div style="margin-bottom:15px;">
                                <label data-tooltip="Type ANY model ID manually, or use the dropdown below to autofill.">Model ID (Editable)</label>
                                <input type="text" id="ui-model-manual" value="${SETTINGS.aiModel}" placeholder="gemini-2.0-flash-exp">
                                <select id="ui-model-quick" style="margin-top:5px;"><option value="" disabled selected>AI Models</option><option value="gemini-2.0-flash-exp">Gemini 2.0 Flash</option><option value="gemini-1.5-flash-8b">Gemini 1.5 Flash 8B</option></select>
                            </div>
                            <div style="margin-bottom:15px;"><label data-tooltip="The custom instructions sent to the AI to analyze the job description.">Analysis Prompt</label><textarea id="ui-custom-prompt">${SETTINGS.aiPrompt}</textarea></div>
                            <button class="ui-btn-save" id="ui-save-btn-3">Save AI Settings</button>
                        </div>
                    </details>
                </div>`;
            document.body.appendChild(panel);

            panel.querySelector('#ui-panel-hide-btn').onclick = () => UI.toggle(false);
            panel.querySelector('#ui-theme-icon').onclick = UI.toggleTheme;
            UI.toggle(SETTINGS.isOpen);

            let h = panel.querySelector('.ui-drag-handle'), dragging = false, x, y;
            h.onmousedown = (e) => { dragging = true; x = e.clientX; y = e.clientY; };
            document.onmousemove = (e) => { if(!dragging) return; panel.style.left = (panel.offsetLeft + (e.clientX - x)) + "px"; panel.style.top = (panel.offsetTop + (e.clientY - y)) + "px"; x = e.clientX; y = e.clientY; };
            document.onmouseup = () => { dragging = false; GM_setValue('panelTop', panel.style.top); GM_setValue('panelLeft', panel.style.left); };

            panel.querySelectorAll('textarea').forEach(t => {
                t.addEventListener('input', () => UI.autoResize(t));
                UI.autoResize(t);
            });

            panel.querySelector('#ui-model-quick').onchange = (e) => { document.getElementById('ui-model-manual').value = e.target.value; e.target.selectedIndex = 0; };
            panel.querySelector('#ui-api-key').oninput = (e) => { SETTINGS.apiKey = e.target.value; GM_setValue('apiKey', e.target.value); };

            const save = () => {
                GM_setValue('minHourly', document.getElementById('ui-min-hourly').value);
                GM_setValue('minFixed', document.getElementById('ui-min-fixed').value);
                GM_setValue('maxProposals', document.getElementById('ui-max-proposals').value);
                GM_setValue('thHourlyGood', document.getElementById('ui-th-hourly-good').value);
                GM_setValue('thHourlyBad', document.getElementById('ui-th-hourly-bad').value);
                GM_setValue('thIntvGood', document.getElementById('ui-th-intv-good').value);
                GM_setValue('thIntvWarn', document.getElementById('ui-th-intv-warn').value);
                GM_setValue('badCountries', document.getElementById('ui-bad-countries').value);
                GM_setValue('titleKeywords', document.getElementById('ui-title-keywords').value);
                GM_setValue('paymentFilter', document.getElementById('ui-payment-filter').checked);
                GM_setValue('selectedModel', document.getElementById('ui-model-manual').value);
                GM_setValue('customPrompt', document.getElementById('ui-custom-prompt').value);
                window.location.reload();
            };
            document.getElementById('ui-save-btn').onclick = save;
            document.getElementById('ui-save-btn-2').onclick = save;
            document.getElementById('ui-save-btn-3').onclick = save;
        }
    };

    // --- LOGIC ---
    const Logic = {
        cleanNum: (str) => { if (!str) return 0; const m = str.replace(/,/g, '').match(/\d+/); return m ? parseInt(m[0]) : 0; },

        getBg: (val, type) => {
            const valStr = (val === null || val === undefined) ? '' : val.toString();
            const num = parseFloat(valStr.replace(/[$,%]/g, '')) || 0;
            const isGhost = !valStr.includes('N/A') && (valStr.toLowerCase().includes('day') || valStr.toLowerCase().includes('month'));
            const G='var(--c-green)', R='var(--c-red)', B='var(--c-blue)', O='var(--c-orange)', D='var(--c-dark)';

            if (type === 'hr') return valStr.includes('N/A') ? D : (num >= 60 ? G : (num < 30 ? R : O));
            if (type === 'pay') { if (valStr.includes('N/A')) return D; return num >= SETTINGS.thHourlyGood ? G : (num < SETTINGS.thHourlyBad ? R : B); }
            if (type === 'intv') { if(isGhost) return R; return num <= SETTINGS.thIntvGood ? G : (num <= SETTINGS.thIntvWarn ? O : R); }
            if (type === 'hired') return num > 0 ? R : G;
            if (type === 'viewed') return isGhost ? R : G;
            if (type === 'conn') return num <= 1 ? G : (num <= 2 ? D : O);
            return D;
        },

        async fetchStats(url) {
            const delay = getRandomInt(TIMING.REACTION_MIN_MS, TIMING.REACTION_MAX_MS);
            await new Promise(r => setTimeout(r, delay));
            const cacheKey = "ui_cache_" + url;
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) return JSON.parse(cached);

            try {
                const res = await unsafeWindow.fetch(url);
                const html = await res.text();
                if (html.includes("Just a moment") || (!html.includes('job-description') && !html.includes('client-activity'))) return { error: 'cloudflare', url: url };

                const doc = new DOMParser().parseFromString(html, 'text/html');
                const text = doc.body.innerText || "";

                const stats = { hireRate: 'N/A', interviews: '0', pay: 'N/A', lastViewed: 'N/A', hiredOnJob: '0', description: '', connects: 'N/A' };

                const hrMatch = text.match(/(\d{1,3})%\s*hire\s*rate/i); stats.hireRate = hrMatch ? hrMatch[1] + '%' : 'N/A';
                const payMatch = text.match(/\$([\d,.]+)\s*\/hr\s*avg\s*hourly/i); stats.pay = payMatch ? payMatch[0] : 'N/A';

                doc.querySelectorAll(SELECTORS.jobPage.clientStatsItem).forEach(item => {
                    const t = item.querySelector(SELECTORS.jobPage.statTitle)?.innerText.toLowerCase() || "";
                    const v = item.querySelector(SELECTORS.jobPage.statValue)?.innerText.trim() || "";
                    if (t.includes('viewed') || t.includes('activity')) stats.lastViewed = v.replace(/ago/i, '').trim();
                    if (t.includes('interviewing')) stats.interviews = v;
                    if (t.includes('hires')) stats.hiredOnJob = v;
                });

                stats.connects = text.match(/(?:Required\s*Connects:\s*|proposal\s*for:\s*)(\d+)/i)?.[1] || 'N/A';
                const descEl = doc.querySelector(SELECTORS.jobPage.description);
                stats.description = descEl ? descEl.innerText.trim().substring(0, 1000) : "";

                sessionStorage.setItem(cacheKey, JSON.stringify(stats));
                return stats;
            } catch (err) { return null; }
        },

        addDashboard(tile, s, insertAfterElement) {
            const dash = document.createElement('div'); dash.className = 'ui-dash-outer';
            let costDisplay = s.connects; let total = null;
            if(s.connects !== 'N/A') {
                const c = parseInt(s.connects); total = (c * 0.15 * 1.20);
                costDisplay = `$${total.toFixed(2)}`;
            }

            dash.innerHTML = `
                <div class="ui-dash-grid">
                    <div class="ui-card" title="Percentage of jobs where this client actually hires someone." style="background:${Logic.getBg(s.hireRate,'hr')}"><b>${s.hireRate}</b><span>Hire Rate</span></div>
                    <div class="ui-card" title="Average hourly rate paid by this client." style="background:${Logic.getBg(s.pay,'pay')}"><b>${s.pay.split(' ')[0]}</b><span>Avg Hourly</span></div>
                    <div class="ui-card" title="Total number of hires on this specific job post." style="background:${Logic.getBg(s.hiredOnJob,'hired')}"><b>${s.hiredOnJob}</b><span>Hires Made</span></div>
                    <div class="ui-card" title="Number of freelancers the client is currently interviewing." style="background:${Logic.getBg(s.interviews,'intv')}"><b>${s.interviews}</b><span>Interviewing</span></div>
                    <div class="ui-card" title="When the client last viewed this job post." style="background:${Logic.getBg(s.lastViewed,'viewed')}"><b>${s.lastViewed}</b><span>Last Activity</span></div>
                    <div class="ui-card" title="Estimated cost to apply (Connects x $0.15 + 20% Tax)." style="background:${Logic.getBg(total !== null ? total : s.connects,'conn')}"><b>${costDisplay}</b><span>Bid Cost</span></div>
                </div>
                <div class="ui-ai-row"><div class="ui-ai-text">Analyze with AI...</div><span style="font-size:16px;">🧠</span></div>
            `;
            insertAfterElement.after(dash);

            dash.querySelector('.ui-ai-row').onclick = (ev) => {
                ev.stopPropagation();
                if (!SETTINGS.apiKey) { alert("🤖 AI Analysis requires a Gemini API Key.\n\nPlease open the '🧠' panel settings > AI Configuration to add it."); UI.toggle(true); return; }
                const txt = dash.querySelector('.ui-ai-text'); txt.innerHTML = "Thinking...";
                GM_xmlhttpRequest({
                    method: "POST",
                    url: `https://generativelanguage.googleapis.com/v1beta/models/${SETTINGS.aiModel}:generateContent?key=${SETTINGS.apiKey}`,
                    headers: { "Content-Type": "application/json" },
                    data: JSON.stringify({ contents: [{ parts: [{ text: `${SETTINGS.aiPrompt}. Job: "${s.description}"` }] }] }),
                    onload: (r) => {
                        try {
                            const d = JSON.parse(r.responseText);
                            txt.innerHTML = d.candidates?.[0]?.content?.parts?.[0]?.text || "Error.";
                        } catch (e) { txt.innerHTML = "Error"; }
                    }
                });
            };
        },

        applyFilter(tile, reason) {
            const l = document.createElement('div'); l.className = 'ui-warning-label';
            l.innerHTML = `<span>⚠️ ${reason}</span> <b>Expand +</b>`;
            l.onclick = (e) => { e.stopPropagation(); tile.classList.toggle('ui-is-collapsed'); l.querySelector('b').innerText = tile.classList.contains('ui-is-collapsed') ? 'Expand +' : 'Collapse -'; };
            tile.prepend(l); tile.classList.add('ui-is-collapsed');

            let t;
            const open = () => { t = setTimeout(() => tile.classList.add('ui-temp-expand'), TIMING.HOVER_EXPAND_MS); };
            const close = () => { clearTimeout(t); tile.classList.remove('ui-temp-expand'); };
            l.addEventListener('mouseenter', open); tile.addEventListener('mouseenter', () => { if(tile.classList.contains('ui-is-collapsed')) open(); });
            tile.addEventListener('mouseleave', close);
        },

        injectPeek(link, tile, insertAfter) {
            const peek = document.createElement('button');
            peek.innerHTML = 'Insights';
            peek.style.cssText = `all:unset; cursor:pointer; background:var(--ui-btn-bg); color:var(--ui-btn-text); padding:4px 12px; border-radius:4px; font-size:11px; font-weight:700; margin-right:10px;`;
            peek.onclick = async (e) => {
                e.preventDefault(); e.stopPropagation();

                // --- SMART EXPAND LOGIC ---
                // If user clicks "Insights" on a collapsed tile, force it open permanently
                if (tile.classList.contains('ui-is-collapsed')) {
                    tile.classList.remove('ui-is-collapsed');
                    const label = tile.querySelector('.ui-warning-label b');
                    if(label) label.innerText = 'Collapse -';
                }
                // --------------------------

                peek.innerHTML = '...';
                const s = await Logic.fetchStats(link.href);
                if (s?.error) { peek.innerText = "Retry (Cloudflare)"; window.open(s.url, '_blank'); return; }
                if (s) { Logic.addDashboard(tile, s, insertAfter); peek.remove(); }
            };
            link.prepend(peek);
        }
    };

    // --- SEARCH PAGE ---
    const processSearch = () => {
        const slider = document.querySelector(SELECTORS.sliderPanel);
        if (slider && !window.uiSliderActive) { window.uiSliderActive = true; UI.toggle(false); }
        else if (!slider && window.uiSliderActive) { window.uiSliderActive = false; }

        document.querySelectorAll(`${SELECTORS.search.tile}:not([data-ui-done])`).forEach(tile => {
            tile.dataset.uiDone = "true";
            const link = tile.querySelector(SELECTORS.search.titleLink);
            if (!link) return;
            link.addEventListener('click', () => UI.toggle(false));

            const text = tile.innerText; const titleText = link.innerText || "";
            let hideReason = null;

            if (SETTINGS.titleKeywords.find(k => titleText.toLowerCase().includes(k))) hideReason = `Title Keyword`;
            const propsMatch = text.match(/Proposals:\s*([0-9\+\sto]+)/i);
            if (!hideReason && propsMatch && SETTINGS.maxProposals.some(p => propsMatch[1].includes(p))) hideReason = `Saturated (${propsMatch[1]})`;

            if (!hideReason) {
                 if (text.toLowerCase().includes('fixed-price')) {
                    const bMatch = text.match(/Est\.\s*Budget:\s*\$([\d,]+)/i);
                    if (bMatch && Logic.cleanNum(bMatch[1]) < SETTINGS.minFixed) hideReason = `Low Budget: $${bMatch[1]}`;
                 }
                 const hMatch = text.match(/Hourly:\s*\$([\d,.]+)\s*[-–—]\s*\$([\d,.]+)/i);
                 if (hMatch && Logic.cleanNum(hMatch[1]) < SETTINGS.minHourly) hideReason = `Broad Range ($${hMatch[1]} - $${hMatch[2]})`;
            }
            if (!hideReason) {
                const locEl = tile.querySelector(SELECTORS.search.location);
                if (locEl) {
                    const loc = locEl.innerText;
                    if (SETTINGS.badCountries.some(c => loc.includes(c))) hideReason = `Location: ${loc.trim()}`;
                } else if (SETTINGS.badCountries.some(c => text.includes(c))) {
                    hideReason = `Location`;
                }
            }
            if (!hideReason && SETTINGS.paymentFilter && (text.includes('Payment unverified') || tile.querySelector(SELECTORS.search.paymentUnverifiedIcon))) hideReason = `Payment Unverified`;

            if (hideReason) Logic.applyFilter(tile, hideReason);
            Logic.injectPeek(link, tile, tile.querySelector('h2'));
        });
    };

    // --- JOB FEED ---
    const processFeed = () => {
        const isSidebarOpen = !!document.querySelector(SELECTORS.sliderPanel);
        if (isSidebarOpen !== window.uiLastSidebarState) { UI.toggle(!isSidebarOpen); window.uiLastSidebarState = isSidebarOpen; }

        document.querySelectorAll(`${SELECTORS.feed.tile}:not([data-ui-done])`).forEach(tile => {
            tile.dataset.uiDone = "true";
            const link = tile.querySelector(SELECTORS.feed.titleLink);
            if (!link) return;
            link.addEventListener('click', () => UI.toggle(false));

            const text = tile.innerText; const titleText = link.innerText || "";
            let hideReason = null;

            if (SETTINGS.titleKeywords.find(k => titleText.toLowerCase().includes(k))) hideReason = `Title Keyword`;
            const props = tile.querySelector(SELECTORS.feed.proposals)?.innerText || "";
            if (!hideReason && SETTINGS.maxProposals.some(p => props.includes(p))) hideReason = `Saturated (${props})`;

            const budgetEl = tile.querySelector(SELECTORS.feed.budget);
            if (!hideReason && budgetEl) {
                const b = Logic.cleanNum(budgetEl.innerText);
                if (b > 0 && b < SETTINGS.minFixed) hideReason = `Low Budget: $${b}`;
            }
            const hMatch = text.match(/Hourly:\s*\$([\d,.]+)\s*[-–—]\s*\$([\d,.]+)/i);
            if (!hideReason && hMatch && Logic.cleanNum(hMatch[1]) < SETTINGS.minHourly) hideReason = `Broad Range ($${hMatch[1]} - $${hMatch[2]})`;

            const loc = tile.querySelector(SELECTORS.feed.country)?.innerText || "";
            if (!hideReason && SETTINGS.badCountries.some(c => loc.includes(c))) hideReason = `Location: ${loc.trim()}`;

            const isUnverified = tile.querySelector(SELECTORS.feed.paymentUnverifiedIcon) || text.includes('Payment unverified');
            if (!hideReason && SETTINGS.paymentFilter && isUnverified) hideReason = `Payment Unverified`;

            if (hideReason) Logic.applyFilter(tile, hideReason);
            Logic.injectPeek(link, tile, tile.querySelector('h3.job-tile-title'));
        });
    };

    // --- MAIN ---
    const runLoop = () => {
        UI.init();
        if (window.location.href.includes('/search/jobs')) processSearch();
        else processFeed();
        setTimeout(runLoop, getRandomInt(TIMING.SCAN_MIN_MS, TIMING.SCAN_MAX_MS));
    };
    runLoop();
})();
