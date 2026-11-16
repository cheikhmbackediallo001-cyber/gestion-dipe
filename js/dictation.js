/**
 * Dictée vocale des champs (prénoms, noms, contacts).
 *
 * - Tout champ portant data-dictate="first-name" | "last-name" | "name" | "phone" | "text"
 *   reçoit un bouton micro 🎤 : on parle, le champ se remplit (mise en forme automatique).
 * - Un bouton portant data-dictate-sequence="#champ1,#champ2,..." dicte plusieurs champs
 *   à la suite (« Dicter la fiche ») : prénom, puis nom, puis parent, puis téléphone.
 * Utilise la reconnaissance vocale du navigateur (Chrome Android, Safari iPhone, Chrome/Edge PC).
 * Si elle n'existe pas, aucun bouton n'est ajouté : le micro du clavier reste utilisable.
 */
(function () {
  'use strict';

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = !!Recognition;

  const MIC_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1"/><line x1="12" y1="18" x2="12" y2="22"/></svg>';

  // ------------------------------------------------------------------------
  // Mise en forme du texte dicté
  // ------------------------------------------------------------------------
  const clean = (t) => String(t || '').replace(/[.,;:!?]+$/g, '').replace(/\s+/g, ' ').trim();
  const titleCase = (t) => clean(t).toLowerCase().replace(/(^|[\s'-])([a-zà-öø-ÿ])/g, (m, sep, ch) => sep + ch.toUpperCase());

  // Nombres dits en français → chiffres (pour les numéros de téléphone)
  const WORDS = {
    'zéro': 0, 'zero': 0, 'un': 1, 'une': 1, 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5, 'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9,
    'dix': 10, 'onze': 11, 'douze': 12, 'treize': 13, 'quatorze': 14, 'quinze': 15, 'seize': 16,
    'vingt': 20, 'vingts': 20, 'trente': 30, 'quarante': 40, 'cinquante': 50, 'soixante': 60, 'septante': 70, 'huitante': 80, 'octante': 80, 'nonante': 90,
    'cent': 100, 'cents': 100
  };

  function spokenToDigits(text) {
    const tokens = String(text || '').toLowerCase()
      .replace(/quatre[\s-]vingts?/g, ' 80w ')
      .replace(/[-–]/g, ' ')
      .replace(/\bet\b/g, ' ')
      .split(/\s+/).filter(Boolean);
    const groups = [];
    let current = null;
    const flush = () => { if (current !== null) { groups.push(String(current)); current = null; } };
    for (const raw of tokens) {
      if (raw === '+' || /^\+\d+$/.test(raw)) { flush(); groups.push(raw); continue; }
      if (/^\d+$/.test(raw)) { flush(); groups.push(raw); continue; }
      const tok = raw.replace(/[.,]/g, '');
      const v = tok === '80w' ? 80 : WORDS[tok];
      if (v === undefined) continue;
      if (v === 100) {
        if (current !== null && current < 10) current *= 100;
        else { flush(); current = 100; }
        continue;
      }
      if (current === null) { current = v; continue; }
      const rest = current % 100;
      const fits = (rest === 0 && v < 100) ||
        ((rest === 60 || rest === 80) && v < 20) ||
        (rest % 10 === 0 && rest >= 20 && v < 10);
      if (fits) current += v;
      else { flush(); current = v; }
    }
    flush();
    return groups.join('');
  }

  function formatPhone(text) {
    let digits = spokenToDigits(text).replace(/[^\d+]/g, '');
    if (!digits) return clean(text);
    if (digits.startsWith('00')) digits = '+' + digits.slice(2);
    return window.Utils && Utils.normalizeSenegalPhone ? Utils.normalizeSenegalPhone(digits) : digits;
  }

  function format(kind, text) {
    if (kind === 'phone') return formatPhone(text);
    if (kind === 'last-name') return clean(text).toUpperCase();
    if (kind === 'first-name' || kind === 'name') return titleCase(text);
    const t = clean(text);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  // ------------------------------------------------------------------------
  // Écoute d'un champ
  // ------------------------------------------------------------------------
  let active = null; // { recognition, input, button }

  function notify(message, type) {
    if (window.App && typeof App.showToast === 'function') App.showToast(message, type || 'info');
  }

  function stop() {
    if (!active) return;
    try { active.recognition.abort(); } catch (e) {}
    finish();
  }

  function finish() {
    if (!active) return;
    const { input, button, placeholder } = active;
    input.classList.remove('is-dictating');
    if (button) { button.classList.remove('is-listening'); button.setAttribute('aria-pressed', 'false'); }
    input.placeholder = placeholder;
    active = null;
  }

  /**
   * Écoute une phrase et remplit le champ. Renvoie une promesse : true si un texte a été reçu.
   */
  function listen(input, button) {
    if (!supported) return Promise.resolve(false);
    if (active) stop();
    const kind = input.getAttribute('data-dictate') || 'text';
    return new Promise((resolve) => {
      const recognition = new Recognition();
      recognition.lang = 'fr-FR';
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;
      const previous = input.value;
      active = { recognition, input, button, placeholder: input.placeholder };
      input.classList.add('is-dictating');
      input.placeholder = '🎙️ Parlez maintenant…';
      if (button) { button.classList.add('is-listening'); button.setAttribute('aria-pressed', 'true'); }
      let finalText = '';
      let errorCode = null;

      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        // Aperçu en direct pendant que l'on parle
        input.value = format(kind === 'phone' ? 'text' : kind, finalText + interim);
      };
      recognition.onerror = (event) => { errorCode = event.error; };
      recognition.onend = () => {
        const received = clean(finalText);
        if (received) {
          input.value = format(kind, received);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          input.value = previous;
          if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
            notify("Micro refusé : autorisez le micro pour ce site dans les réglages du navigateur, puis réessayez.", 'warning');
          } else if (errorCode === 'network') {
            notify("La dictée a besoin d'Internet. Vérifiez la connexion et réessayez.", 'warning');
          } else if (errorCode === 'no-speech' || !errorCode) {
            notify("Je n'ai rien entendu. Appuyez sur 🎤 et parlez juste après.", 'info');
          }
        }
        finish();
        resolve(!!received);
      };
      try {
        recognition.start();
      } catch (e) {
        finish();
        resolve(false);
      }
    });
  }

  // ------------------------------------------------------------------------
  // Boutons micro dans les champs
  // ------------------------------------------------------------------------
  function enhance(input) {
    if (!input || input._dictateReady) return;
    input._dictateReady = true;
    const wrap = document.createElement('div');
    wrap.className = 'dictate-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dictate-btn';
    btn.setAttribute('aria-pressed', 'false');
    const label = input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null;
    const name = label ? label.textContent.replace(/\*/g, '').trim() : 'ce champ';
    btn.setAttribute('aria-label', `Dicter : ${name}`);
    btn.title = `Dicter : ${name}`;
    btn.innerHTML = MIC_ICON;
    btn.addEventListener('click', () => {
      if (active && active.input === input) { stop(); return; }
      listen(input, btn);
    });
    wrap.appendChild(btn);
    input._dictateButton = btn;
  }

  // Dictée de plusieurs champs à la suite (« Dicter la fiche »)
  async function runSequence(trigger) {
    if (trigger._running) { trigger._running = false; stop(); return; }
    const selectors = String(trigger.getAttribute('data-dictate-sequence') || '').split(',').map(s => s.trim()).filter(Boolean);
    const fields = selectors.map(s => document.querySelector(s)).filter(Boolean);
    if (!fields.length) return;
    trigger._running = true;
    const original = trigger.innerHTML;
    trigger.classList.add('is-listening');
    try {
      for (const field of fields) {
        if (!trigger._running) break;
        const label = field.id ? document.querySelector(`label[for="${CSS.escape(field.id)}"]`) : null;
        const name = label ? label.textContent.replace(/\*/g, '').replace(/\(.*?\)/g, '').trim() : 'le champ';
        trigger.innerHTML = `${MIC_ICON}<span>Dites : ${name}</span>`;
        field.scrollIntoView({ block: 'center', behavior: 'smooth' });
        const ok = await listen(field, field._dictateButton || null);
        if (!ok) break;
      }
    } finally {
      trigger._running = false;
      trigger.classList.remove('is-listening');
      trigger.innerHTML = original;
    }
  }

  function enhanceAll(root) {
    if (!supported) {
      (root || document).querySelectorAll('[data-dictate-sequence]').forEach(b => { b.hidden = true; });
      return;
    }
    (root || document).querySelectorAll('input[data-dictate], textarea[data-dictate]').forEach(enhance);
    (root || document).querySelectorAll('[data-dictate-sequence]').forEach(b => {
      if (b._dictateReady) return;
      b._dictateReady = true;
      b.hidden = false;
      b.addEventListener('click', () => runSequence(b));
    });
  }

  // Arrêt de l'écoute à la fermeture d'une fenêtre
  document.addEventListener('click', (e) => {
    if (active && (e.target.closest('.modal-close-btn') || (e.target.classList && e.target.classList.contains('modal-backdrop')))) stop();
  }, true);

  window.Dictation = { supported, listen, stop, enhanceAll, spokenToDigits, formatPhone, format };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => enhanceAll(document));
  else enhanceAll(document);
})();
