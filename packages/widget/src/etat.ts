/**
 * Pourquoi ce fichier existe : l'état du configurateur et ses transitions.
 * Une seule source — `JoineryConfiguration` — dont TOUT le reste (prix,
 * refus, Uw, dessin) est dérivé à chaque rendu par `@ahjc/core`. Aucune
 * valeur calculée n'est stockée : un prix mémorisé est un prix qui ment.
 *
 * Solution écartée : un état par écran (dimensions ici, vitrage là) recollé
 * à la fin. C'est ainsi qu'un écran affiche un prix que l'autre ignore. Le
 * réducteur ci-dessous ne connaît que des configurations complètes, et le
 * changement de famille RECONSTRUIT une configuration valide au lieu de
 * porter les champs d'une famille vers une autre qui ne les comprend pas.
 *
 * Incident fondateur : « le prix du navigateur n'écrit jamais une commande »
 * (docs/00 §8). Ce module calcule pour AFFICHER ; la phase 4 recalculera
 * côté serveur avant d'écrire quoi que ce soit — d'où l'envoi, dans le
 * panier, de la configuration entière et non d'un montant.
 */

import {
  chargerFamille,
  computeElevation,
  configurationParDefaut,
  computePrice,
  finaliser,
  ValeurInconnueError,
  computeAcoustique,
  computeUw,
  critereTechniqueAides,
  seuilsAidesDe,
  familleCatalog,
  familleChargee,
  posePourFamille,
  systemeDe,
  systemesDuMateriau,
  validateConfiguration,
  type FamilleId,
  type JoineryConfiguration,
  type Materiau,
  type OptionChoisie,
  type OptionId,
  type PricingCatalog,
} from '@ahjc/core';
import type { EtatDesCotes, ReleveTroisPoints } from '@ahjc/core';
import type { Preset } from './host-context.ts';

export async function attendreFamille(famille: FamilleId): Promise<void> {
  if (familleChargee(famille)) return;
  await chargerFamille(famille);
}

/**
 * LA CONFIGURATION NEUVE vient du cœur, et elle est REDONNÉE ici.
 *
 * Elle vivait dans ce fichier tant que seuls des écrans l'appelaient. Le
 * lecteur de bordereau (`core/src/bordereau.ts`) reçoit quarante lignes qui
 * ne portent que des cotes, et il lui faut exactement la même recette :
 * premier matériau de la famille, système du marchand, vitrage si la
 * famille est vitrée. Deux recettes auraient divergé au premier champ
 * ajouté au catalogue, et une configuration à demi remplie ne plante pas —
 * elle se chiffre faux.
 *
 * Elle est réexportée depuis ce module parce que c'est ici que les écrans
 * la cherchent, et qu'un import déplacé n'apprend rien à personne.
 */
export { configurationParDefaut } from '@ahjc/core';

/**
 * Les dimensions proposées d'un clic. Le marchand les fournit ; à défaut,
 * elles sont LUES DANS LA MATRICE (des paliers réels, jamais des chiffres
 * inventés) — la règle « préréglages d'abord » du parcours (docs/02 §6).
 *
 * Et elles sont VÉRIFIÉES contre la configuration courante avant d'être
 * proposées. Une matrice de prix monte jusqu'à ce que le matériau le plus
 * large sait faire ; le matériau par défaut, lui, est souvent le PVC. Le
 * dernier palier de la matrice donnait donc un bouton « dimensions
 * courantes » qui menait tout droit à « Vantail de 1200 mm : le PVC admet
 * 900 mm au plus » — sur 13 des 16 couples famille/vantaux du catalogue.
 * Un palier de PRIX n'est pas une dimension FABRICABLE.
 */
export function presetsParDefaut(config: JoineryConfiguration, catalogue: PricingCatalog): Preset[] {
  const fam = catalogue.familles[config.famille];
  // UNE FAMILLE VENDUE À LA PIÈCE N'A PAS DE MATRICE (lot Z0) : ses cotes ne
  // décident d'aucun prix, et il n'y a donc PAS de « dimensions courantes »
  // à proposer. Aucun préréglage plutôt qu'un préréglage inventé.
  const matrice = fam.matrices?.[String(config.vantaux)] ?? Object.values(fam.matrices ?? {})[0];
  if (!matrice) return [];

  // UN REFUS ÉTRANGER AUX COTES NE TRIE PAS LES COTES. Une motorisation sans
  // volet est refusée sur toutes les cellules : la liste tombait à zéro. Un code
  // présent sur la configuration de départ ET sur chaque cellule ne dépend pas
  // des cotes — il est ignoré ; tout autre code écarte la cellule.
  const erreurs = (c: JoineryConfiguration) =>
    validateConfiguration(c, catalogue).filter((issue) => issue.severite === 'erreur').map((issue) => issue.code);
  let communs = new Set(erreurs(config));
  const candidats: Array<[Preset, string[]]> = [];
  const vus = new Set<string>();
  for (const widthMm of matrice.widthsMm) {
    for (const heightMm of matrice.heightsMm) {
      const label = `${widthMm} × ${heightMm}`;
      if (vus.has(label)) continue;
      vus.add(label);
      const codes = erreurs({ ...config, widthMm, heightMm });
      communs = new Set(codes.filter((code) => communs.has(code)));
      candidats.push([{ label, widthMm, heightMm }, codes]);
    }
  }
  const fabricables = candidats.filter(([, codes]) => codes.every((code) => communs.has(code))).map(([preset]) => preset);
  if (fabricables.length === 0) return [];

  // Trois tailles bien écartées : la plus petite, une médiane, la plus
  // grande — triées par surface pour que l'écart se voie.
  fabricables.sort((a, b) => a.widthMm * a.heightMm - b.widthMm * b.heightMm);
  const choisis = [
    fabricables[0],
    fabricables[Math.floor(fabricables.length / 2)],
    fabricables[fabricables.length - 1],
  ];
  return choisis.filter((preset, index) => choisis.findIndex((autre) => autre.label === preset.label) === index);
}

/**
 * La clé d'une ligne de panier — lisible, pour que l'hôte la retrouve et
 * rouvre la ligne (`editCartItemKey`), et unique parce que le numéro vient
 * d'un compteur qui ne redescend jamais.
 */
export function cleDeLigne(config: JoineryConfiguration, numero: number): string {
  return `${config.famille}-${config.widthMm}x${config.heightMm}-${numero}`;
}

/** Une ligne du panier — la configuration voyage entière, jamais un montant. */
export interface LignePanier {
  cle: string;
  config: JoineryConfiguration;
  quantite: number;
  /**
   * LE LOCAL et LE REPÈRE DU PLAN, quand la ligne vient d'un BORDEREAU.
   *
   * Ils n'entrent dans aucun calcul, et c'est justement pourquoi ils
   * voyagent : un lot repéré B12, ESC-04, PIG-2 l'a été sur des plans, et
   * ces trois-là sont le seul lien entre le devis, l'étiquette, le colis et
   * la porte devant laquelle il faut le déposer. Une ligne ajoutée depuis
   * le configurateur n'en a pas, et retombe sur le repérage M1…Mn.
   *
   * Ce sont les mêmes champs que `LigneProjet` du cœur, et c'est voulu : le
   * panier se passe tel quel à `computeProjet` et à `computeDoe`.
   */
  piece?: string;
  repere?: string;
}

/**
 * CE QUE LE CLIENT DÉCLARE DE SA SITUATION, et que le configurateur ne peut
 * pas deviner.
 *
 * ELLE VIT DANS L'ÉTAT ET NON DANS UN PANNEAU, et c'est une correction.
 * Deux écrans en ont besoin — celui des aides et celui d'après la signature
 * — et deux d'entre eux posent LA MÊME question : « remplacez-vous du
 * simple vitrage ? ». Elle décide de MaPrimeRénov' d'un côté et de
 * l'éco-PTZ de l'autre. Laissée dans un `useState` local, elle se répondait
 * deux fois, et rien n'empêchait les deux réponses de diverger — sur un
 * écran où l'une ouvre un droit que l'autre refuse.
 *
 * Tous les champs sont FACULTATIFS, et leur absence n'est pas un défaut :
 * c'est « je ne sais pas », que les deux modules du cœur savent traiter et
 * disent en toutes lettres. Un défaut optimiste — « oui » partout — aurait
 * annoncé des aides que le dossier refuse.
 */
export interface SituationClient {
  /** La tranche de revenus de l'Anah — elle décide du montant ET du plafond. */
  tranche?: 'tres-modestes' | 'modestes' | 'intermediaires' | 'superieurs';
  logementDePlusDe15Ans?: boolean;
  /** Condition du geste isolé, ET condition propre à l'éco-PTZ. */
  remplaceSimpleVitrage?: boolean;
  artisanRge?: boolean;
  /** Qui pose — la question qui décide de la moitié des garanties. */
  poseParLePro?: boolean;
}

export interface RaccordementDeclare {
  avecKit?: boolean;
  kitInjectionW?: number;
  kitSurCircuitDedie?: boolean;
  kitMicroOnduleurCertifie?: boolean;

  avecBatterie?: boolean;
  batterieCapaciteKwh?: number;
  batterieLocalDedie?: boolean;
  batterieReferenceOnduleur?: string;
  batterieReferenceBatterie?: string;

  avecRecharge?: boolean;
  rechargePuissanceKw?: number;
  rechargeQualifieIrve?: boolean;
  rechargeGestionDynamique?: boolean;

  /** La puissance souscrite au compteur, en kVA. */
  abonnementKva?: number;
  /** La part autoconsommée, en millièmes. Déclarée, ou pas de chiffre. */
  tauxAutoconsommationMilliemes?: number;
}

export interface EtatWidget {
  config: JoineryConfiguration;
  /**
   * Ce que le client a déclaré de sa situation. Partagé par l'écran des
   * aides et par celui d'après la signature : voir `SituationClient`.
   */
  situation: SituationClient;
  /** Ce que le client a déclaré de son raccordement — voir `RaccordementDeclare`. */
  raccordement: RaccordementDeclare;
  /** L'étape ouverte dans le panneau (1 à 7) — une décision par écran. */
  etape: number;
  /**
   * La vue ouverte. `plan` est la vue de dessus d'un ouvrage linéaire — la
   * seule projection que ce cœur ne savait pas produire avant le lot 4, et
   * celle qui évite les litiges de pose.
   */
  vue: '2d' | 'plan' | 'facade' | '3d' | 'ar' | 'photo';
  panier: LignePanier[];
  /** Vrai quand le tiroir de détail du prix est ouvert. */
  detailOuvert: boolean;
  /**
   * La famille demandée dont le module n'est pas encore arrivé. L'écran le
   * DIT plutôt que de paraître figé : un configurateur qui ne répond pas au
   * clic passe pour cassé, même une demi-seconde.
   */
  familleEnAttente: FamilleId | null;
  /**
   * La famille dont le module N'EST PAS ARRIVÉ — réseau coupé, morceau
   * absent du serveur du marchand, coupure entre deux déploiements.
   *
   * Sans cet état, `attendreFamille()` rejetait dans le vide : la tuile
   * restait sur « chargement… » pour toujours, et le client attendait un
   * écran qui ne viendrait jamais. Un configurateur qui ne répond pas passe
   * pour cassé — un configurateur qui DIT qu'il n'a pas pu charger reste un
   * configurateur.
   */
  familleIndisponible: FamilleId | null;
  /**
   * Le numéro de la PROCHAINE ligne de panier. Il ne redescend jamais, même
   * après un retrait : numéroter sur le nombre de lignes faisait réapparaître
   * une clé déjà prise (ajouter, ajouter, retirer la première, ajouter), et
   * « Retirer » effaçait alors les deux lignes qui la partageaient. Un
   * compteur, pas une horloge ni un tirage : l'état reste reproductible.
   */
  sequence: number;
  /**
   * LE RELEVÉ AUX TROIS POINTS, quand le client l'a fait.
   *
   * Il vit ICI et pas dans la configuration, et c'est la même séparation que
   * pour l'état des cotes : la configuration décrit un PRODUIT, le relevé
   * décrit ce qu'on sait du MUR. Deux menuiseries identiques peuvent être
   * l'une relevée sur place et l'autre saisie au téléphone.
   *
   * `null` tant qu'on n'a que deux nombres — et c'est le cas de départ.
   */
  releve: ReleveTroisPoints | null;
  /**
   * L'ÉTAT DES COTES — `declaree` tant qu'on n'a que deux nombres saisis.
   *
   * Il est STOCKÉ et pas dérivé, pour la même raison que la cote retenue :
   * le dériver ici ferait entrer `metrage.ts` dans le chargement initial,
   * pour une valeur que l'écran du relevé a déjà calculée. C'est lui qui
   * l'envoie, avec le relevé.
   */
  etatDesCotes: EtatDesCotes;
}

export type Action =
  | { type: 'famille'; famille: FamilleId }
  | { type: 'attente'; famille: FamilleId | null }
  | { type: 'attente-echouee'; famille: FamilleId }
  | { type: 'etape'; etape: number }
  | { type: 'vue'; vue: EtatWidget['vue'] }
  | { type: 'detail' }
  /**
   * UNE DÉCLARATION DU CLIENT SUR SA SITUATION. Elle ne touche jamais la
   * configuration : la tranche de revenus ne change pas la fenêtre, elle
   * change ce qu'elle peut ouvrir.
   */
  | { type: 'situation'; patch: Partial<SituationClient> }
  | { type: 'raccordement'; patch: Partial<RaccordementDeclare> }
  | { type: 'champ'; patch: Partial<JoineryConfiguration> }
  | { type: 'option'; option: OptionId; actif: boolean; quantite?: number }
  | { type: 'panier-ajouter' }
  /**
   * UN LOT ENTIER, importé d'un bordereau. Il AJOUTE au chantier plutôt que
   * de le remplacer : un bailleur qui importe le lot d'un bâtiment puis
   * celui du suivant fait un seul devis, et écraser le premier serait un
   * geste qu'on ne peut pas défaire.
   */
  | { type: 'lot-importer'; lignes: Array<Omit<LignePanier, 'cle'>> }
  | { type: 'panier-retirer'; cle: string }
  | { type: 'panier-quantite'; cle: string; quantite: number }
  /**
   * Applique une teinte ou un matériau à TOUTES les lignes du chantier. Un
   * GESTE, pas une contrainte : chaque ligne reste ensuite maîtresse d'elle
   * même, et le client peut repasser sa porte en bois sans sortir du projet.
   */
  /**
   * LE GESTE DU PROJET — une teinte, un matériau, appliqués à tout le
   * chantier. Il porte les LIGNES DÉJÀ FAITES et non les paramètres : voir
   * le cas du réducteur, qui dit ce que l'autre forme coûtait au chargement
   * initial de tout le monde.
   */
  | { type: 'projet-harmoniser'; lignes: LignePanier[] }
  /**
   * LE RELEVÉ. Il ne remplace pas la configuration : il l'ALIMENTE. La cote
   * retenue — la plus petite des trois, jamais la moyenne — descend dans
   * `widthMm`/`heightMm`, et le relevé reste à côté pour dire d'où elle
   * vient et ce qu'elle vaut.
   *
   * `null` efface le relevé et rend les cotes à la saisie directe : un
   * client qui s'est trompé de mur doit pouvoir repartir.
   */
  | {
      type: 'releve';
      releve: ReleveTroisPoints | null;
      /**
       * La cote retenue, calculée PAR L'ÉCRAN qui a déjà le rapport. Absente
       * quand le relevé bloque — voir le commentaire du réducteur.
       */
      coteRetenue?: { widthMm: number; heightMm: number };
      /** L'état auquel ce relevé donne droit, calculé par l'écran. */
      etatDesCotes?: EtatDesCotes;
    };

function basculerOption(
  options: OptionChoisie[] | undefined,
  option: OptionId,
  actif: boolean,
  quantite?: number,
): OptionChoisie[] {
  const sans = (options ?? []).filter((choisie) => choisie.id !== option);
  if (!actif) return sans;
  return [...sans, quantite !== undefined ? { id: option, quantite } : { id: option }];
}

export function reducteur(catalogue: PricingCatalog) {
  return function reduire(etat: EtatWidget, action: Action): EtatWidget {
    switch (action.type) {
      case 'famille':
        // Changer de famille RECONSTRUIT : les champs d'une fenêtre n'ont
        // pas de sens sur un store, et les traîner produirait des refus
        // incompréhensibles (« l'allège ne concerne que les fenêtres »).
        //
        // ET ELLE NE CHANGE PLUS D'ÉTAPE — lot D19, et c'est une correction.
        // Cette ligne portait `etape: 2` : choisir une famille refermait donc
        // la liste des trente-neuf tuiles et ouvrait les dimensions. Une
        // avance automatique économise un clic ; MESURÉ dans le navigateur,
        // elle coûtait au client sa place dans la page — tuile cliquée à
        // 269 px du haut d'une fenêtre de 598, document de 2 572 px tombé à
        // 2 087, et l'en-tête de l'étape qui s'ouvre arrivant à **−122 px**,
        // hors écran PAR LE HAUT.
        //
        // C'EST LE SEUL DES VINGT-NEUF BOUTONS DU PANNEAU QU'ON NE POUVAIT PAS
        // COMPENSER, parce que c'est le seul qui ferme SON PROPRE corps : la
        // tuile cliquée n'existe plus après le rendu, il n'y a plus rien dont
        // on puisse rattraper l'écart, et garder fixe l'en-tête de son étape
        // envoie la suivante hors du cadre dès que le client avait défilé dans
        // la liste. Quand une mise en page ne peut pas être compensée, la
        // question n'est pas comment la rattraper mais pourquoi on la
        // provoque. La liste reste donc ouverte, la tuile choisie s'allume, le
        // prix change, et RIEN NE BOUGE — zéro pixel, comme les vingt-sept
        // autres tuiles. Le client ouvre les dimensions quand il le décide.
        return {
          ...etat,
          config: configurationParDefaut(action.famille, catalogue),
          familleEnAttente: null,
          familleIndisponible: null,
        };
      case 'attente':
        return { ...etat, familleEnAttente: action.famille, familleIndisponible: null };
      case 'attente-echouee':
        // On relâche l'attente ET on nomme la famille qui a échoué : le
        // client doit pouvoir réessayer, ou en choisir une autre.
        return { ...etat, familleEnAttente: null, familleIndisponible: action.famille };
      case 'etape':
        return { ...etat, etape: action.etape };
      case 'vue':
        return { ...etat, vue: action.vue };
      case 'detail':
        return { ...etat, detailOuvert: !etat.detailOuvert };
      case 'situation':
        return { ...etat, situation: { ...etat.situation, ...action.patch } };
      case 'raccordement':
        return { ...etat, raccordement: { ...etat.raccordement, ...action.patch } };
      case 'champ': {
        const config = { ...etat.config, ...action.patch };
        // Changer de matériau après avoir choisi sa gamme laissait une
        // gamme alu sur une menuiserie PVC : refus immédiat, et le client
        // n'avait rien fait de mal. On lui reprend la gamme équivalente
        // dans le nouveau matériau.
        if (action.patch.materiau !== undefined && config.systeme !== undefined) {
          const systeme = systemeDe(catalogue, config.systeme);
          if (!systeme || systeme.materiau !== config.materiau) {
            const disponibles = systemesDuMateriau(catalogue, config.famille, config.materiau);
            const remplacant =
              disponibles.find((candidat) => candidat.gamme === config.gamme) ?? disponibles[0];
            config.systeme = remplacant?.id;
            if (remplacant) config.gamme = remplacant.gamme;
          }
        }
        // Même raison, autre champ : la tapée n'existe qu'en pose applique.
        // Changer de pose après l'avoir choisie laissait une tapée orpheline
        // et un avertissement que le client n'avait pas mérité. On la
        // retire — le prix la retirait déjà, l'écran devait suivre.
        if (action.patch.pose !== undefined && config.tapeeMm !== undefined) {
          if (!posePourFamille(catalogue, config.famille, config.pose).tapee) {
            config.tapeeMm = undefined;
          }
        }
        return { ...etat, config };
      }
      case 'option':
        return {
          ...etat,
          config: {
            ...etat.config,
            options: basculerOption(etat.config.options, action.option, action.actif, action.quantite),
          },
        };
      case 'panier-ajouter':
        return {
          ...etat,
          panier: [
            ...etat.panier,
            {
              cle: cleDeLigne(etat.config, etat.sequence),
              config: etat.config,
              quantite: etat.config.quantite ?? 1,
            },
          ],
          sequence: etat.sequence + 1,
        };
      case 'lot-importer':
        // LA SÉQUENCE AVANCE D'AUTANT DE LIGNES, et pas d'une seule. La clé
        // d'une ligne mêle sa configuration et ce numéro : quarante lignes
        // importées avec le même numéro donneraient quarante clés dont
        // certaines identiques — et retirer l'une en retirerait plusieurs.
        return {
          ...etat,
          panier: [
            ...etat.panier,
            ...action.lignes.map((ligne, rang) => ({
              ...ligne,
              cle: cleDeLigne(ligne.config, etat.sequence + rang),
            })),
          ],
          sequence: etat.sequence + action.lignes.length,
        };
      case 'releve':
        // LE RELEVÉ ALIMENTE LES COTES, il ne les double pas. La cote
        // retenue — la plus PETITE des trois, jamais la moyenne — descend
        // dans la configuration ; le relevé reste à côté pour dire d'où
        // elle vient et ce qu'elle vaut.
        //
        // C'EST L'ÉCRAN QUI LA CALCULE, et pas ce réducteur. Il a déjà le
        // rapport sous les yeux pour l'afficher ; le recalculer ici serait
        // un doublon — et surtout, `metrage.ts` serait alors dans le
        // chargement initial de tout le monde, pour un écran qu'on ouvre
        // quand on a décidé d'acheter. Mesuré : 1,1 ko.
        //
        // Quand la cote retenue est absente, c'est que le relevé BLOQUE
        // (faute de frappe, cote nulle). On garde alors ce que le client
        // avait : écraser une cote saisie par une cote absurde ferait
        // perdre les deux.
        return {
          ...etat,
          releve: action.releve,
          // Sans relevé, on retombe à `declaree` : effacer un relevé rend
          // les cotes à la saisie directe, et une cote saisie n'a jamais
          // été validée par personne.
          etatDesCotes: action.releve ? (action.etatDesCotes ?? 'declaree') : 'declaree',
          ...(action.coteRetenue ? { config: { ...etat.config, ...action.coteRetenue } } : {}),
        };
      case 'projet-harmoniser':
        // C'EST L'ÉCRAN QUI HARMONISE, et pas ce réducteur — la même raison
        // que pour le relevé, dix lignes plus haut, et la même mesure à
        // l'appui. `harmoniser()` vit dans `projet.ts` avec `computeProjet`,
        // et l'importer ici mettait TOUT le module dans le chargement
        // initial : le calcul du projet, le récapitulatif par pièce, et
        // surtout leurs REMARQUES — trois paragraphes de prose sur les
        // teintes qui ne se raccordent pas et les matériaux qui ne
        // vieillissent pas ensemble. Vérifié dans le texte du bundle : ils y
        // étaient, pour un panneau que seul un client à plusieurs
        // menuiseries ouvre.
        //
        // Le panier a déjà le rapport sous les yeux pour l'afficher ; il
        // applique donc le geste et rend les lignes faites. Le réducteur ne
        // fait plus que les poser.
        return { ...etat, panier: action.lignes };
      case 'panier-retirer':
        return { ...etat, panier: etat.panier.filter((ligne) => ligne.cle !== action.cle) };
      case 'panier-quantite':
        return {
          ...etat,
          panier: etat.panier.map((ligne) =>
            ligne.cle === action.cle ? { ...ligne, quantite: Math.max(1, action.quantite) } : ligne,
          ),
        };
      default:
        return etat;
    }
  };
}

/** Tout ce que le moteur dit de la configuration courante — jamais mémorisé. */
export function derive(config: JoineryConfiguration, catalogue: PricingCatalog) {
  let issues = validateConfiguration(config, catalogue);
  // UNE VALEUR INCONNUE DU CATALOGUE n'a pas de prix (le cœur lève, revue
  // WordPress.org du 9 octobre 2026). L'écran ne tombe pas pour autant : il
  // affiche un REFUS, et un refus n'entre pas au panier.
  let prix;
  try {
    prix = computePrice(config, catalogue);
  } catch (erreur) {
    if (!(erreur instanceof ValeurInconnueError)) throw erreur;
    issues = [...issues, { code: 'valeur-inconnue', severite: 'erreur', message: erreur.message }];
    prix = finaliser([], 0, config.quantite ?? 1, catalogue);
  }
  const uw = computeUw(config, catalogue);
  return {
    prix,
    issues,
    erreurs: issues.filter((issue) => issue.severite === 'erreur'),
    uw,
    // Le pendant du Uw pour le BRUIT — dérivé au même endroit, à chaque
    // geste, jamais mémorisé.
    acoustique: computeAcoustique(config, catalogue),
    // LE CRITÈRE TECHNIQUE DES AIDES, et lui seul. Le MONTANT demande une
    // tranche de revenus, une ancienneté de logement et un artisan RGE que
    // le configurateur ne connaît pas ; l'estimer au « cas le plus
    // courant » afficherait un chiffre au hasard sous le prix. Ce qu'on
    // affiche ici est un fait sur le produit, pas une promesse sur un
    // dossier — l'écran qui posera les questions chargera `aides.ts`.
    // Les seuils de la FAMILLE : une fenêtre de toit n'a pas les mêmes.
    // ET IL NE SE DIT QU'À UN OUVRAGE QUI POURRAIT ÊTRE VITRÉ — lot C12b. Sous
    // relève pas du geste "parois vitrées" » : une phrase juste, sur un ouvrage
    // qui n'a jamais relevé d'aucun geste de rénovation.
    critereAides:
      uw || catalogue.familles[config.famille].vitree
        ? critereTechniqueAides(uw, seuilsAidesDe(config.famille))
        : null,
    elevation: computeElevation(config, catalogue),
  };
}

/**
 * Le prix d'un panier — chaque ligne recalculée, jamais un total mémorisé.
 *
 * On additionne les montants AFFICHÉS (arrondi commercial), pas les totaux
 * exacts : le client doit pouvoir additionner lui-même les lignes qu'il voit
 * et retomber sur le total. Sommer les centimes exacts donnait un total de
 * 971,73 € sous des lignes affichées à 971,70 € — trois centimes suffisent
 * à faire douter de tout le reste. Le montant qui engage reste celui que le
 * serveur recalculera (phase 4).
 */
export function totalPanierCents(panier: LignePanier[], catalogue: PricingCatalog): number {
  return panier.reduce((somme, ligne) => somme + totalLigneCents(ligne, catalogue), 0);
}

/**
 * Le total d'UNE ligne : le prix unitaire, MULTIPLIÉ par la quantité.
 *
 * `computePrice()` rend le prix d'UNE menuiserie, remise quantité comprise —
 * c'est son contrat, et les golden configs le figent ainsi : `fen-2v-remise-3`
 * vaut 429,90 € pour trois exemplaires, pas 1 289,70. Le panier l'oubliait :
 * un chantier de quatre fenêtres coûtait le prix d'une, et cela depuis la
 * phase 2. Le devis du lot 6 l'a mis au jour en imprimant « 4 » à côté d'un
 * montant unitaire.
 */
export function totalLigneCents(ligne: LignePanier, catalogue: PricingCatalog): number {
  const quantite = Math.max(1, Math.round(ligne.quantite));
  return (
    computePrice({ ...ligne.config, quantite }, catalogue).displayTotalCents * quantite
  );
}

/** Un montant en centimes, écrit à la française. */
export function euros(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
