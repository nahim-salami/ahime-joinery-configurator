/**
 * Pourquoi ce fichier existe : le configurateur ne laisse jamais commander
 * l'infabricable (docs/02 §3). Chaque règle refuse EN EXPLIQUANT : un code
 * stable, le message qui dit la norme ou la contrainte d'atelier, et
 * l'alternative la plus proche sous forme de patch applicable en un clic.
 *
 * Solution écartée : lever des exceptions, ou refuser sèchement (« valeur
 * invalide »). Un configurateur qui claque la porte perd la vente ; celui-ci
 * rend TOUTES les remarques d'un coup, triées par gravité, et le widget les
 * affiche à côté du champ fautif avec le bouton « corriger ».
 *
 * Incident fondateur : le harnais de parité des néons compare `errorCount`,
 * jamais les messages — les libellés ont le droit de différer entre JS et
 * PHP, « la configuration passe ou non » n'a pas ce droit. D'où des codes
 * stables et une sévérité tranchée : seule `erreur` bloque la commande.
 */

import type { JoineryConfiguration, OptionChoisie, ValidationIssue } from './types.ts';
import {
  DEFAULT_CATALOG,
  familleCatalog,
  matricePourVantaux,
  formeDe,
  formesDeLaFamille,
  modelePorteDe,
  optionDef,
  poseApplicable,
  posePourFamille,
  systemeDe,
  systemesDuMateriau,
  tapeeDe,
  tapeeLaPlusProche,
  type PricingCatalog,
} from './catalog.ts';
import { refusDesPostesSiCharge } from './couture-du-prix-a-la-piece.ts';
// LA PHRASE D'UN REFUS ARRIVE AVEC SON GROUPE (lot D26) : ce fichier décide,
// `textes-des-refus.ts` dit, et `chargerGroupe` les charge ensemble.
import { dire } from './couture-des-phrases.ts';
import { computeAcoustique } from './acoustique.ts';
import {
  computeMeasureReport,
  effectiveVitrage,
  feuilleteImpose,
  requiredFittings,
} from './structural.ts';
import {
  chargeDeVent,
  epaisseurVerreConseilleeMm,
  fleche,
  inertieProfilCm4,
  inertieRenfortCm4,
} from './mecanique.ts';
import { moduleDe } from './familles/registre.ts';
import {
  computePriseAuVent,
  moteurCompatibleLePlusProche,
  securitesManquantes,
  verifierMoteur,
} from './motorisation.ts';
import { nommerMateriau as nommer, nommerVantaux, nommerZoneVent } from './libelles.ts';
// LA ZONE NORMATIVE (lot 13). Elle décide de ce qui s'applique — et
// surtout de ce qui NE s'applique pas hors d'Europe.
import {
  classementAevApplicable,
  classementEuropeenApplicable,
  expositionSansEmploi,
  reglesDeZone,
} from './zones.ts';

/** Le nombre d'erreurs bloquantes — LE champ comparé par la parité JS↔PHP. */
export function countErrors(issues: ValidationIssue[]): number {
  return issues.filter((issue) => issue.severite === 'erreur').length;
}

function borne(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

function sansOption(options: OptionChoisie[] | undefined, id: string): OptionChoisie[] {
  return (options ?? []).filter((option) => option.id !== id);
}

/**
 * L'épaisseur d'UNE face d'un vitrage courant. Le catalogue vend son verre
 * en épaisseur CUMULÉE — un double fait 8 mm, soit 4 + 4 — mais le vent ne
 * pousse que sur la face extérieure, et c'est elle qui casse. Quatre
 * millimètres, c'est le float standard, celui que toute la filière tient en
 * stock ; tout ce qui dépasse se commande.
 */
const FACE_EXTERIEURE_BASE_MM = 4;

/**
 * Toutes les règles de fabricabilité, rendues d'un coup.
 * Ne lève jamais pour une configuration mal remplie — elle la décrit.
 */
export function validateConfiguration(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const fam = catalog.familles[config.famille];
  if (!fam) {
    return [
      {
        code: 'famille-inconnue',
        severite: 'erreur',
        message: dire('famille-inconnue', [config.famille]),
        alternative: { label: 'Configurer une fenêtre', patch: { famille: 'fenetre' } },
      },
    ];
  }

  // --- Vantaux dans la fourchette de la famille
  const { bornes } = fam;
  if (config.vantaux < bornes.vantauxMin || config.vantaux > bornes.vantauxMax) {
    const vantauxCorriges = borne(config.vantaux, bornes.vantauxMin, bornes.vantauxMax);
    issues.push({
      code: 'vantaux-hors-famille',
      severite: 'erreur',
      message: dire('vantaux-hors-famille', [fam.label, bornes.vantauxMin, bornes.vantauxMax, config.vantaux]),
      alternative: {
        label: `Passer à ${nommerVantaux(vantauxCorriges)}`,
        patch: { vantaux: vantauxCorriges },
      },
    });
  }

  // --- Bornes dimensionnelles : mini de famille, maxi de la matrice.
  // Sous le premier palier de la matrice le prix plancher s'applique (docs/04
  // §1) — le mini ci-dessous est la limite de FABRICATION, plus basse.
  // À LA PIÈCE, IL N'Y A PAS DE MATRICE À LIRE (lot Z0) : `matricePourVantaux`
  // lèverait, et cette fonction ne lève JAMAIS. Les bornes sont alors celles
  // de la FABRICATION — les seules qui existent quand le prix ne vient pas
  // d'un tableau de cotes.
  const aLaPiece = fam.unitePrix === 'piece';
  const matrice = aLaPiece
    ? undefined
    : matricePourVantaux(fam, borne(config.vantaux, bornes.vantauxMin, bornes.vantauxMax));
  // LA BORNE DE LARGEUR vient de la MATRICE — le dernier palier tarifé —
  // sauf sur un ouvrage LINÉAIRE, où la matrice n'a qu'un palier : le mètre
  // de 1000 à 1000 mm », ce qui est exact et absurde. Sa borne est celle de
  // la FABRICATION, dans les bornes de la famille — et cent mètres d'un
  // coup restent un projet à découper en tronçons. À la pièce, même lecture
  // et pour une raison plus forte encore : la cote ne décide d'aucun prix.
  const lineaire = fam.unitePrix === 'metre-lineaire';
  const maxDeFabrication = () =>
    Math.max(
      bornes.minWidthMm,
      ...Object.values(bornes.vantailMaxMm).filter((valeur): valeur is number => valeur !== undefined),
    );
  const maxWidthMm =
    lineaire || aLaPiece ? maxDeFabrication() : matrice!.widthsMm[matrice!.widthsMm.length - 1];
  // LA BORNE DE HAUTEUR. Au tableau, c'est le dernier palier de la matrice —
  // au-delà, la cellule n'est plus tarifée. À la pièce, elle se DÉCLARE : le
  // repli sur la borne de largeur n'avait jamais eu d'appelant, et la première
  // famille à la pièce a montré qu'il confond deux contraintes (voir
  const maxHeightMm = matrice
    ? matrice.heightsMm[matrice.heightsMm.length - 1]
    : (bornes.hauteurMaxMm ?? Math.max(bornes.minHeightMm, maxDeFabrication()));
  if (config.widthMm < bornes.minWidthMm || config.widthMm > maxWidthMm) {
    const largeurCorrigee = borne(config.widthMm, bornes.minWidthMm, maxWidthMm);
    issues.push({
      code: 'largeur-hors-bornes',
      severite: 'erreur',
      message: dire('largeur-hors-bornes', [fam.label, lineaire, config.vantaux, bornes.minWidthMm, maxWidthMm, config.widthMm]),
      alternative: { label: `Ramener à ${largeurCorrigee} mm`, patch: { widthMm: largeurCorrigee } },
    });
  }
  if (config.heightMm < bornes.minHeightMm || config.heightMm > maxHeightMm) {
    const hauteurCorrigee = borne(config.heightMm, bornes.minHeightMm, maxHeightMm);
    issues.push({
      code: 'hauteur-hors-bornes',
      severite: 'erreur',
      message: dire('hauteur-hors-bornes', [fam.label, config.vantaux, bornes.minHeightMm, maxHeightMm, config.heightMm]),
      alternative: { label: `Ramener à ${hauteurCorrigee} mm`, patch: { heightMm: hauteurCorrigee } },
    });
  }

  // --- Matériau disponible pour la famille
  const coefMateriau = fam.coefMateriauMilliemes[config.materiau];
  const materiauxDisponibles = Object.keys(fam.coefMateriauMilliemes) as Array<typeof config.materiau>;
  if (coefMateriau === undefined) {
    issues.push({
      code: 'materiau-indisponible',
      severite: 'erreur',
      message: dire('materiau-indisponible', [fam.label, config.materiau, materiauxDisponibles]),
      alternative: {
        label: `Passer en ${nommer(materiauxDisponibles[0])}`,
        patch: { materiau: materiauxDisponibles[0] },
      },
    });
  }

  // --- La gamme nommée doit exister, et correspondre au matériau
  if (config.systeme !== undefined) {
    const systeme = systemeDe(catalog, config.systeme);
    const disponibles = systemesDuMateriau(catalog, config.famille, config.materiau);
    if (!systeme) {
      issues.push({
        code: 'systeme-inconnu',
        severite: 'erreur',
        message: dire('systeme-inconnu', [config.systeme]),
        alternative: disponibles.length
          ? { label: `Passer à « ${disponibles[0].nom} »`, patch: { systeme: disponibles[0].id } }
          : { label: 'Revenir aux paliers standard', patch: { systeme: undefined } },
      });
    } else if (systeme.materiau !== config.materiau) {
      // Le piège : changer de matériau après avoir choisi sa gamme. Sans
      // cette règle, on vendait un profilé alu facturé en PVC.
      issues.push({
        code: 'systeme-hors-materiau',
        severite: 'erreur',
        message: dire('systeme-hors-materiau', [systeme.nom, systeme.materiau, config.materiau]),
        alternative: disponibles.length
          ? { label: `Passer à « ${disponibles[0].nom} »`, patch: { systeme: disponibles[0].id } }
          : { label: `Passer en ${nommer(systeme.materiau)}`, patch: { materiau: systeme.materiau } },
      });
    }
  }

  // --- Largeur de vantail admissible par matériau (docs/02 §2 : un vantail
  // PVC ne dépasse pas ~900 mm, un vantail alu va plus loin)
  const mesure = computeMeasureReport(config, catalog);
  const vantailMax = fam.bornes.vantailMaxMm[config.materiau];
  if (vantailMax !== undefined && mesure.vantail.widthMm > vantailMax) {
    const materiauPlusLarge = materiauxDisponibles.find(
      (m) => (fam.bornes.vantailMaxMm[m] ?? 0) >= mesure.vantail.widthMm,
    );
    const alternative = materiauPlusLarge
      ? {
          label: `Passer en ${nommer(materiauPlusLarge)} (vantail jusqu'à ${fam.bornes.vantailMaxMm[materiauPlusLarge]} mm)`,
          patch: { materiau: materiauPlusLarge },
        }
      : config.vantaux < bornes.vantauxMax
        ? { label: `Passer à ${config.vantaux + 1} vantaux`, patch: { vantaux: config.vantaux + 1 } }
        : {
            label: `Ramener la largeur à ${vantailMax * config.vantaux} mm`,
            patch: { widthMm: vantailMax * config.vantaux },
          };
    issues.push({
      code: 'vantail-trop-large',
      severite: 'erreur',
      message: dire('vantail-trop-large', [mesure.vantail.widthMm, config.materiau, vantailMax]),
      alternative,
    });
  }
  if (mesure.vantail.widthMm < bornes.vantailMinMm) {
    issues.push({
      code: 'vantail-trop-etroit',
      severite: 'erreur',
      message: dire('vantail-trop-etroit', [mesure.vantail.widthMm, bornes.vantailMinMm]),
      alternative: {
        label: `Ramener à ${bornes.vantailMinMm * config.vantaux} mm de largeur totale`,
        patch: { widthMm: bornes.vantailMinMm * config.vantaux },
      },
    });
  }

  // --- Ouverture autorisée pour la famille
  if (config.ouverture !== undefined && fam.ouvertures && !fam.ouvertures.includes(config.ouverture)) {
    issues.push({
      code: 'ouverture-hors-famille',
      severite: 'erreur',
      message: dire('ouverture-hors-famille', [fam.label, config.ouverture, fam.ouvertures]),
      alternative: { label: `Passer en « ${fam.ouvertures[0]} »`, patch: { ouverture: fam.ouvertures[0] } },
    });
  }
  if (config.ouverture === 'soufflet' && config.vantaux !== 1) {
    issues.push({
      code: 'soufflet-monovantail',
      severite: 'erreur',
      message: dire('soufflet-monovantail'),
      alternative: { label: 'Passer à 1 vantail', patch: { vantaux: 1 } },
    });
  }

  // --- Poids de vitrage et ferrures (docs/02 §3.2)
  const ferrures = requiredFittings(config, catalog);
  if (ferrures === 'hors-limite') {
    // L'alternative doit TENIR : on essaie les patchs du plus proche au plus
    // coûteux et on propose le premier qui repasse sous la limite.
    const candidats: Array<{ label: string; patch: Partial<JoineryConfiguration> }> = [];
    if (config.vitrage?.base === 'triple') {
      candidats.push({
        label: 'Passer en double vitrage à isolation renforcée',
        patch: { vitrage: { ...config.vitrage, base: 'double-itr' } },
      });
    }
    if (config.vantaux < bornes.vantauxMax) {
      candidats.push({
        label: `Répartir sur ${config.vantaux + 1} vantaux`,
        patch: { vantaux: config.vantaux + 1 },
      });
    }
    for (let largeur = config.widthMm - 100; largeur >= bornes.minWidthMm; largeur -= 100) {
      candidats.push({ label: `Ramener la largeur à ${largeur} mm`, patch: { widthMm: largeur } });
    }
    candidats.push({ label: 'Passer en double vitrage', patch: { vitrage: { base: 'double' } } });
    const alternative = candidats.find(
      (candidat) => requiredFittings({ ...config, ...candidat.patch }, catalog) !== 'hors-limite',
    );
    issues.push({
      code: 'vitrage-trop-lourd',
      severite: 'erreur',
      message: dire('vitrage-trop-lourd', [mesure.glassWeightKgParVantail, fam.seuilsFerrures?.renforceKg]),
      alternative,
    });
  } else if (ferrures === 'renforcees') {
    issues.push({
      code: 'ferrures-renforcees',
      severite: 'info',
      message: dire('ferrures-renforcees', [mesure.glassWeightKgParVantail, fam.seuilsFerrures?.standardKg]),
    });
  }

  // --- Feuilleté imposé (allège basse, portes) — docs/02 §3.3
  if (feuilleteImpose(config, catalog) && !config.vitrage?.feuillete) {
    issues.push({
      code: 'feuillete-impose',
      severite: 'info',
      message: dire('feuillete-impose', [
        config.famille === 'fenetre',
        config.hauteurAllegeMm,
        catalog.feuilleteImposeAllegeSousMm,
      ]),
    });
  }

  // --- Exposition et classement AEV (docs/02 §3.4)
  //
  // La règle CITE désormais la grandeur et la borne, au lieu de dire
  // « insuffisant » : la charge de vent se calcule (EN 1991-1-4) et se
  // traduit en classe EN 12210. Un refus qui n'apprend rien est un
  // abandon (compétence `cpq-configurateur-industriel` §2).
  //
  // ELLE NE S'APPLIQUE QUE DANS SON DOMAINE, depuis le lot 13. EN 1991-1-4
  // et EN 12210 sont européens, et les zones de vent employées ici sont
  // FRANÇAISES. Les appliquer à Sydney ou à Chicago donnait un classement
  // juste et hors sujet, que le marchand recopiait sur son devis. Hors
  // d'Europe, `reglesDeZone` dit quel système classe — et dit aussi que ce
  // moteur ne sait pas le calculer.
  // ELLE NE S'APPLIQUE PAS NON PLUS À TOUT OUVRAGE, depuis le lot Z17. Le
  // domaine a DEUX axes, et le lot 13 n'en avait fermé qu'un : mesuré avant
  // correction, `aev-insuffisant` sortait — en ERREUR — sur TRENTE ET UNE
  // `classementAevApplicable` joint les deux axes ; `expositionSansEmploi`
  // dit à l'appelant que son exposition n'a pas servi, au lieu de la jeter en
  // silence.
  if (config.exposition && !classementAevApplicable(config.famille, catalog)) {
    const sansEmploi = expositionSansEmploi(config.famille);
    if (sansEmploi) issues.push(sansEmploi);
  }

  if (config.exposition && classementEuropeenApplicable(catalog)) {
    const etage = config.exposition.etageEleve;
    const vitrage = effectiveVitrage(config, catalog);
    const vent = chargeDeVent(
      config.exposition.zoneVent,
      etage ? 'mer' : 'bocage',
      etage ? 22 : 8,
    );

    // La gamme standard tient la classe 2 — 800 Pa. Au-delà, il faut un
    // profilé plus épais et un renfort, c'est-à-dire une autre gamme.
    if (
      config.gamme === 'standard' &&
      vent.classePression > 2 &&
      classementAevApplicable(config.famille, catalog)
    ) {
      issues.push({
        code: 'aev-insuffisant',
        severite: 'erreur',
        message: dire('aev-insuffisant', [config.exposition.zoneVent, etage, vent.qpPa, vent.classement]),
        alternative: { label: 'Passer en gamme confort', patch: { gamme: 'confort' } },
      });
    }

    // --- L'ÉPAISSEUR DE VERRE sous cette pression (EN 16612)
    //
    // Le catalogue vend un 4/16/4 quelle que soit la surface : c'est le
    // produit courant, et il est juste jusqu'à un mètre carré et demi. Une
    // baie de deux mètres de haut en zone exposée le casse. La règle ne
    // refuse pas — elle DIT la face conseillée, parce que le verrier sait
    // la fournir et que le client a le droit de savoir ce qu'il achète.
    const clair = mesure.clairVitrage;
    if (clair) {
      const surfaceM2 = (clair.widthMm * clair.heightMm) / 1_000_000;
      const conseil = epaisseurVerreConseilleeMm({ surfaceM2, pressionPa: vent.qpPa });
      // La face EXTÉRIEURE est celle qui prend le vent. Le supplément
      // phonique épaissit cette face-là (4/16/4 → 10/16/4) : c'est
      // exactement le levier qui sert aussi au dimensionnement.
      const faceMm = FACE_EXTERIEURE_BASE_MM + (vitrage?.phonique ? catalog.verre.phoniqueSupplementMm : 0);
      if (faceMm < conseil.faceExterieureMm) {
        issues.push({
          code: 'verre-sous-dimensionne',
          severite: conseil.etudeRequise ? 'erreur' : 'avertissement',
          message: dire('verre-sous-dimensionne', [
            surfaceM2,
            vent.qpPa,
            faceMm,
            conseil.faceExterieureMm,
            conseil.etudeRequise,
          ]),
          ...(conseil.etudeRequise || vitrage?.phonique
            ? {}
            : {
                alternative: {
                  label: 'Passer en vitrage asymétrique (face 10 mm)',
                  patch: { vitrage: { ...(vitrage ?? { base: 'double' }), phonique: true } },
                },
              }),
        });
      }
    }

    // --- LA FLÈCHE du montant le plus chargé (EN 12210, classe C)
    //
    // C'est le refus que le métier formule en « renfort au-delà d'un
    // mètre ». Ce n'est pas une convention commerciale : c'est
    // f = 5wL⁴/384EI arrondie. On la calcule donc, au lieu de la réciter.
    //
    // Et on la calcule DEUX FOIS, ce qui est tout l'intérêt : une menuiserie
    // PVC est TOUJOURS renforcée passé le mètre — c'est le produit, pas un
    // défaut. Ne calculer que le profilé nu faisait crier au renfort sur une
    // fenêtre de 1200×1400 abritée, et une alerte qui sonne toujours ne dit
    // plus rien. On distingue donc « il faut le renfort » (une info : il est
    // au débit) de « même renforcé, ça fléchit » (là, il faut l'étude).
    const profondeurMm =
      systemeDe(catalog, config.systeme)?.epaisseurMm ??
      catalog.profils.epaisseurMm[config.materiau][config.gamme];
    if (mesure.chaineDeCotes) {
      const commun = {
        pressionPa: vent.qpPa,
        porteeMm: mesure.chaineDeCotes.dimensionFabrication.heightMm,
        // Le montant intermédiaire reprend une demi-largeur de vantail de
        // chaque côté ; le montant de rive, une seule. On prend le cas
        // chargé, qui est celui qui décide du renfort.
        largeurTributaireMm: mesure.vantail.widthMm,
        materiau: config.materiau,
        inertieCm4: inertieProfilCm4({
          materiau: config.materiau,
          profondeurMm,
          largeurMm: mesure.chaineDeCotes.masseVueMm,
        }),
      };
      const renfortCm4 = inertieRenfortCm4(config.materiau, profondeurMm);
      const nu = fleche(commun);
      const renforce = fleche({ ...commun, renfortCm4 });
      const portee = commun.porteeMm;
      if (renforce.renfortRequis) {
        // Même avec le plus gros tube qui entre dans la chambre, ça fléchit.
        // Ce n'est plus un choix de débit, c'est une limite de gamme.
        issues.push({
          code: 'fleche-excessive',
          severite: 'erreur',
          message: dire('fleche-renforcee', [
            portee,
            config.materiau,
            vent.qpPa,
            renforce.flecheMm,
            renforce.admissibleMm,
          ]),
          ...(config.gamme !== 'performance'
            ? {
                alternative: {
                  label: 'Passer en gamme performance (profilé plus profond)',
                  patch: { gamme: 'performance' },
                },
              }
            : {}),
        });
      } else if (nu.renfortRequis && renfortCm4 > 0) {
        issues.push({
          code: 'renfort-acier-impose',
          severite: 'info',
          message: dire('renfort-acier-impose', [
            portee,
            vent.qpPa,
            Math.round(profondeurMm - 2 * 2 - 10),
            renfortCm4,
            nu.flecheMm,
            nu.admissibleMm,
          ]),
        });
      } else if (nu.renfortRequis) {
        // Le bois n'a pas de chambre : on ne le renforce pas, on l'épaissit.
        issues.push({
          code: 'fleche-excessive',
          severite: 'avertissement',
          message: dire('fleche-bois', [portee, config.materiau, vent.qpPa, nu.flecheMm, nu.admissibleMm]),
        });
      }
    }
  }

  // --- LE GARDE-FOU ACOUSTIQUE (docs/15 lot 1)
  //
  // C'est la seule règle de ce fichier qui protège le client contre une
  // VENTE plutôt que contre un défaut de fabrication, et elle a sa place
  // ici pour cette raison : un client qui prend le triple vitrage pour le
  // bruit paie un supplément qui ne lui rendra rien. Trois verres minces et
  // deux lames d'air résonnent ensemble.
  //
  // Elle est en `info` et non en `avertissement` : le triple vitrage n'est
  // pas une erreur — il est excellent pour la thermique, qui est ce qu'on
  // lui demande. Ce qui serait une erreur, c'est de le laisser croire
  // meilleur qu'un asymétrique pour le bruit, alors qu'il lui est
  // inférieur et plus cher.
  const acoustique = computeAcoustique(config, catalog);
  if (acoustique?.avertissement) {
    const asymetrique = computeAcoustique(
      { ...config, vitrage: { ...(effectiveVitrage(config, catalog) ?? { base: 'double' }), base: 'double', phonique: true } },
      catalog,
    );
    issues.push({
      code: 'triple-vitrage-acoustique',
      severite: 'info',
      message: dire('triple-vitrage-acoustique', [
        acoustique.avertissement,
        acoustique.rwFenetreDb,
        asymetrique?.rwFenetreDb,
      ]),
      ...(asymetrique && asymetrique.rwFenetreDb > acoustique.rwFenetreDb
        ? {
            alternative: {
              label: `Passer en double asymétrique (${asymetrique.rwFenetreDb} dB)`,
              patch: {
                vitrage: {
                  ...(effectiveVitrage(config, catalog) ?? { base: 'double' }),
                  base: 'double',
                  phonique: true,
                },
              },
            },
          }
        : {}),
    });
  }

  // --- LES POSTES D'UN OUVRAGE VENDU À LA PIÈCE (lot Z0)
  //
  // C'est ICI que se dit ce que `sommeDesPostes` a refusé de chiffrer. Le
  // prix reste défini — l'écran ne casse pas pendant que le client corrige —
  // qui porte une erreur.
  //
  // SANS CE BLOC, un poste sans prix unitaire déclaré disparaîtrait du devis
  // EN SILENCE, et le total serait plus bas de ce qu'on ne sait pas. Un total
  // amputé sans un mot n'est pas seulement faux : il est plausible.
  //
  // CE QUI N'EST PAS ICI, ET OÙ C'EST : « des postes sur une famille qui se
  // vend au tableau ». C'est une incohérence de CATALOGUE, pas de
  // configuration — `catalog.test.ts` la refuse sur le catalogue par défaut
  // ici l'aurait fait payer, en octets de chargement initial, à tout visiteur
  // venu pour une fenêtre, pour un cas qu'aucune configuration ne produit.
  if (fam.unitePrix === 'piece') {
    issues.push(...refusDesPostesSiCharge(fam, config));
  }

  // --- Cohérence des options (docs/02 §3.5)
  const options = config.options ?? [];
  const ids = options.map((option) => option.id);
  for (const choisie of options) {
    const def = optionDef(catalog, choisie.id);
    if (!def) {
      issues.push({
        code: 'option-inconnue',
        severite: 'erreur',
        message: dire('option-inconnue', [choisie.id]),
        alternative: { label: "Retirer l'option", patch: { options: sansOption(options, choisie.id) } },
      });
      continue;
    }
    if (!def.familles.includes(config.famille)) {
      issues.push({
        code: 'option-hors-famille',
        severite: 'erreur',
        message: dire('option-hors-famille', [def.label, fam.label]),
        alternative: { label: "Retirer l'option", patch: { options: sansOption(options, choisie.id) } },
      });
      continue;
    }
    if (def.unite === 'parVantail' && (choisie.quantite ?? 1) > config.vantaux) {
      issues.push({
        code: 'option-quantite-excessive',
        severite: 'erreur',
        message: dire('option-quantite-excessive', [def.label, choisie.quantite, config.vantaux]),
        alternative: {
          label: `Équiper ${nommerVantaux(config.vantaux)}`,
          patch: {
            options: options.map((option) =>
              option.id === choisie.id ? { ...option, quantite: config.vantaux } : option,
            ),
          },
        },
      });
    }
  }
  const ouvertureEffective = config.ouverture ?? fam.ouvertures?.[0];
  if (ids.includes('oscillo-battant') && ouvertureEffective !== 'frappe') {
    issues.push({
      code: 'oscillo-battant-incompatible',
      severite: 'erreur',
      message: dire('oscillo-battant-incompatible', [ouvertureEffective]),
      alternative: { label: "Retirer l'option", patch: { options: sansOption(options, 'oscillo-battant') } },
    });
  }
  // On ne pose jamais deux grilles sur la même baie.
  const grilles = ids.filter((id) => id.startsWith('grille-') && id !== 'grille-ventilation');
  if (grilles.length > 1) {
    issues.push({
      code: 'grilles-multiples',
      severite: 'erreur',
      message: dire('grilles-multiples'),
      alternative: {
        label: `Garder « ${optionDef(catalog, grilles[0])?.label ?? grilles[0]} »`,
        patch: {
          options: options.filter(
            (option) =>
              option.id === grilles[0] ||
              !option.id.startsWith('grille-') ||
              option.id === 'grille-ventilation',
          ),
        },
      },
    });
  }

  const motorisations = ids.filter((id) => id.startsWith('motorisation-'));
  if (motorisations.length > 1) {
    issues.push({
      code: 'motorisations-multiples',
      severite: 'erreur',
      message: dire('motorisations-multiples'),
      alternative: {
        label: `Garder « ${motorisations[0]} »`,
        patch: { options: options.filter((option) => option.id === motorisations[0] || !option.id.startsWith('motorisation-')) },
      },
    });
  }
  if (
    motorisations.length === 1 &&
    (config.famille === 'fenetre' || config.famille === 'porte-fenetre') &&
    !ids.includes('bloc-baie-manuel')
  ) {
    issues.push({
      code: 'motorisation-sans-volet',
      severite: 'erreur',
      message: dire('motorisation-sans-volet'),
      alternative: {
        label: 'Ajouter le volet bloc-baie',
        patch: { options: [...options, { id: 'bloc-baie-manuel' }] },
      },
    });
  }
  if (ids.includes('moustiquaire') && ids.includes('bloc-baie-manuel') && config.gamme === 'standard') {
    issues.push({
      code: 'moustiquaire-bloc-baie',
      severite: 'erreur',
      message: dire('moustiquaire-bloc-baie'),
      alternative: { label: 'Passer en gamme confort', patch: { gamme: 'confort' } },
    });
  }

  // --- La pose : ce qui a été mesuré, et ce qu'il en reste
  // Elle ne bloque presque jamais. Elle DIT — parce qu'une cote prise pour
  // une pose et fabriquée pour une autre donne une menuiserie qui ne rentre
  // pas, et que le client ne l'apprendra que le jour de la livraison.
  if (config.pose !== undefined && !poseApplicable(catalog, config.famille)) {
    issues.push({
      code: 'pose-sans-objet',
      severite: 'avertissement',
      message: dire('pose-sans-objet', [fam.label]),
    });
  }
  if (config.pose !== undefined && catalog.poses[config.pose] === undefined) {
    issues.push({
      code: 'pose-inconnue',
      severite: 'erreur',
      message: dire('pose-inconnue', [config.pose]),
      alternative: { label: 'Poser en neuf, au tableau', patch: { pose: 'neuf-tableau' } },
    });
  }

  if (poseApplicable(catalog, config.famille)) {
    const pose = posePourFamille(catalog, config.famille, config.pose);
    const mesure = computeMeasureReport(config, catalog);

    // La tapée : une pièce qui n'a de sens qu'en applique.
    if (config.tapeeMm !== undefined && !pose.tapee) {
      issues.push({
        code: 'tapee-sans-applique',
        severite: 'avertissement',
        message: dire('tapee-sans-applique', [pose.label]),
        alternative: { label: 'Passer en pose applique', patch: { pose: 'applique' } },
      });
    } else if (config.tapeeMm !== undefined && tapeeDe(catalog, config.tapeeMm) === undefined) {
      const proche = tapeeLaPlusProche(catalog, config.tapeeMm);
      issues.push({
        code: 'tapee-inconnue',
        severite: 'erreur',
        message: dire('tapee-inconnue', [config.tapeeMm, catalog.tapees]),
        alternative: {
          label: `Tapée ${proche.epaisseurMm} mm`,
          patch: { tapeeMm: proche.epaisseurMm },
        },
      });
    } else if (pose.tapee && config.tapeeMm === undefined) {
      // Sans tapée, le dormant s'arrête au nu de la maçonnerie et laisse
      // l'épaisseur du doublage à nu : ce n'est pas infabricable, c'est
      // inachevé. D'où un avertissement, jamais un refus.
      const defaut = catalog.tapees[1] ?? catalog.tapees[0];
      issues.push({
        code: 'applique-sans-tapee',
        severite: 'avertissement',
        message: dire('applique-sans-tapee'),
        alternative: {
          label: `Tapée ${defaut.epaisseurMm} mm`,
          patch: { tapeeMm: defaut.epaisseurMm },
        },
      });
    }

    // La rénovation : dire ce qu'on perd AVANT de vendre, jamais après.
    if (mesure.clairPerduParCoteMm > 0) {
      const perdu = mesure.clairPerduParCoteMm;
      issues.push({
        code: 'renovation-clair-reduit',
        severite: 'info',
        message: dire('renovation-clair-reduit', [perdu]),
        alternative: {
          label: "Déposer l'ancien dormant",
          patch: { pose: 'depose-totale' },
        },
      });
      // Et quand ce qui reste devient déraisonnable, le dire plus fort.
      if (mesure.clairVitrage && mesure.clairVitrage.widthMm < 400) {
        issues.push({
          code: 'renovation-clair-critique',
          severite: 'avertissement',
          message: dire('renovation-clair-critique', [mesure.clairVitrage.widthMm]),
          alternative: {
            label: "Déposer l'ancien dormant",
            patch: { pose: 'depose-totale' },
          },
        });
      }
    }
  } else if (config.tapeeMm !== undefined) {
    issues.push({
      code: 'tapee-sans-objet',
      severite: 'avertissement',
      message: dire('tapee-sans-objet', [fam.label]),
    });
  }

  // --- Champs sans objet pour la famille — ignorés, mais dits
  if (config.hauteurAllegeMm !== undefined && config.famille !== 'fenetre') {
    issues.push({
      code: 'allege-sans-objet',
      severite: 'avertissement',
      message: dire('allege-sans-objet'),
    });
  }
  // L'imposte s'ouvre à la porte d'entrée : l'imposte vitrée au-dessus de
  // la porte est un classique du pavillon, elle éclaire l'entrée, et le
  // dessin la traitait déjà comme n'importe quel fixe haut. Seul ce refus
  // l'interdisait.
  const familleAImposte =
    config.famille === 'fenetre' ||
    config.famille === 'porte-fenetre' ||
    config.famille === 'porte-entree';
  if (config.imposteHauteurMm !== undefined && !familleAImposte) {
    issues.push({
      code: 'imposte-sans-objet',
      severite: 'avertissement',
      message: dire('imposte-sans-objet'),
    });
  }

  // Le BLOC-BAIE n'est pas un volet, c'est une FENÊTRE. Son coffre est
  // solidaire du dormant de la menuiserie et se pose avec elle, d'une seule
  // main : commander un bloc-baie sans menuiserie, c'est commander un
  // dormant sans sa fenêtre. Le refus porte donc l'alternative qui existe
  // vraiment — le coffre extérieur, celui qu'on ajoute sur une baie en
  // place — et l'écran rappelle l'autre chemin, l'option bloc-baie sur la
  // fenêtre elle-même.
  if (config.famille === 'volet-roulant' && config.coffre === 'bloc-baie') {
    issues.push({
      code: 'bloc-baie-sans-menuiserie',
      severite: 'erreur',
      message: dire('bloc-baie-sans-menuiserie'),
      alternative: {
        label: 'Passer en coffre extérieur',
        patch: { coffre: 'exterieur' },
      },
    });
  }

  // ---- LES REFUS PROPRES À LA FAMILLE ----
  //
  // manœuvre d'un volet roulant sont partis dans leurs modules de famille :
  // une fenêtre n'oppose aucun de ces refus, et elle en téléchargeait le
  // code. Voir `ModuleFamille.regles`.
  //
  // Un groupe non chargé n'en oppose aucun, ce qui est cohérent : sans son
  // module, une famille ne se valide pas — elle se refuse, et c'est
  // `refusFamilleNonChargee` qui le dit, plus haut.
  const moduleFamille = moduleDe(config.famille);
  if (moduleFamille?.regles) issues.push(...moduleFamille.regles({ config, catalog }));

  // LES REFUS DE FORME sont partis dans `familles/partages/formes.ts`, et
  // menuiserie RECTANGULAIRE -- l'écrasante majorité -- ne les exécutait
  // jamais et en téléchargeait le code : c'est le même raisonnement qui
  // avait sorti leur TRACÉ de l'entrée au lot « physique ».

  // --- Le modèle de porte
  if (config.modelePorte !== undefined && config.famille !== 'porte-entree') {
    issues.push({
      code: 'modele-porte-sans-objet',
      severite: 'avertissement',
      message: dire('modele-porte-sans-objet', [fam.label]),
    });
  } else if (
    config.modelePorte !== undefined &&
    modelePorteDe(catalog, config.famille, config.modelePorte) === undefined
  ) {
    issues.push({
      code: 'modele-porte-inconnu',
      severite: 'erreur',
      message: dire('modele-porte-inconnu', [config.modelePorte]),
      alternative: {
        label: 'Revenir au panneau uni',
        patch: { modelePorte: catalog.modelesPorte[0]?.id },
      },
    });
  }
  // Un décor de panneau sur une porte toute vitrée n'a nulle part où se
  // poser : on le dit AVANT la vente, avec la porte qui le porterait.
  const modelePorte = modelePorteDe(catalog, config.famille, config.modelePorte);
  if (
    modelePorte &&
    Object.keys(modelePorte.decor).length > 0 &&
    (config.remplissagePorte ?? 'pleine') === 'vitree'
  ) {
    issues.push({
      code: 'modele-porte-sans-panneau',
      severite: 'avertissement',
      message: dire('modele-porte-sans-panneau', [modelePorte.nom]),
      alternative: { label: 'Passer en semi-vitrée', patch: { remplissagePorte: 'semi-vitree' } },
    });
  }
  if (config.vitrage !== undefined && !fam.vitree && config.famille !== 'porte-entree') {
    issues.push({
      code: 'vitrage-sans-objet',
      severite: 'avertissement',
      message: dire('vitrage-sans-objet', [fam.label]),
    });
  }

  // --- Quantité
  if (config.quantite !== undefined && (!Number.isInteger(config.quantite) || config.quantite < 1)) {
    issues.push({
      code: 'quantite-invalide',
      severite: 'erreur',
      message: dire('quantite-invalide', [config.quantite]),
      alternative: { label: 'Revenir à 1', patch: { quantite: 1 } },
    });
  }

  // --- LA ZONE NORMATIVE, en DERNIER. Elle ne calcule rien : elle dit ce
  // qui s'applique là où le marchand vend, refuse ce qui n'y a pas cours,
  // et nomme ce qui manque. En France — le défaut —, elle ne dit rien du
  // tout, et aucun devis existant ne change d'une ligne.
  issues.push(...reglesDeZone({ config, catalogue: catalog }));

  return issues;
}
