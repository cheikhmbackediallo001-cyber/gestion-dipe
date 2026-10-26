/**
 * Calendrier maison — même apparence sur tous les téléphones, tablettes et ordinateurs.
 *
 * Le calendrier natif des navigateurs change selon la marque (Samsung, Chrome, iPhone…).
 * Ce module remplace chaque <input type="date"> par un champ qui ouvre un calendrier sombre unique.
 * Le champ d'origine reste dans la page (caché) : sa valeur garde le format AAAA-MM-JJ,
 * donc le reste de l'application continue de lire et d'écrire `input.value` comme avant.
 */
(function () {
  'use strict';

  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const WEEKDAYS_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

  const ICONS = {
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>',
    caret: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>'
  };

  // --------------------------------------------------------------------------
  // Outils de dates (toujours en heure locale, sans décalage de fuseau)
  // --------------------------------------------------------------------------
  const pad = (n) => String(n).padStart(2, '0');
  const toIso = (p) => `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`;
  const cmp = (a, b) => (a.y - b.y) || (a.m - b.m) || (a.d - b.d);
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

  function makeParts(y, m, d) {
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
    if (y < 1900 || y > 2200 || m < 0 || m > 11 || d < 1 || d > daysInMonth(y, m)) return null;
    return { y, m, d };
  }

  function parseIso(str) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(str || '').trim());
    return match ? makeParts(+match[1], +match[2] - 1, +match[3]) : null;
  }

  // Saisie au clavier : JJ/MM/AAAA (accepte aussi les tirets ou les points)
  function parseTyped(str) {
    const match = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(String(str || '').trim());
    return match ? makeParts(+match[3], +match[2] - 1, +match[1]) : null;
  }

  function today() {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() };
  }

  const formatHeadline = (p) => `${p.d} ${MONTHS_SHORT[p.m]} ${p.y}`;
  const formatField = (p) => `${pad(p.d)}/${pad(p.m + 1)}/${p.y}`;
  const formatSpoken = (p) => {
    const wd = (new Date(p.y, p.m, p.d).getDay() + 6) % 7;
    return `${WEEKDAYS_LONG[wd]} ${p.d} ${MONTHS[p.m]} ${p.y}`;
  };
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // --------------------------------------------------------------------------
  // Fenêtre du calendrier (une seule, partagée par tous les champs)
  // --------------------------------------------------------------------------
  let dlg = null;
  let state = null;

  function el(root, selector) {
    return root.querySelector(selector);
  }

  function buildDialog() {
    const root = document.createElement('div');
    root.className = 'dp-backdrop';
    root.hidden = true;
    root.innerHTML = `
      <div class="dp-dialog" role="dialog" aria-modal="true" aria-labelledby="dpSupporting">
        <div class="dp-header">
          <div class="dp-supporting" id="dpSupporting">Sélectionnez une date</div>
          <div class="dp-headline-row">
            <div class="dp-headline" aria-live="polite"></div>
            <button type="button" class="dp-icon-btn dp-mode-btn"></button>
          </div>
        </div>
        <div class="dp-divider"></div>
        <div class="dp-view-calendar">
          <div class="dp-nav">
            <button type="button" class="dp-month-btn" aria-label="Choisir l'année">
              <span class="dp-month-label"></span><span class="dp-caret">${ICONS.caret}</span>
            </button>
            <div class="dp-arrows">
              <button type="button" class="dp-icon-btn dp-prev" aria-label="Mois précédent">${ICONS.prev}</button>
              <button type="button" class="dp-icon-btn dp-next" aria-label="Mois suivant">${ICONS.next}</button>
            </div>
          </div>
          <div class="dp-days-view">
            <div class="dp-weekdays" aria-hidden="true">${WEEKDAYS.map((d) => `<span>${d}</span>`).join('')}</div>
            <div class="dp-grid"></div>
          </div>
          <div class="dp-years" hidden></div>
        </div>
        <div class="dp-view-input" hidden>
          <label class="dp-text-field">
            <span class="dp-text-label">Date</span>
            <input type="text" class="dp-text-input" inputmode="numeric" autocomplete="off" placeholder="JJ/MM/AAAA" maxlength="10">
          </label>
          <div class="dp-text-help">Format : JJ/MM/AAAA</div>
        </div>
        <div class="dp-actions">
          <button type="button" class="dp-text-btn dp-clear">Effacer</button>
          <span class="dp-spacer"></span>
          <button type="button" class="dp-text-btn dp-cancel">Annuler</button>
          <button type="button" class="dp-text-btn dp-ok">OK</button>
        </div>
      </div>`;
    document.body.appendChild(root);

    root.addEventListener('mousedown', (e) => { if (e.target === root) close(false); });
    el(root, '.dp-cancel').addEventListener('click', () => close(false));
    el(root, '.dp-ok').addEventListener('click', confirm);
    el(root, '.dp-clear').addEventListener('click', () => { state.sel = null; commit(); });
    el(root, '.dp-prev').addEventListener('click', () => shiftMonth(-1));
    el(root, '.dp-next').addEventListener('click', () => shiftMonth(1));
    el(root, '.dp-month-btn').addEventListener('click', () => {
      state.mode = state.mode === 'years' ? 'days' : 'years';
      render();
    });
    el(root, '.dp-mode-btn').addEventListener('click', toggleInputMode);

    el(root, '.dp-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('.dp-day');
      if (!btn || btn.disabled) return;
      state.sel = parseIso(btn.dataset.date);
      render();
      focusDay(btn.dataset.date);
    });
    el(root, '.dp-grid').addEventListener('keydown', onGridKey);

    el(root, '.dp-years').addEventListener('click', (e) => {
      const btn = e.target.closest('.dp-year');
      if (!btn) return;
      state.view.y = +btn.dataset.year;
      clampView();
      state.mode = 'days';
      render();
    });

    const textInput = el(root, '.dp-text-input');
    textInput.addEventListener('input', () => {
      // Ajoute les barres automatiquement : 25102026 -> 25/10/2026
      const digits = textInput.value.replace(/\D/g, '').slice(0, 8);
      let out = digits.slice(0, 2);
      if (digits.length > 2) out += '/' + digits.slice(2, 4);
      if (digits.length > 4) out += '/' + digits.slice(4);
      textInput.value = out;
      root.querySelector('.dp-view-input').classList.remove('has-error');
      const parsed = parseTyped(out);
      if (parsed && inRange(parsed)) {
        state.sel = parsed;
        state.view = { y: parsed.y, m: parsed.m };
        renderHeadline();
      }
    });
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); confirm(); }
    });

    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); }
      if (e.key === 'Tab') trapFocus(e);
    });
    return root;
  }

  function trapFocus(e) {
    const focusables = Array.from(dlg.querySelectorAll('button, input'))
      .filter((n) => !n.disabled && n.offsetParent !== null && n.tabIndex !== -1);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function inRange(p) {
    if (state.min && cmp(p, state.min) < 0) return false;
    if (state.max && cmp(p, state.max) > 0) return false;
    return true;
  }

  function clampView() {
    const v = state.view;
    if (state.min && (v.y < state.min.y || (v.y === state.min.y && v.m < state.min.m))) { v.y = state.min.y; v.m = state.min.m; }
    if (state.max && (v.y > state.max.y || (v.y === state.max.y && v.m > state.max.m))) { v.y = state.max.y; v.m = state.max.m; }
  }

  function shiftMonth(delta) {
    const d = new Date(state.view.y, state.view.m + delta, 1);
    state.view = { y: d.getFullYear(), m: d.getMonth() };
    clampView();
    state.mode = 'days';
    render();
  }

  function yearBounds() {
    const t = today();
    return {
      from: state.min ? state.min.y : Math.min(t.y - 100, state.view.y),
      to: state.max ? state.max.y : Math.max(t.y + 10, state.view.y)
    };
  }

  function renderHeadline() {
    const headline = el(dlg, '.dp-headline');
    headline.textContent = state.sel ? formatHeadline(state.sel) : 'Aucune date';
    headline.classList.toggle('is-empty', !state.sel);
  }

  function render() {
    renderHeadline();
    const inputMode = state.mode === 'input';
    el(dlg, '.dp-view-calendar').hidden = inputMode;
    el(dlg, '.dp-view-input').hidden = !inputMode;
    const modeBtn = el(dlg, '.dp-mode-btn');
    modeBtn.innerHTML = inputMode ? ICONS.calendar : ICONS.pencil;
    modeBtn.setAttribute('aria-label', inputMode ? 'Revenir au calendrier' : 'Saisir la date au clavier');
    el(dlg, '.dp-clear').hidden = state.required;
    if (inputMode) return;

    const v = state.view;
    el(dlg, '.dp-month-label').textContent = `${capitalize(MONTHS[v.m])} ${v.y}`;
    const showYears = state.mode === 'years';
    el(dlg, '.dp-month-btn').classList.toggle('is-open', showYears);
    el(dlg, '.dp-month-btn').setAttribute('aria-expanded', String(showYears));
    el(dlg, '.dp-days-view').hidden = showYears;
    el(dlg, '.dp-years').hidden = !showYears;
    el(dlg, '.dp-arrows').style.visibility = showYears ? 'hidden' : '';

    const prevLimit = state.min && (v.y < state.min.y || (v.y === state.min.y && v.m <= state.min.m));
    const nextLimit = state.max && (v.y > state.max.y || (v.y === state.max.y && v.m >= state.max.m));
    el(dlg, '.dp-prev').disabled = !!prevLimit;
    el(dlg, '.dp-next').disabled = !!nextLimit;

    if (showYears) {
      const { from, to } = yearBounds();
      const years = el(dlg, '.dp-years');
      let html = '';
      for (let y = from; y <= to; y++) {
        const cls = ['dp-year'];
        if (y === v.y) cls.push('is-selected');
        if (y === today().y) cls.push('is-current');
        html += `<button type="button" class="${cls.join(' ')}" data-year="${y}" aria-pressed="${y === v.y}">${y}</button>`;
      }
      years.innerHTML = html;
      const current = years.querySelector('.is-selected');
      if (current) {
        years.scrollTop = current.offsetTop - years.clientHeight / 2 + current.offsetHeight / 2;
        current.focus({ preventScroll: true });
      }
      return;
    }

    // Grille des jours : toujours 6 lignes pour garder la même hauteur d'un mois à l'autre
    const t = today();
    const offset = (new Date(v.y, v.m, 1).getDay() + 6) % 7; // semaine commençant le lundi
    const total = daysInMonth(v.y, v.m);
    const focusDate = state.sel && state.sel.y === v.y && state.sel.m === v.m ? state.sel
      : (t.y === v.y && t.m === v.m ? t : { y: v.y, m: v.m, d: 1 });
    let html = '';
    for (let i = 0; i < 42; i++) {
      const day = i - offset + 1;
      if (day < 1 || day > total) { html += '<span class="dp-cell" aria-hidden="true"></span>'; continue; }
      const p = { y: v.y, m: v.m, d: day };
      const cls = ['dp-day'];
      if (state.sel && cmp(p, state.sel) === 0) cls.push('is-selected');
      if (cmp(p, t) === 0) cls.push('is-today');
      const disabled = !inRange(p);
      const tab = cmp(p, focusDate) === 0 ? '0' : '-1';
      html += `<span class="dp-cell"><button type="button" class="${cls.join(' ')}" data-date="${toIso(p)}" tabindex="${tab}"`
        + ` aria-label="${formatSpoken(p)}${cmp(p, t) === 0 ? ' (aujourd\'hui)' : ''}" aria-pressed="${cls.includes('is-selected')}"${disabled ? ' disabled' : ''}>${day}</button></span>`;
    }
    el(dlg, '.dp-grid').innerHTML = html;
  }

  function focusDay(iso) {
    const btn = dlg.querySelector(`.dp-day[data-date="${iso}"]`);
    if (btn) {
      dlg.querySelectorAll('.dp-day[tabindex="0"]').forEach((b) => { b.tabIndex = -1; });
      btn.tabIndex = 0;
      btn.focus();
    }
  }

  // Flèches du clavier dans la grille (ordinateur)
  function onGridKey(e) {
    const btn = e.target.closest('.dp-day');
    if (!btn) return;
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!btn.disabled) { state.sel = parseIso(btn.dataset.date); render(); confirm(); }
      return;
    }
    if (!(e.key in moves)) return;
    e.preventDefault();
    const p = parseIso(btn.dataset.date);
    const d = new Date(p.y, p.m, p.d + moves[e.key]);
    const target = { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
    if (!inRange(target)) return;
    if (target.m !== state.view.m || target.y !== state.view.y) {
      state.view = { y: target.y, m: target.m };
      render();
    }
    focusDay(toIso(target));
  }

  function toggleInputMode() {
    const textInput = el(dlg, '.dp-text-input');
    if (state.mode === 'input') {
      const parsed = parseTyped(textInput.value);
      if (parsed && inRange(parsed)) {
        state.sel = parsed;
        state.view = { y: parsed.y, m: parsed.m };
      }
      state.mode = 'days';
      render();
      const sel = dlg.querySelector('.dp-day[tabindex="0"]');
      if (sel) sel.focus();
    } else {
      state.mode = 'input';
      render();
      textInput.value = state.sel ? formatField(state.sel) : '';
      el(dlg, '.dp-view-input').classList.remove('has-error');
      textInput.focus();
      textInput.select();
    }
  }

  function confirm() {
    if (state.mode === 'input') {
      const raw = el(dlg, '.dp-text-input').value.trim();
      const parsed = parseTyped(raw);
      if (raw === '' && !state.required) {
        state.sel = null;
      } else if (!parsed || !inRange(parsed)) {
        el(dlg, '.dp-view-input').classList.add('has-error');
        el(dlg, '.dp-text-help').textContent = parsed ? 'Cette date est en dehors des limites autorisées.' : 'Date invalide. Format : JJ/MM/AAAA';
        el(dlg, '.dp-text-input').focus();
        return;
      } else {
        state.sel = parsed;
      }
    }
    if (!state.sel && state.required) {
      // Une date est obligatoire : on ne ferme pas sans choix
      const headline = el(dlg, '.dp-headline');
      headline.classList.remove('dp-shake');
      void headline.offsetWidth;
      headline.classList.add('dp-shake');
      return;
    }
    commit();
  }

  function commit() {
    const input = state.input;
    const before = input.value;
    input.value = state.sel ? toIso(state.sel) : '';
    if (input.value !== before) {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    close(true);
  }

  function close() {
    if (!dlg || !state) return;
    dlg.hidden = true;
    dlg.classList.remove('is-open');
    document.documentElement.classList.remove('dp-lock');
    const field = state.field;
    state = null;
    if (field && document.contains(field)) field.focus({ preventScroll: true });
  }

  function open(input) {
    if (input.disabled || input.readOnly) return;
    if (!dlg) dlg = buildDialog();
    const sel = parseIso(input.value);
    const base = sel || today();
    state = {
      input,
      field: input._dpField,
      sel,
      view: { y: base.y, m: base.m },
      mode: 'days',
      required: input.required,
      min: parseIso(input.getAttribute('min')),
      max: parseIso(input.getAttribute('max'))
    };
    clampView();
    el(dlg, '.dp-text-help').textContent = 'Format : JJ/MM/AAAA';
    el(dlg, '.dp-view-input').classList.remove('has-error');
    render();
    dlg.hidden = false;
    document.documentElement.classList.add('dp-lock');
    requestAnimationFrame(() => {
      if (!dlg.hidden) dlg.classList.add('is-open');
    });
    const focusTarget = dlg.querySelector('.dp-day[tabindex="0"]') || el(dlg, '.dp-ok');
    focusTarget.focus({ preventScroll: true });
  }

  // --------------------------------------------------------------------------
  // Transformation d'un champ <input type="date">
  // --------------------------------------------------------------------------
  function enhance(input) {
    if (!input || input._dpField) return;
    const initial = input.value;

    const wrap = document.createElement('div');
    wrap.className = 'dp-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const field = document.createElement('button');
    field.type = 'button';
    field.className = 'form-input dp-field';
    field.setAttribute('aria-haspopup', 'dialog');
    field.innerHTML = '<span class="dp-field-text"></span><span class="dp-field-icon">' + ICONS.calendar + '</span>';
    wrap.appendChild(field);
    input._dpField = field;

    // Le champ d'origine devient un simple support de valeur (caché mais toujours validé par le formulaire)
    input.type = 'text';
    input.classList.add('dp-native');
    input.tabIndex = -1;
    input.setAttribute('inputmode', 'none');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-hidden', 'true');

    const label = input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null;
    if (label) {
      if (!label.id) label.id = input.id + 'Label';
      field.setAttribute('aria-labelledby', label.id + ' ' + (field.id = input.id + 'Display'));
      label.addEventListener('click', (e) => { e.preventDefault(); field.focus(); open(input); });
    }

    const textEl = field.querySelector('.dp-field-text');
    const refresh = () => {
      const p = parseIso(nativeValue.get.call(input));
      textEl.textContent = p ? formatField(p) : 'JJ/MM/AAAA';
      field.classList.toggle('is-empty', !p);
      field.disabled = input.disabled;
      if (p) field.classList.remove('dp-invalid');
    };

    // Toute écriture de input.value (par l'application) met à jour l'affichage
    Object.defineProperty(input, 'value', {
      configurable: true,
      get() { return nativeValue.get.call(this); },
      set(v) {
        const p = parseIso(v == null ? '' : String(v));
        nativeValue.set.call(this, p ? toIso(p) : '');
        refresh();
      }
    });
    // Le code qui fait input.focus() place le curseur sur le nouveau champ
    input.focus = (opts) => field.focus(opts);
    input.showPicker = () => open(input);
    input.addEventListener('focus', () => field.focus());
    input.addEventListener('invalid', (e) => {
      e.preventDefault();
      field.classList.add('dp-invalid');
      const form = input.form;
      const firstInvalid = form ? form.querySelector(':invalid') : input;
      if (firstInvalid === input && !state) { field.focus(); open(input); }
    });

    field.addEventListener('click', () => open(input));
    field.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'F4') { e.preventDefault(); open(input); }
      if ((e.key === 'Backspace' || e.key === 'Delete') && !input.required && input.value) {
        e.preventDefault();
        input.value = '';
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    input.value = initial;
  }

  function enhanceAll(root) {
    (root || document).querySelectorAll('input[type="date"]').forEach(enhance);
  }

  function start() {
    enhanceAll(document);
    // Champs de date ajoutés plus tard dans la page
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches('input[type="date"]')) enhance(node);
          else if (node.querySelectorAll) enhanceAll(node);
        });
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  window.DatePicker = { enhance, enhanceAll, open, parseIso, formatField };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
