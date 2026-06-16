function generateKey() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function renderQR(url, size) {
    if (typeof qrcode === 'undefined') return '';
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    return qr.createSvgTag({ cellSize: Math.floor(size / qr.getModuleCount()), margin: 0 });
}

class FirebaseRelayHost {
    constructor(onRemoteCommand, onPeerStatus) {
        this.key = null;
        this._ref = null;
        this._onCmd = onRemoteCommand;
        this._onPeer = onPeerStatus;
        this._dragParams = new Set();
        this._stopped = false;
    }

    start() {
        this.key = generateKey();
        this._stopped = false;
        this._ref = fbRtdb.ref('sessions/' + this.key);
        this._ref.onDisconnect().remove();

        this._ref.child('commands').on('child_added', (snap) => {
            if (this._stopped) return;
            const msg = snap.val();
            if (!msg) return;
            if (msg.t === 'setParam' && this._onCmd) {
                this._onCmd('setParam', msg.d);
            } else if (msg.t === 'setPreset' && this._onCmd) {
                this._onCmd('setPreset', msg.d);
            }
            snap.ref.remove();
        });

        this._ref.child('drag').on('child_added', (snap) => {
            this._dragParams.add(parseInt(snap.key));
        });
        this._ref.child('drag').on('child_removed', (snap) => {
            this._dragParams.delete(parseInt(snap.key));
        });

        const connRef = fbRtdb.ref('.info/connected');
        this._connListener = connRef.on('value', (snap) => {
            if (snap.val() === true) {
                this._ref.onDisconnect().remove();
            }
        });

        this._ref.child('remote_connected').on('value', (snap) => {
            if (this._onPeer) this._onPeer(snap.val() === true);
        });

        return this.key;
    }

    stop() {
        this._stopped = true;
        if (this._ref) {
            this._ref.child('commands').off();
            this._ref.child('drag').off();
            this._ref.child('remote_connected').off();
            this._ref.remove();
            this._ref = null;
        }
        fbRtdb.ref('.info/connected').off('value', this._connListener);
        this.key = null;
        this._dragParams.clear();
    }

    getShareURL() {
        return `${location.origin}${location.pathname}?r=${this.key}`;
    }

    broadcastState(stateData) {
        if (this._ref && !this._stopped) {
            this._ref.child('state').set(stateData);
        }
    }

    broadcastParam(index, value) {
        if (this._dragParams.has(index)) return;
        if (this._ref && !this._stopped) {
            this._ref.child('state/params/' + index + '/Val').set(value);
        }
    }

    broadcastPreset(index) {
        if (this._ref && !this._stopped) {
            this._ref.child('state/preset').set(index);
        }
    }

    broadcastStatus(connected, synced) {
        if (this._ref && !this._stopped) {
            this._ref.child('state/connected').set(connected);
            this._ref.child('state/synced').set(synced);
        }
    }
}

class FirebaseRelayRemote {
    constructor(key, onEvent, onPeerStatus) {
        this.key = key;
        this._ref = null;
        this._onEvent = onEvent;
        this._onPeer = onPeerStatus;
        this._stopped = false;
        this._dragging = null;
    }

    connect() {
        this._stopped = false;
        this._ref = fbRtdb.ref('sessions/' + this.key);

        this._ref.child('remote_connected').onDisconnect().set(false);
        this._ref.child('remote_connected').set(true);
        this._ref.child('drag').onDisconnect().remove();

        this._ref.child('state').on('value', (snap) => {
            if (this._stopped) return;
            const data = snap.val();
            if (!data) return;

            if (data.preset !== undefined && data.params) {
                if (this._onEvent) this._onEvent(data);
            }
        });

        this._ref.on('value', (snap) => {
            if (this._stopped) return;
            const exists = snap.exists();
            if (this._onPeer) this._onPeer(exists);
            if (!exists) {
                if (this._onEvent) this._onEvent({ type: 'status', connected: false, synced: false });
            }
        });
    }

    disconnect() {
        this._stopped = true;
        if (this._ref) {
            this._ref.child('state').off();
            this._ref.off();
            this._ref.child('remote_connected').set(false);
            this._ref.child('drag').remove();
            this._ref = null;
        }
    }

    sendParam(index, value) {
        if (this._ref && !this._stopped) {
            this._ref.child('commands').push({ t: 'setParam', d: { i: index, v: value } });
        }
    }

    sendPreset(preset) {
        if (this._ref && !this._stopped) {
            this._ref.child('commands').push({ t: 'setPreset', d: { p: preset } });
        }
    }

    dragStart(index) {
        this._dragging = index;
        if (this._ref) this._ref.child('drag/' + index).set(true);
    }

    dragEnd(index) {
        this._dragging = null;
        if (this._ref) this._ref.child('drag/' + index).remove();
    }
}
