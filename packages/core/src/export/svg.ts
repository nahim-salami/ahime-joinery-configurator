/**
 * Pourquoi ce fichier existe : rendre l'élévation calculée en SVG — le
 * viewport du widget, la vignette du panier et le schéma du devis PDF
 * sortent tous d'ici, donc du même `computeElevation()` (docs/08, règle 7).
 * Le DXF de la phase 4 lira la même élévation, avec son propre écrivain.
 *
 * Solution écartée : peindre les couleurs dans les attributs SVG. Un pack de
 * thème doit pouvoir rehabiller le dessin sans le regénérer — chaque forme
 * porte donc une CLASSE (`ahjc-dormant`, `ahjc-clair`, `ahjc-symbole`…) et les
 * teintes passent par des variables CSS avec repli sur la couleur calculée.
 * C'est la discipline « aucune couleur en dur » des thèmes (docs/03 §8),
 * appliquée dès le premier dessin plutôt qu'extraite après coup — chez les
 * néons, 96 couleurs en dur ont dû être retirées a posteriori.
 *
 * Incident fondateur : pas d'horloge, pas de DOM, pas d'aléa — la chaîne
 * rendue est reproductible au caractère près, donc comparable en test
 * (golden files) et identique dans Node, le navigateur et le worker.
 */

import type { Elevation } from '../drawing.ts';
import { formaterCote, type Unite } from '../unites.ts';
import { encreLisibleSur } from '../teintes.ts';

export interface SvgOptions {
  /** Attribut `width` du SVG ; à défaut, le SVG est fluide (100 %). */
  widthPx?: number;
  /** Injecte la feuille de style par défaut — false quand le pack habille. */
  styles?: boolean;
  /** Trace les cotes et leurs libellés (faux pour une vignette de panier). */
  cotes?: boolean;
  /** Texte alternatif — l'accessibilité n'est pas une option (docs/08 §5). */
  titre?: string;
  /**
   * L'unité des COTES. Le dessin, lui, reste tracé en millimètres : le
   * `viewBox` et chaque coordonnée sont des millimètres, quoi qu'il arrive.
   * Seul le texte porté par les lignes de cote change de langue — c'est la
   * frontière de docs/11 §0.1, et elle passe ici. Absent = millimètres, et
   * la chaîne rendue est alors identique au caractère près à celle d'avant
   * cette option : `prototypes.test.ts` en est le témoin.
   */
  unite?: Unite;
}

/** Deux décimales au plus, sans zéro inutile — un SVG stable et lisible. */
function n(valeur: number): string {
  const arrondi = Math.round(valeur * 100) / 100;
  return Object.is(arrondi, -0) ? '0' : String(arrondi);
}

function echapper(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Aucun commentaire dans cette feuille : elle est INLINÉE dans chaque SVG
// que le widget affiche, que le devis sérialise et que la vignette du
// panier capture. Une phrase d'explication y voyagerait des milliers de
// fois — et le parcours qui vérifie que l'incrustation sur photo ne porte
// aucune cote l'a attrapée au mot « comme », qui contient « mm ».
//
// `.ahjc-recouvrement` : l'aile d'un dormant de rénovation n'est pas le
// produit, elle dit ce que le neuf vient coiffer — d'où le trait
// interrompu, comme une ligne cachée au plan.
/** L'ordre de pose des rectangles, du fond vers la surface. Voir son usage. */
const ORDRE_DE_POSE =
  'toiture maconnerie doublage existant recouvrement virole dormant coffre coulisse ouvrant ' +
  'tablier lame-finale poteau module-pv toile lambrequin barre panneau moulure insert ' +
  'trou-d-homme clair';

const FEUILLE_DE_STYLE = `
.ahjc-dormant, .ahjc-ouvrant, .ahjc-coffre, .ahjc-coulisse, .ahjc-tablier, .ahjc-lambrequin { fill: var(--ahjc-cadre); stroke: var(--ahjc-trait); stroke-width: 6; }
.ahjc-ouvrant--fixe { fill: color-mix(in srgb, var(--ahjc-cadre) 92%, #000); }
.ahjc-recouvrement { fill: color-mix(in srgb, var(--ahjc-cadre) 80%, #000); stroke: var(--ahjc-trait); stroke-width: 4; stroke-dasharray: 22 14; }
.ahjc-panneau { fill: color-mix(in srgb, var(--ahjc-cadre) 94%, #000); stroke: var(--ahjc-trait); stroke-width: 4; }
.ahjc-moulure { fill: none; stroke: var(--ahjc-trait); stroke-width: 3; opacity: .7; }
.ahjc-insert { fill: var(--ahjc-couleur-inox, #b9bec2); stroke: var(--ahjc-trait); stroke-width: 2; }
.ahjc-rainure { stroke: var(--ahjc-trait); stroke-width: 5; opacity: .55; }
.ahjc-judas { fill: var(--ahjc-couleur-inox, #b9bec2); stroke: var(--ahjc-trait); stroke-width: 3; }
.ahjc-heurtoir { fill: none; stroke: var(--ahjc-trait); stroke-width: 12; opacity: .8; }
.ahjc-clair { fill: var(--ahjc-vitre); stroke: var(--ahjc-trait); stroke-width: 4; }
.ahjc-toile { fill: var(--ahjc-couleur-toile, #c9d3c4); stroke: var(--ahjc-trait); stroke-width: 5; }
.ahjc-symbole { stroke: var(--ahjc-trait); stroke-width: 5; stroke-dasharray: 34 22; fill: none; opacity: .75; }
.ahjc-petit-bois { stroke: var(--ahjc-cadre); stroke-width: 22; }
.ahjc-lame { stroke: var(--ahjc-trait); stroke-width: 3; opacity: .45; }
.ahjc-store-integre { stroke: var(--ahjc-trait); stroke-width: 8; opacity: .28; }
.ahjc-barre { fill: color-mix(in srgb, var(--ahjc-cadre) 88%, #000); stroke: var(--ahjc-trait); stroke-width: 4; }
.ahjc-lame-finale { fill: color-mix(in srgb, var(--ahjc-cadre) 82%, #000); stroke: var(--ahjc-trait); stroke-width: 5; }
.ahjc-echarpe { stroke: var(--ahjc-trait); stroke-width: 26; stroke-linecap: butt; opacity: .55; }
.ahjc-espagnolette { stroke: var(--ahjc-couleur-inox, #b9bec2); stroke-width: 14; stroke-linecap: round; }
.ahjc-poteau { fill: var(--ahjc-trait); stroke: none; }
.ahjc-virole { fill: var(--ahjc-couleur-inox, #b9bec2); stroke: var(--ahjc-trait); stroke-width: 6; }
.ahjc-trou-d-homme { fill: none; stroke: var(--ahjc-trait); stroke-width: 5; rx: 40; }
.ahjc-profil { stroke: var(--ahjc-trait); stroke-width: 6; fill: none; stroke-linecap: round; }
.ahjc-maconnerie { fill: var(--ahjc-couleur-maconnerie, #d8d2c8); stroke: var(--ahjc-trait); stroke-width: 4; }
.ahjc-toiture { fill: var(--ahjc-couleur-toiture, #9c8a7d); stroke: var(--ahjc-trait); stroke-width: 4; }
.ahjc-module-pv { fill: var(--ahjc-couleur-module-pv, #1c2a3a); stroke: var(--ahjc-trait); stroke-width: 4; }
.ahjc-doublage { fill: var(--ahjc-couleur-doublage, #f0e9dc); stroke: var(--ahjc-trait); stroke-width: 3; opacity: .9; }
.ahjc-existant { fill: none; stroke: var(--ahjc-trait); stroke-width: 5; stroke-dasharray: 26 18; opacity: .8; }
.ahjc-troncon { stroke: var(--ahjc-cadre); stroke-width: 60; stroke-linecap: round; }
.ahjc-terrain { stroke: var(--ahjc-trait); stroke-width: 14; stroke-linecap: square; }
.ahjc-ligne-de-coupe { stroke: var(--ahjc-trait); stroke-width: 6; stroke-dasharray: 60 16 10 16; opacity: .7; }
.ahjc-barreau { stroke: var(--ahjc-couleur-barreau, var(--ahjc-trait)); stroke-width: 16; stroke-linecap: square; }
.ahjc-poignee { fill: var(--ahjc-trait); }
.ahjc-cote { stroke: var(--ahjc-couleur-cote, #7a8083); stroke-width: 4; }
.ahjc-cote-fond { fill: var(--ahjc-couleur-fond, #fff); }
.ahjc-cote-texte { fill: var(--ahjc-couleur-cote, #7a8083); font: 500 68px system-ui, sans-serif; text-anchor: middle; dominant-baseline: middle; }
`.trim();

/**
 * L'élévation en SVG autonome. Aucune dépendance, aucun script : la même
 * chaîne s'affiche dans le widget, se sérialise dans un PDF et se capture
 * en vignette.
 */
export function elevationToSvg(elevation: Elevation, options: SvgOptions = {}): string {
  const { viewBox } = elevation;
  const avecCotes = options.cotes ?? true;
  const morceaux: string[] = [];

  const attributsTaille = options.widthPx
    ? ` width="${n(options.widthPx)}"`
    : ' width="100%" height="100%"';
  // Le titre est lu par les lecteurs d'écran : il cote dans la même unité
  // que le dessin, sans quoi un client aveugle entendrait des millimètres
  // pendant qu'un client voyant lit des pouces (docs/08 §5).
  //
  // La forme française est réécrite MOT POUR MOT plutôt que déléguée à
  // `formaterCote()` : celui-ci suffixe chaque nombre, et « Élévation
  // 1230 mm × 1350 mm » n'est pas « Élévation 1230 × 1350 mm ». Le test
  // « la vignette sans cotes ne porte aucun texte de cote » a attrapé la
  // différence au premier essai — tout ajout est additif, jusqu'au libellé.
  const titre =
    options.titre ??
    (options.unite && options.unite !== 'mm'
      ? `Élévation ${formaterCote(elevation.widthMm, options.unite)} × ${formaterCote(elevation.heightMm, options.unite)}`
      : `Élévation ${elevation.widthMm} × ${elevation.heightMm} mm`);

  // Les teintes calculées se posent EN LIGNE sur la racine, jamais dans la
  // feuille de style : deux dessins d'une même page (le panier, la planche,
  // une liste de chantier) partagent le document, donc le sélecteur — le
  // dernier <style> gagnerait pour tous, et toutes les menuiseries
  // prendraient la couleur de la dernière. Incident vu à la première
  // planche de contrôle. Le pack garde la main : chaque variable passe par
  // `--ahjc-couleur-*`, qu'un thème peut définir plus haut dans le document.
  //
  // LA FACE MONTRÉE EST L'EXTÉRIEURE, et c'est une décision qu'il faut
  // dire, parce qu'elle a l'air de contredire la convention de dessin.
  //
  // L'élévation garde ses SYMBOLES en vue intérieure — le V pointe vers les
  // paumelles, comme sur tout plan de menuiserie —, mais elle porte la
  // TEINTE EXTÉRIEURE. Les deux conventions ne parlent pas de la même
  // chose : la première dit de quel côté ça s'ouvre, la seconde dit à quoi
  // ça ressemble.
  //
  // Ce qui a tranché : un client qui vient de choisir un plaxé chêne doré
  // regarde le dessin pour voir son chêne. Le lui montrer blanc — ce qu'est
  // physiquement la face intérieure d'un plaxé — serait exact et
  // inutilisable. C'est la face rue qu'on achète, et c'est celle que la
  // tuile promettait.
  //
  // La face intérieure voyage quand même, dans sa propre variable : une
  // bicoloration a deux teintes, et un thème ou une légende doit pouvoir
  // montrer la seconde sans recalculer le dessin.
  // L'ENCRE SUIT LE CADRE, elle n'est plus une constante.
  //
  // #383E42) son contraste tombait à 1,2:1 : les BARREAUX d'un remplissage
  // ajouré devenaient invisibles, et « barreaudé », « ajouré », « mi-plein »
  // et « plein » donnaient la même image. Un client validait donc une
  // RESSEMBLANCE. Voir `encreLisibleSur`.
  //
  // LE THÈME GARDE LA MAIN : `--ahjc-couleur-trait` reste la valeur de tête,
  // et ce calcul n'est que le repli. Un marchand qui impose son encre
  // continue de l'imposer.
  const encre = encreLisibleSur(elevation.couleurs.cadreExterieur);
  const teintes =
    `--ahjc-cadre: var(--ahjc-couleur-cadre, ${elevation.couleurs.cadreExterieur});` +
    `--ahjc-cadre-interieur: var(--ahjc-couleur-cadre-interieur, ${elevation.couleurs.cadreInterieur});` +
    `--ahjc-vitre: var(--ahjc-couleur-vitrage, ${elevation.couleurs.vitrage});` +
    `--ahjc-trait: var(--ahjc-couleur-trait, ${encre})`;

  morceaux.push(
    `<svg xmlns="http://www.w3.org/2000/svg" class="ahjc-dessin" role="img" aria-label="${echapper(titre)}"` +
      ` style="${teintes}"` +
      `${attributsTaille} viewBox="${n(viewBox.xMm)} ${n(viewBox.yMm)} ${n(viewBox.widthMm)} ${n(viewBox.heightMm)}" preserveAspectRatio="xMidYMid meet">`,
  );
  morceaux.push(`<title>${echapper(titre)}</title>`);

  if (options.styles ?? true) {
    morceaux.push(`<style>${FEUILLE_DE_STYLE}</style>`);
  }

  // L'ordre de pose fait la lecture : dormant, puis ouvrants, puis clairs.
  // LA VIROLE EST POSÉE TÔT ET LA PORTE D'HOMME TARD : la seconde se dessine
  // EN CREUX sur la première, et l'ordre inverse l'aurait effacée.
  //
  // L'ORDRE EST UNE CHAÎNE, pas un tableau de littéraux — c'est la coupe du lot
  // D0 sur le manifeste, appliquée ici parce que cette table se paie PAR RÔLE
  // dans le chargement initial et qu'elle grandit à chaque famille d'un métier
  // nouveau. Ce qui disparaît n'est pas la répétition des mots, que gzip mange
  // déjà, mais les guillemets et les virgules, que le minifieur garde.
  const ordre = ORDRE_DE_POSE.split(' ');
  const rects = [...elevation.rects].sort(
    (a, b) => ordre.indexOf(a.role) - ordre.indexOf(b.role),
  );
  for (const rect of rects) {
    const classes = `ahjc-${rect.role}${rect.fixe ? ` ahjc-${rect.role}--fixe` : ''}`;
    // LA TEINTE D'UNE SURFACE PRIME SUR SA CLASSE — lot O9b, et c'est le seul
    // cas où ce dessin peint en ligne : la toile d'un store est un choix du
    // client, et la feuille de style ne peut pas le connaître. La table des
    // teintes vit dans le morceau paresseux de la famille ; ici il n'y a que
    // l'aiguillage.
    const peinture = rect.teinte ? ` style="fill:${rect.teinte}"` : '';
    morceaux.push(
      `<rect class="${classes}"${peinture} x="${n(rect.xMm)}" y="${n(rect.yMm)}" width="${n(rect.widthMm)}" height="${n(rect.heightMm)}"/>`,
    );
  }

  // Les pièces de FORME. Elles portent les mêmes classes que leurs
  // équivalents rectangulaires : un pack de thème qui a redessiné
  // `.ahjc-dormant` redessine du même coup le dormant d'un plein cintre.
  const ordreContours = ['toiture', 'dormant', 'ouvrant', 'clair'];
  for (const contour of [...elevation.contours].sort(
    (a, b) => ordreContours.indexOf(a.role) - ordreContours.indexOf(b.role),
  )) {
    const classes = `ahjc-${contour.role}${contour.fixe ? ` ahjc-${contour.role}--fixe` : ''}`;
    const points = contour.points.map(([x, y]) => `${n(x)},${n(y)}`).join(' ');
    morceaux.push(`<polygon class="${classes}" points="${points}"/>`);
  }

  for (const ligne of elevation.lines) {
    morceaux.push(
      `<line class="ahjc-${ligne.role}" x1="${n(ligne.x1Mm)}" y1="${n(ligne.y1Mm)}" x2="${n(ligne.x2Mm)}" y2="${n(ligne.y2Mm)}"/>`,
    );
  }

  // Judas et heurtoir : ronds, parce qu'ils le sont. Un judas carré
  // n'existe pas, et le dessiner ainsi ferait douter de tout le plan.
  for (const disque of elevation.disques) {
    morceaux.push(
      `<circle class="ahjc-${disque.role}" cx="${n(disque.xMm)}" cy="${n(disque.yMm)}" r="${n(disque.rayonMm)}"/>`,
    );
  }

  for (const poignee of elevation.poignees) {
    morceaux.push(
      `<circle class="ahjc-poignee" cx="${n(poignee.xMm)}" cy="${n(poignee.yMm)}" r="34"/>`,
      `<rect class="ahjc-poignee" x="${n(poignee.xMm - 16)}" y="${n(poignee.yMm)}" width="32" height="150" rx="16"/>`,
    );
  }

  if (avecCotes) {
    for (const cote of elevation.cotes) {
      // La cote se réécrit dans l'unité du client à partir de sa VALEUR,
      // jamais par découpe du libellé déjà formé — « coffre 230 mm » n'est
      // pas un nombre, et le jour où un préfixe contiendra un chiffre, une
      // expression régulière se tromperait en silence.
      const label =
        options.unite && options.unite !== 'mm'
          ? `${cote.prefixe ?? ''}${formaterCote(cote.valeurMm, options.unite)}`
          : cote.label;
      morceaux.push(
        `<line class="ahjc-cote" x1="${n(cote.x1Mm)}" y1="${n(cote.y1Mm)}" x2="${n(cote.x2Mm)}" y2="${n(cote.y2Mm)}"/>`,
      );
      const rotation =
        cote.orientation === 'verticale'
          ? ` transform="rotate(-90 ${n(cote.textXMm)} ${n(cote.textYMm)})"`
          : '';
      // Le libellé se pose sur la ligne : on la coupe par un fond ajouré.
      const largeurTexte = label.length * 38;
      morceaux.push(
        `<rect class="ahjc-cote-fond" x="${n(cote.textXMm - largeurTexte / 2)}" y="${n(cote.textYMm - 44)}" width="${n(largeurTexte)}" height="88"${rotation}/>`,
        `<text class="ahjc-cote-texte" x="${n(cote.textXMm)}" y="${n(cote.textYMm)}"${rotation}>${echapper(label)}</text>`,
      );
    }
  }

  morceaux.push('</svg>');
  return morceaux.join('');
}
