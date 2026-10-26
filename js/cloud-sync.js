/**
 * SYNCHRONISATION CLOUD - GESTION PRÉSCOLAIRE
 * 1. Sauvegarde automatique de toutes les données de l'école dans Supabase (table school_backups),
 *    lisible UNIQUEMENT par le compte propriétaire (sécurité RLS côté serveur).
 * 2. Publication des reçus (informations non sensibles) pour que n'importe quel parent puisse
 *    vérifier un reçu en scannant son QR code depuis son propre téléphone.
 * 3. Restauration automatique sur un nouvel appareil après connexion, et récupération des
 *    modifications faites sur un autre appareil.
 *
 * Fonctionne avec un compte en ligne confirmé (session Supabase). Sans effet en mode démo,
 * hors-ligne ou si la base en ligne n'est pas encore à jour : l'application reste utilisable.
 */

const CloudSync = {
  STATE_KEY: 'gp_cloud_sync_state_v1',
  DEBOUNCE_MS: 3000,
  BATCH_SIZE: 200,
  _timer: null,
  _running: false,
  _suspended: false,
  status: { state: 'idle', message: '', lastBackupAt: null, publishedCount: 0 },

  // ----------------------------------------------------------------------------
  // État local de synchronisation (par école et par compte)
  // ----------------------------------------------------------------------------
  _readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.STATE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  },

  _writeState(state) {
    try {
      localStorage.setItem(this.STATE_KEY, JSON.stringify(state));
    } catch (e) {}
  },

  _stateKey(userId) {
    const schoolId = window.Store && Store.data && Store.data.school ? Store.data.school.id : 'none';
    return `${schoolId}:${userId}`;
  },

  _entry(userId) {
    const state = this._readState();
    const key = this._stateKey(userId);
    state[key] = state[key] || { published: {}, lastBackupAt: null, lastBackupSavedAt: null };
    return { state, key, entry: state[key] };
  },

  // ----------------------------------------------------------------------------
  // Conditions
  // ----------------------------------------------------------------------------
  canSync() {
    return !!(window.Store && Store.data && Store.data.school && !Store.isDemo());
  },

  async _session() {
    if (!window.Auth || !Auth.client || !navigator.onLine) return null;
    try {
      const { data } = await Auth.client.auth.getSession();
      return data && data.session && data.session.user ? data.session : null;
    } catch (e) {
      return null;
    }
  },

  _setStatus(state, message, extra = {}) {
    this.status = { ...this.status, state, message, ...extra };
    try {
      document.dispatchEvent(new CustomEvent('cloudsync-status', { detail: this.status }));
    } catch (e) {}
  },

  /**
   * Traduit une erreur Supabase en message compréhensible
   */
  _humanError(err) {
    const code = err && (err.code || '');
    const msg = String((err && err.message) || err || '');
    if (code === 'PGRST205' || code === 'PGRST202' || code === '42P01' || /schema cache|does not exist|Could not find/i.test(msg)) {
      return "La base en ligne n'est pas encore à jour : le script SQL de synchronisation doit être exécuté dans Supabase.";
    }
    if (/JWT|token|not authenticated|Authentification/i.test(msg)) {
      return "Session en ligne expirée : reconnectez-vous avec votre e-mail et votre mot de passe.";
    }
    if (/Failed to fetch|NetworkError|network/i.test(msg)) {
      return "Connexion Internet indisponible : la sauvegarde reprendra automatiquement.";
    }
    return "Sauvegarde en ligne momentanément impossible : nouvel essai automatique plus tard.";
  },

  // ----------------------------------------------------------------------------
  // Déclenchement automatique après chaque modification locale
  // ----------------------------------------------------------------------------
  onLocalChange() {
    if (this._suspended || !this.canSync()) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => { this.syncNow().catch(() => {}); }, this.DEBOUNCE_MS);
  },

  /**
   * Sauvegarde + publication des reçus modifiés
   */
  async syncNow({ force = false } = {}) {
    if (!this.canSync()) {
      this._setStatus('demo', "La sauvegarde en ligne s'active dès que votre école est créée.");
      return this.status;
    }
    if (this._running) return this.status;
    const session = await this._session();
    if (!session) {
      this._setStatus('no-session', navigator.onLine
        ? "Inactive : connectez-vous en ligne avec votre e-mail confirmé pour activer la sauvegarde automatique et la vérification des reçus depuis tout téléphone."
        : "Hors ligne : la sauvegarde reprendra au retour de la connexion.");
      return this.status;
    }

    this._running = true;
    this._setStatus('syncing', 'Synchronisation en cours...');
    try {
      await this._backup(session, force);
      const published = await this._publishReceipts(session, force);
      const { entry } = this._entry(session.user.id);
      this._setStatus('ok', 'Active', { lastBackupAt: entry.lastBackupAt, publishedCount: published });
    } catch (err) {
      console.warn('[CloudSync]', err);
      this._setStatus('error', this._humanError(err));
    } finally {
      this._running = false;
    }
    return this.status;
  },

  async _backup(session, force) {
    const data = Store.data;
    const savedAt = data._savedAt || new Date().toISOString();
    const { state, key, entry } = this._entry(session.user.id);
    if (!force && entry.lastBackupSavedAt === savedAt) return false; // rien de nouveau

    const payload = {
      owner_id: session.user.id,
      local_school_id: String(data.school.id).slice(0, 100),
      school_name: String(data.school.name || '').slice(0, 255),
      data: data,
      client_saved_at: savedAt
    };
    const { error } = await Auth.client.from('school_backups').upsert(payload, { onConflict: 'owner_id' });
    if (error) throw error;

    entry.lastBackupAt = new Date().toISOString();
    entry.lastBackupSavedAt = savedAt;
    state[key] = entry;
    this._writeState(state);
    return true;
  },

  _receiptPublicList() {
    const school = Store.getSchool();
    return Store.getReceipts()
      .filter(r => r.public_token)
      .map(r => ({
        token: r.public_token,
        receipt_number: r.receipt_number,
        school_name: school.name,
        school_commune: school.commune || '',
        object_label: r.object_label,
        amount: parseInt(r.amount, 10) || 0,
        method: r.method || 'cash',
        status: r.status === 'cancelled' ? 'cancelled' : 'valid',
        issued_at: r.issued_at
      }));
  },

  _signature(r) {
    return [r.status, r.amount, r.receipt_number, r.object_label, r.method, r.school_name, r.school_commune].join('|');
  },

  async _publishReceipts(session, force) {
    const { state, key, entry } = this._entry(session.user.id);
    const published = entry.published || {};
    const list = this._receiptPublicList();
    const currentTokens = new Set(list.map(r => r.token));

    const changes = list.filter(r => force || published[r.token] !== this._signature(r));
    // Reçus supprimés localement : marqués ANNULÉ en ligne (jamais effacés)
    Object.keys(published).forEach(token => {
      if (!currentTokens.has(token) && published[token] !== 'revoked') {
        changes.push({ token, revoke: true });
      }
    });

    for (let i = 0; i < changes.length; i += this.BATCH_SIZE) {
      const batch = changes.slice(i, i + this.BATCH_SIZE);
      const { error } = await Auth.client.rpc('publish_receipts', { p_receipts: batch });
      if (error) throw error;
      batch.forEach(r => { published[r.token] = r.revoke ? 'revoked' : this._signature(r); });
      entry.published = published;
      state[key] = entry;
      this._writeState(state);
    }
    return list.length;
  },

  // ----------------------------------------------------------------------------
  // Récupération des données en ligne
  // ----------------------------------------------------------------------------
  async _fetchBackupMeta(session) {
    const { data, error } = await Auth.client
      .from('school_backups')
      .select('local_school_id, client_saved_at')
      .eq('owner_id', session.user.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async _fetchBackup(session) {
    const { data, error } = await Auth.client
      .from('school_backups')
      .select('local_school_id, client_saved_at, data')
      .eq('owner_id', session.user.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  _isValidSchoolData(data) {
    return !!(data && typeof data === 'object' && data.school && data.school.id && data.school.name &&
      Array.isArray(data.classes) && Array.isArray(data.students) && Array.isArray(data.payments) && Array.isArray(data.receipts));
  },

  _hasRecords(data) {
    return !!(data && ((data.students || []).length || (data.payments || []).length || (data.expenses || []).length || (data.other_revenues || []).length));
  },

  /**
   * Après connexion : restaure la sauvegarde en ligne si l'appareil n'a pas cette école
   * ou si la version en ligne est plus récente. Ne remplace jamais une AUTRE école présente sur l'appareil.
   * @param {string|null} currentSchoolId école déjà associée à ce compte sur l'appareil
   * @returns {Promise<object|null>} l'école restaurée (ou confirmée), sinon null
   */
  async restoreAfterLogin(currentSchoolId = null) {
    const session = await this._session();
    if (!session) return null;
    let backup;
    try {
      backup = await this._fetchBackup(session);
    } catch (e) {
      console.warn('[CloudSync] Restauration impossible:', e && e.message);
      return null;
    }
    if (!backup || !this._isValidSchoolData(backup.data)) return null;

    const remote = backup.data;
    if (currentSchoolId && String(currentSchoolId) !== String(remote.school.id)) {
      return null; // une autre école existe déjà sur cet appareil pour ce compte : on n'y touche pas
    }

    const storageKey = `gp_store_${remote.school.id}`;
    let local = null;
    try { local = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (e) { local = null; }
    const localTime = local && local._savedAt ? Date.parse(local._savedAt) || 0 : 0;
    const remoteTime = Date.parse(backup.client_saved_at || remote._savedAt || '') || 0;

    if (!local || !this._hasRecords(local) || remoteTime > localTime) {
      localStorage.setItem(storageKey, JSON.stringify(remote));
      const { state, key, entry } = (() => {
        const st = this._readState();
        const k = `${remote.school.id}:${session.user.id}`;
        st[k] = st[k] || { published: {}, lastBackupAt: null, lastBackupSavedAt: null };
        return { state: st, key: k, entry: st[k] };
      })();
      entry.lastBackupSavedAt = remote._savedAt || backup.client_saved_at;
      state[key] = entry;
      this._writeState(state);
    }
    return remote.school;
  },

  /**
   * À l'ouverture de l'application : récupère les modifications faites sur un autre appareil,
   * puis envoie les modifications locales.
   * @param {Function} onUpdated appelé si les données affichées ont été remplacées
   */
  async startupSync(onUpdated) {
    if (!this.canSync()) {
      this._setStatus('demo', "La sauvegarde en ligne s'active dès que votre école est créée.");
      return;
    }
    const session = await this._session();
    if (!session) {
      await this.syncNow();
      return;
    }
    try {
      const meta = await this._fetchBackupMeta(session);
      if (meta && String(meta.local_school_id) === String(Store.data.school.id)) {
        const remoteTime = Date.parse(meta.client_saved_at || '') || 0;
        const localTime = Date.parse(Store.data._savedAt || '') || 0;
        if (remoteTime > localTime + 1000) {
          const full = await this._fetchBackup(session);
          if (full && this._isValidSchoolData(full.data) && String(full.data.school.id) === String(Store.data.school.id)) {
            this._suspended = true;
            Store.data = full.data;
            localStorage.setItem(Store.storageKey, JSON.stringify(full.data));
            this._suspended = false;
            const { state, key, entry } = this._entry(session.user.id);
            entry.lastBackupSavedAt = full.data._savedAt || full.client_saved_at;
            state[key] = entry;
            this._writeState(state);
            if (typeof onUpdated === 'function') onUpdated();
          }
        }
      }
    } catch (err) {
      console.warn('[CloudSync] Récupération en ligne impossible:', err && err.message);
    }
    await this.syncNow();
  }
};

// Reprise automatique au retour de la connexion
window.addEventListener('online', () => {
  if (window.CloudSync) CloudSync.onLocalChange();
});

window.CloudSync = CloudSync;
