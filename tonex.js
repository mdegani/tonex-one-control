'use strict';

const HDLC_FLAG = 0x7E, HDLC_ESC = 0x7D, HDLC_MASK = 0x20;
const TONEX_VID = 0x1963, TONEX_PID = 0x00D1, BAUD = 115200;
const MAX_PRESETS = 20, PARAM_LAST = 109;

const _PM = [0xB9,0x04,0xB9,0x02,0xBC,0x21];
const _PS = [0xBA,0x03,0xBA,0x6D];
const _PC = [0xB9,0x04,0x03];

const SO_TRIM=15, SO_CAB=20;
const SE_BPM=4, SE_TEMPO=6, SE_DMON=7, SE_TUNE=9, SE_SLOT=11, SE_BYP=12;
const SE_SC=14, SE_SB=16, SE_SA=18;
const G_BPM=110,G_TRIM=111,G_CABSIM=112,G_TEMPOS=113,G_TUNEREF=114,G_BYPASS=115,G_MVOL=116;

function _crc(d){let c=0xFFFF;for(let i=0;i<d.length;i++){c^=d[i];for(let j=0;j<8;j++)c=c&1?(c>>1)^0x8408:c>>1;}return(c^0xFFFF)&0xFFFF;}

function _f2b(v){const b=new ArrayBuffer(4);new DataView(b).setFloat32(0,v,true);return new Uint8Array(b);}
function _b2f(d,o){const b=new ArrayBuffer(4);const u=new Uint8Array(b);for(let i=0;i<4;i++)u[i]=d[o+i];return new DataView(b).getFloat32(0,true);}

function _frame(d){
    const o=[HDLC_FLAG];
    for(let i=0;i<d.length;i++){const b=d[i];if(b===HDLC_FLAG||b===HDLC_ESC){o.push(HDLC_ESC,b^HDLC_MASK);}else o.push(b);}
    const c=_crc(d);
    for(const b of[c&0xFF,(c>>8)&0xFF]){if(b===HDLC_FLAG||b===HDLC_ESC){o.push(HDLC_ESC,b^HDLC_MASK);}else o.push(b);}
    o.push(HDLC_FLAG);
    return new Uint8Array(o);
}

function _unframe(d){
    if(d.length<4||d[0]!==HDLC_FLAG||d[d.length-1]!==HDLC_FLAG)return null;
    const u=[];let i=1;const e=d.length-1;
    while(i<e){if(d[i]===HDLC_ESC){i++;if(i>=e)return null;u.push(d[i]^HDLC_MASK);}else u.push(d[i]);i++;}
    if(u.length<2)return null;
    const p=u.slice(0,-2),rc=u[u.length-2]|(u[u.length-1]<<8);
    return rc===_crc(p)?p:null;
}

function _pval(d,i){
    if(d[i]===0x81||d[i]===0x82)return[d[i+1]|(d[i+2]<<8),i+3];
    if(d[i]===0x80)return[d[i+1],i+2];
    return[d[i],i+1];
}

function _find(d,m){
    outer:for(let i=0;i<=d.length-m.length;i++){for(let j=0;j<m.length;j++)if(d[i+j]!==m[j])continue outer;return i;}
    return -1;
}

function _msgType(p){
    if(p.length<5)return[0,0,0];
    let i=2,t,s;[t,i]=_pval(p,i);[s,i]=_pval(p,i);
    return[{0x02:1,0x0306:2,0x0304:3,0x0303:4,0x0309:5}[t]||0,s,i];
}

function _parseName(d){
    const i=_find(d,_PM);if(i<0)return null;const s=i+_PM.length;if(s+32>d.length)return null;
    const b=d.slice(s,s+32),n=b.indexOf(0);
    return new TextDecoder().decode(new Uint8Array(n>=0?b.slice(0,n):b)).trim();
}


function _parseParams(d,cnt){
    const i=_find(d,_PS);if(i<0)return null;let p=i+_PS.length;const r=[];
    for(let n=0;n<cnt;n++){if(p>=d.length)break;if(d[p]===0x88){p++;if(p+4>d.length)break;r.push(_b2f(d,p));p+=4;}else break;}
    return r.length===cnt?r:null;
}

function _parseChanged(d){
    const i=_find(d,_PC);if(i<0)return null;let p=i+_PC.length;
    if(p+2>d.length)return null;const pi=d[p]|(d[p+1]<<8);p+=2;
    if(p>=d.length||d[p]!==0x88)return null;p++;if(p+4>d.length)return null;
    return[pi,_b2f(d,p)];
}

const _hello=()=>_frame(new Uint8Array([0xB9,0x03,0x00,0x82,0x04,0x00,0x80,0x0B,0x01,0xB9,0x02,0x02,0x0B]));
const _reqState=()=>_frame(new Uint8Array([0xB9,0x03,0x00,0x82,0x06,0x00,0x80,0x0B,0x03,0xB9,0x02,0x81,0x06,0x03,0x0B]));
const _reqMvol=()=>_frame(new Uint8Array([0xB9,0x03,0x81,0x0D,0x03,0x82,0x05,0x00,0x80,0x0B,0x03,0xB9,0x03,0x03,0x00,0x00]));

function _reqPreset(idx,full=false){
    const m=new Uint8Array([0xB9,0x03,0x81,0x00,0x03,0x82,0x06,0x00,0x80,0x0B,0x03,0xB9,0x04,0x0B,0x01,0x00,0x00]);
    m[15]=idx&0xFF;m[16]=full?1:0;return _frame(m);
}

function _sendParam(idx,val){
    const h=[0xB9,0x03,0x81,0x09,0x03,0x82,0x0A,0x00,0x80,0x0B,0x03];
    const p=[0xB9,0x04,0x02,0x00,0x00,0x88,0,0,0,0];
    p[4]=idx&0xFF;const fb=_f2b(val);p[6]=fb[0];p[7]=fb[1];p[8]=fb[2];p[9]=fb[3];
    return _frame(new Uint8Array([...h,...p]));
}

function _sendMvol(val){
    const h=[0xB9,0x03,0x81,0x09,0x03,0x82,0x0A,0x00,0x80,0x0B,0x03];
    const p=[0xB9,0x04,0x03,0x00,0x00,0x88,0,0,0,0];
    const fb=_f2b(val);p[6]=fb[0];p[7]=fb[1];p[8]=fb[2];p[9]=fb[3];
    return _frame(new Uint8Array([...h,...p]));
}

function _setState(sd){
    const len=sd.length;
    const h=new Uint8Array([0xB9,0x03,0x81,0x06,0x03,0x82,len&0xFF,(len>>8)&0xFF,0x80,0x0B,0x03]);
    const c=new Uint8Array(h.length+sd.length);c.set(h);c.set(sd,h.length);return _frame(c);
}

const PARAM_DEFS={
    0:{n:"NG POST",mn:0,mx:1},1:{n:"NG POWER",mn:0,mx:1},2:{n:"NG THRESH",mn:-100,mx:0},
    3:{n:"NG REL",mn:5,mx:500},4:{n:"NG DEPTH",mn:-100,mx:-20},5:{n:"COMP POST",mn:0,mx:1},
    6:{n:"COMP POWER",mn:0,mx:1},7:{n:"COMP THRESH",mn:-40,mx:0},8:{n:"COMP GAIN",mn:-30,mx:10},
    9:{n:"COMP ATTACK",mn:1,mx:51},10:{n:"EQ POST",mn:0,mx:1},11:{n:"EQ BASS",mn:0,mx:10},
    12:{n:"EQ BFREQ",mn:75,mx:600},13:{n:"EQ MID",mn:0,mx:10},14:{n:"EQ MIDQ",mn:0.2,mx:3.0},
    15:{n:"EQ MFREQ",mn:150,mx:5000},16:{n:"EQ TREBLE",mn:0,mx:10},17:{n:"EQ TFREQ",mn:1000,mx:4000},
    18:{n:"MDL AMP",mn:0,mx:1},19:{n:"MDL SW1",mn:0,mx:1},20:{n:"MDL GAIN",mn:0,mx:10},
    21:{n:"MDL VOL",mn:0,mx:10},22:{n:"MDL MIX",mn:0,mx:100},23:{n:"MDL CABU",mn:0,mx:1},
    24:{n:"MDL CAB",mn:0,mx:2},25:{n:"VIR CMDL",mn:0,mx:39},26:{n:"VIR RESO",mn:0,mx:10},
    27:{n:"VIR M1",mn:0,mx:2},28:{n:"VIR M1X",mn:0,mx:10},29:{n:"VIR M1Z",mn:0,mx:10},
    30:{n:"VIR M2",mn:0,mx:2},31:{n:"VIR M2X",mn:0,mx:2},32:{n:"VIR M2Z",mn:0,mx:10},
    33:{n:"VIR BLEND",mn:-100,mx:100},34:{n:"MDL PRE",mn:0,mx:10},35:{n:"MDL DEP",mn:0,mx:10},
    36:{n:"RVB POS",mn:0,mx:1},37:{n:"RVB POWER",mn:0,mx:1},38:{n:"RVB MODEL",mn:0,mx:5},
    39:{n:"RVB SP1 TIME",mn:0,mx:10},40:{n:"RVB SP1 PDLY",mn:0,mx:200},
    41:{n:"RVB SP1 CLR",mn:0,mx:10},42:{n:"RVB SP1 MIX",mn:0,mx:100},
    43:{n:"RVB SP2 TIME",mn:0,mx:10},44:{n:"RVB SP2 PDLY",mn:0,mx:200},
    45:{n:"RVB SP2 CLR",mn:0,mx:10},46:{n:"RVB SP2 MIX",mn:0,mx:100},
    47:{n:"RVB SP3 TIME",mn:0,mx:10},48:{n:"RVB SP3 PDLY",mn:0,mx:200},
    49:{n:"RVB SP3 CLR",mn:0,mx:10},50:{n:"RVB SP3 MIX",mn:0,mx:100},
    51:{n:"RVB SP4 TIME",mn:0,mx:10},52:{n:"RVB SP4 PDLY",mn:0,mx:200},
    53:{n:"RVB SP4 CLR",mn:0,mx:10},54:{n:"RVB SP4 MIX",mn:0,mx:100},
    55:{n:"RVB RM TIME",mn:0,mx:10},56:{n:"RVB RM PDLY",mn:0,mx:200},
    57:{n:"RVB RM CLR",mn:0,mx:10},58:{n:"RVB RM MIX",mn:0,mx:100},
    59:{n:"RVB PL TIME",mn:0,mx:10},60:{n:"RVB PL PDLY",mn:0,mx:200},
    61:{n:"RVB PL CLR",mn:0,mx:10},62:{n:"RVB PL MIX",mn:0,mx:100},
    63:{n:"MOD POST",mn:0,mx:1},64:{n:"MOD POWER",mn:0,mx:1},65:{n:"MOD MODEL",mn:0,mx:4},
    66:{n:"CH SYNC",mn:0,mx:1},67:{n:"CH TS",mn:0,mx:14},68:{n:"CH RATE",mn:0,mx:10},
    69:{n:"CH DEPTH",mn:0,mx:10},70:{n:"CH LEVEL",mn:0,mx:100},
    71:{n:"TR SYNC",mn:0,mx:1},72:{n:"TR TS",mn:0,mx:14},73:{n:"TR RATE",mn:0,mx:10},
    74:{n:"TR SHAPE",mn:0,mx:10},75:{n:"TR SPREAD",mn:0,mx:10},76:{n:"TR LEVEL",mn:0,mx:100},
    77:{n:"PH SYNC",mn:0,mx:1},78:{n:"PH TS",mn:0,mx:14},79:{n:"PH RATE",mn:0,mx:10},
    80:{n:"PH DEPTH",mn:0,mx:10},81:{n:"PH LEVEL",mn:0,mx:100},
    82:{n:"FL SYNC",mn:0,mx:1},83:{n:"FL TS",mn:0,mx:14},84:{n:"FL RATE",mn:0,mx:10},
    85:{n:"FL DEPTH",mn:0,mx:10},86:{n:"FL FBACK",mn:0,mx:10},87:{n:"FL LEVEL",mn:0,mx:100},
    88:{n:"RT SYNC",mn:0,mx:1},89:{n:"RT TS",mn:0,mx:14},90:{n:"RT SPEED",mn:0,mx:10},
    91:{n:"RT RADIUS",mn:0,mx:10},92:{n:"RT SPREAD",mn:0,mx:10},93:{n:"RT LEVEL",mn:0,mx:100},
    94:{n:"DLY POST",mn:0,mx:1},95:{n:"DLY POWER",mn:0,mx:1},96:{n:"DLY MODEL",mn:0,mx:1},
    97:{n:"DG SYNC",mn:0,mx:1},98:{n:"DG TS",mn:0,mx:14},99:{n:"DG TIME",mn:0,mx:2000},
    100:{n:"DG FBACK",mn:0,mx:100},101:{n:"DG MODE",mn:0,mx:2},102:{n:"DG MIX",mn:0,mx:100},
    103:{n:"TP SYNC",mn:0,mx:1},104:{n:"TP TS",mn:0,mx:14},105:{n:"TP TIME",mn:0,mx:2000},
    106:{n:"TP FBACK",mn:0,mx:100},107:{n:"TP MODE",mn:0,mx:2},108:{n:"TP MIX",mn:0,mx:100},
    110:{n:"BPM",mn:40,mx:240},111:{n:"TRIM",mn:-15,mx:15},112:{n:"CABSIM",mn:0,mx:1},
    113:{n:"TEMPOS",mn:0,mx:1},114:{n:"TUNEREF",mn:415,mx:465},115:{n:"BYPASS",mn:0,mx:1},
    116:{n:"MVOL",mn:-40,mx:3},
};

class TonexSerial {
    constructor(onEvent) {
        this._onEvent = onEvent;
        this._port = null;
        this._writer = null;
        this._reader = null;
        this._running = false;
        this._rxBuf = [];
        this._state = 'IDLE';
        this._cmdQueue = [];
        this._cmdTimer = null;

        this.stateData = null;
        this.presetNames = new Array(MAX_PRESETS).fill('');
        this.paramValues = new Float64Array(120);
        this.currentPreset = 0;
        this.slotA = 0; this.slotB = 0; this.slotC = 0;
        this.currentSlot = 0;
        this.bypassMode = 0;
        this.syncComplete = false;
        this.connected = false;

        this._bootReq = 0;
        this._bootInit = false;
        this._bootGotActive = false;
    }

    async connect() {
        this._port = await navigator.serial.requestPort({
            filters: [{ usbVendorId: TONEX_VID, usbProductId: TONEX_PID }]
        });
        await this._port.open({ baudRate: BAUD, dataBits: 8, parity: 'none', stopBits: 1 });
        console.log('Tonex: Port opened, sending hello...');
        this._writer = this._port.writable.getWriter();
        this._running = true;
        this.connected = true;
        this._rxBuf = [];
        this._state = 'IDLE';
        this.syncComplete = false;
        await new Promise(r => setTimeout(r, 250));
        this._readLoop();
        this._write(_hello());
        this._state = 'HELLO';
        this._cmdTimer = setInterval(() => this._processQueue(), 10);
    }

    async disconnect() {
        this._running = false;
        if (this._cmdTimer) { clearInterval(this._cmdTimer); this._cmdTimer = null; }
        if (this._reader) { try { await this._reader.cancel(); } catch(e) {} this._reader = null; }
        if (this._writer) { try { this._writer.releaseLock(); } catch(e) {} this._writer = null; }
        if (this._port) { try { await this._port.close(); } catch(e) {} this._port = null; }
        this.connected = false;
        this.syncComplete = false;
        this._onEvent({ CMD: 'GETSYNCCOMPLETE', SYNC: 0 });
    }

    queueSetParam(index, value) { this._cmdQueue.push({ t: 'p', i: index, v: value }); }
    queueSetPreset(preset) { this._cmdQueue.push({ t: 's', p: preset }); }

    async _readLoop() {
        while (this._running && this._port?.readable) {
            this._reader = this._port.readable.getReader();
            try {
                while (this._running) {
                    const { value, done } = await this._reader.read();
                    if (done) break;
                    for (let i = 0; i < value.length; i++) this._rxBuf.push(value[i]);
                    this._processBuf();
                }
            } catch (e) {
                if (this._running) console.error('Serial read error:', e);
            } finally {
                try { this._reader.releaseLock(); } catch(e) {}
                this._reader = null;
            }
        }
        if (this._running) this.disconnect();
    }

    _processBuf() {
        while (this._rxBuf.length >= 2) {
            const s = this._rxBuf.indexOf(HDLC_FLAG);
            if (s < 0) { this._rxBuf = []; return; }
            if (s > 0) this._rxBuf = this._rxBuf.slice(s);
            let e = -1;
            for (let i = 1; i < this._rxBuf.length; i++) { if (this._rxBuf[i] === HDLC_FLAG) { e = i; break; } }
            if (e < 0) return;
            const fr = this._rxBuf.slice(0, e + 1);
            this._rxBuf = this._rxBuf.slice(e + 1);
            if (fr.length < 4) continue;
            const p = _unframe(fr);
            if (p) this._processMsg(p);
        }
    }

    _processMsg(payload) {
        const [mt,,ds] = _msgType(payload);
        switch (mt) {
            case 1:
                console.log('Tonex: Hello response received');
                this._write(_reqState());
                this._state = 'GET_STATE';
                this._bootInit = true;
                this._bootReq = 0;
                this._bootGotActive = false;
                break;
            case 2: this._onStateUpdate(payload, ds); break;
            case 3: case 4: this._onPresetDetails(payload); break;
            case 5: this._onParamChanged(payload); break;
            default: console.log('Tonex: Unknown msg type', mt, 'len', payload.length); break;
        }
    }

    _onStateUpdate(payload, ds) {
        let idx = ds;
        if (idx < payload.length) [, idx] = _pval(payload, idx);
        const raw = payload.slice(idx);
        this.stateData = new Uint8Array(raw);
        const sd = this.stateData, sl = sd.length;
        console.log('Tonex: State update, data length:', sl);
        if (sl < 20) { console.warn('Tonex: State data too short'); return; }

        if (SO_TRIM + 4 <= sl) this.paramValues[G_TRIM] = _b2f(sd, SO_TRIM);
        if (SO_CAB < sl) this.paramValues[G_CABSIM] = sd[SO_CAB];

        if (sl >= SE_SA + 1) {
            this.slotA = sd[sl - SE_SA]; this.slotB = sd[sl - SE_SB]; this.slotC = sd[sl - SE_SC];
            this.currentSlot = sd[sl - SE_SLOT];
            this.bypassMode = sd[sl - SE_BYP];
            this.paramValues[G_BYPASS] = this.bypassMode;
            this.paramValues[G_TEMPOS] = sd[sl - SE_TEMPO];
            this.paramValues[G_BPM] = _b2f(sd, sl - SE_BPM);
            if (sl >= SE_TUNE + 1) this.paramValues[G_TUNEREF] = sd[sl - SE_TUNE] | (sd[sl - SE_TUNE + 1] << 8);
        }
        this.currentPreset = this._activeIdx();

        if (this._bootInit) {
            this._bootInit = false;
            this._state = 'SYNCING';
            console.log('Tonex: Starting preset sync, active preset:', this.currentPreset);
            this._write(_reqPreset(0, false));
        } else {
            this._fireSync();
        }
    }

    _onPresetDetails(payload) {
        const name = _parseName(payload);
        if (this._state === 'SYNCING') {
            if (this._bootReq < MAX_PRESETS) {
                if (name) this.presetNames[this._bootReq] = name;
                this._bootReq++;
                console.log('Tonex: Preset', this._bootReq, '/', MAX_PRESETS, name || '(no name)');
                this._onEvent({ CMD: 'SYNCPROGRESS', CURRENT: this._bootReq, TOTAL: MAX_PRESETS });
                if (this._bootReq < MAX_PRESETS) {
                    this._write(_reqPreset(this._bootReq, false));
                } else {
                    console.log('Tonex: All names loaded, requesting active preset params');
                    this._write(_reqPreset(this._activeIdx(), false));
                }
            } else if (!this._bootGotActive) {
                this._bootGotActive = true;
                const params = _parseParams(payload, PARAM_LAST);
                console.log('Tonex: Active preset params', params ? 'OK' : 'MISSING', '— requesting mvol');
                if (params) for (let i = 0; i < params.length; i++) this.paramValues[i] = params[i];
                this._write(_reqMvol());
            }
        } else {
            if (name) {
                const a = this._activeIdx();
                if (a >= 0 && a < MAX_PRESETS) this.presetNames[a] = name;
            }
            const params = _parseParams(payload, PARAM_LAST);
            if (params) {
                for (let i = 0; i < params.length; i++) this.paramValues[i] = params[i];
                this._fireSync();
            }
        }
    }

    _onParamChanged(payload) {
        const r = _parseChanged(payload);
        if (!r) { console.log('Tonex: ParamChanged but could not parse'); return; }
        const [pi, val] = r;
        console.log('Tonex: ParamChanged index:', pi, 'value:', val);
        if (pi === 0) {
            this.paramValues[G_MVOL] = (val / 10.0) * 43.0 - 40.0;
            if (this._state === 'SYNCING') {
                this.syncComplete = true;
                this._state = 'READY';
                console.log('Tonex: Sync complete — READY');
                this._fireSync();
            }
        }
    }

    _fireSync() {
        const params = {};
        for (const [idx, def] of Object.entries(PARAM_DEFS)) {
            const i = parseInt(idx);
            params[idx] = { Val: this.paramValues[i], Min: def.mn, Max: def.mx, NAME: def.n };
        }
        const names = {};
        for (let i = 0; i < MAX_PRESETS; i++) names[String(i)] = this.presetNames[i];
        this._onEvent({ CMD: 'GETSYNCCOMPLETE', SYNC: this.syncComplete ? 1 : 0 });
        this._onEvent({ CMD: 'GETPRESETNAMES', PRESET_NAMES: names });
        this._onEvent({ CMD: 'GETPRESET', INDEX: this.currentPreset });
        this._onEvent({ CMD: 'GETPARAMS', PARAMS: params });
    }

    _activeIdx() {
        return this.currentSlot === 0 ? this.slotA : this.currentSlot === 1 ? this.slotB : this.slotC;
    }

    _processQueue() {
        if (this._state !== 'READY' || !this._cmdQueue.length) return;
        const cmd = this._cmdQueue.shift();
        while (this._cmdQueue.length) {
            const n = this._cmdQueue[0];
            if (n.t === 's') { Object.assign(cmd, this._cmdQueue.shift()); }
            else if (n.t === 'p' && cmd.t === 'p' && n.i === cmd.i) { cmd.v = this._cmdQueue.shift().v; }
            else break;
        }
        if (cmd.t === 's') this._doSetPreset(cmd.p);
        else if (cmd.t === 'p') this._doSetParam(cmd.i, cmd.v);
    }

    _doSetPreset(preset) {
        if (preset < 0 || preset >= MAX_PRESETS || !this.stateData || this.stateData.length < 20) return;
        const sd = new Uint8Array(this.stateData), sl = sd.length;
        if (preset === this._activeIdx()) {
            this.bypassMode = this.bypassMode ? 0 : 1;
            sd[sl - SE_BYP] = this.bypassMode;
        } else { sd[sl - SE_BYP] = 0; }
        const s = this.currentSlot;
        if (s === 0) sd[sl - SE_SA] = preset;
        else if (s === 1) sd[sl - SE_SB] = preset;
        else sd[sl - SE_SC] = preset;
        sd[sl - SE_DMON] = 1;
        this._write(_setState(sd));
        this.stateData = sd;
        if (s === 0) this.slotA = preset; else if (s === 1) this.slotB = preset; else this.slotC = preset;
        this.currentPreset = preset;
        this._write(_reqPreset(preset, false));
    }

    _doSetParam(index, value) {
        if (index < PARAM_LAST) {
            this._write(_sendParam(index, value));
            this.paramValues[index] = value;
        } else if (index === G_MVOL) {
            const dv = ((value + 40.0) / 43.0) * 10.0;
            this._write(_sendMvol(dv));
            this.paramValues[index] = value;
            setTimeout(() => this._write(_reqMvol()), 20);
        } else {
            this._modGlobal(index, value);
        }
    }

    _modGlobal(index, value) {
        if (!this.stateData || this.stateData.length < 20) return;
        const sd = new Uint8Array(this.stateData), sl = sd.length;
        this.paramValues[index] = value;
        if (index === G_BPM) { const fb = _f2b(value); for (let i = 0; i < 4; i++) sd[sl - SE_BPM + i] = fb[i]; }
        else if (index === G_TRIM) { const fb = _f2b(value); for (let i = 0; i < 4; i++) sd[SO_TRIM + i] = fb[i]; }
        else if (index === G_CABSIM) { sd[SO_CAB] = value | 0; }
        else if (index === G_TEMPOS) { sd[sl - SE_TEMPO] = value | 0; }
        else if (index === G_TUNEREF) { const r = value | 0; sd[sl - SE_TUNE] = r & 0xFF; sd[sl - SE_TUNE + 1] = (r >> 8) & 0xFF; }
        else if (index === G_BYPASS) { sd[sl - SE_BYP] = value | 0; this.bypassMode = value | 0; }
        sd[sl - SE_DMON] = 1;
        this._write(_setState(sd));
        this.stateData = sd;
    }

    _write(data) {
        if (!this._writer) return;
        this._writer.write(data).catch(e => {
            console.error('Serial write error:', e);
            this.disconnect();
        });
    }
}
