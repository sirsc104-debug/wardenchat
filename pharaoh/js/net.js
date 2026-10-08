// Friend codes. Each town has a ten-symbol code. When the game runs as a
// published Claude artifact, towns are shared through the artifact's database
// so friends can find each other by code. Anywhere else it falls back to this
// browser only (handy for siblings sharing a computer).
(function (G) {
  'use strict';
  const { U } = G;
  const LOCAL_KEY = 'sotp_bases_v1';

  const Net = {
    online: false,
    db: null,
    uid: null,
    lastPublished: '',
    status: 'This browser only',

    async init() {
      try {
        const c = globalThis.claude;
        if (!c || typeof c.use !== 'function') return false;
        const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
        if (!db || !user) return false;
        const uid = await user.id();
        if (!uid) return false;
        this.db = db; this.uid = uid; this.online = true;
        this.status = 'Online';
        return true;
      } catch (e) {
        return false;
      }
    },

    // Compact layout: [typeIndex, x, y, level] per building.
    pack(st, layout) {
      const types = G.D.BUILDING_ORDER;
      return {
        code: st.code, name: st.name.slice(0, 40), ph: G.Game.ph(), trophies: st.trophies,
        guardLevel: G.Game.guardLevel(),
        layout: layout.map((b) => [types.indexOf(b.type), b.x, b.y, b.level]),
        updated: Date.now(),
      };
    },
    unpack(doc) {
      const types = G.D.BUILDING_ORDER;
      return {
        code: doc.code, name: String(doc.name || 'Friend').slice(0, 40), ph: Math.max(1, Math.min(11, doc.ph | 0)), trophies: doc.trophies | 0,
        guardLevel: Math.max(1, Math.min(11, doc.guardLevel | 0 || 1)),
        layout: (doc.layout || []).filter((r) => Array.isArray(r) && types[r[0]]).map((r) => ({
          type: types[r[0]], x: U.clamp(r[1] | 0, 0, G.D.MAP - 1), y: U.clamp(r[2] | 0, 0, G.D.MAP - 1), level: U.clamp(r[3] | 0, 1, 11),
        })),
      };
    },

    localAll() { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); } catch (e) { return {}; } },
    localPut(doc) {
      try { const all = this.localAll(); all[doc.code] = doc; localStorage.setItem(LOCAL_KEY, JSON.stringify(all)); } catch (e) { /* ignore */ }
    },

    // Publish your town so friends can attack it. Called after changes.
    async publish(st) {
      const layout = G.Game.battleLayout(st);
      const doc = this.pack(st, layout);
      const sig = JSON.stringify({ ...doc, updated: 0 });
      if (sig === this.lastPublished) return;
      this.lastPublished = sig;
      this.localPut(doc);
      if (!this.online) return;
      try {
        await this.db.doc('bases/' + this.uid).set(doc);
        this.status = 'Online';
      } catch (e) {
        // view-only visitors can still attack others, they just cannot share their own town
        this.status = e && e.code === 'invalid_argument' ? 'Read only' : 'Offline';
        if (e && e.code === 'invalid_argument') this.readOnly = true;
      }
    },

    async find(code) {
      code = U.normalizeCode(code);
      if (code.length !== 10) return { error: 'Codes are 10 letters and numbers long.' };
      if (this.online) {
        try {
          const snap = await this.db.collection('bases').where('code', '==', code).limit(1).get();
          if (!snap.empty) return { base: this.unpack(snap.docs[0].data()) };
        } catch (e) { /* fall through to local */ }
      }
      const local = this.localAll()[code];
      if (local) return { base: this.unpack(local) };
      return { error: this.online ? 'No town has that code. Check it with your friend.' : 'No town with that code on this device. To play with friends on other devices, open the shared game link.' };
    },

    // Private cloud copy of your save, so the game follows you between devices.
    async loadCloudSave() {
      if (!this.online) return null;
      try {
        const snap = await this.db.doc('data/users/' + this.uid + '/save').get();
        if (!snap.exists) return null;
        const d = snap.data();
        return d && d.json ? JSON.parse(d.json) : null;
      } catch (e) { return null; }
    },
    async saveCloud(st) {
      if (!this.online || this.readOnly) return;
      // Leave out raid replays: they are big and only matter on this device.
      const json = JSON.stringify({ ...st, log: st.log.map((e) => ({ ...e, replay: null })) });
      if (json === this._lastCloud) return;
      this._lastCloud = json;
      try { await this.db.doc('data/users/' + this.uid + '/save').set({ json, at: Date.now() }); } catch (e) { /* ignore */ }
    },
  };

  G.Net = Net;
})(globalThis.SOTP = globalThis.SOTP || {});
