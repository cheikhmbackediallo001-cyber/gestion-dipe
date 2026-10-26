/**
 * UTILITAIRES MÉTIER & SÉCURITÉ - GESTION DIPE
 * - Formatage FCFA avec espace insécable
 * - Dates JJ/MM/AAAA (Africa/Dakar)
 * - Validation téléphone Sénégal (+221 7X XXX XX XX)
 * - Conversion montants en toutes lettres (Français)
 * - Générateur de QR Code SVG autonome ultra-léger
 * - Protection XSS (échappement HTML)
 */

const Utils = {
  /**
   * Formate un montant entier en devise FCFA avec espace insécable
   * Exemple : 25000 -> "25 000 FCFA"
   */
  formatFCFA(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return '0\u00A0FCFA';
    const rounded = Math.round(Number(amount));
    // Utilisation de l'espace insécable \u00A0 pour éviter les retours à la ligne intempestifs
    const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
    return `${formatted}\u00A0FCFA`;
  },

  /**
   * Formate une date ISO ou Date en JJ/MM/AAAA
   */
  formatDate(dateInput) {
    if (!dateInput) return '-';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '-';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  },

  /**
   * Formate une date et heure : JJ/MM/AAAA à HH:MM
   */
  formatDateTime(dateInput) {
    if (!dateInput) return '-';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '-';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} à ${hours}:${minutes}`;
  },

  /**
   * Valide un numéro de téléphone sénégalais (formats acceptés : +221 7X XXX XX XX, 2217XXXXXXXX, 7XXXXXXXX)
   */
  validateSenegalPhone(phone) {
    if (!phone) return false;
    const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
    // Regex autorisant les préfixes 70, 75, 76, 77, 78 avec ou sans indicatif +221 / 221 / 00221
    const regex = /^(?:(?:\+|00)?221)?(7[05678]\d{7})$/;
    return regex.test(cleaned);
  },

  /**
   * Normalise un numéro au format international standard +221 7X XXX XX XX
   */
  normalizeSenegalPhone(phone) {
    if (!phone) return '';
    const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
    const match = cleaned.match(/^(?:(?:\+|00)?221)?(7[05678])(\d{3})(\d{2})(\d{2})$/);
    if (match) {
      return `+221 ${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
    }
    return phone;
  },

  /**
   * Convertit un numéro de téléphone pour WhatsApp (ex: 221775432100)
   */
  toWhatsAppPhone(phone) {
    if (!phone) return '';
    const cleaned = phone.replace(/[\s\-\(\)\+\.]/g, '');
    if (cleaned.startsWith('221') && cleaned.length === 12) {
      return cleaned;
    }
    if (cleaned.length === 9) {
      return `221${cleaned}`;
    }
    return cleaned;
  },

  /**
   * Échappement strict anti-XSS pour injection sécurisée dans innerHTML
   */
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /**
   * Convertit un entier positif (FCFA) en toutes lettres en français
   * Exemple : 25000 -> "vingt-cinq mille francs CFA"
   */
  amountToFrenchWords(num) {
    num = Math.round(Math.abs(Number(num) || 0));
    if (num === 0) return 'zéro franc CFA';

    const unites = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
    const particuliers = {
      10: 'dix', 11: 'onze', 12: 'douze', 13: 'treize', 14: 'quatorze', 15: 'quinze', 16: 'seize',
      70: 'soixante-dix', 71: 'soixante-et-onze', 72: 'soixante-douze', 73: 'soixante-treize', 74: 'soixante-quatorze',
      75: 'soixante-quinze', 76: 'soixante-seize', 77: 'soixante-dix-sept', 78: 'soixante-dix-huit', 79: 'soixante-dix-neuf',
      90: 'quatre-vingt-dix', 91: 'quatre-vingt-onze', 92: 'quatre-vingt-douze', 93: 'quatre-vingt-treize',
      94: 'quatre-vingt-quatorze', 95: 'quatre-vingt-quinze', 96: 'quatre-vingt-seize', 97: 'quatre-vingt-dix-sept',
      98: 'quatre-vingt-dix-huit', 99: 'quatre-vingt-dix-neuf'
    };
    const dizaines = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

    function convertInferieurCent(n) {
      if (n === 0) return '';
      if (n < 10) return unites[n];
      if (particuliers[n]) return particuliers[n];
      
      const d = Math.floor(n / 10);
      const u = n % 10;

      if (d === 8 && u === 0) return 'quatre-vingts';
      if (d === 8) return `quatre-vingt-${unites[u]}`;
      
      if (u === 1 && d >= 2 && d <= 7) {
        return `${dizaines[d]}-et-un`;
      }
      if (u === 0) {
        return dizaines[d];
      }
      return `${dizaines[d]}-${unites[u]}`;
    }

    function convertInferieurMille(n) {
      if (n === 0) return '';
      const c = Math.floor(n / 100);
      const r = n % 100;
      let res = '';

      if (c === 1) {
        res = 'cent';
      } else if (c > 1) {
        res = `${unites[c]} cent${r === 0 ? 's' : ''}`;
      }

      if (r > 0) {
        const resteStr = convertInferieurCent(r);
        res = res ? `${res} ${resteStr}` : resteStr;
      }
      return res;
    }

    let millions = Math.floor(num / 1000000);
    let resteMillions = num % 1000000;
    let milliers = Math.floor(resteMillions / 1000);
    let unitesSimples = resteMillions % 1000;

    let blocs = [];

    if (millions > 0) {
      if (millions === 1) {
        blocs.push('un million');
      } else {
        blocs.push(`${convertInferieurMille(millions)} millions`);
      }
    }

    if (milliers > 0) {
      if (milliers === 1) {
        blocs.push('mille');
      } else {
        blocs.push(`${convertInferieurMille(milliers)} mille`);
      }
    }

    if (unitesSimples > 0) {
      blocs.push(convertInferieurMille(unitesSimples));
    }

    const phrase = blocs.join(' ').trim();
    return `${phrase} francs CFA`;
  },

  /**
   * Échappe une valeur destinée à un argument JavaScript placé dans un attribut HTML
   * (ex. onclick="App.f(${Utils.jsArg(valeur)})"). JSON.stringify produit un littéral
   * de chaîne valide, puis l'échappement HTML protège l'attribut.
   */
  jsArg(value) {
    return this.escapeHtml(JSON.stringify(value === undefined || value === null ? '' : String(value)));
  },

  /**
   * Neutralise une valeur pour l'export CSV :
   * - double les guillemets
   * - empêche l'injection de formules Excel/LibreOffice (=, +, -, @, tabulation, retour chariot)
   */
  csvCell(value) {
    if (value === null || value === undefined) return '""';
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    let str = String(value);
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    return `"${str.replace(/"/g, '""')}"`;
  },

  /**
   * Construit une ligne CSV (séparateur point-virgule, lisible directement par Excel en français)
   */
  csvRow(values) {
    return values.map(v => this.csvCell(v)).join(';') + '\r\n';
  },

  /**
   * Déclenche le téléchargement d'un fichier CSV encodé en UTF-8 (avec BOM pour Excel)
   */
  downloadCSV(content, fileName) {
    const clean = String(content || '').replace(/^﻿/, '');
    const safeName = String(fileName || 'export.csv').replace(/[\\/:*?"<>|]+/g, '_');
    const blob = new Blob(['﻿' + clean], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 500);
  },

  /**
   * Analyse un texte CSV (séparateur « ; » ou « , » détecté automatiquement, champs entre guillemets)
   * Retourne un tableau de lignes, chaque ligne étant un tableau de cellules.
   */
  parseCSV(text) {
    const src = String(text || '').replace(/^﻿/, '');
    const firstLine = src.split(/\r?\n/, 1)[0] || '';
    const delimiter = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (inQuotes) {
        if (ch === '"') {
          if (src[i + 1] === '"') { cell += '"'; i++; } else { inQuotes = false; }
        } else {
          cell += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(cell.trim());
        cell = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && src[i + 1] === '\n') i++;
        row.push(cell.trim());
        if (row.some(c => c !== '')) rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += ch;
      }
    }
    row.push(cell.trim());
    if (row.some(c => c !== '')) rows.push(row);
    return rows;
  },

  /**
   * Génère une chaîne hexadécimale aléatoire cryptographiquement sûre
   */
  randomHex(bytes = 16) {
    const arr = new Uint8Array(bytes);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(arr);
    } else {
      for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Identifiant unique non devinable (préfixe lisible + 96 bits aléatoires)
   */
  randomId(prefix = 'id') {
    return `${prefix}_${this.randomHex(12)}`;
  },

  /**
   * Retourne le libellé lisible d'un mode de paiement (cash -> Espèces)
   */
  paymentMethodLabel(methodId) {
    const list = (window.CONFIG && Array.isArray(CONFIG.PAYMENT_METHODS)) ? CONFIG.PAYMENT_METHODS : [];
    const found = list.find(m => m.id === methodId);
    return found ? found.label : (methodId ? String(methodId) : 'Espèces');
  },

  /**
   * Générateur autonome de QR Code vectoriel SVG conforme à la norme ISO/IEC 18004
   * (mode octet, correction d'erreur niveau M, versions 1 à 40 choisies automatiquement).
   * Le QR code produit est réellement lisible par tous les scanners (appareil photo, WhatsApp, etc.).
   */
  generateQRCodeSVG(text, size = 120) {
    const modules = QRCodeEncoder.encode(String(text || ''));
    const quiet = 2; // Marge blanche (le reçu fournit déjà un fond blanc autour)
    const count = modules.length + quiet * 2;

    let pathData = '';
    for (let y = 0; y < modules.length; y++) {
      for (let x = 0; x < modules.length; x++) {
        if (modules[y][x]) {
          pathData += `M${x + quiet},${y + quiet}h1v1h-1z`;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${count} ${count}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="QR Code de vérification">
      <rect width="${count}" height="${count}" fill="#FFFFFF" />
      <path d="${pathData}" fill="#000000" />
    </svg>`;
  }
};

/**
 * ENCODEUR QR CODE (ISO/IEC 18004) — implémentation compacte sans dépendance.
 * Algorithme inspiré du générateur de référence de Project Nayuki (licence MIT).
 */
const QRCodeEncoder = (() => {
  // Niveau de correction M (index 1 dans les tables)
  const ECL_INDEX = 1;
  const ECL_FORMAT_BITS = 0; // M = 00

  const ECC_CODEWORDS_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  ];

  const NUM_ERROR_CORRECTION_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  ];

  const getBit = (x, i) => ((x >>> i) & 1) !== 0;

  function numRawDataModules(ver) {
    let result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }

  function numDataCodewords(ver) {
    return Math.floor(numRawDataModules(ver) / 8)
      - ECC_CODEWORDS_PER_BLOCK[ECL_INDEX][ver] * NUM_ERROR_CORRECTION_BLOCKS[ECL_INDEX][ver];
  }

  function gfMultiply(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  function rsDivisor(degree) {
    const result = new Array(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < result.length; j++) {
        result[j] = gfMultiply(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = gfMultiply(root, 0x02);
    }
    return result;
  }

  function rsRemainder(data, divisor) {
    const result = divisor.map(() => 0);
    for (const b of data) {
      const factor = b ^ result.shift();
      result.push(0);
      divisor.forEach((coef, i) => { result[i] ^= gfMultiply(coef, factor); });
    }
    return result;
  }

  function alignmentPositions(ver, size) {
    if (ver === 1) return [];
    const numAlign = Math.floor(ver / 7) + 2;
    const step = Math.floor((ver * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
    const result = [6];
    for (let pos = size - 7; result.length < numAlign; pos -= step) {
      result.splice(1, 0, pos);
    }
    return result;
  }

  function encode(text) {
    const bytes = Array.from(new TextEncoder().encode(text));

    // 1. Choix de la plus petite version capable de contenir les données
    let ver = 1;
    let ccBits = 8;
    for (; ver <= 40; ver++) {
      ccBits = ver <= 9 ? 8 : 16;
      const used = 4 + ccBits + bytes.length * 8;
      if (used <= numDataCodewords(ver) * 8) break;
    }
    if (ver > 40) throw new Error('Texte trop long pour un QR code');

    // 2. Flux de bits : mode octet + longueur + données + terminateur + bourrage
    const bits = [];
    const appendBits = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    appendBits(0x4, 4);
    appendBits(bytes.length, ccBits);
    bytes.forEach(b => appendBits(b, 8));
    const capacity = numDataCodewords(ver) * 8;
    appendBits(0, Math.min(4, capacity - bits.length));
    appendBits(0, (8 - bits.length % 8) % 8);
    for (let pad = 0xEC; bits.length < capacity; pad ^= 0xEC ^ 0x11) appendBits(pad, 8);

    const dataCodewords = new Array(bits.length / 8).fill(0);
    bits.forEach((bit, i) => { dataCodewords[i >>> 3] |= bit << (7 - (i & 7)); });

    // 3. Blocs Reed-Solomon et entrelacement
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ECL_INDEX][ver];
    const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ECL_INDEX][ver];
    const rawCodewords = Math.floor(numRawDataModules(ver) / 8);
    const numShortBlocks = numBlocks - rawCodewords % numBlocks;
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);
    const divisor = rsDivisor(blockEccLen);
    const blocks = [];
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const dat = dataCodewords.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
      k += dat.length;
      const ecc = rsRemainder(dat, divisor);
      if (i < numShortBlocks) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const allCodewords = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((block, j) => {
        if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) allCodewords.push(block[i]);
      });
    }

    // 4. Matrice et motifs fonctionnels
    const size = ver * 4 + 17;
    const modules = Array.from({ length: size }, () => new Array(size).fill(false));
    const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));
    const setFn = (x, y, dark) => { modules[y][x] = dark; isFunction[y][x] = true; };

    for (let i = 0; i < size; i++) {
      setFn(6, i, i % 2 === 0);
      setFn(i, 6, i % 2 === 0);
    }
    const drawFinder = (x, y) => {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFn(xx, yy, dist !== 2 && dist !== 4);
        }
      }
    };
    drawFinder(3, 3);
    drawFinder(size - 4, 3);
    drawFinder(3, size - 4);

    const alignPos = alignmentPositions(ver, size);
    const numAlign = alignPos.length;
    for (let i = 0; i < numAlign; i++) {
      for (let j = 0; j < numAlign; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === numAlign - 1) || (i === numAlign - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            setFn(alignPos[i] + dx, alignPos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
          }
        }
      }
    }

    const drawFormatBits = (mask) => {
      const data = (ECL_FORMAT_BITS << 3) | mask;
      let rem = data;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const fbits = ((data << 10) | rem) ^ 0x5412;
      for (let i = 0; i <= 5; i++) setFn(8, i, getBit(fbits, i));
      setFn(8, 7, getBit(fbits, 6));
      setFn(8, 8, getBit(fbits, 7));
      setFn(7, 8, getBit(fbits, 8));
      for (let i = 9; i < 15; i++) setFn(14 - i, 8, getBit(fbits, i));
      for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, getBit(fbits, i));
      for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, getBit(fbits, i));
      setFn(8, size - 8, true);
    };
    drawFormatBits(0);

    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      const vbits = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const color = getBit(vbits, i);
        const a = size - 11 + i % 3;
        const b = Math.floor(i / 3);
        setFn(a, b, color);
        setFn(b, a, color);
      }
    }

    // 5. Placement des données en zigzag
    let bitIndex = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!isFunction[y][x] && bitIndex < allCodewords.length * 8) {
            modules[y][x] = getBit(allCodewords[bitIndex >>> 3], 7 - (bitIndex & 7));
            bitIndex++;
          }
        }
      }
    }

    // 6. Masquage : choix du masque à pénalité minimale
    const applyMask = (mask) => {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          let invert;
          switch (mask) {
            case 0: invert = (x + y) % 2 === 0; break;
            case 1: invert = y % 2 === 0; break;
            case 2: invert = x % 3 === 0; break;
            case 3: invert = (x + y) % 3 === 0; break;
            case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
            case 5: invert = (x * y) % 2 + (x * y) % 3 === 0; break;
            case 6: invert = ((x * y) % 2 + (x * y) % 3) % 2 === 0; break;
            default: invert = ((x + y) % 2 + (x * y) % 3) % 2 === 0; break;
          }
          if (!isFunction[y][x] && invert) modules[y][x] = !modules[y][x];
        }
      }
    };

    const penalty = () => {
      let result = 0;
      const addHistory = (run, history) => {
        if (history[0] === 0) run += size;
        history.pop();
        history.unshift(run);
      };
      const countPatterns = (h) => {
        const n = h[1];
        const core = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n;
        return (core && h[0] >= n * 4 && h[6] >= n ? 1 : 0) + (core && h[6] >= n * 4 && h[0] >= n ? 1 : 0);
      };
      const terminate = (color, run, history) => {
        if (color) { addHistory(run, history); run = 0; }
        run += size;
        addHistory(run, history);
        return countPatterns(history);
      };
      const scanLine = (get) => {
        let runColor = false;
        let run = 0;
        const history = [0, 0, 0, 0, 0, 0, 0];
        for (let i = 0; i < size; i++) {
          if (get(i) === runColor) {
            run++;
            if (run === 5) result += 3;
            else if (run > 5) result++;
          } else {
            addHistory(run, history);
            if (!runColor) result += countPatterns(history) * 40;
            runColor = get(i);
            run = 1;
          }
        }
        result += terminate(runColor, run, history) * 40;
      };
      for (let y = 0; y < size; y++) scanLine(x => modules[y][x]);
      for (let x = 0; x < size; x++) scanLine(y => modules[y][x]);
      for (let y = 0; y < size - 1; y++) {
        for (let x = 0; x < size - 1; x++) {
          const c = modules[y][x];
          if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) result += 3;
        }
      }
      let dark = 0;
      modules.forEach(row => row.forEach(m => { if (m) dark++; }));
      const total = size * size;
      const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
      result += k * 10;
      return result;
    };

    let bestMask = 0;
    let minPenalty = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      applyMask(mask);
      drawFormatBits(mask);
      const p = penalty();
      if (p < minPenalty) { minPenalty = p; bestMask = mask; }
      applyMask(mask); // annule le masque (XOR)
    }
    applyMask(bestMask);
    drawFormatBits(bestMask);

    return modules;
  }

  return { encode };
})();

window.QRCodeEncoder = QRCodeEncoder;

window.Utils = Utils;
