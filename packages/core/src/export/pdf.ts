
import type { JoineryConfiguration, PriceResult } from '../types.ts';
import { DEFAULT_CATALOG, familleCatalog, type PricingCatalog } from '../catalog.ts';
import { computeElevation, type Elevation } from '../drawing.ts';
import { computePrice } from '../pricing.ts';
import { computeUw } from '../thermal.ts';
import { computeMetre } from '../terrain.ts';
import { computeProjet, type LigneProjet } from '../projet.ts';
import { formaterCote, type Unite } from '../unites.ts';
import {
  PAGE,
  Page,
  assembler,
  envelopper,
  euros,
  litteral,
  n,
  versWinAnsi,
} from './pdf-primitives.ts';

/** Ce que l'appelant doit fournir — et qui ne peut PAS venir du cœur. */
export interface OptionsDevis {
  /** La date, au format `AAAA-MM-JJ`. Le cœur n'a pas d'horloge. */
  dateISO: string;
  /** La référence du devis. L'appelant la tient de sa boutique. */
  reference: string;
  /** Le marchand, tel qu'il veut être nommé. */
  marchand?: { nom: string; adresse?: string; siret?: string };
  /** Le client, si l'hôte le connaît. */
  client?: { nom: string; adresse?: string };
  /** Le taux de TVA en millièmes (200 = 20 %). Réglage de boutique. */
  tvaMilliemes?: number;
  /** L'unité des cotes affichées. */
  unite?: Unite;
  /** La validité, en jours. */
  validiteJours?: number;
  /**
   * LES MENTIONS QUI ENGAGENT L'ÉMETTEUR, et qu'aucun moteur ne peut
   * inventer.
   *
   * Elles sont OPTIONNELLES, et leur absence ne change pas un octet du
   * document — c'est la règle de tout ajout à ce dépôt : une configuration
   * qui ne demande rien de neuf paie ce qu'elle payait avant. Un devis
   * sans elles reste ce qu'il était : un chiffrage. Un devis AVEC elles
   * gagne une page, et devient un document qu'un professionnel du bâtiment
   * peut remettre à un client.
   *
   * Pourquoi une page et non une ligne de pied : les six informations
   * d'assurance de l'article L243-2 du Code des assurances ne tiennent pas
   * en une ligne, et les résumer reviendrait à en omettre — or c'est
   * précisément l'omission qui expose à l'amende.
   */
  mentions?: MentionsLegales;
}

/** Ce qu'un devis de professionnel du bâtiment doit porter. */
export interface MentionsLegales {
  /**
   * L'assurance décennale — les six informations de l'art. L243-2 du Code
   * des assurances. Leur absence sur un devis expose à 15 000 € d'amende
   * pour une personne morale.
   */
  assurance?: {
    assureur: string;
    adresse: string;
    contrat: string;
    activites: string;
    zone: string;
  };
  /** La qualification RGE, sans laquelle aucune aide n'est due. */
  rge?: { numero: string; echeance?: string };
  /** L'acompte demandé, et le mot employé — acompte et arrhes diffèrent. */
  acompte?: { mot: 'acompte' | 'arrhes'; pourcent: number };
  /**
   * Le mode de conclusion. Il décide du délai de rétractation et de la
   * date à partir de laquelle un paiement peut être demandé : hors
   * établissement, AUCUN paiement avant sept jours (art. L221-10 du Code
   * de la consommation).
   */
  modeDeConclusion?: 'etablissement' | 'distance' | 'hors-etablissement';
  /** Les conditions générales, telles qu'elles ont été acceptées. */
  cgv?: string;
}

/** Une ligne du devis, avec tout ce qu'il faut pour l'imprimer. */
interface LigneDevis {
  config: JoineryConfiguration;
  quantite: number;
  prix: PriceResult;
  elevation: Elevation;
  label: string;
}

// --------------------------------------------------------------------------
// Le devis lui-même.
// --------------------------------------------------------------------------

/**
 * Le SCHÉMA, retracé depuis la même `Elevation` que l'écran. Deux écrivains,
 * une source : le SVG pour la page, celui-ci pour le PDF, et le DXF du bloc
 * II fera le troisième. Un second dessin aurait fini par diverger.
 */
function tracerElevation(page: Page, elevation: Elevation, x: number, y: number, largeur: number, hauteur: number): void {
  const boite = elevation.viewBox;
  const echelle = Math.min(largeur / boite.widthMm, hauteur / boite.heightMm);
  // Le repère d'un PDF a son origine EN BAS ; celui d'une élévation en
  // haut. C'est la seule conversion, et l'oublier retourne le dessin.
  const versX = (mm: number) => x + (mm - boite.xMm) * echelle;
  const versY = (mm: number) => y + hauteur - (mm - boite.yMm) * echelle;

  for (const rect of elevation.rects) {
    const gris = rect.role === 'clair' ? 0.88 : rect.role === 'poteau' ? 0.45 : 0.72;
    page.rectangle(
      versX(rect.xMm),
      versY(rect.yMm + rect.heightMm),
      rect.widthMm * echelle,
      rect.heightMm * echelle,
      gris,
      0.3,
    );
  }
  for (const contour of elevation.contours) {
    const points = contour.points;
    if (points.length < 3) continue;
    const trace = points
      .map(([px, py], index) => `${n(versX(px))} ${n(versY(py))} ${index === 0 ? 'm' : 'l'}`)
      .join(' ');
    page.operations.push('0.72 g', '0.3 w', `${trace} h B`, '0 g');
  }
  for (const trait of elevation.lines) {
    page.ligne(versX(trait.x1Mm), versY(trait.y1Mm), versX(trait.x2Mm), versY(trait.y2Mm), 0.3, 0.35);
  }
  for (const cote of elevation.cotes) {
    page.ligne(versX(cote.x1Mm), versY(cote.y1Mm), versX(cote.x2Mm), versY(cote.y2Mm), 0.3, 0.55);
    page.texte(versX(cote.textXMm) - cote.label.length * 1.6, versY(cote.textYMm) - 2, cote.label, 6, false, 0.35);
  }
}

/** L'en-tête d'une page — le même sur toutes, pour qu'on sache ce qu'on lit. */
function entete(page: Page, options: OptionsDevis, titre: string): number {
  const haut = PAGE.hauteur - PAGE.marge;
  page.texte(PAGE.marge, haut - 10, options.marchand?.nom ?? 'Devis', 14, true);
  page.texteDroite(PAGE.largeur - PAGE.marge, haut - 10, titre, 10, true);
  page.ligne(PAGE.marge, haut - 18, PAGE.largeur - PAGE.marge, haut - 18, 0.8, 0.2);
  return haut - 34;
}

/** Le pied de page — les mentions qui engagent, sur CHAQUE page. */
function pied(page: Page, options: OptionsDevis, numero: number, total: number): void {
  const bas = PAGE.marge;
  page.ligne(PAGE.marge, bas + 26, PAGE.largeur - PAGE.marge, bas + 26, 0.4, 0.6);
  page.texte(
    PAGE.marge,
    bas + 16,
    `Devis ${options.reference} du ${options.dateISO} — valable ${options.validiteJours ?? 30} jours. Pose non comprise.`,
    7,
    false,
    0.4,
  );
  page.texte(
    PAGE.marge,
    bas + 7,
    'Coefficients thermiques en calcul simplifié (EN ISO 10077-1). Prix indicatifs, non contractuels avant confirmation des cotes.',
    7,
    false,
    0.4,
  );
  page.texteDroite(PAGE.largeur - PAGE.marge, bas + 7, `${numero} / ${total}`, 7);
}

/**
 * Le devis complet d'un projet — une page de récapitulatif, puis une page
 * par ouvrage avec son schéma et le détail de son prix.
 */
export function devisEnPdf(
  lignes: LigneProjet[],
  options: OptionsDevis,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): Uint8Array {
  const unite = options.unite ?? 'mm';
  const cote = (mm: number) => formaterCote(mm, unite);
  const preparees: LigneDevis[] = lignes.map((ligne) => {
    const quantite = Math.max(1, Math.round(ligne.quantite));
    const config = { ...ligne.config, quantite };
    return {
      config,
      quantite,
      prix: computePrice(config, catalog),
      elevation: computeElevation(config, catalog),
      label: familleCatalog(catalog, config.famille).label,
    };
  });
  const projet = computeProjet(lignes, catalog);
  const pages: Page[] = [];

  // ---- Page 1 : le récapitulatif ----
  const recap = new Page();
  let y = entete(recap, options, `Devis ${options.reference}`);
  if (options.marchand?.adresse) {
    recap.texte(PAGE.marge, y, options.marchand.adresse, 8, false, 0.35);
    y -= 11;
  }
  if (options.client) {
    recap.texteDroite(PAGE.largeur - PAGE.marge, y + 11, options.client.nom, 9, true);
    if (options.client.adresse) recap.texteDroite(PAGE.largeur - PAGE.marge, y, options.client.adresse, 8);
  }
  y -= 18;

  recap.texte(PAGE.marge, y, 'Désignation', 8, true);
  recap.texteDroite(PAGE.largeur - PAGE.marge - 190, y, 'Qté', 8, true);
  recap.texteDroite(PAGE.largeur - PAGE.marge, y, 'Total', 8, true);
  y -= 4;
  recap.ligne(PAGE.marge, y, PAGE.largeur - PAGE.marge, y, 0.5, 0.4);
  y -= 14;

  for (const ligne of preparees) {
    const metre = computeMetre(ligne.config, catalog);
    const cotes = metre
      ? `${Math.round(metre.longueurMm / 100) / 10} m × ${cote(ligne.config.heightMm)}`
      : `${cote(ligne.config.widthMm)} × ${cote(ligne.config.heightMm)}`;
    recap.texte(PAGE.marge, y, `${ligne.label} — ${cotes}`, 9);
    recap.texteDroite(PAGE.largeur - PAGE.marge - 190, y, String(ligne.quantite), 9);
    // Le total d'une LIGNE : le prix unitaire MULTIPLIÉ par la quantité.
    // C'est en imprimant « 4 » à côté d'un montant unitaire que le devis a
    // mis au jour l'oubli du panier — il durait depuis la phase 2.
    recap.texteDroite(
      PAGE.largeur - PAGE.marge,
      y,
      euros(ligne.prix.displayTotalCents * ligne.quantite),
      9,
    );
    y -= 13;
  }

  y -= 6;
  recap.ligne(PAGE.marge, y, PAGE.largeur - PAGE.marge, y, 0.5, 0.4);
  y -= 16;
  const tva = options.tvaMilliemes ?? 200;
  const ht = Math.round((projet.totalCents * 1000) / (1000 + tva));
  recap.texteDroite(PAGE.largeur - PAGE.marge, y, `Total HT   ${euros(ht)}`, 9);
  y -= 13;
  recap.texteDroite(PAGE.largeur - PAGE.marge, y, `TVA ${tva / 10} %   ${euros(projet.totalCents - ht)}`, 9);
  y -= 15;
  recap.texteDroite(PAGE.largeur - PAGE.marge, y, `Total TTC   ${euros(projet.totalCents)}`, 12, true);
  y -= 24;

  // LE MÉTRÉ DU CHANTIER, quand il y en a un — c'est ce que le poseur lit
  // en premier, et ce que le maçon commande.
  if (projet.metre) {
    recap.texte(PAGE.marge, y, 'Métré du chantier', 9, true);
    y -= 12;
    recap.texte(
      PAGE.marge,
      y,
      `${Math.round(projet.metre.longueurMm / 100) / 10} m développés · ${projet.metre.poteaux} poteaux` +
        `${projet.metre.poteauxAngle > 0 ? ` dont ${projet.metre.poteauxAngle} d'angle` : ''}` +
        ` · ${projet.metre.panneaux} panneaux · ${projet.metre.betonLitres} L de béton`,
      8,
    );
    y -= 20;
  }

  for (const remarque of projet.remarques) {
    recap.texte(PAGE.marge, y, remarque.message, 7, false, 0.35);
    y -= 11;
  }
  pages.push(recap);

  // ---- Une page par ouvrage ----
  for (const [index, ligne] of preparees.entries()) {
    const page = new Page();
    let py = entete(page, options, `Ouvrage ${index + 1} — ${ligne.label}`);

    tracerElevation(page, ligne.elevation, PAGE.marge, py - 300, 300, 290);

    let dy = py - 10;
    const xDetail = PAGE.marge + 320;
    page.texte(xDetail, dy, ligne.label, 11, true);
    dy -= 15;
    const metre = computeMetre(ligne.config, catalog);
    for (const info of [
      metre
        ? `Longueur ${Math.round(metre.longueurMm / 100) / 10} m`
        : `Largeur ${cote(ligne.config.widthMm)}`,
      `Hauteur ${cote(ligne.config.heightMm)}`,
      `Matériau ${ligne.config.materiau}`,
      `Teinte ${ligne.config.couleur}`,
    ]) {
      page.texte(xDetail, dy, info, 8, false, 0.25);
      dy -= 11;
    }
    const uw = computeUw(ligne.config, catalog);
    if (uw) {
      page.texte(xDetail, dy, `Uw ${uw.uw.toFixed(2).replace('.', ',')} W/m²·K — calcul simplifié`, 8, false, 0.25);
      dy -= 11;
    }

    dy -= 8;
    page.texte(xDetail, dy, 'Décomposition', 9, true);
    dy -= 13;
    for (const detail of ligne.prix.lines) {
      page.texte(xDetail, dy, detail.label.slice(0, 40), 7, false, 0.3);
      page.texteDroite(PAGE.largeur - PAGE.marge, dy, euros(detail.amountCents), 7);
      dy -= 10;
    }
    dy -= 6;
    page.ligne(xDetail, dy + 4, PAGE.largeur - PAGE.marge, dy + 4, 0.4, 0.5);
    page.texteDroite(
      PAGE.largeur - PAGE.marge,
      dy - 6,
      ligne.quantite > 1
        ? `${ligne.quantite} × ${euros(ligne.prix.displayTotalCents)} = ${euros(ligne.prix.displayTotalCents * ligne.quantite)}`
        : euros(ligne.prix.displayTotalCents),
      10,
      true,
    );

    pages.push(page);
  }

  // LA PAGE DES MENTIONS n'existe que si l'appelant en a fourni. Sans
  // elles, le document est octet pour octet celui d'avant.
  if (options.mentions) pages.push(pageDesMentions(options.mentions));

  for (const [index, page] of pages.entries()) pied(page, options, index + 1, pages.length);
  return assembler(pages, options.dateISO);
}

/**
 * La page des mentions légales.
 *
 * Elle est volontairement dense et sans ornement : ce n'est pas une page
 * qu'on lit, c'est une page qu'on doit pouvoir produire.
 */
function pageDesMentions(mentions: MentionsLegales): Page {
  const page = new Page();
  let y = PAGE.hauteur - PAGE.marge - 10;
  page.texte(PAGE.marge, y, 'Mentions légales', 14, true);
  y -= 24;

  const titre = (texte: string) => {
    y -= 6;
    page.texte(PAGE.marge, y, texte, 9, true);
    y -= 13;
  };
  const ligne = (texte: string) => {
    for (const morceau of envelopper(texte, 108)) {
      page.texte(PAGE.marge, y, morceau, 8, false, 0.2);
      y -= 11;
    }
  };

  if (mentions.assurance) {
    titre('Assurance de responsabilité décennale');
    ligne(`Assureur : ${mentions.assurance.assureur}`);
    ligne(`Adresse : ${mentions.assurance.adresse}`);
    ligne(`Contrat n° ${mentions.assurance.contrat}`);
    ligne(`Activités couvertes : ${mentions.assurance.activites}`);
    ligne(`Zone géographique : ${mentions.assurance.zone}`);
  }

  if (mentions.rge) {
    titre('Qualification');
    ligne(
      `RGE n° ${mentions.rge.numero}${mentions.rge.echeance ? ` — valable jusqu'au ${mentions.rge.echeance}` : ''}`,
    );
  }

  if (mentions.acompte) {
    titre('Conditions de règlement');
    ligne(
      `${mentions.acompte.mot === 'arrhes' ? 'Arrhes' : 'Acompte'} de ${mentions.acompte.pourcent} % à la commande.` +
        (mentions.acompte.mot === 'arrhes'
          ? " Les arrhes permettent à chaque partie de renoncer : le client les perd, le professionnel en restitue le double."
          : " L'acompte engage les deux parties."),
    );
  }

  if (mentions.modeDeConclusion) {
    titre('Droit de rétractation');
    if (mentions.modeDeConclusion === 'etablissement') {
      ligne(
        "Ce devis a été signé dans l'établissement du professionnel : le droit de rétractation des articles L221-18 et suivants du Code de la consommation ne s'applique pas.",
      );
    } else {
      ligne(
        `Ce devis a été conclu ${mentions.modeDeConclusion === 'distance' ? 'à distance' : "hors établissement"}. Le consommateur dispose de quatorze jours pour se rétracter (art. L221-18), SAUF pour les biens confectionnés selon ses spécifications ou nettement personnalisés (art. L221-28 3°) — ce qui est le cas d'une menuiserie faite à ses cotes.`,
      );
      if (mentions.modeDeConclusion === 'hors-etablissement') {
        ligne(
          "Aucun paiement, sous quelque forme que ce soit, ne peut être demandé ni reçu avant l'expiration d'un délai de sept jours à compter de la signature (art. L221-10).",
        );
      }
    }
  }

  if (mentions.cgv) {
    titre('Conditions générales de vente');
    ligne(mentions.cgv);
  }

  return page;
}
