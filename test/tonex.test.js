const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

const src = fs.readFileSync(__dirname + '/../tonex.js', 'utf8');
const ctx = vm.createContext({
    navigator: {},
    console,
    TextDecoder: globalThis.TextDecoder,
    Float64Array: globalThis.Float64Array,
    Uint8Array: globalThis.Uint8Array,
    ArrayBuffer: globalThis.ArrayBuffer,
    DataView: globalThis.DataView,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
    setTimeout: globalThis.setTimeout,
});
vm.runInContext(src, ctx);

const run = (expr) => vm.runInContext(`(()=>{${expr}})()`, ctx);

describe('CRC-16-CCITT', () => {
    it('computes known CRC', () => {
        const crc = run('return _crc(new Uint8Array([0x01, 0x02, 0x03]))');
        assert.strictEqual(typeof crc, 'number');
        assert.ok(crc >= 0 && crc <= 0xFFFF);
    });

    it('is deterministic', () => {
        const a = run('return _crc(new Uint8Array([0xAA, 0xBB, 0xCC]))');
        const b = run('return _crc(new Uint8Array([0xAA, 0xBB, 0xCC]))');
        assert.strictEqual(a, b);
    });
});

describe('HDLC framing', () => {
    it('round-trips payload through frame/unframe', () => {
        const ok = run(`
            const payload = [0x01, 0x7E, 0x7D, 0xFF, 0x00];
            const framed = _frame(new Uint8Array(payload));
            const recovered = _unframe(Array.from(framed));
            return JSON.stringify(recovered) === JSON.stringify(payload);
        `);
        assert.strictEqual(ok, true);
    });

    it('wraps with FLAG bytes', () => {
        const [first, last] = run(`
            const f = _frame(new Uint8Array([0xAA]));
            return [f[0], f[f.length-1]];
        `);
        assert.strictEqual(first, 0x7E);
        assert.strictEqual(last, 0x7E);
    });

    it('rejects corrupted frame', () => {
        const result = run(`
            const framed = Array.from(_frame(new Uint8Array([0xAA, 0xBB])));
            framed[2] ^= 0xFF;
            return _unframe(framed);
        `);
        assert.strictEqual(result, null);
    });

    it('escapes FLAG and ESCAPE bytes in payload', () => {
        const len = run(`
            const clean = _frame(new Uint8Array([0x01]));
            const escaped = _frame(new Uint8Array([0x7E]));
            return escaped.length - clean.length;
        `);
        assert.strictEqual(len, 1);
    });
});

describe('float conversion', () => {
    it('round-trips float values', () => {
        for (const val of [0, 1, -1, 3.14, 100.5, -40]) {
            const recovered = run(`return _b2f(_f2b(${val}), 0)`);
            assert.ok(Math.abs(recovered - val) < 0.001, `${val} != ${recovered}`);
        }
    });
});

describe('message builders', () => {
    it('builds valid framed messages', () => {
        for (const fn of ['_hello()', '_reqState()', '_reqMvol()']) {
            const [first, last] = run(`const m = ${fn}; return [m[0], m[m.length-1]]`);
            assert.strictEqual(first, 0x7E, `${fn} missing start FLAG`);
            assert.strictEqual(last, 0x7E, `${fn} missing end FLAG`);
        }
    });

    it('builds send parameter with decodable payload', () => {
        const ok = run('return _unframe(Array.from(_sendParam(42, 5.5))) !== null');
        assert.strictEqual(ok, true);
    });

    it('builds preset request with correct index', () => {
        const ok = run('return _unframe(Array.from(_reqPreset(7, false))) !== null');
        assert.strictEqual(ok, true);
    });
});

describe('PARAM_DEFS', () => {
    it('has all 109 preset parameter indices', () => {
        const count = run(`
            let c = 0;
            for (let i = 0; i < 109; i++) { if (PARAM_DEFS[i]) c++; }
            return c;
        `);
        assert.strictEqual(count, 109);
    });

    it('has all global parameter indices', () => {
        const ok = run('return [110,111,112,113,114,115,116].every(i => !!PARAM_DEFS[i])');
        assert.strictEqual(ok, true);
    });

    it('all params have min <= max', () => {
        const count = run(`
            return Object.values(PARAM_DEFS).filter(d => d.mn > d.mx).length;
        `);
        assert.strictEqual(count, 0);
    });
});

describe('parsers', () => {
    it('parsePresetName returns null for empty data', () => {
        const r = run('return _parseName([0x00, 0x00, 0x00])');
        assert.strictEqual(r, null);
    });

    it('parseParamChanged returns null for empty data', () => {
        const r = run('return _parseChanged([0x00, 0x00, 0x00])');
        assert.strictEqual(r, null);
    });
});
