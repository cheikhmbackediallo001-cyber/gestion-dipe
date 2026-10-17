/**
 * GÉNÉRATEUR VECTORIEL DE CACHET OFFICIEL D'ÉCOLE (SVG)
 * Conforme à la spécification § 6 :
 * - Double contour circulaire ou ovale
 * - Bleu encre #1E3A8A
 * - Texte courbe : NOM DE L'ÉCOLE (en majuscules) sur l'arc supérieur
 * - Commune / Ville sur l'arc inférieur
 * - Centre : « DIRECTEUR / DIRECTRICE », Nom complet, Tél : [numéro]
 * - Rendu vectoriel ultra-net pour l'écran, le web et l'impression A5
 */

const SchoolStamp = {
  /**
   * Génère le SVG complet du cachet officiel
   * @param {Object} schoolData - Données de l'école (name, director_name, director_phone, commune, region)
   * @param {number} size - Diamètre en pixels (défaut 190)
   * @param {boolean} addTexture - Légère texture tampon réaliste
   */
  generateSVG(schoolData = {}, size = 190, addTexture = false) {
    const schoolName = (schoolData.name || "ÉCOLE MATERNELLE").toUpperCase().trim();
    const directorName = (schoolData.director_name || "LE DIRECTEUR").trim();
    const phone = schoolData.director_phone || "+221 7X XXX XX XX";
    const location = (schoolData.commune ? `${schoolData.commune} - ${schoolData.region || 'SÉNÉGAL'}` : "RÉPUBLIQUE DU SÉNÉGAL").toUpperCase().trim();

    const uniqueId = 'stamp_' + Math.random().toString(36).substring(2, 8);
    // Couleur rouge officielle vive et contrastée demandée par l'utilisateur
    const color = schoolData.stamp_color || '#DC2626';

    // Rayons des cercles concentriques (centrés à (100, 100))
    const cx = 100;
    const cy = 100;
    const rOuter = 95;
    const rInner = 88;
    const rTextArcTop = 75;
    const rTextArcBottom = 78;
    const rCenterBorder = 58;

    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" class="school-stamp-svg" aria-label="Cachet officiel de ${Utils.escapeHtml(schoolName)}">
      <defs>
        <!-- Arc supérieur pour le nom de l'école (sens horaire) -->
        <path id="${uniqueId}_topArc" d="M 25,100 A ${rTextArcTop},${rTextArcTop} 0 0,1 175,100" fill="none" />
        
        <!-- Arc inférieur pour la localisation (sens horaire pour que le texte soit à l'endroit) -->
        <path id="${uniqueId}_bottomArc" d="M 178,100 A ${rTextArcBottom},${rTextArcBottom} 0 0,1 22,100" fill="none" />

        ${addTexture ? `
        <filter id="${uniqueId}_grunge" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        ` : ''}
      </defs>

      <g ${addTexture ? `filter="url(#${uniqueId}_grunge)"` : ''} transform="rotate(-2.5, 100, 100)">
        <!-- 1. Cercle extérieur épais (haute visibilité rouge officiel) -->
        <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="none" stroke="${color}" stroke-width="3.6" stroke-dasharray="none" />
        
        <!-- 2. Cercle intérieur (double contour officiel) -->
        <circle cx="${cx}" cy="${cy}" r="${rInner}" fill="none" stroke="${color}" stroke-width="1.6" />

        <!-- 3. Cercle central délimitant le texte du directeur -->
        <circle cx="${cx}" cy="${cy}" r="${rCenterBorder}" fill="none" stroke="${color}" stroke-width="1.2" stroke-dasharray="4,2" opacity="0.9" />

        <!-- 4. Étoiles séparatrices gauche et droite -->
        <text x="18" y="104" font-size="12" font-weight="900" fill="${color}" text-anchor="middle" font-family="'Poppins', sans-serif">★</text>
        <text x="182" y="104" font-size="12" font-weight="900" fill="${color}" text-anchor="middle" font-family="'Poppins', sans-serif">★</text>

        <!-- 5. Texte courbe supérieur : Nom de l'école (Gras & Visible) -->
        <text fill="${color}" font-family="'Poppins', sans-serif" font-weight="800" font-size="${schoolName.length > 28 ? '10.5' : '12'}" letter-spacing="1.2">
          <textPath href="#${uniqueId}_topArc" startOffset="50%" text-anchor="middle">
            ${Utils.escapeHtml(schoolName)}
          </textPath>
        </text>

        <!-- 6. Texte courbe inférieur : Commune / Localisation -->
        <text fill="${color}" font-family="'Inter', sans-serif" font-weight="700" font-size="9.5" letter-spacing="0.8">
          <textPath href="#${uniqueId}_bottomArc" startOffset="50%" text-anchor="middle">
            ${Utils.escapeHtml(location)}
          </textPath>
        </text>

        <!-- 7. Zone centrale : Fonction, Nom du Directeur et Téléphone -->
        <g text-anchor="middle" font-family="'Inter', sans-serif" fill="${color}">
          <text x="${cx}" y="81" font-size="9" font-weight="800" letter-spacing="1">LE DIRECTEUR</text>
          <line x1="70" y1="86" x2="130" y2="86" stroke="${color}" stroke-width="1" />
          <text x="${cx}" y="103" font-size="${directorName.length > 20 ? '9' : '10.5'}" font-weight="800" font-family="'Poppins', sans-serif">
            ${Utils.escapeHtml(directorName)}
          </text>
          <text x="${cx}" y="119" font-size="8.5" font-weight="600">Tél : ${Utils.escapeHtml(phone)}</text>
          <text x="${cx}" y="133" font-size="7.5" font-weight="800" letter-spacing="0.6">VISA / SCEAU</text>
        </g>
      </g>
    </svg>
    `.trim();
  },

  /**
   * Retourne un Data URI SVG pour balise <img src="..."> ou export PDF
   */
  toDataUri(schoolData, size = 190) {
    const svg = this.generateSVG(schoolData, size, false);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
};

window.SchoolStamp = SchoolStamp;
