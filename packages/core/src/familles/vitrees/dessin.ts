/**
 * Pourquoi ce fichier existe : le TRAIT des menuiseries vitrées — dormant,
 * ouvrants, clairs, petits-bois, symboles d'ouverture, décors et accessoires
 * de porte, grilles de défense. Il vient VERBATIM de `drawing.ts` : déplacé,
 * jamais réécrit, et `prototypes.test.ts` le prouve — le dessin d'une
 * fenêtre est identique au caractère près à celui d'avant la couture.
 *
 * Solution écartée : laisser ce trait dans `drawing.ts` et n'y rendre
 * paresseuse que la DONNÉE (les matrices). La donnée d'une famille pèse un
 * quart de ce que pèse son dessin : une couture qui ne déplace que les
 * matrices laisse dans l'entrée le décor de porte d'entrée d'un visiteur
 * venu pour un volet. Le module de famille porte son dessin, ou il ne sert
 * à rien (docs/11 §0.2).
 *
 * Incident fondateur : les rainures d'un panneau de porte sont CREUSÉES,
 * jamais posées en applique — une rainure en relief est une baguette.
 */

import type { JoineryConfiguration } from '../../types.ts';
import {
  familleCatalog,
  modelePorteDe,
  posePourFamille,
  type DecorPorte,
  type PricingCatalog,
} from '../../catalog.ts';
import { ouvertureNativeEquivalente } from '../../ouverture-declaree.ts';
import { computeMeasureReport, effectiveVitrage } from '../../structural.ts';
import type {
  ElevationDisque,
  ElevationLine,
  ElevationPoignee,
  ElevationRect,
} from '../../drawing.ts';
import { dormantMm, sensDesVantaux, type SensVantail } from '../../drawing.ts';
import { hauteurCoffreMm } from '../../geometrie/profils.ts';

/**
 * Découpe une droite d'équation `x − y = c` (ou `x + y = c`) par le
 * rectangle du clair, et rend le segment intérieur — ou rien s'il ne
 * traverse pas. Sans ce rognage, un losange déborderait du vitrage et se
 * dessinerait par-dessus les profilés.
 */
function segmentDiagonal(
  clair: ElevationRect,
  constante: number,
  montante: boolean,
): [number, number, number, number] | null {
  const x0 = clair.xMm;
  const x1 = clair.xMm + clair.widthMm;
  const y0 = clair.yMm;
  const y1 = clair.yMm + clair.heightMm;
  // y = x − c (montante) ou y = c − x (descendante).
  const yDe = (x: number) => (montante ? x - constante : constante - x);
  const xDe = (y: number) => (montante ? y + constante : constante - y);

  const points: Array<[number, number]> = [];
  for (const x of [x0, x1]) {
    const y = yDe(x);
    if (y >= y0 - 1e-6 && y <= y1 + 1e-6) points.push([x, y]);
  }
  for (const y of [y0, y1]) {
    const x = xDe(y);
    if (x > x0 + 1e-6 && x < x1 - 1e-6) points.push([x, y]);
  }
  if (points.length < 2) return null;
  const [a, b] = points;
  if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 40) return null;
  return [a[0], a[1], b[0], b[1]];
}

/** Les quatre modèles de grille du catalogue, du plus simple au plus ouvré. */
const MODELES_GRILLE = [
  'grille-defense',
  'grille-horizontale',
  'grille-croisillons',
  'grille-ouvragee',
] as const;

/** Une volute : le cintre du ferronnier, approché par une polyligne. */
function pousserVolute(
  lines: ElevationLine[],
  cxMm: number,
  cyMm: number,
  rayonMm: number,
  angleDebut: number,
  angleFin: number,
  segments = 7,
): void {
  let precedentX = cxMm + rayonMm * Math.cos(angleDebut);
  let precedentY = cyMm + rayonMm * Math.sin(angleDebut);
  for (let index = 1; index <= segments; index++) {
    const angle = angleDebut + ((angleFin - angleDebut) * index) / segments;
    const x = cxMm + rayonMm * Math.cos(angle);
    const y = cyMm + rayonMm * Math.sin(angle);
    lines.push({ role: 'barreau', x1Mm: precedentX, y1Mm: precedentY, x2Mm: x, y2Mm: y });
    precedentX = x;
    precedentY = y;
  }
}

/**
 * La grille de défense, selon le modèle commandé. Quatre dessins :
 * barreaux droits, barreaudage horizontal, croisillons soudés, barreaux
 * ouvragés à volutes. Le cadre scellé dans le tableau est commun aux
 * quatre — c'est lui qui tient, les barreaux ne font que garnir.
 *
 * Le nombre de barreaux se déduit de la BAIE, jamais d'un compte fixe : une
 * baie de 2,40 m sans barreau de plus qu'un châssis de 60 cm laisserait un
 * passage d'homme entre deux fers.
 */
export function pousserGrilleDefense(
  lines: ElevationLine[],
  config: JoineryConfiguration,
  baie: { xMm: number; yMm: number; widthMm: number; heightMm: number },
): void {
  const ids = (config.options ?? []).map((option) => option.id);
  const modele = MODELES_GRILLE.find((candidat) => ids.includes(candidat));
  if (!modele || baie.widthMm <= 0 || baie.heightMm <= 0) return;

  const gauche = baie.xMm;
  const droite = baie.xMm + baie.widthMm;
  const haut = baie.yMm;
  const bas = baie.yMm + baie.heightMm;
  const trait = (x1Mm: number, y1Mm: number, x2Mm: number, y2Mm: number) =>
    lines.push({ role: 'barreau', x1Mm, y1Mm, x2Mm, y2Mm });

  // Le cadre, toujours.
  trait(gauche, haut, droite, haut);
  trait(gauche, bas, droite, bas);
  trait(gauche, haut, gauche, bas);
  trait(droite, haut, droite, bas);

  if (modele === 'grille-horizontale') {
    const pas = 130;
    const barres = Math.max(2, Math.round(baie.heightMm / pas));
    for (let index = 1; index < barres; index++) {
      const y = haut + (baie.heightMm * index) / barres;
      trait(gauche, y, droite, y);
    }
    const montants = Math.max(2, Math.round(baie.widthMm / 700));
    for (let index = 1; index < montants; index++) {
      const x = gauche + (baie.widthMm * index) / montants;
      trait(x, haut, x, bas);
    }
    return;
  }

  if (modele === 'grille-croisillons') {
    // Le treillis soudé : deux familles de diagonales, rognées à la baie.
    const rect: ElevationRect = { role: 'clair', xMm: gauche, yMm: haut, widthMm: baie.widthMm, heightMm: baie.heightMm };
    const pas = 190;
    for (let c = Math.floor((gauche - bas) / pas) * pas; c <= Math.ceil((droite - haut) / pas) * pas; c += pas) {
      const segment = segmentDiagonal(rect, c, true);
      if (segment) trait(...segment);
    }
    for (let c = Math.floor((gauche + haut) / pas) * pas; c <= Math.ceil((droite + bas) / pas) * pas; c += pas) {
      const segment = segmentDiagonal(rect, c, false);
      if (segment) trait(...segment);
    }
    return;
  }

  // Barreaux droits, ouvragés ou non.
  const pas = modele === 'grille-ouvragee' ? 155 : 130;
  const barreaux = Math.max(2, Math.round(baie.widthMm / pas));
  for (let index = 1; index < barreaux; index++) {
    const x = gauche + (baie.widthMm * index) / barreaux;
    trait(x, haut, x, bas);
  }
  const traverses = Math.max(2, Math.round(baie.heightMm / 700));
  for (let index = 1; index < traverses; index++) {
    const y = haut + (baie.heightMm * index) / traverses;
    trait(gauche, y, droite, y);
  }

  if (modele === 'grille-ouvragee') {
    // La bande de volutes, à mi-hauteur : deux enroulements opposés entre
    // chaque paire de barreaux, comme au fer forgé.
    const ecart = baie.widthMm / barreaux;
    const rayon = Math.min(ecart * 0.42, baie.heightMm * 0.16);
    const milieu = haut + baie.heightMm / 2;
    for (let index = 0; index < barreaux; index++) {
      const centre = gauche + ecart * (index + 0.5);
      pousserVolute(lines, centre, milieu - rayon, rayon, Math.PI * 0.5, Math.PI * 1.9);
      pousserVolute(lines, centre, milieu + rayon, rayon, Math.PI * 1.5, Math.PI * 2.9);
    }
  }
}

/**
 * Ce qui se voit DANS le vitrage : les lames d'un store vénitien intégré,
 * les stries d'une sérigraphie. Deux choses très différentes, dessinées de
 * la même façon — des traits horizontaux au travers du clair — parce que
 * c'est ainsi qu'elles se lisent de face.
 *
 * Solution écartée : montrer le store REMONTÉ, comme il l'est neuf fois sur
 * dix. Un store remonté ne se voit pas, et le client vient de payer 55 % de
 * supplément pour lui. On le montre donc BAISSÉ, lames ouvertes — c'est la
 * pose de tous les catalogues, et pour la même raison.
 */
function pousserVitrageVisible(
  lines: ElevationLine[],
  clair: ElevationRect,
  vitrage: { aspect?: string; storeIntegre?: boolean } | undefined,
  vantail: number,
): void {
  if (!vitrage) return;
  // La sérigraphie est un motif d'émail cuit dans le verre : des bandes
  // larges et espacées. Le store, lui, est fait de lames de 25 mm — bien
  // plus nombreuses, bien plus serrées.
  const pas = vitrage.storeIntegre ? 62 : vitrage.aspect === 'serigraphie' ? 150 : 0;
  if (pas === 0) return;
  for (let y = clair.yMm + pas; y < clair.yMm + clair.heightMm; y += pas) {
    lines.push({
      role: 'store-integre',
      x1Mm: clair.xMm,
      y1Mm: y,
      x2Mm: clair.xMm + clair.widthMm,
      y2Mm: y,
      vantail,
    });
  }
}

function pousserPetitsBois(
  lines: ElevationLine[],
  clair: ElevationRect,
  vantail: number,
  composition: 'droits' | 'losanges' | 'imperiale' = 'droits',
  pasMm = 450,
): void {
  const gauche = clair.xMm;
  const droite = clair.xMm + clair.widthMm;
  const haut = clair.yMm;
  const bas = clair.yMm + clair.heightMm;
  const trait = (x1Mm: number, y1Mm: number, x2Mm: number, y2Mm: number) =>
    lines.push({ role: 'petit-bois', x1Mm, y1Mm, x2Mm, y2Mm, vantail });

  if (composition === 'imperiale') {
    // La croisée impériale : un seul bois vertical, un seul horizontal, et
    // quatre carreaux. C'est la composition la plus ancienne, et la plus
    // sobre.
    trait(gauche + clair.widthMm / 2, haut, gauche + clair.widthMm / 2, bas);
    trait(gauche, haut + clair.heightMm / 2, droite, haut + clair.heightMm / 2);
    return;
  }

  if (composition === 'losanges') {
    // Le losange : deux familles de diagonales à 45°, rognées au clair.
    const pas = Math.max(180, pasMm * 0.62);
    const debut = Math.floor((gauche - bas) / pas) * pas;
    const fin = Math.ceil((droite - haut) / pas) * pas;
    for (let c = debut; c <= fin; c += pas) {
      const montant = segmentDiagonal(clair, c, true);
      if (montant) trait(...montant);
    }
    const debutDescendant = Math.floor((gauche + haut) / pas) * pas;
    const finDescendant = Math.ceil((droite + bas) / pas) * pas;
    for (let c = debutDescendant; c <= finDescendant; c += pas) {
      const descendant = segmentDiagonal(clair, c, false);
      if (descendant) trait(...descendant);
    }
    return;
  }

  const colonnes = Math.max(1, Math.round(clair.widthMm / pasMm));
  const rangees = Math.max(1, Math.round(clair.heightMm / pasMm));
  for (let c = 1; c < colonnes; c++) {
    const x = gauche + (clair.widthMm * c) / colonnes;
    trait(x, haut, x, bas);
  }
  for (let r = 1; r < rangees; r++) {
    const y = haut + (clair.heightMm * r) / rangees;
    trait(gauche, y, droite, y);
  }
}

/** Le symbole normalisé d'un vantail — la pointe du V désigne les paumelles. */
function pousserSymbole(
  lines: ElevationLine[],
  clair: ElevationRect,
  sens: SensVantail,
  vantail: number,
): void {
  if (sens === null) return;
  const gauche = clair.xMm;
  const droite = clair.xMm + clair.widthMm;
  const haut = clair.yMm;
  const bas = clair.yMm + clair.heightMm;
  const milieuY = clair.yMm + clair.heightMm / 2;
  const milieuX = clair.xMm + clair.widthMm / 2;
  const trait = (x1Mm: number, y1Mm: number, x2Mm: number, y2Mm: number) =>
    lines.push({ role: 'symbole', x1Mm, y1Mm, x2Mm, y2Mm, vantail });

  if (sens === 'gauche') {
    trait(droite, haut, gauche, milieuY);
    trait(droite, bas, gauche, milieuY);
  } else if (sens === 'droite') {
    trait(gauche, haut, droite, milieuY);
    trait(gauche, bas, droite, milieuY);
  } else if (sens === 'bas') {
    trait(gauche, haut, milieuX, bas);
    trait(droite, haut, milieuX, bas);
  } else {
    // Coulissant : une flèche horizontale dans le sens du refoulement.
    const versDroite = sens === 'coulisse-droite';
    const depart = versDroite ? gauche + clair.widthMm * 0.2 : droite - clair.widthMm * 0.2;
    const arrivee = versDroite ? droite - clair.widthMm * 0.2 : gauche + clair.widthMm * 0.2;
    const pointe = clair.widthMm * 0.08;
    trait(depart, milieuY, arrivee, milieuY);
    trait(arrivee, milieuY, arrivee + (versDroite ? -pointe : pointe), milieuY - pointe * 0.6);
    trait(arrivee, milieuY, arrivee + (versDroite ? -pointe : pointe), milieuY + pointe * 0.6);
  }
}

/**
 * Le décor d'un panneau de porte — panneaux en creux, moulures, rainures,
 * inserts d'inox. Tout vient du catalogue : un marchand ajoute un modèle
 * sans qu'une ligne soit écrite ici, et le dessin suit.
 *
 * `zone` est la partie PLEINE de l'ouvrant, vitrage déduit. En deçà d'une
 * hauteur utile on ne dessine rien : trois panneaux dans 180 mm ne sont
 * pas trois panneaux, ce sont trois traits, et la porte livrée ne leur
 * ressemblerait pas.
 */
function pousserDecorPorte(
  rects: ElevationRect[],
  lines: ElevationLine[],
  zone: { xMm: number; yMm: number; widthMm: number; heightMm: number },
  decor: DecorPorte,
  vantail: number,
): void {
  if (zone.widthMm < 200 || zone.heightMm < 280) return;
  const marge = Math.min(70, zone.widthMm * 0.13);

  const nombrePanneaux = Math.max(0, Math.round(decor.panneaux ?? 0));
  if (nombrePanneaux > 0) {
    const entre = Math.min(60, zone.heightMm * 0.05);
    const hauteur = (zone.heightMm - 2 * marge - entre * (nombrePanneaux - 1)) / nombrePanneaux;
    if (hauteur > 90) {
      for (let index = 0; index < nombrePanneaux; index++) {
        const panneau: ElevationRect = {
          role: 'panneau',
          xMm: zone.xMm + marge,
          yMm: zone.yMm + marge + index * (hauteur + entre),
          widthMm: zone.widthMm - 2 * marge,
          heightMm: hauteur,
          vantail,
        };
        rects.push(panneau);
        // Les moulures encadrent CHAQUE panneau, en cadres emboîtés : c'est
        // ce qui distingue une porte de style d'une porte à plate-bande.
        for (let rang = 1; rang <= Math.max(0, Math.round(decor.moulures ?? 0)); rang++) {
          const retrait = rang * Math.min(22, hauteur * 0.09);
          if (panneau.widthMm - 2 * retrait < 40 || panneau.heightMm - 2 * retrait < 40) break;
          rects.push({
            role: 'moulure',
            xMm: panneau.xMm + retrait,
            yMm: panneau.yMm + retrait,
            widthMm: panneau.widthMm - 2 * retrait,
            heightMm: panneau.heightMm - 2 * retrait,
            vantail,
          });
        }
      }
    }
  }

  const nombreRainures = Math.max(0, Math.round(decor.rainures ?? 0));
  if (nombreRainures > 0) {
    // Les rainures sont fraisées dans la masse : elles courent sur toute la
    // hauteur pleine, sans marge haute ni basse — c'est la passe d'outil.
    const pas = zone.widthMm / (nombreRainures + 1);
    for (let index = 1; index <= nombreRainures; index++) {
      const x = zone.xMm + pas * index;
      lines.push({
        role: 'rainure',
        x1Mm: x,
        y1Mm: zone.yMm + marge * 0.5,
        x2Mm: x,
        y2Mm: zone.yMm + zone.heightMm - marge * 0.5,
        vantail,
      });
    }
  }

  const nombreInserts = Math.max(0, Math.round(decor.insertsInox ?? 0));
  if (nombreInserts > 0) {
    const epaisseur = Math.min(38, zone.heightMm * 0.035);
    const pas = zone.heightMm / (nombreInserts + 1);
    for (let index = 1; index <= nombreInserts; index++) {
      rects.push({
        role: 'insert',
        xMm: zone.xMm + marge * 0.6,
        yMm: zone.yMm + pas * index - epaisseur / 2,
        widthMm: zone.widthMm - marge * 1.2,
        heightMm: epaisseur,
        vantail,
      });
    }
  }
}

/**
 * Les accessoires d'une porte, posés aux hauteurs du métier : le judas à
 * hauteur d'œil, le heurtoir sous lui, la boîte aux lettres à hauteur de
 * facteur, le soubassement au pied. Ces cotes se comptent depuis le SOL,
 * jamais depuis le haut de l'ouvrant — une porte de 2,15 m et une porte de
 * 2,40 m ont le même judas à la même hauteur.
 */
function pousserAccessoiresPorte(
  rects: ElevationRect[],
  disques: ElevationDisque[],
  options: string[],
  ouvrant: ElevationRect,
  solYMm: number,
  vantail: number,
): void {
  const centreX = ouvrant.xMm + ouvrant.widthMm / 2;
  const depuisLeSol = (hauteurMm: number) => solYMm - hauteurMm;
  const dans = (y: number) => y > ouvrant.yMm + 40 && y < ouvrant.yMm + ouvrant.heightMm - 40;

  if (options.includes('soubassement-inox')) {
    const hauteur = Math.min(260, ouvrant.heightMm * 0.14);
    rects.push({
      role: 'insert',
      xMm: ouvrant.xMm + 18,
      yMm: ouvrant.yMm + ouvrant.heightMm - hauteur - 18,
      widthMm: ouvrant.widthMm - 36,
      heightMm: hauteur,
      vantail,
    });
  }
  if (options.includes('boite-aux-lettres')) {
    // La fente est large et basse : 300 × 40 mm, la cote normalisée de La
    // Poste pour qu'une enveloppe A4 passe sans être pliée.
    const y = depuisLeSol(1050);
    if (dans(y)) {
      rects.push({
        role: 'insert',
        xMm: centreX - 150,
        yMm: y,
        widthMm: Math.min(300, ouvrant.widthMm - 120),
        heightMm: 40,
        vantail,
      });
    }
  }
  if (options.includes('judas')) {
    const y = depuisLeSol(1550);
    if (dans(y)) disques.push({ role: 'judas', xMm: centreX, yMm: y, rayonMm: 13, vantail });
  }
  if (options.includes('heurtoir')) {
    const y = depuisLeSol(1350);
    if (dans(y)) disques.push({ role: 'heurtoir', xMm: centreX, yMm: y, rayonMm: 52, vantail });
  }
}

/** La menuiserie vitrée : dormant, imposte, ouvrants, clairs, symboles. */
/**
 * Les trois cotes que la CHAÎNE DE COTES donne au trait (lot 0) : la masse
 * vue totale par côté, ce que le dormant en montre seul, et le refend
 * entre deux vantaux. Elles arrivent résolues de `computeElevation()`, qui
 * les tient de la même fonction que `computeMeasureReport()` — c'est ce
 * qui empêche le dessin et la mesure de diverger.
 */
export interface CotesDuTrait {
  bandeMm: number;
  dormantVuMm: number;
  battementMm: number;
}

export function elevationVitree(
  config: JoineryConfiguration,
  catalog: PricingCatalog,
  cotes: CotesDuTrait,
  rects: ElevationRect[],
  lines: ElevationLine[],
  poignees: ElevationPoignee[],
  disques: ElevationDisque[],
): void {
  const mesure = computeMeasureReport(config, catalog);
  const { bandeMm, dormantVuMm, battementMm } = cotes;
  const dormant = dormantVuMm;
  const W = config.widthMm;
  const H = config.heightMm;
  const imposteMm = config.imposteHauteurMm ?? 0;

  // Le volet roulant en bloc-baie : son coffre se pose AU-DESSUS de la
  // menuiserie, et ses coulisses la longent. Les cotes saisies restent
  // celles de la menuiserie — le coffre s'ajoute, comme en rénovation.
  // Sans lui, une option facturée 260 € n'apparaissait nulle part.
  // Seul le COFFRE entre dans l'élévation : elle est une vue intérieure, et
  // de l'intérieur on ne voit pas les coulisses, qui longent la face
  // extérieure. La 3D les ajoutera là où elles sont réellement.
  const blocBaie = (config.options ?? []).some((option) => option.id === 'bloc-baie-manuel');
  // Le coffre d'un BLOC-BAIE se calcule comme celui d'un volet roulant :
  // c'est le même tablier, le même tube, le même rouleau. Un forfait à
  // 14 % de la hauteur posait un caisson de 168 mm sur un tablier de
  // 2,20 m, là où le rouleau seul en mesure 207 (docs/18 §10, G13).
  const coffreMm = blocBaie ? hauteurCoffreMm(H) : 0;
  /**
   * LA HAUTEUR DE LA MENUISERIE — la cote commandée MOINS le coffre, depuis
   * le lot O10.
   *
   * Le coffre s'ajoutait PAR-DESSUS : une fenêtre de 1 450 mm avec l'option
   * bloc-baie descendait à **1 630**, pour un tableau mesuré « du rejingot au
   * linteau » — 180 mm de trop, 12,4 % de sa hauteur, et l'ouvrage ne rentrait
   * pas dans le trou. Un bloc-baie est un MONOBLOC : son coffre entre dans le
   * trou AVEC le dormant, et le relevé de Fenetre24 le répète deux fois — « la
   * hauteur du caisson est comprise dans la hauteur totale ».
   *
   * Les zones intérieures, elles, n'ont rien à changer : elles viennent déjà
   * de `mesure.vantail`, qui déduit le coffre depuis le même lot.
   */
  const menuiserieMm = Math.max(0, H - coffreMm);
  if (coffreMm > 0) {
    rects.push({ role: 'coffre', xMm: 0, yMm: 0, widthMm: W, heightMm: coffreMm });
  }

  // L'aile de recouvrement du dormant de rénovation. Elle coiffe l'ancien
  // cadre par l'extérieur et déborde donc de la cote saisie — c'est
  // exactement ce que le client verra, et ce qui explique qu'il perde du
  // clair de jour. Elle est posée AVANT le dormant : elle passe derrière.
  const pose = posePourFamille(catalog, config.famille, config.pose);
  if (pose.recouvrementMm > 0) {
    const r = pose.recouvrementMm;
    rects.push({
      role: 'recouvrement',
      xMm: -r,
      yMm: coffreMm - r,
      widthMm: W + 2 * r,
      heightMm: menuiserieMm + 2 * r,
    });
  }

  rects.push({ role: 'dormant', xMm: 0, yMm: coffreMm, widthMm: W, heightMm: menuiserieMm });

  // L'imposte est un fixe vitré en partie haute — sa traverse basse sépare.
  // Son châssis est RENTRÉ du dormant, comme n'importe quel ouvrant : posé à
  // (0, 0) sur toute la largeur, il recouvrait le dormant, et la 3D — qui
  // déduit l'ouverture du dormant de l'emprise des ouvrants — n'y voyait
  // plus de place pour les montants ni pour la traverse haute. Une fenêtre à
  // imposte s'exportait alors en RA avec trois barres de cadre en moins.
  if (imposteMm > 0) {
    rects.push({
      role: 'ouvrant',
      xMm: dormant,
      yMm: coffreMm + dormant,
      widthMm: Math.max(0, W - 2 * dormant),
      heightMm: Math.max(0, imposteMm - dormant),
      fixe: true,
    });
    rects.push({
      role: 'clair',
      xMm: bandeMm,
      yMm: coffreMm + bandeMm,
      widthMm: Math.max(0, W - 2 * bandeMm),
      heightMm: Math.max(0, imposteMm - 2 * bandeMm),
      fixe: true,
    });
  }

  // La grille de défense se lit AUSSI de l'intérieur : on voit ses barreaux
  // au travers du vitrage. Elle se dessine donc sur l'élévation, devant le
  // dormant, et la 3D la posera côté extérieur.
  pousserGrilleDefense(lines, config, {
    xMm: dormant,
    yMm: coffreMm + dormant,
    widthMm: Math.max(0, W - 2 * dormant),
    heightMm: Math.max(0, menuiserieMm - 2 * dormant),
  });

  const zoneY = coffreMm + imposteMm;
  const zoneH = mesure.vantail.heightMm;
  // L'OUVERTURE DÉCLARÉE SE RÉSOUT ICI (lot MT4a), dans le module de
  // famille, et pas dans `drawing.ts` : ce fichier est paresseux, l'entrée
  // ne l'est pas. Le dessin commun reçoit une ouverture NATIVE et ne connaît
  // toujours que six mots.
  const sens = sensDesVantaux(
    config,
    mesure.vantaux,
    ouvertureNativeEquivalente(config.ouvertureDeclaree, catalog.ouverturesDeclarees),
  );
  const optionsIds = (config.options ?? []).map((option) => option.id);
  const petitsBois = optionsIds.includes('petits-bois');
  const obQuantite = config.options?.find((option) => option.id === 'oscillo-battant')?.quantite ?? 0;
  // Une porte d'entrée pleine ne porte aucun clair ; semi-vitrée : le haut.
  const remplissage = config.remplissagePorte ?? 'pleine';
  const modele = modelePorteDe(catalog, config.famille, config.modelePorte);
  const partVitree = config.famille === 'porte-entree'
    ? remplissage === 'pleine'
      ? 0
      : remplissage === 'semi-vitree'
        ? 0.4
        : 0.8
    : 1;

  for (let i = 0; i < mesure.vantaux; i++) {
    const celluleX = (W * i) / mesure.vantaux;
    const celluleW = W / mesure.vantaux;
    const bordGauche = i === 0 ? dormant : 0;
    const frappe = sens[i] === 'gauche' || sens[i] === 'droite';
    // Le vantail de SERVICE : celui qu'on manœuvre. Il porte la poignée, et
    // c'est lui aussi qui portera les accessoires de la porte.
    const service = !frappe || i === mesure.vantaux - 1;
    const bordDroit = i === mesure.vantaux - 1 ? dormant : 0;
    const rectOuvrant: ElevationRect = {
      role: 'ouvrant',
      xMm: celluleX + bordGauche,
      yMm: zoneY + (imposteMm > 0 ? 0 : dormant),
      widthMm: celluleW - bordGauche - bordDroit,
      heightMm: zoneH - (imposteMm > 0 ? 0 : dormant) - dormant,
      vantail: i,
      fixe: sens[i] === null,
    };
    rects.push(rectOuvrant);

    // Le clair : la cellule rentrée de la bande de profil sur les quatre
    // côtés — exactement le rectangle que `computeMeasureReport` a pesé.
    // LE BATTEMENT, à sa place (lot 0). Un vantail perd la masse vue
    // complète du côté du dormant, et un DEMI battement du côté où il
    // rejoint son voisin — parce que l'autre moitié appartient au voisin.
    // Le modèle d'avant retranchait la masse vue des deux côtés de chaque
    // vantail : au milieu d'un deux-vantaux, cela faisait 170 mm de
    // profilé là où le métier en pose 112, et le clair se trouvait
    // rétréci de 10 à 61 % selon la taille (docs/13 §2).
    const retraitGauche = i === 0 ? bandeMm : battementMm / 2;
    const retraitDroit = i === mesure.vantaux - 1 ? bandeMm : battementMm / 2;
    const clairPleine: ElevationRect = {
      role: 'clair',
      xMm: celluleX + retraitGauche,
      yMm: zoneY + bandeMm,
      widthMm: Math.max(0, Math.round(celluleW - retraitGauche - retraitDroit)),
      heightMm: Math.max(0, zoneH - 2 * bandeMm),
      vantail: i,
      fixe: sens[i] === null,
    };
    if (partVitree > 0) {
      // Une porte vitre sa partie haute : même largeur, hauteur au prorata.
      const clair: ElevationRect =
        partVitree === 1
          ? clairPleine
          : { ...clairPleine, heightMm: clairPleine.heightMm * partVitree };
      rects.push(clair);
      pousserVitrageVisible(lines, clair, config.vitrage, i);
      if (petitsBois) pousserPetitsBois(lines, clair, i, config.compositionPetitsBois ?? 'droits');
      pousserSymbole(lines, clair, sens[i], i);
    } else {
      pousserSymbole(lines, clairPleine, sens[i], i);
    }

    // La poignée se pose sur le montant opposé aux paumelles, à mi-hauteur —
    // et sur le seul VANTAIL DE SERVICE : en frappe, les autres sont des
    // semi-fixes manœuvrés à la crémone, qui ne porte pas de béquille (voir
    // la compétence `metier-menuiserie`). Un coulissant, lui, a bien une
    // poignée par vantail mobile.
    if (sens[i] !== null && service) {
      // En frappe, la poignée est à l'opposé des paumelles. Sur un
      // coulissant, elle est sur le montant qui MÈNE le mouvement — donc du
      // côté vers lequel le vantail refoule, là où les deux vantaux se
      // rejoignent. Posée à l'opposé, elle sortait de la baie de 25 mm :
      // trouvé par le test d'emprise du volume, pas à l'œil.
      const coteHandle: 'gauche' | 'droite' =
        sens[i] === 'coulisse-droite'
          ? 'droite'
          : sens[i] === 'coulisse-gauche'
            ? 'gauche'
            : sens[i] === 'gauche'
              ? 'droite'
              : 'gauche';
      poignees.push({
        xMm: coteHandle === 'gauche' ? celluleX + bandeMm / 2 : celluleX + celluleW - bandeMm / 2,
        yMm: zoneY + zoneH / 2,
        cote: coteHandle,
        vantail: i,
      });
    }

    // L'oscillo-battant ajoute le soufflet aux vantaux équipés — en
    // commençant par le vantail de service, celui qu'on manœuvre.
    if (i >= mesure.vantaux - obQuantite && frappe) {
      pousserSymbole(lines, clairPleine, 'bas', i);
    }

    // Le décor du panneau de porte. La zone PLEINE est ce qui reste sous le
    // vitrage : sur une porte pleine c'est tout le clair, sur une vitrée il
    // n'en reste presque rien — et le décor s'efface plutôt que de se
    // tasser en trois traits.
    if (modele && config.famille === 'porte-entree') {
      const hauteurVitree = partVitree > 0 ? clairPleine.heightMm * partVitree + bandeMm : 0;
      pousserDecorPorte(
        rects,
        lines,
        {
          xMm: clairPleine.xMm,
          yMm: clairPleine.yMm + hauteurVitree,
          widthMm: clairPleine.widthMm,
          heightMm: clairPleine.heightMm - hauteurVitree,
        },
        modele.decor,
        i,
      );
    }
    // Les accessoires vont sur le vantail de SERVICE : c'est celui qu'on
    // pousse, et une boîte aux lettres sur la tierce serait inaccessible
    // huit mois par an.
    if (config.famille === 'porte-entree' && service) {
      // LE BAS DE L'OUVRAGE vaut la cote commandée depuis le lot O10 : le
      // coffre est DEDANS, il ne s'ajoute plus par-dessus.
      pousserAccessoiresPorte(rects, disques, optionsIds, rectOuvrant, H, i);
    }
  }
}
