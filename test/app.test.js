'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

const tonexSrc = fs.readFileSync(__dirname + '/../tonex.js', 'utf8');
const appSrc = fs.readFileSync(__dirname + '/../app.js', 'utf8');

function createMockElement() {
    let _textContent = '';
    let _innerHTML = '';
    return {
        get textContent() { return _textContent; },
        set textContent(val) { _textContent = String(val ?? ''); },
        get innerHTML() {
            if (_innerHTML) return _innerHTML;
            return _textContent
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        },
        set innerHTML(val) { _innerHTML = val; },
        value: '',
        style: new Proxy({}, { set() { return true; }, get() { return ''; } }),
        className: '',
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        appendChild() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
        addEventListener() {},
        removeEventListener() {},
        setAttribute() {},
        getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; },
        dataset: {},
        files: [],
        checked: false,
        selected: false,
    };
}

const storage = {};
const ctx = vm.createContext({
    navigator: { serial: {} },
    console,
    document: {
        createElement() { return createMockElement(); },
        getElementById() { return createMockElement(); },
        querySelector() { return createMockElement(); },
        querySelectorAll() { return []; },
        addEventListener() {},
    },
    localStorage: {
        getItem(k) { return storage[k] ?? null; },
        setItem(k, val) { storage[k] = String(val); },
        removeItem(k) { delete storage[k]; },
        clear() { for (const k of Object.keys(storage)) delete storage[k]; },
    },
    window: { scrollTo() {}, devicePixelRatio: 1 },
    confirm() { return false; },
    prompt() { return null; },
    requestAnimationFrame() { return 0; },
    cancelAnimationFrame() {},
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
    TextDecoder: globalThis.TextDecoder,
    Float64Array: globalThis.Float64Array,
    Uint8Array: globalThis.Uint8Array,
    ArrayBuffer: globalThis.ArrayBuffer,
    DataView: globalThis.DataView,
    alert() {},
});

vm.runInContext(tonexSrc, ctx);
vm.runInContext(appSrc, ctx);

const run = (expr) => vm.runInContext(`(()=>{${expr}})()`, ctx);
const P = JSON.parse(vm.runInContext('JSON.stringify(P)', ctx));

// ============================================================
// Formatting
// ============================================================
describe('fmt — number formatting', () => {
    it('formats with default 1 decimal', () => {
        assert.strictEqual(run('return fmt(3.14)'), '3.1');
    });
    it('formats with 0 decimals', () => {
        assert.strictEqual(run('return fmt(3.14, 0)'), '3');
    });
    it('appends unit string', () => {
        assert.strictEqual(run('return fmt(440, 0, "Hz")'), '440 Hz');
    });
    it('formats negative values', () => {
        assert.strictEqual(run('return fmt(-12.5, 1, "dB")'), '-12.5 dB');
    });
    it('handles zero', () => {
        assert.strictEqual(run('return fmt(0, 2)'), '0.00');
    });
});

describe('esc — HTML escaping', () => {
    it('escapes angle brackets', () => {
        assert.strictEqual(run('return esc("<script>")'), '&lt;script&gt;');
    });
    it('escapes ampersands', () => {
        assert.strictEqual(run('return esc("A & B")'), 'A &amp; B');
    });
    it('escapes quotes', () => {
        assert.strictEqual(run('return esc(\'say "hello"\')'), 'say &quot;hello&quot;');
    });
    it('returns empty string for empty input', () => {
        assert.strictEqual(run('return esc("")'), '');
    });
    it('passes through plain text unchanged', () => {
        assert.strictEqual(run('return esc("hello world")'), 'hello world');
    });
});

// ============================================================
// State helpers
// ============================================================
describe('state helpers — v, vMin, vMax, isOn', () => {
    it('v returns Val property', () => {
        run('state.params[0] = { Val: 3.5, Min: 0, Max: 10 }');
        assert.strictEqual(run('return v(0)'), 3.5);
    });
    it('v returns 0 for missing param', () => {
        assert.strictEqual(run('return v(999)'), 0);
    });
    it('vMin returns Min property', () => {
        run('state.params[50] = { Val: 5, Min: 1, Max: 10 }');
        assert.strictEqual(run('return vMin(50)'), 1);
    });
    it('vMax returns Max property', () => {
        assert.strictEqual(run('return vMax(50)'), 10);
    });
    it('isOn true when Val > 0.5', () => {
        run('state.params[1] = { Val: 1, Min: 0, Max: 1 }');
        assert.strictEqual(run('return isOn(1)'), true);
    });
    it('isOn false when Val = 0', () => {
        run('state.params[1] = { Val: 0, Min: 0, Max: 1 }');
        assert.strictEqual(run('return isOn(1)'), false);
    });
    it('isOn false at exactly 0.5', () => {
        run('state.params[1] = { Val: 0.5, Min: 0, Max: 1 }');
        assert.strictEqual(run('return isOn(1)'), false);
    });
});

// ============================================================
// Signal chain
// ============================================================
describe('getChainOrder — signal chain routing', () => {
    it('places all effects pre-amp when post flags are off', () => {
        for (const i of [P.NG_POST, P.CP_POST, P.EQ_POST, P.MOD_POST, P.DLY_POST])
            run(`state.params[${i}] = { Val: 0, Min: 0, Max: 1 }`);
        const order = JSON.parse(run('return JSON.stringify(getChainOrder())'));
        assert.deepStrictEqual(order, ['gate', 'comp', 'eq', 'mod', 'delay', 'amp', 'reverb', 'cab']);
    });
    it('moves effects post-amp when post flags are on', () => {
        for (const i of [P.NG_POST, P.CP_POST, P.EQ_POST, P.MOD_POST, P.DLY_POST])
            run(`state.params[${i}] = { Val: 1, Min: 0, Max: 1 }`);
        const order = JSON.parse(run('return JSON.stringify(getChainOrder())'));
        assert.deepStrictEqual(order, ['amp', 'gate', 'comp', 'eq', 'mod', 'delay', 'reverb', 'cab']);
    });
    it('supports mixed pre/post configuration', () => {
        run(`state.params[${P.NG_POST}] = { Val: 0, Min: 0, Max: 1 }`);
        run(`state.params[${P.CP_POST}] = { Val: 1, Min: 0, Max: 1 }`);
        run(`state.params[${P.EQ_POST}] = { Val: 0, Min: 0, Max: 1 }`);
        run(`state.params[${P.MOD_POST}] = { Val: 1, Min: 0, Max: 1 }`);
        run(`state.params[${P.DLY_POST}] = { Val: 0, Min: 0, Max: 1 }`);
        const order = JSON.parse(run('return JSON.stringify(getChainOrder())'));
        assert.deepStrictEqual(order, ['gate', 'eq', 'delay', 'amp', 'comp', 'mod', 'reverb', 'cab']);
    });
    it('always has amp between pre and post, reverb and cab at end', () => {
        for (const i of [P.NG_POST, P.CP_POST, P.EQ_POST, P.MOD_POST, P.DLY_POST])
            run(`state.params[${i}] = { Val: ${Math.random() > 0.5 ? 1 : 0}, Min: 0, Max: 1 }`);
        const order = JSON.parse(run('return JSON.stringify(getChainOrder())'));
        assert.ok(order.includes('amp'));
        assert.strictEqual(order[order.length - 2], 'reverb');
        assert.strictEqual(order[order.length - 1], 'cab');
    });
});

describe('sectionOn — section enable states', () => {
    it('gate follows NG_EN', () => {
        run(`state.params[${P.NG_EN}] = { Val: 1, Min: 0, Max: 1 }`);
        assert.strictEqual(run('return sectionOn("gate")'), true);
        run(`state.params[${P.NG_EN}] = { Val: 0, Min: 0, Max: 1 }`);
        assert.strictEqual(run('return sectionOn("gate")'), false);
    });
    it('comp follows CP_EN', () => {
        run(`state.params[${P.CP_EN}] = { Val: 1, Min: 0, Max: 1 }`);
        assert.strictEqual(run('return sectionOn("comp")'), true);
    });
    it('eq is always on', () => {
        assert.strictEqual(run('return sectionOn("eq")'), true);
    });
    it('amp follows AMP_EN', () => {
        run(`state.params[${P.AMP_EN}] = { Val: 0, Min: 0, Max: 1 }`);
        assert.strictEqual(run('return sectionOn("amp")'), false);
    });
    it('cab is off when type is 2 (Off)', () => {
        run(`state.params[${P.CAB_TYPE}] = { Val: 2, Min: 0, Max: 2 }`);
        assert.strictEqual(run('return sectionOn("cab")'), false);
    });
    it('cab is on for Tone Model (0) and Virtual (1)', () => {
        run(`state.params[${P.CAB_TYPE}] = { Val: 0, Min: 0, Max: 2 }`);
        assert.strictEqual(run('return sectionOn("cab")'), true);
        run(`state.params[${P.CAB_TYPE}] = { Val: 1, Min: 0, Max: 2 }`);
        assert.strictEqual(run('return sectionOn("cab")'), true);
    });
});

describe('sectionPos — pre/post position labels', () => {
    it('returns Pre when post flag is off', () => {
        run(`state.params[${P.NG_POST}] = { Val: 0, Min: 0, Max: 1 }`);
        assert.strictEqual(run('return sectionPos("gate")'), 'Pre');
    });
    it('returns Post when post flag is on', () => {
        run(`state.params[${P.NG_POST}] = { Val: 1, Min: 0, Max: 1 }`);
        assert.strictEqual(run('return sectionPos("gate")'), 'Post');
    });
    it('reverb returns Post or Last based on position flag', () => {
        run(`state.params[${P.RVB_POS}] = { Val: 0, Min: 0, Max: 1 }`);
        assert.strictEqual(run('return sectionPos("reverb")'), 'Post');
        run(`state.params[${P.RVB_POS}] = { Val: 1, Min: 0, Max: 1 }`);
        assert.strictEqual(run('return sectionPos("reverb")'), 'Last');
    });
    it('returns null for amp and cab (no position)', () => {
        assert.strictEqual(run('return sectionPos("amp")'), null);
        assert.strictEqual(run('return sectionPos("cab")'), null);
    });
});

describe('sectionModel — model name lookup', () => {
    it('mod returns model name', () => {
        run(`state.params[${P.MOD_MDL}] = { Val: 0, Min: 0, Max: 4 }`);
        assert.strictEqual(run('return sectionModel("mod")'), 'Chorus');
        run(`state.params[${P.MOD_MDL}] = { Val: 2, Min: 0, Max: 4 }`);
        assert.strictEqual(run('return sectionModel("mod")'), 'Phaser');
        run(`state.params[${P.MOD_MDL}] = { Val: 4, Min: 0, Max: 4 }`);
        assert.strictEqual(run('return sectionModel("mod")'), 'Rotary');
    });
    it('delay returns model name', () => {
        run(`state.params[${P.DLY_MDL}] = { Val: 0, Min: 0, Max: 1 }`);
        assert.strictEqual(run('return sectionModel("delay")'), 'Digital');
        run(`state.params[${P.DLY_MDL}] = { Val: 1, Min: 0, Max: 1 }`);
        assert.strictEqual(run('return sectionModel("delay")'), 'Tape');
    });
    it('reverb returns model name', () => {
        run(`state.params[${P.RVB_MDL}] = { Val: 0, Min: 0, Max: 5 }`);
        assert.strictEqual(run('return sectionModel("reverb")'), 'Spring 1');
        run(`state.params[${P.RVB_MDL}] = { Val: 5, Min: 0, Max: 5 }`);
        assert.strictEqual(run('return sectionModel("reverb")'), 'Plate');
    });
    it('cab returns type name', () => {
        run(`state.params[${P.CAB_TYPE}] = { Val: 0, Min: 0, Max: 2 }`);
        assert.strictEqual(run('return sectionModel("cab")'), 'Tone Model');
        run(`state.params[${P.CAB_TYPE}] = { Val: 1, Min: 0, Max: 2 }`);
        assert.strictEqual(run('return sectionModel("cab")'), 'Virtual');
    });
    it('returns empty string for amp, gate, eq', () => {
        assert.strictEqual(run('return sectionModel("amp")'), '');
        assert.strictEqual(run('return sectionModel("gate")'), '');
        assert.strictEqual(run('return sectionModel("eq")'), '');
    });
});

// ============================================================
// EQ math
// ============================================================
describe('EQ math', () => {
    it('eqDb: raw 5 = flat (0 dB)', () => {
        assert.strictEqual(run('return eqDb(5)'), 0);
    });
    it('eqDb: raw 10 = +12 dB', () => {
        assert.strictEqual(run('return eqDb(10)'), 12);
    });
    it('eqDb: raw 0 = -12 dB', () => {
        assert.strictEqual(run('return eqDb(0)'), -12);
    });
    it('eqLow: 0 dB boost = flat response', () => {
        assert.strictEqual(run('return eqLow(100, 200, 0)'), 0);
    });
    it('eqLow: boosts below cutoff', () => {
        const val = run('return eqLow(50, 200, 6)');
        assert.ok(val > 5, `expected >5 dB at 50Hz; got ${val}`);
    });
    it('eqLow: attenuates above cutoff', () => {
        const val = run('return eqLow(2000, 200, 6)');
        assert.ok(val < 1, `expected <1 dB at 2kHz; got ${val}`);
    });
    it('eqHigh: boosts above cutoff', () => {
        const val = run('return eqHigh(5000, 2000, 6)');
        assert.ok(val > 5, `expected >5 dB at 5kHz; got ${val}`);
    });
    it('eqHigh: attenuates below cutoff', () => {
        const val = run('return eqHigh(100, 2000, 6)');
        assert.ok(val < 1, `expected <1 dB at 100Hz; got ${val}`);
    });
    it('eqPeak: maximum at center frequency', () => {
        const atCenter = run('return eqPeak(1000, 1000, 6, 1)');
        const offCenter = run('return eqPeak(500, 1000, 6, 1)');
        assert.strictEqual(atCenter, 6);
        assert.ok(offCenter < atCenter);
    });
    it('eqPeak: higher Q = narrower peak', () => {
        const wideOff = run('return eqPeak(800, 1000, 6, 0.5)');
        const narrowOff = run('return eqPeak(800, 1000, 6, 4)');
        assert.ok(wideOff > narrowOff, 'wider Q should have more effect off-center');
    });
});

// ============================================================
// Delay impulses
// ============================================================
describe('dlyImps — delay impulse generation', () => {
    it('produces one echo then stops when feedback is 0', () => {
        const imps = JSON.parse(run(
            'return JSON.stringify(dlyImps({ delayMs:500, feedback:0, mix:0.5, mode:0 }))'
        ));
        assert.strictEqual(imps.length, 2);
        assert.strictEqual(imps[0].orig, true);
        assert.strictEqual(imps[1].orig, false);
        assert.strictEqual(imps[1].amp, 0.5);
    });
    it('generates decaying echoes with feedback', () => {
        const imps = JSON.parse(run(
            'return JSON.stringify(dlyImps({ delayMs:500, feedback:0.5, mix:0.8, mode:0 }))'
        ));
        assert.ok(imps.length > 2);
        assert.ok(imps[1].amp < 1, 'first echo quieter than dry');
        assert.ok(imps[2].amp < imps[1].amp, 'second echo quieter than first');
    });
    it('spaces impulses evenly by delayMs', () => {
        const imps = JSON.parse(run(
            'return JSON.stringify(dlyImps({ delayMs:300, feedback:0.5, mix:0.8, mode:0 }))'
        ));
        for (let i = 1; i < imps.length; i++) {
            assert.strictEqual(imps[i].t, i * 300);
        }
    });
    it('alternates channels in ping pong mode', () => {
        const imps = JSON.parse(run(
            'return JSON.stringify(dlyImps({ delayMs:500, feedback:0.5, mix:0.8, mode:1 }))'
        ));
        assert.strictEqual(imps[0].ch, 0);
        assert.strictEqual(imps[1].ch, 0);
        assert.strictEqual(imps[2].ch, 1);
        assert.strictEqual(imps[3].ch, 0);
    });
    it('all echoes on channel 0 in normal mode', () => {
        const imps = JSON.parse(run(
            'return JSON.stringify(dlyImps({ delayMs:500, feedback:0.5, mix:0.8, mode:0 }))'
        ));
        assert.ok(imps.every(imp => imp.ch === 0));
    });
    it('stops when amplitude falls below 0.03', () => {
        const imps = JSON.parse(run(
            'return JSON.stringify(dlyImps({ delayMs:200, feedback:0.9, mix:0.5, mode:0 }))'
        ));
        const lastEcho = imps[imps.length - 1];
        assert.ok(lastEcho.amp >= 0.03, 'last echo should be >= threshold');
        const nextAmp = lastEcho.amp * 0.9;
        assert.ok(nextAmp < 0.03, 'next would-be echo should be below threshold');
    });
});

describe('dlyWinMs — delay window duration', () => {
    it('returns at least 2000ms', () => {
        const win = run('return dlyWinMs({ delayMs:100, feedback:0, mix:0.5, mode:0 })');
        assert.ok(win >= 2000);
    });
    it('extends window for longer delay tails', () => {
        const win = run('return dlyWinMs({ delayMs:500, feedback:0.5, mix:0.8, mode:0 })');
        assert.ok(win > 2000, `expected >2000ms; got ${win}`);
    });
});

// ============================================================
// Snapshots
// ============================================================
describe('fingerprint — parameter comparison hash', () => {
    it('identical params produce identical fingerprint', () => {
        const result = run(`
            const a = { '0': 1.5, '1': 0, '2': 3.14 };
            const b = { '0': 1.5, '1': 0, '2': 3.14 };
            return fingerprint(a) === fingerprint(b);
        `);
        assert.strictEqual(result, true);
    });
    it('different params produce different fingerprint', () => {
        const result = run(`
            const a = { '0': 1.5, '1': 0 };
            const b = { '0': 1.5, '1': 1 };
            return fingerprint(a) !== fingerprint(b);
        `);
        assert.strictEqual(result, true);
    });
    it('rounds to 3 decimal places (ignores sub-0.001 differences)', () => {
        const result = run(`
            const a = { '0': 1.0001 };
            const b = { '0': 1.0002 };
            return fingerprint(a) === fingerprint(b);
        `);
        assert.strictEqual(result, true);
    });
});

describe('isDirty — snapshot change detection', () => {
    it('returns false when no active snapshot', () => {
        run('state.activeSnapshotId = null; state.snapshots = []');
        assert.strictEqual(run('return isDirty()'), false);
    });
    it('returns false when current params match active snapshot', () => {
        run(`
            const params = {};
            for (let i = 0; i < 109; i++) {
                state.params[i] = { Val: 5, Min: 0, Max: 10 };
                params[String(i)] = 5;
            }
            state.snapshots = [{ id: 'snap1', params }];
            state.activeSnapshotId = 'snap1';
        `);
        assert.strictEqual(run('return isDirty()'), false);
    });
    it('returns true when a param differs from active snapshot', () => {
        run('state.params[0] = { Val: 7, Min: 0, Max: 10 }');
        assert.strictEqual(run('return isDirty()'), true);
    });
});

describe('nextName — snapshot auto-naming', () => {
    it('returns Snapshot 1 with no snapshots', () => {
        run('state.snapshots = []');
        assert.strictEqual(run('return nextName()'), 'Snapshot 1');
    });
    it('increments past existing names', () => {
        run('state.snapshots = [{ name: "Snapshot 1" }, { name: "Snapshot 2" }]');
        assert.strictEqual(run('return nextName()'), 'Snapshot 3');
    });
    it('skips collisions', () => {
        run('state.snapshots = [{ name: "Snapshot 1" }, { name: "Snapshot 3" }]');
        assert.strictEqual(run('return nextName()'), 'Snapshot 4');
    });
});

// ============================================================
// A/B comparison
// ============================================================
describe('abFmtVal — A/B display formatting', () => {
    it('formats enable params as On/Off', () => {
        assert.strictEqual(run(`return abFmtVal(${P.NG_EN}, 1)`), 'On');
        assert.strictEqual(run(`return abFmtVal(${P.NG_EN}, 0)`), 'Off');
        assert.strictEqual(run(`return abFmtVal(${P.MOD_EN}, 1)`), 'On');
    });
    it('formats post params as On/Off', () => {
        assert.strictEqual(run(`return abFmtVal(${P.NG_POST}, 1)`), 'On');
        assert.strictEqual(run(`return abFmtVal(${P.EQ_POST}, 0)`), 'Off');
    });
    it('formats cab type as name', () => {
        assert.strictEqual(run(`return abFmtVal(${P.CAB_TYPE}, 0)`), 'Tone Model');
        assert.strictEqual(run(`return abFmtVal(${P.CAB_TYPE}, 1)`), 'Virtual');
        assert.strictEqual(run(`return abFmtVal(${P.CAB_TYPE}, 2)`), 'Off');
    });
    it('formats reverb model as name', () => {
        assert.strictEqual(run(`return abFmtVal(${P.RVB_MDL}, 0)`), 'Spring 1');
        assert.strictEqual(run(`return abFmtVal(${P.RVB_MDL}, 5)`), 'Plate');
    });
    it('formats mod model as name', () => {
        assert.strictEqual(run(`return abFmtVal(${P.MOD_MDL}, 0)`), 'Chorus');
        assert.strictEqual(run(`return abFmtVal(${P.MOD_MDL}, 4)`), 'Rotary');
    });
    it('formats delay model as name', () => {
        assert.strictEqual(run(`return abFmtVal(${P.DLY_MDL}, 0)`), 'Digital');
        assert.strictEqual(run(`return abFmtVal(${P.DLY_MDL}, 1)`), 'Tape');
    });
    it('formats mic type as name', () => {
        assert.strictEqual(run(`return abFmtVal(${P.VIR_M1}, 0)`), 'Condenser 414');
        assert.strictEqual(run(`return abFmtVal(${P.VIR_M2}, 2)`), 'Ribbon 121');
    });
    it('formats virtual cab model as name', () => {
        assert.strictEqual(run(`return abFmtVal(${P.VIR_MDL}, 0)`), '16 DK');
        assert.strictEqual(run(`return abFmtVal(${P.VIR_MDL}, 4)`), '112 MARK');
    });
    it('formats decimal values with 1 decimal place', () => {
        assert.strictEqual(run('return abFmtVal(20, 5.5)'), '5.5');
    });
    it('formats integer values without decimals', () => {
        assert.strictEqual(run('return abFmtVal(20, 5.0)'), '5');
    });
});

describe('abParamLabel — parameter label lookup', () => {
    it('returns known labels', () => {
        assert.strictEqual(run('return abParamLabel(0)'), 'Post');
        assert.strictEqual(run('return abParamLabel(1)'), 'Power');
        assert.strictEqual(run('return abParamLabel(20)'), 'Gain');
        assert.strictEqual(run('return abParamLabel(34)'), 'Presence');
    });
    it('falls back to Param N for unknown indices', () => {
        run('state.params[200] = {}');
        assert.strictEqual(run('return abParamLabel(200)'), 'Param 200');
    });
});

// ============================================================
// Preset metadata
// ============================================================
describe('preset metadata', () => {
    it('metaFor returns null for unknown preset', () => {
        assert.strictEqual(run('return metaFor("nonexistent_preset_xyz")'), null);
    });
    it('savePresetMeta stores and retrieves via metaFor', () => {
        run(`savePresetMeta([{
            name: 'Test Preset',
            character: 'Clean',
            toneModel: 'Model X',
            stomp: 'OD-1',
            amp: 'Fender Twin',
            cab: '212 TWIN'
        }])`);
        const meta = JSON.parse(run('return JSON.stringify(metaFor("Test Preset"))'));
        assert.strictEqual(meta.character, 'Clean');
        assert.strictEqual(meta.amp, 'Fender Twin');
        assert.strictEqual(meta.cab, '212 TWIN');
        assert.strictEqual(meta.toneModel, 'Model X');
    });
    it('persists metadata to localStorage', () => {
        const raw = storage['tonex_preset_meta'];
        assert.ok(raw, 'should be saved to localStorage');
        const parsed = JSON.parse(raw);
        assert.ok(parsed['Test Preset']);
    });
    it('overwrites existing metadata for same preset name', () => {
        run(`savePresetMeta([{ name: 'Test Preset', character: 'Drive', toneModel: '', stomp: '', amp: '', cab: '' }])`);
        const meta = JSON.parse(run('return JSON.stringify(metaFor("Test Preset"))'));
        assert.strictEqual(meta.character, 'Drive');
    });
});

describe('importMeta — TSV parsing', () => {
    it('parses tab-separated rows', () => {
        run(`
            const origFn = document.getElementById;
            document.getElementById = function(id) {
                if (id === 'meta-import') return { value: 'My Preset\\tDrive\\tTM1\\tOD1\\tMarshall\\t412 1960' };
                return origFn(id);
            };
            importMeta();
            document.getElementById = origFn;
        `);
        const meta = JSON.parse(run('return JSON.stringify(metaFor("My Preset"))'));
        assert.strictEqual(meta.character, 'Drive');
        assert.strictEqual(meta.amp, 'Marshall');
        assert.strictEqual(meta.cab, '412 1960');
        assert.strictEqual(meta.stomp, 'OD1');
    });
    it('skips header rows', () => {
        run(`
            const origFn = document.getElementById;
            document.getElementById = function(id) {
                if (id === 'meta-import') return { value: 'PRESET_NAME\\tCharacter\\tTone Model\\nClean Tone\\tClean\\tCT1\\t\\tFender\\t212' };
                return origFn(id);
            };
            importMeta();
            document.getElementById = origFn;
        `);
        assert.strictEqual(run('return metaFor("PRESET_NAME")'), null);
        assert.ok(run('return metaFor("Clean Tone")') !== null);
    });
    it('skips lines with fewer than 2 columns', () => {
        run(`
            const origFn = document.getElementById;
            document.getElementById = function(id) {
                if (id === 'meta-import') return { value: 'single-column\\nValid\\tClean' };
                return origFn(id);
            };
            importMeta();
            document.getElementById = origFn;
        `);
        assert.strictEqual(run('return metaFor("single-column")'), null);
        assert.ok(run('return metaFor("Valid")') !== null);
    });
    it('handles empty value when textarea is blank', () => {
        run(`
            const origFn = document.getElementById;
            document.getElementById = function(id) {
                if (id === 'meta-import') return { value: '   ' };
                return origFn(id);
            };
            importMeta();
            document.getElementById = origFn;
        `);
        // Should not throw
    });
});
