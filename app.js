'use strict';

// ============================================================
// TONEX ONE — SIGNAL CHAIN CONTROLLER
// ============================================================

const TS = ['1/1','1/2D','1/2','1/2T','1/4D','1/4','1/4T','1/8D','1/8','1/8T','1/16D','1/16','1/16T','1/32','1/32T'];

const REVERB_NAMES = ['Spring 1','Spring 2','Spring 3','Spring 4','Room','Plate'];
const MOD_NAMES    = ['Chorus','Tremolo','Phaser','Flanger','Rotary'];
const DELAY_NAMES  = ['Digital','Tape'];
const CAB_NAMES    = ['Tone Model','Virtual','Off'];
const MIC_NAMES    = ['Condenser 414','Dynamic 57','Ribbon 121'];
const VIR_CABS     = [
    '16 DK','18 CHAMP','110 TONE','112 DLX','112 MARK','112 CALI','112 MAZ','112 TINY',
    '115 BMAN','212 TWIN','212 BLUE','212 H70','212 JAZZ','212 OPEN','212 PPC','212 REHO',
    '212 DZ','412 1960','412 B30','412 B8000','412 B9000','412 BS','412 DBAG','412 HW',
    '412 F1','412 T1','412 V1','412 M1','412 PPC','412 RETS','412 RKB','412 RKV',
    '412 PIG','412 GRN','412 XXL','412 STD','410 SVX','115 SVX','810 SVX','810 OBC'
];
const DELAY_MODES  = ['Normal','Ping Pong','Stereo'];

const GLOW = {
    gate:   '96, 165, 250',
    comp:   '74, 222, 128',
    eq:     '250, 204, 21',
    amp:    '251, 146, 60',
    mod:    '192, 132, 252',
    delay:  '34, 211, 238',
    reverb: '129, 140, 248',
    cab:    '251, 146, 60',
    globals:'161, 161, 170',
};

const P = {
    NG_POST:0, NG_EN:1, NG_THRESH:2, NG_REL:3, NG_DEPTH:4,
    CP_POST:5, CP_EN:6, CP_THRESH:7, CP_GAIN:8, CP_ATK:9,
    EQ_POST:10, EQ_BASS:11, EQ_BFREQ:12, EQ_MID:13, EQ_MIDQ:14, EQ_MFREQ:15, EQ_TREBLE:16, EQ_TFREQ:17,
    AMP_EN:18, AMP_SW1:19, AMP_GAIN:20, AMP_VOL:21, AMP_MIX:22,
    CAB_UNK:23, CAB_TYPE:24, VIR_MDL:25, VIR_RESO:26,
    VIR_M1:27, VIR_M1X:28, VIR_M1Z:29, VIR_M2:30, VIR_M2X:31, VIR_M2Z:32, VIR_BLEND:33,
    AMP_PRES:34, AMP_DEP:35,
    RVB_POS:36, RVB_EN:37, RVB_MDL:38,
    MOD_POST:63, MOD_EN:64, MOD_MDL:65,
    DLY_POST:94, DLY_EN:95, DLY_MDL:96,
    G_BPM:110, G_TRIM:111, G_CABSIM:112, G_TEMPOS:113, G_TUNEREF:114, G_BYPASS:115, G_MVOL:116,
};

const RVB_BASE = [39, 43, 47, 51, 55, 59];

const MOD_P = {
    0: { name:'Chorus',  sync:66, ts:67, rate:68, extra:[{i:69,l:'Depth'},{i:70,l:'Level',u:'%',d:0}] },
    1: { name:'Tremolo', sync:71, ts:72, rate:73, extra:[{i:74,l:'Shape'},{i:75,l:'Spread'},{i:76,l:'Level',u:'%',d:0}] },
    2: { name:'Phaser',  sync:77, ts:78, rate:79, extra:[{i:80,l:'Depth'},{i:81,l:'Level',u:'%',d:0}] },
    3: { name:'Flanger', sync:82, ts:83, rate:84, extra:[{i:85,l:'Depth'},{i:86,l:'Feedback'},{i:87,l:'Level',u:'%',d:0}] },
    4: { name:'Rotary',  sync:88, ts:89, rate:90, extra:[{i:91,l:'Radius'},{i:92,l:'Spread'},{i:93,l:'Level',u:'%',d:0}] },
};

const DLY_P = {
    0: { name:'Digital', sync:97,  ts:98,  time:99,  extra:[{i:100,l:'Feedback',u:'%',d:0},{i:101,l:'Mode',t:'select',opts:DELAY_MODES},{i:102,l:'Mix',u:'%',d:0}] },
    1: { name:'Tape',    sync:103, ts:104, time:105, extra:[{i:106,l:'Feedback',u:'%',d:0},{i:107,l:'Mode',t:'select',opts:DELAY_MODES},{i:108,l:'Mix',u:'%',d:0}] },
};

const ICONS = { gate:'⚡', comp:'🔧', eq:'📊', amp:'🔊', mod:'〰️', delay:'⏱', reverb:'🌊', cab:'📦' };
const NAMES = { gate:'Noise Gate', comp:'Compressor', eq:'Equalizer', amp:'Amplifier', mod:'Modulation', delay:'Delay', reverb:'Reverb', cab:'Cabinet' };


// ============================================================
// PRESET METADATA (scraped from Tonex Editor)
// ============================================================
const PRESET_META = {};
function loadPresetMeta() {
    const raw = localStorage.getItem('tonex_preset_meta');
    if (raw) try { Object.assign(PRESET_META, JSON.parse(raw)); } catch(e) {}
}
function savePresetMeta(rows) {
    for (const r of rows) PRESET_META[r.name] = r;
    localStorage.setItem('tonex_preset_meta', JSON.stringify(PRESET_META));
}
function metaFor(name) { return PRESET_META[name] || null; }
loadPresetMeta();

// ============================================================
// STATE
// ============================================================
const PRESET_PARAMS = Array.from({length:109}, (_,i) => i);

const state = {
    tonex: null, connected: false, synced: false,
    params: {}, presetNames: {}, currentPreset: 0,
    view: 'chain', activeSection: null, dragParam: null,
    snapshots: [], activeSnapshotId: null,
};
const throttle = {};

// ============================================================
// HELPERS
// ============================================================
function v(i) { return state.params[i]?.Val ?? 0; }
function vMin(i) { return state.params[i]?.Min ?? 0; }
function vMax(i) { return state.params[i]?.Max ?? 1; }
function isOn(i) { return v(i) > 0.5; }
function fmt(val, d=1, u='') { return val.toFixed(d) + (u ? ' '+u : ''); }

// ============================================================
// WEBSERIAL
// ============================================================
async function connectSerial() {
    if (state.tonex?.connected) {
        await state.tonex.disconnect();
        state.tonex = null;
        state.connected = false;
        state.synced = false;
        updateConnUI();
        return;
    }
    try {
        state.tonex = new TonexSerial(handleMsg);
        document.getElementById('connection-status').textContent = 'Connecting...';
        await state.tonex.connect();
        state.connected = true;
        updateConnUI();
    } catch(e) {
        console.error('Connection failed:', e);
        state.connected = false;
        state.tonex = null;
        updateConnUI();
    }
}

function sendParam(i, val) { if (state.tonex) state.tonex.queueSetParam(i, val); }
function sendPreset(p) { if (state.tonex) { _appInitiatedSwitch = true; state.tonex.queueSetPreset(p); } }

function throttledSend(i, val) {
    const now = Date.now();
    if (!throttle[i] || now - throttle[i] >= 200) {
        sendParam(i, val);
        throttle[i] = now;
    } else {
        clearTimeout(throttle['t'+i]);
        throttle['t'+i] = setTimeout(() => { sendParam(i, val); throttle[i] = Date.now(); }, 200-(now-throttle[i]));
    }
}

function handleMsg(msg) {
    switch (msg.CMD) {
        case 'SYNCPROGRESS': {
            const st = document.getElementById('connection-status');
            if (st) st.textContent = `Syncing preset ${msg.CURRENT} / ${msg.TOTAL}...`;
            break;
        }
        case 'GETSYNCCOMPLETE':
            if (msg.SYNC === 1 && !state.synced) {
                state.synced = true;
            } else if (msg.SYNC !== 1) {
                state.synced = false;
                state.connected = false;
            }
            updateConnUI();
            break;
        case 'GETPRESETNAMES':
            state.presetNames = msg.PRESET_NAMES;
            updatePresetSel();
            break;
        case 'GETPARAMS':
            state.params = msg.PARAMS;
            refreshView();
            if (_presetJustChanged) {
                _presetJustChanged = false;
                renderSnapshotBar();
            } else if (_needSnapshotReload) {
                _needSnapshotReload = false;
                maybeLoadSnapshots();
            } else {
                renderSnapshotBar();
            }
            break;
        case 'GETPRESET': {
            const changed = state.currentPreset !== msg.INDEX || !_gotPreset;
            state.currentPreset = msg.INDEX;
            _gotPreset = true;
            updatePresetSel();
            if (changed) {
                _lastLoadedModel = null;
                _needSnapshotReload = true;
                _presetJustChanged = _appInitiatedSwitch;
                _appInitiatedSwitch = false;
            }
            break;
        }
    }
}

// ============================================================
// CONNECTION UI
// ============================================================
function updateConnUI() {
    const ov = document.getElementById('connection-overlay');
    const dot = document.getElementById('connection-dot');
    const st = document.getElementById('connection-status');
    const btn = document.getElementById('connect-btn');
    if (!state.connected) {
        ov.classList.remove('hidden');
        st.textContent = 'serial' in navigator ? 'Plug in your Tonex One via USB' : 'WebSerial not supported — use Chrome or Edge';
        if (btn) btn.style.display = 'serial' in navigator ? '' : 'none';
        dot.className = 'w-2 h-2 rounded-full bg-red-500';
    } else if (!state.synced) {
        ov.classList.remove('hidden');
        st.textContent = 'Syncing presets...';
        if (btn) btn.style.display = 'none';
        dot.className = 'w-2 h-2 rounded-full bg-yellow-500 animate-pulse';
    } else {
        ov.classList.add('hidden');
        dot.className = 'w-2 h-2 rounded-full bg-emerald-500';
    }
}

function updatePresetSel() {
    const sel = document.getElementById('preset-select');
    sel.innerHTML = '';
    for (let i = 0; i < 20; i++) {
        const n = state.presetNames[i] || `Preset ${i+1}`;
        const m = metaFor(n);
        const label = m?.character ? `${i+1}. ${n}  [${m.character}]` : `${i+1}. ${n}`;
        const o = document.createElement('option');
        o.value = i; o.textContent = label;
        o.selected = i === state.currentPreset;
        sel.appendChild(o);
    }
}

// ============================================================
// VIEW MANAGEMENT
// ============================================================
function refreshView() {
    if (state.view === 'chain') renderChain();
    else if (state.view === 'detail') updateDetail();
}

function showView(view, section) {
    dlyStopAnim();
    state.view = view;
    state.activeSection = section || null;
    if (view === 'chain') renderChain();
    else if (view === 'detail') renderDetail(section);
    else if (view === 'settings') renderSettings();
    else if (view === 'ab') renderAB();
    window.scrollTo({top: 0, behavior: 'smooth'});
}

// ============================================================
// SIGNAL CHAIN ORDER
// ============================================================
function getChainOrder() {
    const pre = [], post = [];
    [{id:'gate',p:P.NG_POST},{id:'comp',p:P.CP_POST},{id:'eq',p:P.EQ_POST},{id:'mod',p:P.MOD_POST},{id:'delay',p:P.DLY_POST}]
        .forEach(f => (isOn(f.p) ? post : pre).push(f.id));
    return [...pre, 'amp', ...post, 'reverb', 'cab'];
}

// ============================================================
// CHAIN VIEW
// ============================================================
function renderChain() {
    const order = getChainOrder();
    let h = renderMetaBar();
    order.forEach((id, i) => {
        h += renderCard(id);
        if (i < order.length - 1) h += connector();
    });
    h += connector();
    h += renderGlobalsCard();
    document.getElementById('app').innerHTML = h;
}

function renderMetaBar() {
    const name = state.presetNames[state.currentPreset];
    const m = metaFor(name);
    if (!m) return '';
    const items = [];
    if (m.character) items.push({ l:'Character', v:m.character });
    if (m.amp) items.push({ l:'Amp', v:m.amp });
    if (m.cab) items.push({ l:'Cab', v:m.cab });
    if (m.stomp) items.push({ l:'Stomp', v:m.stomp });
    if (m.toneModel && m.toneModel !== name) items.push({ l:'Tone Model', v:m.toneModel });
    if (!items.length) return '';
    return `<div class="bg-zinc-900/50 border border-zinc-800/60 rounded-xl px-4 py-3 mb-4">
        <div class="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
            ${items.map(it => `<div><span class="text-zinc-500">${it.l}</span> <span class="text-zinc-300">${esc(it.v)}</span></div>`).join('')}
        </div>
    </div>`;
}

function connector() {
    return `<div class="flex justify-center py-1"><svg class="w-3 h-4 text-zinc-700" viewBox="0 0 12 16" fill="none"><line x1="6" y1="0" x2="6" y2="11" stroke="currentColor" stroke-width="1.5"/><path d="M3 9l3 4 3-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
}

function renderCard(id) {
    const on = sectionOn(id);
    const g = GLOW[id];
    const pos = sectionPos(id);
    const model = sectionModel(id);
    const summ = summaryHtml(id, on, g);
    const gStyle = on
        ? `border-color:rgba(${g},0.4);box-shadow:0 0 20px rgba(${g},0.12),0 0 8px rgba(${g},0.08),inset 0 1px 0 rgba(${g},0.05);`
        : '';
    const dot = on
        ? `background:rgba(${g},1);box-shadow:0 0 6px rgba(${g},0.6)`
        : 'background:#52525b';
    return `<div class="signal-card bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 cursor-pointer ${on?'':'opacity-50'}" style="${gStyle}" onclick="showView('detail','${id}')">
        <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2.5">
                <span class="text-base">${ICONS[id]||''}</span>
                <h3 class="font-heading font-bold text-sm uppercase tracking-wider">${NAMES[id]||id}</h3>
                ${model ? `<span class="text-xs text-zinc-500">· ${model}</span>` : ''}
            </div>
            <div class="flex items-center gap-2.5">
                ${pos ? `<span class="text-[10px] font-mono uppercase tracking-widest ${on?'text-zinc-400':'text-zinc-600'}">${pos}</span>` : ''}
                <span class="w-2.5 h-2.5 rounded-full" style="${dot}"></span>
            </div>
        </div>
        ${summ}
    </div>`;
}

function sectionOn(id) {
    switch(id) {
        case 'gate': return isOn(P.NG_EN);
        case 'comp': return isOn(P.CP_EN);
        case 'eq': return true;
        case 'amp': return isOn(P.AMP_EN);
        case 'mod': return isOn(P.MOD_EN);
        case 'delay': return isOn(P.DLY_EN);
        case 'reverb': return isOn(P.RVB_EN);
        case 'cab': return Math.round(v(P.CAB_TYPE)) !== 2;
        default: return false;
    }
}

function sectionPos(id) {
    const m = {gate:P.NG_POST, comp:P.CP_POST, eq:P.EQ_POST, mod:P.MOD_POST, delay:P.DLY_POST};
    if (id === 'reverb') return isOn(P.RVB_POS) ? 'Last' : 'Post';
    if (m[id] !== undefined) return isOn(m[id]) ? 'Post' : 'Pre';
    return null;
}

function sectionModel(id) {
    if (id === 'mod') return MOD_NAMES[Math.round(v(P.MOD_MDL))] || '';
    if (id === 'delay') return DELAY_NAMES[Math.round(v(P.DLY_MDL))] || '';
    if (id === 'reverb') return REVERB_NAMES[Math.round(v(P.RVB_MDL))] || '';
    if (id === 'cab') return CAB_NAMES[Math.round(v(P.CAB_TYPE))] || '';
    return '';
}

function summaryHtml(id, on, g) {
    let items = [];
    switch(id) {
        case 'gate':
            items = [{l:'Thresh',v:fmt(v(P.NG_THRESH),0,'dB')},{l:'Release',v:fmt(v(P.NG_REL),0,'ms')},{l:'Depth',v:fmt(v(P.NG_DEPTH),0,'dB')}]; break;
        case 'comp':
            items = [{l:'Thresh',v:fmt(v(P.CP_THRESH),0,'dB')},{l:'Gain',v:fmt(v(P.CP_GAIN),0,'dB')},{l:'Attack',v:fmt(v(P.CP_ATK),0,'ms')}]; break;
        case 'eq':
            items = [{l:'Bass',v:fmt(v(P.EQ_BASS),1)},{l:'Mid',v:fmt(v(P.EQ_MID),1)},{l:'Treble',v:fmt(v(P.EQ_TREBLE),1)}];
            return eqMiniCurve(g) + `<div class="grid gap-3" style="grid-template-columns:repeat(3,1fr)">
                ${items.map(it => `<div class="text-center"><div class="font-mono text-sm ${on?`text-[rgb(${g})]`:'text-zinc-600'}">${it.v}</div><div class="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">${it.l}</div></div>`).join('')}
            </div>`;
        case 'amp':
            items = [{l:'Gain',v:fmt(v(P.AMP_GAIN),1)},{l:'Vol',v:fmt(v(P.AMP_VOL),1)},{l:'Mix',v:fmt(v(P.AMP_MIX),0,'%')},{l:'Pres',v:fmt(v(P.AMP_PRES),1)}]; break;
        case 'mod': {
            const m = MOD_P[Math.round(v(P.MOD_MDL))];
            if (m) {
                const synced = isOn(m.sync);
                items = [{l:synced?'TS':'Rate', v:synced ? (TS[Math.round(v(m.ts))]||'?') : fmt(v(m.rate),1)}];
                m.extra.slice(0,2).forEach(p => items.push({l:p.l, v:fmt(v(p.i), p.d??1, p.u??'')}));
            }
            break;
        }
        case 'delay': {
            const d = DLY_P[Math.round(v(P.DLY_MDL))];
            if (d) {
                const synced = isOn(d.sync);
                items = [
                    {l:synced?'TS':'Time', v:synced ? (TS[Math.round(v(d.ts))]||'?') : fmt(v(d.time),0,'ms')},
                    {l:'Fback', v:fmt(v(d.extra[0].i),0,'%')},
                    {l:'Mix', v:fmt(v(d.extra[2].i),0,'%')},
                ];
                return dlyMiniViz(g) + `<div class="grid gap-3" style="grid-template-columns:repeat(3,1fr)">
                    ${items.map(it => `<div class="text-center"><div class="font-mono text-sm ${on?`text-[rgb(${g})]`:'text-zinc-600'}">${it.v}</div><div class="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">${it.l}</div></div>`).join('')}
                </div>`;
            }
            break;
        }
        case 'reverb': {
            const b = RVB_BASE[Math.round(v(P.RVB_MDL))] ?? 39;
            items = [{l:'Time',v:fmt(v(b),1)},{l:'PreDly',v:fmt(v(b+1),0,'ms')},{l:'Mix',v:fmt(v(b+3),0,'%')}];
            break;
        }
        case 'cab': {
            const t = Math.round(v(P.CAB_TYPE));
            if (t === 1) items = [{l:'Speaker',v:VIR_CABS[Math.round(v(P.VIR_MDL))]||'?'},{l:'Reso',v:fmt(v(P.VIR_RESO),1)},{l:'Blend',v:fmt(v(P.VIR_BLEND),0)}];
            else if (t === 0) return `<div class="text-xs text-zinc-500">Using tone model cabinet</div>`;
            else return '';
            break;
        }
    }
    if (!items.length) return '';
    const cols = Math.min(items.length, 4);
    return `<div class="grid gap-3" style="grid-template-columns:repeat(${cols},1fr)">
        ${items.map(it => `<div class="text-center"><div class="font-mono text-sm ${on?`text-[rgb(${g})]`:'text-zinc-600'}">${it.v}</div><div class="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">${it.l}</div></div>`).join('')}
    </div>`;
}

function renderGlobalsCard() {
    const bp = isOn(P.G_BYPASS);
    const bpStyle = bp ? 'border-color:rgba(239,68,68,0.4);box-shadow:0 0 15px rgba(239,68,68,0.15);' : '';
    return `<div class="signal-card bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 cursor-pointer" style="${bpStyle}" onclick="showView('detail','globals')">
        <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2.5">
                <span class="text-base">⚙️</span>
                <h3 class="font-heading font-bold text-sm uppercase tracking-wider">Globals</h3>
            </div>
            ${bp ? '<span class="text-xs font-mono text-red-400 uppercase tracking-wider">Bypassed</span>' : ''}
        </div>
        <div class="grid grid-cols-4 gap-3">
            <div class="text-center"><div class="font-mono text-sm text-zinc-300">${fmt(v(P.G_MVOL),1)}</div><div class="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">Vol</div></div>
            <div class="text-center"><div class="font-mono text-sm text-zinc-300">${fmt(v(P.G_BPM),0)}</div><div class="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">BPM</div></div>
            <div class="text-center"><div class="font-mono text-sm text-zinc-300">${fmt(v(P.G_TRIM),1)}</div><div class="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">Trim</div></div>
            <div class="text-center"><div class="font-mono text-sm text-zinc-300">${isOn(P.G_CABSIM)?'Off':'On'}</div><div class="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">CabSim</div></div>
        </div>
    </div>`;
}

// ============================================================
// DETAIL VIEW
// ============================================================
function renderDetail(id) {
    const name = id === 'globals' ? 'Globals' : NAMES[id];
    const icon = id === 'globals' ? '⚙️' : (ICONS[id]||'');
    document.getElementById('app').innerHTML = `
        <button class="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors mb-6" onclick="showView('chain')">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
            <span class="text-sm">Signal Chain</span>
        </button>
        <div class="flex items-center gap-3 mb-6">
            <span class="text-xl">${icon}</span>
            <h2 class="font-heading font-bold text-xl uppercase tracking-wide">${name}</h2>
        </div>
        <div id="detail-controls" class="space-y-5">
            ${id === 'globals' ? globalsControls() : sectionControls(id)}
        </div>`;
    document.querySelectorAll('.param-slider').forEach(updateFill);
    if (id === 'delay') dlyStartAnim();
}

function updateDetail() {
    const app = document.getElementById('app');
    app.querySelectorAll('.param-slider[data-param]').forEach(el => {
        const i = parseInt(el.dataset.param);
        if (i !== state.dragParam) {
            el.value = v(i);
            updateFill(el);
            const ve = app.querySelector(`[data-val="${i}"]`);
            if (ve) ve.textContent = fmt(v(i), parseInt(el.dataset.dec||'1'), el.dataset.unit||'');
        }
    });
    app.querySelectorAll('input[type="checkbox"][data-param]').forEach(el => {
        el.checked = isOn(parseInt(el.dataset.param));
    });
    app.querySelectorAll('select[data-param]').forEach(el => {
        el.value = Math.round(v(parseInt(el.dataset.param)));
    });
    updateEqCurve();
    app.querySelectorAll('.mic-pad').forEach(pad => {
        const pxI = parseInt(pad.dataset.px), pzI = parseInt(pad.dataset.pz);
        if (_micDragPad === pad) return;
        const xPct = (v(pxI) - vMin(pxI)) / (vMax(pxI) - vMin(pxI)) * 100;
        const zPct = (1 - (v(pzI) - vMin(pzI)) / (vMax(pzI) - vMin(pzI))) * 100;
        const dot = pad.querySelector('.mic-dot');
        if (dot) { dot.style.left = xPct + '%'; dot.style.top = zPct + '%'; }
        const xL = app.querySelector(`[data-padval="${pxI}"]`);
        const zL = app.querySelector(`[data-padval="${pzI}"]`);
        if (xL) xL.textContent = fmt(v(pxI), 1);
        if (zL) zL.textContent = fmt(v(pzI), 1);
    });
    app.querySelectorAll('[data-mic-radio]').forEach(btn => {
        const pi = parseInt(btn.dataset.micRadio), bv = parseInt(btn.dataset.micVal);
        const on = Math.round(v(pi)) === bv;
        const color = pi === P.VIR_M2 ? '#22d3ee' : '#fb923c';
        btn.style.borderColor = on ? color + '80' : '#3f3f46';
        btn.style.backgroundColor = on ? color + '18' : 'transparent';
        btn.style.color = on ? color : '#71717a';
    });
}

// ============================================================
// CONTROL RENDERERS
// ============================================================
function tog(pi, label) {
    const c = isOn(pi) ? 'checked' : '';
    return `<label class="flex items-center gap-3 cursor-pointer select-none">
        <input type="checkbox" data-param="${pi}" class="sr-only" ${c}>
        <div class="toggle-track relative w-10 h-5 bg-zinc-700 rounded-full cursor-pointer">
            <div class="toggle-dot absolute top-0.5 left-0.5 w-4 h-4 bg-zinc-400 rounded-full"></div>
        </div>
        <span class="text-sm text-zinc-300">${label}</span>
    </label>`;
}

function sld(pi, label, opts={}) {
    const val = v(pi), mn = vMin(pi), mx = vMax(pi);
    const u = opts.unit||'', d = opts.decimals??1;
    const st = opts.step ?? (mx-mn > 50 ? 1 : 0.1);
    return `<div class="space-y-1.5">
        <div class="flex justify-between items-baseline">
            <span class="text-sm text-zinc-400">${label}</span>
            <span class="font-mono text-sm text-amber-400" data-val="${pi}">${fmt(val,d,u)}</span>
        </div>
        <input type="range" data-param="${pi}" data-dec="${d}" data-unit="${u}" min="${mn}" max="${mx}" step="${st}" value="${val}" class="param-slider w-full">
    </div>`;
}

function sel(pi, label, options) {
    const val = Math.round(v(pi));
    return `<div class="space-y-1.5">
        <span class="text-sm text-zinc-400">${label}</span>
        <select data-param="${pi}" class="w-full bg-zinc-800 border border-zinc-600 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500/50 focus:outline-none">
            ${options.map((o,i) => `<option value="${i}" ${i===val?'selected':''}>${o}</option>`).join('')}
        </select>
    </div>`;
}

function divider() { return '<div class="border-t border-zinc-800 my-1"></div>'; }

// ============================================================
// SECTION CONTROLS
// ============================================================
function sectionControls(id) {
    switch(id) {
        case 'gate': return gateCtrl();
        case 'comp': return compCtrl();
        case 'eq': return eqCtrl();
        case 'amp': return ampCtrl();
        case 'mod': return modCtrl();
        case 'delay': return delayCtrl();
        case 'reverb': return reverbCtrl();
        case 'cab': return cabCtrl();
        default: return '';
    }
}

function gateCtrl() {
    return `<div class="flex gap-6">${tog(P.NG_EN,'Enable')}${tog(P.NG_POST,'Post')}</div>${divider()}
    ${sld(P.NG_THRESH,'Threshold',{unit:'dB',decimals:0})}
    ${sld(P.NG_REL,'Release',{unit:'ms',decimals:0})}
    ${sld(P.NG_DEPTH,'Depth',{unit:'dB',decimals:0})}`;
}

function compCtrl() {
    return `<div class="flex gap-6">${tog(P.CP_EN,'Enable')}${tog(P.CP_POST,'Post')}</div>${divider()}
    ${sld(P.CP_THRESH,'Threshold',{unit:'dB',decimals:0})}
    ${sld(P.CP_GAIN,'Make-up Gain',{unit:'dB',decimals:0})}
    ${sld(P.CP_ATK,'Attack',{unit:'ms',decimals:0})}`;
}

// ============================================================
// EQ CURVE VISUALIZATION
// ============================================================
const EQ_FMIN = 20, EQ_FMAX = 10000, EQ_DBMAX = 14;
function eqDb(raw) { return (raw - 5) * 2.4; }
function eqLow(f, fc, db) { return db / (1 + Math.pow(f / fc, 2)); }
function eqPeak(f, fc, db, Q) { const x = f/fc - fc/f; return db / (1 + Math.pow(x * Q, 2)); }
function eqHigh(f, fc, db) { return db / (1 + Math.pow(fc / f, 2)); }
function eqTotal(f) {
    return eqLow(f, v(P.EQ_BFREQ), eqDb(v(P.EQ_BASS)))
         + eqPeak(f, v(P.EQ_MFREQ), eqDb(v(P.EQ_MID)), v(P.EQ_MIDQ))
         + eqHigh(f, v(P.EQ_TFREQ), eqDb(v(P.EQ_TREBLE)));
}
function eqPath(fn, W, H, pad) {
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const lMin = Math.log10(EQ_FMIN), lMax = Math.log10(EQ_FMAX);
    let d = '';
    for (let i = 0; i <= 200; i++) {
        const f = Math.pow(10, lMin + (lMax - lMin) * i / 200);
        const x = pad.l + pw * (Math.log10(f) - lMin) / (lMax - lMin);
        const y = pad.t + ph * (0.5 - fn(f) / (2 * EQ_DBMAX));
        d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + Math.max(0, Math.min(H, y)).toFixed(1);
    }
    return d;
}
function eqCurveSvg() {
    const W = 600, H = 200, pad = {t:20, b:30, l:45, r:15};
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const lMin = Math.log10(EQ_FMIN), lMax = Math.log10(EQ_FMAX);
    const fx = f => pad.l + pw * (Math.log10(f) - lMin) / (lMax - lMin);
    const fy = db => pad.t + ph * (0.5 - db / (2 * EQ_DBMAX));
    let grid = '';
    [100,200,500,1000,2000,5000].forEach(f => {
        const x = fx(f).toFixed(1);
        grid += `<line x1="${x}" y1="${pad.t}" x2="${x}" y2="${H-pad.b}" stroke="#3f3f46" stroke-width="0.5"/>`;
        grid += `<text x="${x}" y="${H-pad.b+14}" text-anchor="middle" fill="#71717a" style="font-size:9px;font-family:ui-monospace,monospace">${f>=1000?(f/1000)+'k':f}</text>`;
    });
    [-12,-6,0,6,12].forEach(db => {
        const y = fy(db).toFixed(1);
        grid += `<line x1="${pad.l}" y1="${y}" x2="${W-pad.r}" y2="${y}" stroke="${db===0?'#52525b':'#3f3f46'}" stroke-width="${db===0?'1':'0.5'}"/>`;
        grid += `<text x="${pad.l-6}" y="${parseFloat(y)+3}" text-anchor="end" fill="#71717a" style="font-size:9px;font-family:ui-monospace,monospace">${db>0?'+'+db:db}</text>`;
    });
    const bP = eqPath(f => eqLow(f, v(P.EQ_BFREQ), eqDb(v(P.EQ_BASS))), W, H, pad);
    const mP = eqPath(f => eqPeak(f, v(P.EQ_MFREQ), eqDb(v(P.EQ_MID)), v(P.EQ_MIDQ)), W, H, pad);
    const tP = eqPath(f => eqHigh(f, v(P.EQ_TFREQ), eqDb(v(P.EQ_TREBLE))), W, H, pad);
    const cP = eqPath(eqTotal, W, H, pad);
    const cy = fy(0).toFixed(1);
    const fill = cP + `L${fx(EQ_FMAX).toFixed(1)},${cy}L${fx(EQ_FMIN).toFixed(1)},${cy}Z`;
    return `<div id="eq-curve" class="bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden mb-5">
        <svg viewBox="0 0 ${W} ${H}" class="w-full" style="height:200px">
            ${grid}
            <path id="eq-fill" d="${fill}" fill="rgba(250,204,21,0.06)"/>
            <path id="eq-bass" d="${bP}" fill="none" stroke="#60a5fa" stroke-width="1.2" opacity="0.5"/>
            <path id="eq-mid" d="${mP}" fill="none" stroke="#facc15" stroke-width="1.2" opacity="0.5"/>
            <path id="eq-treb" d="${tP}" fill="none" stroke="#f97316" stroke-width="1.2" opacity="0.5"/>
            <path id="eq-total" d="${cP}" fill="none" stroke="rgba(250,204,21,0.9)" stroke-width="2"/>
        </svg>
        <div class="flex justify-center gap-5 pb-2 -mt-1">
            <span class="text-[10px] text-[#60a5fa]">&#9679; Bass</span>
            <span class="text-[10px] text-[#facc15]">&#9679; Mid</span>
            <span class="text-[10px] text-[#f97316]">&#9679; Treble</span>
        </div>
    </div>`;
}
function updateEqCurve() {
    if (!document.getElementById('eq-curve')) return;
    const W = 600, H = 200, pad = {t:20, b:30, l:45, r:15};
    const ph = H - pad.t - pad.b, pw = W - pad.l - pad.r;
    const lMin = Math.log10(EQ_FMIN), lMax = Math.log10(EQ_FMAX);
    const fx = f => pad.l + pw * (Math.log10(f) - lMin) / (lMax - lMin);
    const fy = db => pad.t + ph * (0.5 - db / (2 * EQ_DBMAX));
    const bP = eqPath(f => eqLow(f, v(P.EQ_BFREQ), eqDb(v(P.EQ_BASS))), W, H, pad);
    const mP = eqPath(f => eqPeak(f, v(P.EQ_MFREQ), eqDb(v(P.EQ_MID)), v(P.EQ_MIDQ)), W, H, pad);
    const tP = eqPath(f => eqHigh(f, v(P.EQ_TFREQ), eqDb(v(P.EQ_TREBLE))), W, H, pad);
    const cP = eqPath(eqTotal, W, H, pad);
    const cy = fy(0).toFixed(1);
    document.getElementById('eq-bass').setAttribute('d', bP);
    document.getElementById('eq-mid').setAttribute('d', mP);
    document.getElementById('eq-treb').setAttribute('d', tP);
    document.getElementById('eq-total').setAttribute('d', cP);
    document.getElementById('eq-fill').setAttribute('d', cP + `L${fx(EQ_FMAX).toFixed(1)},${cy}L${fx(EQ_FMIN).toFixed(1)},${cy}Z`);
}
function eqMiniCurve(g) {
    const W = 280, H = 50, pad = {t:6, b:6, l:4, r:4};
    const cP = eqPath(eqTotal, W, H, pad);
    const cy = (pad.t + (H - pad.t - pad.b) * 0.5).toFixed(1);
    return `<svg viewBox="0 0 ${W} ${H}" class="w-full" style="height:50px">
        <line x1="${pad.l}" y1="${cy}" x2="${W-pad.r}" y2="${cy}" stroke="#3f3f46" stroke-width="0.5"/>
        <path d="${cP + `L${(W-pad.r).toFixed(1)},${cy}L${pad.l},${cy}Z`}" fill="rgba(${g},0.1)"/>
        <path d="${cP}" fill="none" stroke="rgba(${g},0.8)" stroke-width="1.5"/>
    </svg>`;
}

const EQ_DEFAULTS = {
    [P.EQ_BASS]:5, [P.EQ_BFREQ]:200, [P.EQ_MID]:5, [P.EQ_MIDQ]:1.0,
    [P.EQ_MFREQ]:800, [P.EQ_TREBLE]:5, [P.EQ_TFREQ]:2500,
};
function eqReset(params) {
    for (const [idx, val] of Object.entries(params)) {
        const i = parseInt(idx);
        state.params[i] = {...state.params[i], Val: val};
        sendParam(i, val);
    }
    renderDetail('eq');
    renderSnapshotBar();
}
function eqResetToSaved() {
    const snap = activeSnap();
    if (!snap) return;
    const params = {};
    for (const i of Object.keys(EQ_DEFAULTS)) params[i] = snap.params[String(i)] ?? EQ_DEFAULTS[i];
    eqReset(params);
}
function eqResetToDefaults() { eqReset(EQ_DEFAULTS); }

function eqCtrl() {
    return `${eqCurveSvg()}
    <div class="flex gap-6">${tog(P.EQ_POST,'Post')}</div>${divider()}
    ${sld(P.EQ_BASS,'Bass',{decimals:1})}
    ${sld(P.EQ_BFREQ,'Bass Freq',{unit:'Hz',decimals:0})}
    ${sld(P.EQ_MID,'Mid',{decimals:1})}
    ${sld(P.EQ_MIDQ,'Mid Q',{decimals:1,step:0.1})}
    ${sld(P.EQ_MFREQ,'Mid Freq',{unit:'Hz',decimals:0})}
    ${sld(P.EQ_TREBLE,'Treble',{decimals:1})}
    ${sld(P.EQ_TFREQ,'Treble Freq',{unit:'Hz',decimals:0})}
    ${divider()}
    <div class="flex gap-3">
        <button onclick="eqResetToSaved()" class="flex-1 px-3 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 text-xs font-mono uppercase tracking-wider transition-colors">Reset to Saved</button>
        <button onclick="eqResetToDefaults()" class="flex-1 px-3 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 text-xs font-mono uppercase tracking-wider transition-colors">Reset to Defaults</button>
    </div>`;
}

function ampCtrl() {
    return `<div class="flex gap-6">${tog(P.AMP_EN,'Enable')}</div>${divider()}
    ${sld(P.AMP_GAIN,'Gain',{decimals:1})}
    ${sld(P.AMP_VOL,'Volume',{decimals:1})}
    ${sld(P.AMP_MIX,'Mix',{unit:'%',decimals:0})}
    ${sld(P.AMP_PRES,'Presence',{decimals:1})}
    ${sld(P.AMP_DEP,'Depth',{decimals:1})}`;
}

function modCtrl() {
    const m = Math.round(v(P.MOD_MDL));
    const mp = MOD_P[m];
    if (!mp) return '';
    const synced = isOn(mp.sync);
    let h = `<div class="flex gap-6">${tog(P.MOD_EN,'Enable')}${tog(P.MOD_POST,'Post')}</div>${divider()}
    ${sel(P.MOD_MDL,'Model',MOD_NAMES)}${divider()}
    ${tog(mp.sync,'Tempo Sync')}`;
    h += synced ? sel(mp.ts,'Time Signature',TS) : sld(mp.rate,'Rate',{decimals:1});
    mp.extra.forEach(p => { h += p.t==='select' ? sel(p.i,p.l,p.opts) : sld(p.i,p.l,{unit:p.u||'',decimals:p.d??1}); });
    return h;
}

// ============================================================
// DELAY TIMELINE VISUALIZATION
// ============================================================
const TS_BEATS = [4,3,2,4/3,1.5,1,2/3,0.75,0.5,1/3,0.375,0.25,1/6,0.125,1/12];
let _dlyAnim = null, _dlyLoopN = -1;

function dlyP() {
    const m = Math.round(v(P.DLY_MDL));
    const dp = DLY_P[m];
    if (!dp) return null;
    const synced = isOn(dp.sync);
    const bpm = v(P.G_BPM) || 120;
    const tsIdx = Math.round(v(dp.ts));
    const delayMs = synced ? TS_BEATS[tsIdx] * 60000 / bpm : v(dp.time);
    const feedback = v(dp.extra[0].i) / 100;
    const mode = Math.round(v(dp.extra[1].i));
    const mix = v(dp.extra[2].i) / 100;
    return { synced, bpm, tsIdx, delayMs, feedback, mode, mix, beatMs: 60000/bpm, dp };
}

function dlyImps(p) {
    const out = [{t:0, amp:1, ch:0, orig:true}];
    let a = p.mix;
    for (let n=1; a>=0.03 && n<30; n++) {
        out.push({t:n*p.delayMs, amp:a, ch:p.mode===1?(n-1)%2:0, orig:false});
        a *= p.feedback;
    }
    return out;
}

function dlyWinMs(p) {
    const imps = dlyImps(p);
    return Math.max(2000, imps.length > 1 ? imps[imps.length-1].t + p.delayMs*0.5 : 2000);
}

function dlyTimelineSvg() {
    return `<div id="dly-viz" class="bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden mb-5">
        <canvas id="dly-canvas" class="w-full" style="height:180px"></canvas>
        <div class="px-3 pb-2 -mt-1 text-right">
            <span id="dly-info" class="text-[10px] text-zinc-500 font-mono"></span>
        </div>
    </div>`;
}

function dlyStartAnim() {
    dlyStopAnim();
    const canvas = document.getElementById('dly-canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    const CLR = [34,211,238];
    _dlyLoopN = -1;

    function draw(ts) {
        const p = dlyP();
        if (!p || p.delayMs <= 0) { _dlyAnim = requestAnimationFrame(draw); return; }
        const imps = dlyImps(p);
        const winMs = dlyWinMs(p);
        const elapsed = ts % winMs;
        const loopN = Math.floor(ts / winMs);
        const isPP = p.mode === 1;
        const pad = {l:isPP?16:10, r:10, t:isPP?12:18, b:22};
        const pw = W-pad.l-pad.r, ph = H-pad.t-pad.b;
        const laneH = isPP ? ph/2 : ph;
        const fx = t => pad.l + (t/winMs)*pw;

        _dlyLoopN = loopN;

        ctx.clearRect(0,0,W,H);
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0,0,W,H);

        ctx.strokeStyle = '#27272a'; ctx.setLineDash([3,3]); ctx.lineWidth = 0.5;
        ctx.font = '9px ui-monospace,monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#52525b';
        if (p.synced) {
            for (let b=0; b*p.beatMs < winMs; b++) {
                const x = fx(b*p.beatMs);
                ctx.beginPath(); ctx.moveTo(x,pad.t); ctx.lineTo(x,H-pad.b); ctx.stroke();
                ctx.fillText(String(b+1), x, H-pad.b+13);
            }
        } else {
            const step = winMs > 4000 ? 1000 : 500;
            for (let t=0; t<=winMs; t+=step) {
                const x = fx(t);
                ctx.beginPath(); ctx.moveTo(x,pad.t); ctx.lineTo(x,H-pad.b); ctx.stroke();
                ctx.fillText((t/1000).toFixed(t%1000?1:0)+'s', x, H-pad.b+13);
            }
        }
        ctx.setLineDash([]);

        if (isPP) {
            ctx.strokeStyle = '#3f3f46'; ctx.lineWidth = 0.5;
            const mid = pad.t + laneH;
            ctx.beginPath(); ctx.moveTo(pad.l,mid); ctx.lineTo(W-pad.r,mid); ctx.stroke();
            ctx.fillStyle = '#52525b'; ctx.font = '9px ui-monospace,monospace'; ctx.textAlign = 'left';
            ctx.fillText('L', 2, pad.t+laneH/2+3);
            ctx.fillText('R', 2, mid+laneH/2+3);
        }

        imps.forEach(imp => {
            const x = fx(imp.t);
            const lt = pad.t + (isPP ? imp.ch*laneH : 0);
            const maxH = laneH * 0.85;
            const h = maxH * (imp.orig ? 1 : Math.max(0.12, imp.amp));
            const y = lt + laneH*0.075 + (maxH - h);
            const alpha = imp.orig ? 0.95 : Math.max(0.08, imp.amp*0.85);
            const dt = elapsed - imp.t;
            const flash = (dt >= 0 && dt < 120) ? (1-dt/120)*0.5 : 0;
            const bw = Math.max(4, 10 * (imp.orig ? 1 : Math.max(0.25, imp.amp)));

            ctx.fillStyle = imp.orig
                ? `rgba(255,255,255,${0.15+flash*0.3})`
                : `rgba(${CLR},${alpha*0.25+flash*0.4})`;
            ctx.fillRect(x-bw/2, y, bw, h);

            ctx.strokeStyle = imp.orig
                ? `rgba(255,255,255,${alpha+flash*0.5})`
                : `rgba(${CLR},${alpha+flash*0.4})`;
            ctx.lineWidth = imp.orig ? 2.5 : 1.5;
            ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+h); ctx.stroke();
        });

        const px = fx(elapsed);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px,pad.t); ctx.lineTo(px,H-pad.b); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(px,pad.t,2.5,0,Math.PI*2); ctx.fill();

        const info = document.getElementById('dly-info');
        if (info) {
            const mode = ['Normal','Ping Pong','Stereo'][p.mode]||'';
            info.textContent = p.synced
                ? `${TS[p.tsIdx]} @ ${Math.round(p.bpm)} BPM = ${Math.round(p.delayMs)}ms · ${mode}`
                : `${Math.round(p.delayMs)}ms · ${mode}`;
        }
        _dlyAnim = requestAnimationFrame(draw);
    }
    _dlyAnim = requestAnimationFrame(draw);
}

function dlyStopAnim() {
    if (_dlyAnim) { cancelAnimationFrame(_dlyAnim); _dlyAnim = null; }
    _dlyLoopN = -1;
}


function dlyMiniViz(g) {
    const p = dlyP();
    if (!p || p.delayMs <= 0) return '';
    const imps = dlyImps(p);
    const W=280, H=40, pad={t:4,b:4,l:4,r:4};
    const pw=W-pad.l-pad.r, ph=H-pad.t-pad.b;
    const winMs = dlyWinMs(p);
    const isPP = p.mode===1;
    let bars = '';
    if (isPP) bars += `<line x1="${pad.l}" y1="${pad.t+ph/2}" x2="${W-pad.r}" y2="${pad.t+ph/2}" stroke="#3f3f46" stroke-width="0.5"/>`;
    imps.forEach(imp => {
        const x = pad.l + (imp.t/winMs)*pw;
        const lH = isPP ? ph/2 : ph;
        const lt = pad.t + (isPP ? imp.ch*lH : 0);
        const h = lH * (imp.orig ? 0.9 : imp.amp*0.8);
        const y = lt + lH - h;
        const a = imp.orig ? 0.9 : imp.amp*0.7;
        const clr = imp.orig ? `rgba(255,255,255,${a})` : `rgba(${g},${a})`;
        bars += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y+h).toFixed(1)}" stroke="${clr}" stroke-width="${imp.orig?2:1.5}"/>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" class="w-full" style="height:40px">${bars}</svg>`;
}

function delayCtrl() {
    const m = Math.round(v(P.DLY_MDL));
    const dp = DLY_P[m];
    if (!dp) return '';
    const synced = isOn(dp.sync);
    let h = `${dlyTimelineSvg()}
    <div class="flex gap-6">${tog(P.DLY_EN,'Enable')}${tog(P.DLY_POST,'Post')}</div>${divider()}
    ${sel(P.DLY_MDL,'Model',DELAY_NAMES)}${divider()}
    ${tog(dp.sync,'Tempo Sync')}`;
    h += synced ? sel(dp.ts,'Time Signature',TS) : sld(dp.time,'Time',{unit:'ms',decimals:0});
    dp.extra.forEach(p => { h += p.t==='select' ? sel(p.i,p.l,p.opts) : sld(p.i,p.l,{unit:p.u||'',decimals:p.d??1}); });
    return h;
}

function reverbCtrl() {
    const m = Math.round(v(P.RVB_MDL));
    const b = RVB_BASE[m] ?? 39;
    return `<div class="flex gap-6">${tog(P.RVB_EN,'Enable')}</div>
    <div class="flex gap-6">${tog(P.RVB_POS,'Last Position')}</div>${divider()}
    ${sel(P.RVB_MDL,'Model',REVERB_NAMES)}${divider()}
    ${sld(b,'Time',{decimals:1})}
    ${sld(b+1,'Pre-Delay',{unit:'ms',decimals:0})}
    ${sld(b+2,'Color',{decimals:1})}
    ${sld(b+3,'Mix',{unit:'%',decimals:0})}`;
}

function cabPadGrid() {
    let s = '';
    for (let i = 1; i < 5; i++) {
        const x = (i / 5) * 200, y = (i / 5) * 130;
        s += `<line x1="${x}" y1="0" x2="${x}" y2="130" stroke="#27272a" stroke-width="0.5"/>`;
        s += `<line x1="0" y1="${y}" x2="200" y2="${y}" stroke="#27272a" stroke-width="0.5"/>`;
    }
    [20,40,60].forEach(r => { s += `<circle cx="0" cy="65" r="${r}" fill="none" stroke="#1c1c1e" stroke-width="1"/>`; });
    return s;
}

function micRadio(pi, color) {
    const val = Math.round(v(pi));
    return `<div class="flex gap-1 mb-3">${MIC_NAMES.map((name, i) => {
        const on = i === val;
        return `<button data-mic-radio="${pi}" data-mic-val="${i}" class="flex-1 px-1.5 py-1.5 rounded-lg border text-[11px] font-mono transition-colors" style="border-color:${on ? color+'80' : '#3f3f46'};background:${on ? color+'18' : 'transparent'};color:${on ? color : '#71717a'}">${name}</button>`;
    }).join('')}</div>`;
}

function micPad(xPI, zPI, color) {
    const xMn = vMin(xPI), xMx = vMax(xPI), zMn = vMin(zPI), zMx = vMax(zPI);
    const xPct = xMx > xMn ? ((v(xPI) - xMn) / (xMx - xMn)) * 100 : 50;
    const zPct = zMx > zMn ? (1 - (v(zPI) - zMn) / (zMx - zMn)) * 100 : 50;
    return `<div class="mic-pad relative cursor-crosshair select-none"
                data-px="${xPI}" data-pz="${zPI}"
                style="height:130px;background:#0a0a0b;border:1px solid #3f3f46;border-radius:8px;overflow:hidden;touch-action:none">
        <svg class="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 200 130" preserveAspectRatio="none">${cabPadGrid()}</svg>
        <div class="mic-dot absolute rounded-full pointer-events-none"
             style="width:18px;height:18px;left:${xPct}%;top:${zPct}%;transform:translate(-50%,-50%);background:${color};box-shadow:0 0 10px ${color}40;border:2px solid ${color}cc"></div>
        <div class="absolute bottom-0.5 left-1.5 text-[9px] text-zinc-600 pointer-events-none">center</div>
        <div class="absolute bottom-0.5 right-1.5 text-[9px] text-zinc-600 pointer-events-none">edge</div>
        <div class="absolute top-0.5 left-1.5 text-[9px] text-zinc-600 pointer-events-none">far</div>
    </div>
    <div class="flex justify-between text-[10px] text-zinc-500 mt-1 px-1">
        <span>X: <span class="font-mono text-amber-400" data-padval="${xPI}">${fmt(v(xPI),1)}</span></span>
        <span>Z: <span class="font-mono text-amber-400" data-padval="${zPI}">${fmt(v(zPI),1)}</span></span>
    </div>`;
}

function cabBlend() {
    const val = v(P.VIR_BLEND), mn = vMin(P.VIR_BLEND), mx = vMax(P.VIR_BLEND);
    return `<div class="space-y-1.5">
        <div class="flex justify-between items-baseline">
            <span class="text-xs font-mono" style="color:#fb923c">Mic 1</span>
            <span class="font-mono text-sm text-amber-400" data-val="${P.VIR_BLEND}">${fmt(val,0)}</span>
            <span class="text-xs font-mono" style="color:#22d3ee">Mic 2</span>
        </div>
        <input type="range" data-param="${P.VIR_BLEND}" data-dec="0" data-unit="" min="${mn}" max="${mx}" step="1" value="${val}" class="param-slider w-full">
    </div>`;
}

let _micDragPad = null;
function updateMicPadFromPointer(pad, e) {
    const rect = pad.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const zPct = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const pxI = parseInt(pad.dataset.px), pzI = parseInt(pad.dataset.pz);
    const xVal = vMin(pxI) + xPct * (vMax(pxI) - vMin(pxI));
    const zVal = vMax(pzI) - zPct * (vMax(pzI) - vMin(pzI));
    state.params[pxI] = {...state.params[pxI], Val: xVal};
    state.params[pzI] = {...state.params[pzI], Val: zVal};
    throttledSend(pxI, xVal);
    throttledSend(pzI, zVal);
    const dot = pad.querySelector('.mic-dot');
    if (dot) { dot.style.left = (xPct * 100) + '%'; dot.style.top = (zPct * 100) + '%'; }
    const app = document.getElementById('app');
    const xL = app.querySelector(`[data-padval="${pxI}"]`);
    const zL = app.querySelector(`[data-padval="${pzI}"]`);
    if (xL) xL.textContent = fmt(xVal, 1);
    if (zL) zL.textContent = fmt(zVal, 1);
}

function cabCtrl() {
    let h = sel(P.CAB_TYPE,'Cabinet Type',CAB_NAMES);
    if (Math.round(v(P.CAB_TYPE)) === 1) {
        h += divider();
        h += sel(P.VIR_MDL,'Speaker',VIR_CABS);
        h += sld(P.VIR_RESO,'Resonance',{decimals:1});
        h += divider();
        h += `<h4 class="text-xs uppercase tracking-widest font-heading mb-2" style="color:#fb923c">Mic 1</h4>`;
        h += micRadio(P.VIR_M1, '#fb923c');
        h += micPad(P.VIR_M1X, P.VIR_M1Z, '#fb923c');
        h += divider();
        h += `<h4 class="text-xs uppercase tracking-widest font-heading mb-2" style="color:#22d3ee">Mic 2</h4>`;
        h += micRadio(P.VIR_M2, '#22d3ee');
        h += micPad(P.VIR_M2X, P.VIR_M2Z, '#22d3ee');
        h += divider();
        h += cabBlend();
    }
    return h;
}

function globalsControls() {
    return `<div class="flex gap-6 flex-wrap">
        ${tog(P.G_BYPASS,'Global Bypass')}
        ${tog(P.G_CABSIM,'Cab Sim Bypass')}
        ${tog(P.G_TEMPOS,'Tempo Source')}
    </div>${divider()}
    ${sld(P.G_MVOL,'Master Volume',{unit:'dB',decimals:1})}
    ${sld(P.G_BPM,'BPM',{decimals:0,step:1})}
    ${sld(P.G_TRIM,'Input Trim',{unit:'dB',decimals:1})}
    ${sld(P.G_TUNEREF,'Tuning Reference',{unit:'Hz',decimals:0})}`;
}

// ============================================================
// SETTINGS VIEW
// ============================================================
function renderSettings() {
    document.getElementById('app').innerHTML = `
        <button class="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors mb-6" onclick="showView('chain')">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
            <span class="text-sm">Signal Chain</span>
        </button>
        <div class="flex items-center gap-3 mb-6">
            <span class="text-xl">⚙️</span>
            <h2 class="font-heading font-bold text-xl uppercase tracking-wide">Settings</h2>
        </div>
        <div class="space-y-6">
            <div class="space-y-4">
                <h3 class="font-heading font-semibold text-sm uppercase tracking-wider text-zinc-400">My Rig</h3>
                <div id="rig-fields" class="space-y-4"></div>
            </div>
        </div>
        <hr class="border-zinc-800 my-8">
        <div class="space-y-4">
            <h3 class="font-heading font-semibold text-sm uppercase tracking-wider text-zinc-400">Preset Metadata</h3>
            <p class="text-xs text-zinc-500">Import preset metadata exported from the Tonex Editor. Run <code class="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">scripts/export-metadata.sh</code> in the repo to generate the file.</p>
            <input type="file" id="meta-file" accept=".tsv,.txt,.csv" class="hidden" onchange="importMetaFile(this)">
            <div class="flex gap-2 flex-wrap">
                <button onclick="document.getElementById('meta-file').click()" class="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm transition-colors">Import File</button>
                <button onclick="document.getElementById('meta-paste-area').classList.toggle('hidden')" class="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg text-sm transition-colors">Paste</button>
                <span id="meta-status" class="text-xs text-zinc-500 self-center"></span>
            </div>
            <div id="meta-paste-area" class="hidden space-y-2">
                <textarea id="meta-import" class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-300 focus:ring-1 focus:ring-amber-500/50 focus:outline-none resize-y" style="min-height:80px" placeholder="Paste TSV rows here..."></textarea>
                <button onclick="importMeta()" class="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs transition-colors">Import Pasted Data</button>
            </div>
            ${Object.keys(PRESET_META).length ? `<p class="text-xs text-zinc-500">${Object.keys(PRESET_META).length} presets loaded</p>` : ''}
        </div>
        <hr class="border-zinc-800 my-8">
        <div class="space-y-4">
            <h3 class="font-heading font-semibold text-sm uppercase tracking-wider text-zinc-400">Data Management</h3>
            <div class="flex gap-2 flex-wrap items-center">
                <button onclick="clearAllSnapshots()" class="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm transition-colors">Clear All Snapshots</button>
                <span id="clear-snap-status" class="text-xs text-zinc-500"></span>
            </div>
        </div>
        <hr class="border-zinc-800 my-8">
        <div class="space-y-5">
            <h3 class="font-heading font-semibold text-sm uppercase tracking-wider text-zinc-400">About</h3>
            <div class="text-sm text-zinc-400 space-y-4 leading-relaxed">
                <p class="text-zinc-200 font-body">Tonex One Control is a browser-based parameter editor for the IK Multimedia TONEX ONE&trade; guitar pedal.</p>
                <p>A computer is required. Connect your TONEX ONE via USB, open this site in <strong class="text-zinc-300">Chrome</strong> or <strong class="text-zinc-300">Edge</strong> (WebSerial is not supported in Safari or Firefox), and click Connect. The app communicates directly with the pedal through your browser &mdash; no software to install.</p>
                <div>
                    <p class="text-zinc-300 font-semibold mb-1.5">Getting started</p>
                    <ol class="list-decimal list-inside space-y-1">
                        <li>Plug your TONEX ONE into your computer with a USB cable</li>
                        <li>Click <strong class="text-zinc-300">Connect</strong> and select the pedal from the browser prompt</li>
                        <li>Use the preset dropdown to switch between the 20 onboard presets</li>
                        <li>Tap any block in the signal chain to edit its parameters</li>
                        <li>Snapshots save automatically per model &mdash; use the snapshot bar to compare and recall settings</li>
                    </ol>
                </div>
                <div>
                    <p class="text-zinc-300 font-semibold mb-1.5">Your data</p>
                    <p>All TONEX settings, snapshots, rig descriptions, and other text you provide are stored locally in your browser using localStorage. None of your pedal data or personal information is sent to a server. Your data is retrieved automatically when you return to this site in the same browser. Basic, cookie-free analytics are used to measure page visits.</p>
                </div>
                <div>
                    <p class="text-zinc-300 font-semibold mb-1.5">Credits</p>
                    <p>The USB serial protocol is based on the reverse-engineering work by <a href="https://github.com/Builty/TonexOneController" class="text-amber-500 hover:text-amber-400 underline underline-offset-2" target="_blank">Builty's TonexOneController</a>.</p>
                </div>
                <p class="text-zinc-500 text-xs">TONEX and TONEX ONE are trademarks of <a href="https://www.ikmultimedia.com" class="hover:text-zinc-400 underline underline-offset-2" target="_blank">IK Multimedia</a>. This project is not affiliated with or endorsed by IK Multimedia.</p>
                <p class="text-zinc-500 text-xs">Developed by Mark Degani &mdash; <a href="https://github.com/mdegani/tonex-one-control" class="hover:text-zinc-400 underline underline-offset-2" target="_blank">View on GitHub</a></p>
            </div>
        </div>`;
    loadRig();
}

function loadRig() {
    const r = JSON.parse(localStorage.getItem('tonex_rig') || '{"guitars":"","pedals":"","pedalboard":""}');
    const c = document.getElementById('rig-fields');
    if (!c) return;
    c.innerHTML = `
        ${rigField('guitars','Guitars','Describe your guitars...',r.guitars||'')}
        ${rigField('pedals','Pedals','Describe your pedals...',r.pedals||'')}
        ${rigField('pedalboard','Pedalboard','Describe your pedalboard...',r.pedalboard||'')}
        <button onclick="saveRig()" class="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm transition-colors">Save</button>`;
}

function rigField(key, label, ph, val) {
    return `<div class="space-y-1.5">
        <label class="text-sm text-zinc-400">${label}</label>
        <textarea data-rig="${key}" class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:ring-1 focus:ring-amber-500/50 focus:outline-none resize-y" style="min-height:80px" placeholder="${ph}">${val}</textarea>
    </div>`;
}

function saveRig() {
    const g = document.querySelector('[data-rig="guitars"]')?.value ?? '';
    const p = document.querySelector('[data-rig="pedals"]')?.value ?? '';
    const b = document.querySelector('[data-rig="pedalboard"]')?.value ?? '';
    localStorage.setItem('tonex_rig', JSON.stringify({guitars:g,pedals:p,pedalboard:b}));
}

function importMetaFile(input) {
    const file = input.files?.[0];
    if (!file) return;
    file.text().then(text => {
        document.getElementById('meta-import').value = text;
        importMeta();
        input.value = '';
    });
}

function importMeta() {
    const raw = document.getElementById('meta-import')?.value?.trim();
    if (!raw) return;
    const lines = raw.split('\n').filter(l => l.trim());
    const rows = [];
    for (const line of lines) {
        const cols = line.split('\t');
        if (cols.length < 2) continue;
        const name = cols[0]?.trim();
        if (!name || name === 'PRESET_NAME' || name === 'PRESET NAME') continue;
        rows.push({
            name,
            character: cols[1]?.trim() || '',
            toneModel: cols[2]?.trim() || '',
            stomp: cols[3]?.trim() || '',
            amp: cols[4]?.trim() || '',
            cab: cols[5]?.trim() || '',
        });
    }
    if (rows.length) {
        savePresetMeta(rows);
        updatePresetSel();
        const st = document.getElementById('meta-status');
        if (st) st.textContent = `Imported ${rows.length} presets`;
    }
}

// ============================================================
// SLIDER FILL
// ============================================================
function updateFill(el) {
    const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
    el.style.setProperty('--fill', pct + '%');
}

// ============================================================
// EVENTS
// ============================================================
function setupEvents() {
    const app = document.getElementById('app');

    app.addEventListener('input', (e) => {
        if (e.target.matches('.param-slider')) {
            const i = parseInt(e.target.dataset.param);
            const val = parseFloat(e.target.value);
            state.dragParam = i;
            state.params[i] = {...state.params[i], Val:val};
            updateFill(e.target);
            const ve = app.querySelector(`[data-val="${i}"]`);
            if (ve) ve.textContent = fmt(val, parseInt(e.target.dataset.dec||'1'), e.target.dataset.unit||'');
            throttledSend(i, val);
            if (i >= P.EQ_POST && i <= P.EQ_TFREQ) updateEqCurve();
        }
    });

    const clearDrag = () => setTimeout(() => { state.dragParam = null; renderSnapshotBar(); }, 250);
    app.addEventListener('mouseup', clearDrag);
    app.addEventListener('touchend', clearDrag);

    app.addEventListener('change', (e) => {
        if (e.target.matches('input[type="checkbox"][data-param]')) {
            const i = parseInt(e.target.dataset.param);
            const val = e.target.checked ? 1 : 0;
            state.params[i] = {...state.params[i], Val:val};
            sendParam(i, val);
            if (state.view === 'chain') renderChain();
            if (state.view === 'detail' && isSyncP(i)) renderDetail(state.activeSection);
            renderSnapshotBar();
        }
        if (e.target.matches('select[data-param]')) {
            const i = parseInt(e.target.dataset.param);
            const val = parseFloat(e.target.value);
            state.params[i] = {...state.params[i], Val:val};
            sendParam(i, val);
            if (state.view === 'detail' && isModelP(i)) renderDetail(state.activeSection);
            if (state.view === 'chain') renderChain();
            renderSnapshotBar();
        }
    });

    app.addEventListener('pointerdown', (e) => {
        const pad = e.target.closest('.mic-pad');
        if (!pad) return;
        e.preventDefault();
        _micDragPad = pad;
        pad.setPointerCapture(e.pointerId);
        updateMicPadFromPointer(pad, e);
    });
    app.addEventListener('pointermove', (e) => {
        if (!_micDragPad) return;
        updateMicPadFromPointer(_micDragPad, e);
    });
    app.addEventListener('pointerup', (e) => {
        if (_micDragPad) { _micDragPad = null; renderSnapshotBar(); }
    });

    app.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-mic-radio]');
        if (!btn) return;
        const pi = parseInt(btn.dataset.micRadio);
        const val = parseInt(btn.dataset.micVal);
        state.params[pi] = {...state.params[pi], Val: val};
        sendParam(pi, val);
        renderDetail(state.activeSection);
        renderSnapshotBar();
    });

    document.getElementById('preset-select').addEventListener('change', async (e) => {
        const preset = parseInt(e.target.value);
        await checkDirtyThen(() => sendPreset(preset));
    });
    document.getElementById('settings-btn').addEventListener('click', () => showView(state.view === 'settings' ? 'chain' : 'settings'));
}

function isSyncP(i) {
    for (const m of Object.values(MOD_P)) if (m.sync === i) return true;
    for (const d of Object.values(DLY_P)) if (d.sync === i) return true;
    return false;
}
function isModelP(i) { return [P.MOD_MDL, P.DLY_MDL, P.RVB_MDL, P.CAB_TYPE].includes(i); }

// ============================================================
// SNAPSHOTS (model-level)
// ============================================================
let _lastLoadedModel = null;
let _gotPreset = false;
let _snapshotBusy = false;
let _needSnapshotReload = false;
let _presetJustChanged = false;
let _appInitiatedSwitch = false;

function currentModelName() {
    return state.presetNames[state.currentPreset] || '';
}

function currentParamsObj() {
    const p = {};
    PRESET_PARAMS.forEach(i => { p[String(i)] = v(i); });
    return p;
}

function fingerprint(params) {
    return PRESET_PARAMS.map(i => Math.round((params[String(i)] ?? params[i] ?? 0) * 1000)).join(',');
}

function isDirty() {
    const snap = state.snapshots.find(s => s.id === state.activeSnapshotId);
    if (!snap) return false;
    return fingerprint(currentParamsObj()) !== fingerprint(snap.params);
}

function activeSnap() {
    return state.snapshots.find(s => s.id === state.activeSnapshotId) || null;
}

function nextName() {
    const existing = new Set(state.snapshots.map(s => s.name));
    let n = state.snapshots.length + 1;
    while (existing.has(`Snapshot ${n}`)) n++;
    return `Snapshot ${n}`;
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function maybeLoadSnapshots() {
    if (!_gotPreset || _snapshotBusy || _needSnapshotReload) return;
    if (Object.keys(state.params).length === 0 || Object.keys(state.presetNames).length === 0) return;
    const model = currentModelName();
    if (!model || model === _lastLoadedModel) { renderSnapshotBar(); return; }
    _lastLoadedModel = model;
    loadSnapshotsForModel(model);
}

function loadSnapshotsForModel(model) {
    _snapshotBusy = true;
    const all = JSON.parse(localStorage.getItem('tonex_snapshots') || '{}');
    state.snapshots = all[model] || [];

    const fp = fingerprint(currentParamsObj());

    if (state.snapshots.length === 0) {
        createSnapshot(model, 'Snapshot 1', currentParamsObj());
        state.activeSnapshotId = state.snapshots[0]?.id;
    } else {
        const match = state.snapshots.find(s => fingerprint(s.params) === fp);
        if (match) {
            state.activeSnapshotId = match.id;
        } else {
            createSnapshot(model, nextName(), currentParamsObj());
            state.activeSnapshotId = state.snapshots[state.snapshots.length - 1]?.id;
        }
    }
    _snapshotBusy = false;
    renderSnapshotBar();
}

function createSnapshot(model, name, params) {
    const all = JSON.parse(localStorage.getItem('tonex_snapshots') || '{}');
    if (!all[model]) all[model] = [];
    const snap = { id: Math.random().toString(36).slice(2,10), model_name: model, name, params };
    all[model].push(snap);
    localStorage.setItem('tonex_snapshots', JSON.stringify(all));
    state.snapshots.push(snap);
    return snap;
}

function saveActiveSnapshot() {
    const snap = activeSnap();
    if (!snap) return;
    const params = currentParamsObj();
    snap.params = params;
    const all = JSON.parse(localStorage.getItem('tonex_snapshots') || '{}');
    const list = all[snap.model_name] || [];
    const idx = list.findIndex(s => s.id === snap.id);
    if (idx >= 0) list[idx] = snap;
    all[snap.model_name] = list;
    localStorage.setItem('tonex_snapshots', JSON.stringify(all));
    const sIdx = state.snapshots.findIndex(s => s.id === snap.id);
    if (sIdx >= 0) state.snapshots[sIdx] = snap;
    renderSnapshotBar();
}

function checkDirtyThen(action) {
    if (isDirty()) {
        const choice = confirm(`Save changes to "${activeSnap()?.name}"?\n\nOK = Save, Cancel = Discard`);
        if (choice) saveActiveSnapshot();
    }
    action();
}

function applySnapshot(id) {
    const snap = state.snapshots.find(s => s.id === id);
    if (!snap) return;
    state.activeSnapshotId = id;
    for (const [idx, val] of Object.entries(snap.params)) {
        const i = parseInt(idx);
        state.params[i] = {...state.params[i], Val: val};
        sendParam(i, val);
    }
    refreshView();
    renderSnapshotBar();
}

function switchSnapshot(id) {
    if (id === state.activeSnapshotId) return;
    checkDirtyThen(() => applySnapshot(id));
}

function promptNewSnapshot() {
    checkDirtyThen(() => {
        const defaultName = nextName();
        const name = prompt('Snapshot name:', defaultName);
        if (!name?.trim()) return;
        const model = currentModelName();
        if (!model) return;
        const r = createSnapshot(model, name.trim(), currentParamsObj());
        if (r) state.activeSnapshotId = r.id;
        renderSnapshotBar();
    });
}

function clearAllSnapshots() {
    if (!confirm('Delete all snapshots for every model? This cannot be undone.')) return;
    localStorage.removeItem('tonex_snapshots');
    state.snapshots = [];
    state.activeSnapshotId = null;
    _lastLoadedModel = null;
    const el = document.getElementById('clear-snap-status');
    if (el) el.textContent = 'All snapshots cleared.';
    renderSnapshotBar();
}

function deleteSnapshot(id) {
    if (state.snapshots.length <= 1) return;
    const all = JSON.parse(localStorage.getItem('tonex_snapshots') || '{}');
    for (const m of Object.keys(all)) { all[m] = (all[m]||[]).filter(s => s.id !== id); }
    localStorage.setItem('tonex_snapshots', JSON.stringify(all));
    const wasActive = state.activeSnapshotId === id;
    state.snapshots = state.snapshots.filter(s => s.id !== id);
    if (wasActive) {
        state.activeSnapshotId = state.snapshots[0]?.id;
        applySnapshot(state.activeSnapshotId);
    }
    renderSnapshotBar();
}

function renderSnapshotBar() {
    const bar = document.getElementById('snapshot-bar');
    if (!bar) return;
    const snaps = state.snapshots;
    if (!snaps.length) { bar.innerHTML = ''; return; }
    const dirty = isDirty();

    bar.innerHTML = `<div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        ${snaps.map(s => {
            const active = s.id === state.activeSnapshotId;
            const label = esc(s.name) + (active && dirty ? '<span class="text-amber-300 ml-0.5">*</span>' : '');
            const cls = active
                ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                : 'border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500 hover:text-zinc-200';
            return `<button onclick="switchSnapshot('${s.id}')" class="snap-pill shrink-0 group relative px-3 py-1 rounded-full border text-xs font-mono transition-all ${cls}">
                ${label}
                ${snaps.length > 1 ? `<span onclick="event.stopPropagation();deleteSnapshot('${s.id}')" class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-zinc-700 text-zinc-400 hover:bg-red-600 hover:text-white text-[10px] leading-4 text-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">&times;</span>` : ''}
            </button>`;
        }).join('')}
        ${dirty ? `<button onclick="saveActiveSnapshot()" class="shrink-0 px-3 py-1 rounded-full border border-amber-600/50 bg-amber-600/10 text-amber-400 text-xs font-mono hover:bg-amber-600/20 transition-all">Save</button>` : ''}
        <button onclick="promptNewSnapshot()" class="shrink-0 w-7 h-7 rounded-full border border-dashed border-zinc-600 hover:border-amber-500 text-zinc-500 hover:text-amber-400 text-sm flex items-center justify-center transition-colors" title="New snapshot">+</button>
        ${snaps.length >= 2 ? `<button onclick="enterAB()" class="shrink-0 px-2.5 py-1 rounded-full border border-zinc-600 hover:border-violet-500 text-zinc-400 hover:text-violet-400 text-xs font-heading font-bold tracking-wider transition-colors" title="Compare snapshots">A/B</button>` : ''}
    </div>`;
}

// ============================================================
// A/B COMPARISON
// ============================================================
let _abSide = 'A';
let _abA = null;
let _abB = null;

const PARAM_SECTIONS = [
    { name:'Noise Gate',  icon:'⚡', indices:[0,1,2,3,4] },
    { name:'Compressor',  icon:'🔧', indices:[5,6,7,8,9] },
    { name:'Equalizer',   icon:'📊', indices:[10,11,12,13,14,15,16,17] },
    { name:'Amplifier',   icon:'🔊', indices:[18,19,20,21,22,34,35] },
    { name:'Cabinet',     icon:'📦', indices:[23,24,25,26,27,28,29,30,31,32,33] },
    { name:'Reverb',      icon:'🌊', indices:Array.from({length:27},(_,i)=>36+i) },
    { name:'Modulation',  icon:'〰️', indices:Array.from({length:31},(_,i)=>63+i) },
    { name:'Delay',       icon:'⏱',  indices:Array.from({length:15},(_,i)=>94+i) },
];

const PARAM_LABELS = {
    0:'Post', 1:'Power', 2:'Threshold', 3:'Release', 4:'Depth',
    5:'Post', 6:'Power', 7:'Threshold', 8:'Gain', 9:'Attack',
    10:'Post', 11:'Bass', 12:'Bass Freq', 13:'Mid', 14:'Mid Q', 15:'Mid Freq', 16:'Treble', 17:'Treble Freq',
    18:'Power', 19:'Switch', 20:'Gain', 21:'Volume', 22:'Mix', 34:'Presence', 35:'Depth',
    23:'Unknown', 24:'Type', 25:'Model', 26:'Resonance',
    27:'Mic 1', 28:'Mic 1 X', 29:'Mic 1 Z', 30:'Mic 2', 31:'Mic 2 X', 32:'Mic 2 Z', 33:'Blend',
    36:'Post', 37:'Power', 38:'Model',
};

function abParamLabel(i) {
    if (PARAM_LABELS[i]) return PARAM_LABELS[i];
    const def = state.params[i];
    if (def?.NAME) return def.NAME;
    return `Param ${i}`;
}

function abFmtVal(i, val) {
    const r = Math.round(val * 1000) / 1000;
    if (i === P.CAB_TYPE) return CAB_NAMES[Math.round(val)] || String(r);
    if (i === P.VIR_MDL) return VIR_CABS[Math.round(val)] || String(r);
    if (i === P.RVB_MDL) return REVERB_NAMES[Math.round(val)] || String(r);
    if (i === P.MOD_MDL) return MOD_NAMES[Math.round(val)] || String(r);
    if (i === P.DLY_MDL) return DELAY_NAMES[Math.round(val)] || String(r);
    if ([P.VIR_M1, P.VIR_M2].includes(i)) return MIC_NAMES[Math.round(val)] || String(r);
    if ([P.NG_EN, P.CP_EN, P.AMP_EN, P.RVB_EN, P.MOD_EN, P.DLY_EN,
         P.NG_POST, P.CP_POST, P.EQ_POST, P.RVB_POS, P.MOD_POST, P.DLY_POST].includes(i))
        return val > 0.5 ? 'On' : 'Off';
    return r % 1 === 0 ? String(r) : r.toFixed(1);
}

function enterAB() {
    const snaps = state.snapshots;
    if (snaps.length < 2) return;
    const active = snaps.find(s => s.id === state.activeSnapshotId) || snaps[0];
    const other = snaps.find(s => s.id !== active.id) || snaps[1];
    _abA = active.id;
    _abB = other.id;
    _abSide = 'A';
    showView('ab');
}

function abToggle() {
    _abSide = _abSide === 'A' ? 'B' : 'A';
    const id = _abSide === 'A' ? _abA : _abB;
    applySnapshot(id);
    renderAB();
}

function abSelectA(id) { _abA = id; if (_abSide === 'A') applySnapshot(id); renderAB(); }
function abSelectB(id) { _abB = id; if (_abSide === 'B') applySnapshot(id); renderAB(); }

function renderAB() {
    const snaps = state.snapshots;
    const snapA = snaps.find(s => s.id === _abA);
    const snapB = snaps.find(s => s.id === _abB);
    if (!snapA || !snapB) { showView('chain'); return; }

    const isA = _abSide === 'A';
    const diffs = [];
    PRESET_PARAMS.forEach(i => {
        const va = parseFloat(snapA.params[String(i)] ?? 0);
        const vb = parseFloat(snapB.params[String(i)] ?? 0);
        if (Math.round(va * 1000) !== Math.round(vb * 1000)) {
            diffs.push({ i, va, vb });
        }
    });

    const grouped = PARAM_SECTIONS.map(sec => {
        const secDiffs = diffs.filter(d => sec.indices.includes(d.i));
        return secDiffs.length ? { ...sec, diffs: secDiffs } : null;
    }).filter(Boolean);

    const app = document.getElementById('app');
    app.innerHTML = `
        <button class="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors mb-6" onclick="exitAB()">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
            <span class="text-sm">Signal Chain</span>
        </button>

        <div class="flex flex-col items-center mb-8">
            <button onclick="abToggle()" id="ab-toggle" class="relative w-48 h-14 rounded-full border-2 ${isA ? 'border-amber-500' : 'border-violet-500'} bg-zinc-900 transition-colors focus:outline-none">
                <div class="absolute inset-1 rounded-full flex">
                    <div class="flex-1 flex items-center justify-center rounded-full transition-all ${isA ? 'bg-amber-500 text-zinc-950' : 'text-zinc-500'}">
                        <span class="font-heading font-bold text-lg">A</span>
                    </div>
                    <div class="flex-1 flex items-center justify-center rounded-full transition-all ${!isA ? 'bg-violet-500 text-zinc-950' : 'text-zinc-500'}">
                        <span class="font-heading font-bold text-lg">B</span>
                    </div>
                </div>
            </button>
            <div class="text-xs text-zinc-500 mt-2">Press <kbd class="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono">Space</kbd> to toggle</div>
        </div>

        <div class="grid grid-cols-2 gap-3 mb-8">
            <div>
                <label class="text-xs text-zinc-500 uppercase tracking-wider font-heading mb-1.5 block">A</label>
                <select onchange="abSelectA(this.value)" class="w-full bg-zinc-900 border ${isA ? 'border-amber-500' : 'border-zinc-700'} rounded-lg px-3 py-2 text-sm font-mono text-zinc-200 focus:outline-none appearance-none cursor-pointer">
                    ${snaps.map(s => `<option value="${s.id}" ${s.id === _abA ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
                </select>
            </div>
            <div>
                <label class="text-xs text-zinc-500 uppercase tracking-wider font-heading mb-1.5 block">B</label>
                <select onchange="abSelectB(this.value)" class="w-full bg-zinc-900 border ${!isA ? 'border-violet-500' : 'border-zinc-700'} rounded-lg px-3 py-2 text-sm font-mono text-zinc-200 focus:outline-none appearance-none cursor-pointer">
                    ${snaps.map(s => `<option value="${s.id}" ${s.id === _abB ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
                </select>
            </div>
        </div>

        ${grouped.length === 0 ? '<p class="text-center text-zinc-500 text-sm py-8">These snapshots are identical</p>' : `
            <div class="space-y-4">
                ${grouped.map(sec => `
                    <div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                        <div class="px-4 py-2.5 border-b border-zinc-800 flex items-center gap-2">
                            <span class="text-sm">${sec.icon}</span>
                            <span class="font-heading font-bold text-xs uppercase tracking-wider text-zinc-300">${sec.name}</span>
                            <span class="text-xs text-zinc-600">${sec.diffs.length} diff${sec.diffs.length > 1 ? 's' : ''}</span>
                        </div>
                        <div class="divide-y divide-zinc-800/60">
                            ${sec.diffs.map(d => {
                                const aActive = isA, bActive = !isA;
                                return `<div class="grid grid-cols-[1fr_1fr_1fr] px-4 py-2 text-sm items-center">
                                    <div class="font-mono text-xs ${aActive ? 'text-amber-400' : 'text-zinc-500'}">${abFmtVal(d.i, d.va)}</div>
                                    <div class="text-center text-zinc-500 text-xs">${abParamLabel(d.i)}</div>
                                    <div class="font-mono text-xs text-right ${bActive ? 'text-violet-400' : 'text-zinc-500'}">${abFmtVal(d.i, d.vb)}</div>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `}`;
}

function exitAB() {
    showView('chain');
}

function _abKeyHandler(e) {
    if (state.view !== 'ab') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') {
        e.preventDefault();
        abToggle();
    }
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    setupEvents();
    updateConnUI();
    document.addEventListener('keydown', _abKeyHandler);
});
