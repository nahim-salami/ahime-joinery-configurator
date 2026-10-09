/**
 * Pourquoi ce fichier existe : la coupe de profilé — « le dessin technique
 * qui vend la gamme » (docs/05, phase 3). Un client ne comprend pas
 * « 7 chambres, 82 mm » ; il comprend un dessin où il compte les chambres et
 * voit le vitrage pincé entre les joints. C'est l'argument rendu visible.
 *
 * Solution écartée : embarquer les coupes réelles des fournisseurs, en
 * images. Elles sont sous droits, elles vieillissent, elles pèsent, et un
 * marchand qui change de gamme se retrouve avec un dessin qui ment. Ici la
 * coupe est **schématique et calculée** depuis les données du catalogue
 * (épaisseur, chambres, rupture, épaisseur de vitrage) — elle change quand
 * la gamme change, et le dessin annonce lui-même qu'il est schématique.
 *
 * Incident fondateur : la discipline des couleurs. Comme l'élévation, la
 * coupe ne peint rien sur ses formes — tout passe par des classes et des
 * variables `--ahjc-*`, pour qu'un pack de thème l'habille (voir svg.ts).
 */

import type { Gamme, JoineryConfiguration, Materiau } from '../types.ts';
import {
  DEFAULT_CATALOG,
  posePourFamille,
  systemeDe,
  tapeeDe,
  type PricingCatalog,
} from '../catalog.ts';
import { effectiveVitrage, verreEpaisseurMm } from '../structural.ts';

export interface CoupeProfil {
  materiau: Materiau;
  gamme: Gamme;
  /** Le nom commercial de la gamme, quand le marchand en propose une. */
  nomSysteme?: string;
  /** Profondeur du dormant (mm) — la cote qui se lit sur le dessin. */
  epaisseurMm: number;
  /** Nombre de chambres ; 0 quand la notion n'a pas de sens (bois, mixte). */
  chambres: number;
  ruptureThermique: boolean;
  /** Épaisseur du vitrage effectif (mm) — 0 si la famille n'est pas vitrée. */
  vitrageMm: number;
  /**
   * L'intercalaire du vitrage — le profilé qui sépare les verres en rive.
   * `warm-edge` en polymère chargé, `aluminium` sinon. C'est le pont
   * thermique du vitrage, et la seule pièce d'une menuiserie qu'on améliore
   * sans toucher ni au verre ni au profilé.
   */
  intercalaire: 'aluminium' | 'warm-edge' | null;
  /** Vrai quand un store vénitien est monté entre les verres. */
  storeIntegre: boolean;
  /** Le coefficient de profilé, affiché à côté du dessin. */
  uf: number;
  /**
   * La tapée d'isolation, en profondeur (mm) — 0 s'il n'y en a pas. Elle
   * PROLONGE le dormant vers l'intérieur : c'est exactement l'axe que cette
   * coupe mesure, donc elle s'y dessine à l'échelle.
   */
  tapeeMm: number;
  /**
   * L'aile de recouvrement d'un dormant de rénovation (mm par côté). Elle
   * se développe dans l'autre direction — la largeur vue — et vaudrait à
   * elle seule le double de la hauteur du dessin : elle est DITE en
   * légende, pas dessinée. Une coupe illisible n'apprend rien.
   */
  recouvrementMm: number;
}

/** Ce que le catalogue dit du profilé choisi — sans dessiner encore. */
export function computeCoupe(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): CoupeProfil {
  const vitrage = effectiveVitrage(config, catalog);
  // Une gamme nommée porte SES cotes, tenues de son fournisseur ; elles
  // priment sur les tables par matériau × palier. La coupe dessinée change
  // donc avec la gamme, et non seulement avec le palier tarifaire.
  const systeme = systemeDe(catalog, config.systeme);
  const pose = posePourFamille(catalog, config.famille, config.pose);
  const tapee = pose.tapee ? tapeeDe(catalog, config.tapeeMm) : undefined;
  return {
    materiau: config.materiau,
    gamme: systeme?.gamme ?? config.gamme,
    nomSysteme: systeme?.nom,
    epaisseurMm: systeme?.epaisseurMm ?? catalog.profils.epaisseurMm[config.materiau][config.gamme],
    chambres: systeme?.chambres ?? catalog.profils.chambres[config.materiau][config.gamme],
    ruptureThermique: systeme?.ruptureThermique ?? catalog.profils.ruptureThermique[config.materiau],
    vitrageMm: vitrage ? verreEpaisseurMm(vitrage, catalog) : 0,
    intercalaire: vitrage ? (vitrage.warmEdge ? 'warm-edge' : 'aluminium') : null,
    storeIntegre: Boolean(vitrage?.storeIntegre),
    uf: systeme?.uf ?? catalog.thermique.ufParMateriau[config.materiau][config.gamme],
    tapeeMm: tapee?.epaisseurMm ?? 0,
    recouvrementMm: pose.recouvrementMm,
  };
}

function n(valeur: number): string {
  const arrondi = Math.round(valeur * 100) / 100;
  return Object.is(arrondi, -0) ? '0' : String(arrondi);
}

const STYLE_COUPE = `
.ahjc-coupe-masse { fill: var(--ahjc-cadre); stroke: var(--ahjc-trait); stroke-width: 1.6; }
.ahjc-coupe-chambre { fill: var(--ahjc-couleur-fond, #fff); stroke: var(--ahjc-trait); stroke-width: 1; }
.ahjc-coupe-rupture { fill: var(--ahjc-couleur-rupture, #6b7b83); stroke: none; }
.ahjc-coupe-verre { fill: var(--ahjc-vitre); stroke: var(--ahjc-trait); stroke-width: 1; }
.ahjc-coupe-joint { fill: var(--ahjc-couleur-joint, #3b4245); stroke: none; }
.ahjc-coupe-intercalaire { stroke: var(--ahjc-trait); stroke-width: .8; }
.ahjc-coupe-intercalaire--aluminium { fill: var(--ahjc-couleur-inox, #b9bec2); }
.ahjc-coupe-intercalaire--warm-edge { fill: var(--ahjc-couleur-rupture, #6b7b83); }
.ahjc-coupe-store { stroke: var(--ahjc-trait); stroke-width: .8; opacity: .5; }
.ahjc-coupe-cote { stroke: var(--ahjc-couleur-cote, #7a8083); stroke-width: 1; }
.ahjc-coupe-texte { fill: var(--ahjc-couleur-cote, #7a8083); font: 500 11px system-ui, sans-serif; text-anchor: middle; }
.ahjc-coupe-legende { fill: var(--ahjc-couleur-cote, #7a8083); font: 400 10px system-ui, sans-serif; }
`.trim();

/**
 * La coupe en SVG — dormant et ouvrant vus de dessus, vitrage pincé entre
 * les joints. Les proportions suivent l'épaisseur réelle du profilé : une
 * gamme performance se voit tout de suite plus épaisse qu'une standard.
 */
export function coupeToSvg(coupe: CoupeProfil, options: { largeurPx?: number } = {}): string {
  const echelle = 2.6; // mm → unités du dessin, pour une lecture confortable
  const profondeur = coupe.epaisseurMm * echelle;
  const hauteurDormant = 34;
  const hauteurOuvrant = 30;
  const marge = 26;
  const tapee = coupe.tapeeMm * echelle;
  const largeur = profondeur + tapee + marge * 2;

  // Les légendes se comptent AVANT de fixer la hauteur : posées à une
  // distance fixe du bas, la quatrième (celle qui n'apparaît qu'avec une
  // rupture de pont thermique) tombait hors du cadre — invisible en PVC,
  // donc invisible aux essais, et manquante sur toutes les coupes alu.
  const legendes = [
    coupe.chambres > 0 ? `${coupe.chambres} chambres` : 'profilé massif',
    coupe.ruptureThermique ? 'rupture de pont thermique' : null,
    coupe.vitrageMm > 0 ? `vitrage ${n(coupe.vitrageMm)} mm` : null,
    coupe.intercalaire === 'warm-edge' ? 'intercalaire à bord chaud' : null,
    coupe.storeIntegre ? 'store vénitien intégré' : null,
    coupe.tapeeMm > 0 ? `tapée d'isolation ${coupe.tapeeMm} mm` : null,
    coupe.recouvrementMm > 0
      ? `aile de recouvrement ${coupe.recouvrementMm} mm par côté`
      : null,
    `Uf ${n(coupe.uf)} W/m²·K`,
  ].filter(Boolean) as string[];

  const morceaux: string[] = [];
  const teintes =
    '--ahjc-cadre: var(--ahjc-couleur-cadre, #eceae6);' +
    '--ahjc-vitre: var(--ahjc-couleur-vitrage, #d9e8ec);' +
    '--ahjc-trait: var(--ahjc-couleur-trait, #2b2f31)';
  const titre = coupe.nomSysteme
    ? `Coupe schématique — ${coupe.nomSysteme}, ${coupe.epaisseurMm} mm`
    : `Coupe schématique — ${coupe.materiau} ${coupe.gamme}, ${coupe.epaisseurMm} mm`;

  // La mise en page se calcule d'abord : le cadre du dessin DÉCOULE de son
  // contenu, il ne le contraint pas.
  const x0 = marge;
  const yDormant = 36;
  const yOuvrant = yDormant + hauteurDormant + 6;
  const basDuVerre = yOuvrant + 4 + hauteurOuvrant + 26;
  const yPremiereLegende = basDuVerre + 16;
  const hauteur = yPremiereLegende + legendes.length * 12;

  morceaux.push(
    `<svg xmlns="http://www.w3.org/2000/svg" class="ahjc-coupe" role="img" aria-label="${titre}"` +
      ` style="${teintes}"${options.largeurPx ? ` width="${n(options.largeurPx)}"` : ' width="100%"'}` +
      ` viewBox="0 0 ${n(largeur)} ${n(hauteur)}" preserveAspectRatio="xMidYMid meet">`,
    `<title>${titre}</title>`,
    `<style>${STYLE_COUPE}</style>`,
  );

  // Le dormant, puis l'ouvrant : deux masses de la même profondeur.
  morceaux.push(
    `<rect class="ahjc-coupe-masse" x="${n(x0)}" y="${n(yDormant)}" width="${n(profondeur)}" height="${n(hauteurDormant)}" rx="2"/>`,
    `<rect class="ahjc-coupe-masse" x="${n(x0 + profondeur * 0.08)}" y="${n(yOuvrant)}" width="${n(profondeur * 0.84)}" height="${n(hauteurOuvrant)}" rx="2"/>`,
  );

  // La tapée prend le relais du dormant, exactement où il s'arrête. Sa
  // gorge à couvre-joint est ce qui la distingue d'une planche.
  if (tapee > 0) {
    const xTapee = x0 + profondeur;
    morceaux.push(
      `<rect class="ahjc-coupe-masse" x="${n(xTapee)}" y="${n(yDormant)}" width="${n(tapee)}" height="${n(hauteurDormant)}" rx="2"/>`,
      `<rect class="ahjc-coupe-chambre" x="${n(xTapee + tapee - 9)}" y="${n(yDormant + hauteurDormant * 0.28)}" width="6" height="${n(hauteurDormant * 0.44)}" rx="1"/>`,
      `<line class="ahjc-coupe-cote" x1="${n(xTapee)}" y1="${n(yDormant)}" x2="${n(xTapee)}" y2="${n(yDormant + hauteurDormant)}"/>`,
    );
  }

  // Les chambres : les alvéoles qui isolent — on les compte à l'œil.
  if (coupe.chambres > 0) {
    const largeurChambre = (profondeur * 0.82) / coupe.chambres;
    for (let index = 0; index < coupe.chambres; index++) {
      const x = x0 + profondeur * 0.09 + index * largeurChambre;
      morceaux.push(
        `<rect class="ahjc-coupe-chambre" x="${n(x + 1.5)}" y="${n(yDormant + 6)}" width="${n(largeurChambre - 3)}" height="${n(hauteurDormant - 12)}" rx="1"/>`,
      );
    }
  } else {
    // Bois ou mixte : pas de chambres, mais un fil du bois qui le dit.
    for (let index = 1; index < 5; index++) {
      const y = yDormant + (hauteurDormant * index) / 5;
      morceaux.push(
        `<line class="ahjc-coupe-cote" x1="${n(x0 + 3)}" y1="${n(y)}" x2="${n(x0 + profondeur - 3)}" y2="${n(y)}"/>`,
      );
    }
  }

  // La rupture de pont thermique : la barrette qui coupe le métal en deux.
  if (coupe.ruptureThermique) {
    morceaux.push(
      `<rect class="ahjc-coupe-rupture" x="${n(x0 + profondeur * 0.42)}" y="${n(yDormant + 4)}" width="${n(profondeur * 0.16)}" height="${n(hauteurDormant - 8)}" rx="1.5"/>`,
    );
  }

  // Le vitrage, pincé entre deux joints — à son épaisseur réelle.
  if (coupe.vitrageMm > 0) {
    const epaisseurVerre = coupe.vitrageMm * echelle;
    const xVerre = x0 + profondeur * 0.5 - epaisseurVerre / 2;
    const yVerre = yOuvrant + 4;
    const hauteurVerre = hauteurOuvrant + 26;
    morceaux.push(
      `<rect class="ahjc-coupe-verre" x="${n(xVerre)}" y="${n(yVerre)}" width="${n(epaisseurVerre)}" height="${n(hauteurVerre)}"/>`,
      `<rect class="ahjc-coupe-joint" x="${n(xVerre - 3)}" y="${n(yVerre + 2)}" width="3" height="10" rx="1.5"/>`,
      `<rect class="ahjc-coupe-joint" x="${n(xVerre + epaisseurVerre)}" y="${n(yVerre + 2)}" width="3" height="10" rx="1.5"/>`,
    );

    // L'INTERCALAIRE, en rive. C'est là qu'il se voit — une barre entre les
    // deux verres, brillante en aluminium, sombre en bord chaud. On le
    // dessine parce que c'est le seul endroit d'une menuiserie où l'on peut
    // MONTRER un pont thermique : le client voit la pièce qu'il paie.
    if (coupe.intercalaire) {
      const hauteurIntercalaire = 9;
      morceaux.push(
        `<rect class="ahjc-coupe-intercalaire ahjc-coupe-intercalaire--${coupe.intercalaire}"` +
          ` x="${n(xVerre + 1.2)}" y="${n(yVerre + hauteurVerre - hauteurIntercalaire - 1.2)}"` +
          ` width="${n(Math.max(0, epaisseurVerre - 2.4))}" height="${n(hauteurIntercalaire)}" rx="1"/>`,
      );
    }

    // Le STORE INTÉGRÉ : ses lames, vues de champ, dans la lame d'air. Elles
    // sont ce qui explique les douze millimètres de plus — un store vénitien
    // ne se glisse pas dans un 16 mm.
    if (coupe.storeIntegre) {
      const milieu = xVerre + epaisseurVerre / 2;
      for (let i = 1; i <= 6; i++) {
        const y = yVerre + 6 + (i * (hauteurVerre - 22)) / 7;
        morceaux.push(
          `<line class="ahjc-coupe-store" x1="${n(milieu - epaisseurVerre * 0.24)}" y1="${n(y)}"` +
            ` x2="${n(milieu + epaisseurVerre * 0.24)}" y2="${n(y - 2)}"/>`,
        );
      }
    }
  }

  // La cote d'épaisseur, en haut : la seule qui compte pour comparer.
  morceaux.push(
    `<line class="ahjc-coupe-cote" x1="${n(x0)}" y1="20" x2="${n(x0 + profondeur)}" y2="20"/>`,
    `<line class="ahjc-coupe-cote" x1="${n(x0)}" y1="14" x2="${n(x0)}" y2="26"/>`,
    `<line class="ahjc-coupe-cote" x1="${n(x0 + profondeur)}" y1="14" x2="${n(x0 + profondeur)}" y2="26"/>`,
    `<text class="ahjc-coupe-texte" x="${n(x0 + profondeur / 2)}" y="12">${coupe.epaisseurMm} mm</text>`,
  );
  if (tapee > 0) {
    morceaux.push(
      `<line class="ahjc-coupe-cote" x1="${n(x0 + profondeur)}" y1="20" x2="${n(x0 + profondeur + tapee)}" y2="20"/>`,
      `<line class="ahjc-coupe-cote" x1="${n(x0 + profondeur + tapee)}" y1="14" x2="${n(x0 + profondeur + tapee)}" y2="26"/>`,
      `<text class="ahjc-coupe-texte" x="${n(x0 + profondeur + tapee / 2)}" y="12">+ ${coupe.tapeeMm} mm</text>`,
    );
  }

  legendes.forEach((legende, index) => {
    morceaux.push(
      `<text class="ahjc-coupe-legende" x="4" y="${n(yPremiereLegende + index * 12)}">· ${legende}</text>`,
    );
  });

  morceaux.push('</svg>');
  return morceaux.join('');
}
