/**
 * Pourquoi ce fichier existe : le contrat complet avec la page qui héberge
 * le widget — `window.__AHJC_CONTEXT__`. Le widget ne devine RIEN de son
 * hôte : familles ouvertes à la vente, préréglages, peau, surcharges de
 * tarifs, configuration initiale, mode de vue, clé d'édition depuis le
 * panier. Tout ce qui manque a un défaut sûr.
 *
 * Solution écartée : lire des attributs HTML pour chaque réglage. Le
 * catalogue de tarifs d'un marchand ne tient pas dans un attribut, et un
 * attribut mal échappé casse la page. Un objet global, écrit par le plugin
 * PHP avant le script, transporte tout — c'est le `host-context` des néons.
 *
 * Incident fondateur : un widget qui suppose son hôte devient inembarquable.
 * Ici, chargé dans une page nue sans contexte, il fonctionne quand même :
 * catalogue par défaut, toutes familles, mode pleine page.
 */

import {
  DEFAULT_CATALOG,
  MANIFESTE_FAMILLES,
  type FamilleId,
  type JoineryConfiguration,
  type PricingCatalog,
  type Unite,
} from '@ahjc/core';

export type ModeVue = 'pleine' | 'fiche';

export interface Preset {
  label: string;
  widthMm: number;
  heightMm: number;
}

export interface HostContext {
  /** Qui héberge — n'influence que la télémétrie et les libellés d'action. */
  plateforme?: 'wordpress' | 'site' | 'demo';
  /** Jeton du panier ; sans lui, le bouton « Ajouter au panier » se tait. */
  nonce?: string;
  /** Les familles ouvertes à la vente ; absent = toutes celles du catalogue. */
  famillesActives?: FamilleId[];
  /** Les dimensions proposées d'un clic, par famille. */
  presets?: Partial<Record<FamilleId, Preset[]>>;
  /** La peau : accent, rayon, police — le reste vient de la feuille par défaut. */
  appearance?: { accent?: string; rayon?: string; police?: string };
  /** Les surcharges de tarifs du marchand, fusionnées sur le catalogue. */
  pricing?: Partial<PricingCatalog>;
  /** La configuration d'ouverture (édition depuis le panier, lien partagé). */
  configurationInitiale?: Partial<JoineryConfiguration>;
  modeleRa?: string;
  /**
   * L'unité de SAISIE et d'AFFICHAGE des cotes — jamais celle du calcul.
   * Absent = millimètres. Elle ne descend pas dans la configuration : le
   * moteur de prix ne la voit pas, ne peut donc pas en dépendre, et basculer
   * l'affichage ne déplace pas un centime (docs/11, décision 0.1).
   */
  unite?: Unite;
  vue?: ModeVue;
  /**
   * La langue du widget. Absente, elle se lit sur `<html lang>` — c'est la
   * PAGE qui sait dans quelle langue elle vend, pas le navigateur du
   * visiteur : un client allemand d'une boutique française doit voir la
   * boutique, pas une moitié d'allemand au milieu d'un catalogue français.
   */
  langue?: string;
  /**
   * Les traductions du marchand, par code de langue. Elles surchargent le
   * dictionnaire livré, entrée par entrée : corriger un seul libellé ne
   * fait pas perdre les autres.
   *
   * C'est l'étage qui rend le widget traduisible SANS attendre une version
   * — et c'est par là que le plugin WordPress versera ses `.mo` (lot 8).
   */
  traductions?: Record<string, Record<string, string>>;
  /** Présent quand on rouvre une ligne du panier — l'ajout devient édition. */
  editCartItemKey?: string;
  /** Point de collecte du panier côté hôte (AJAX WordPress en phase 4). */
  urlPanier?: string;
  /**
   * Ce que le devis doit porter et que le widget ne peut PAS inventer : le
   * nom du marchand, sa référence, sa TVA. Absent, le devis sort quand même
   * — un widget posé dans une page nue reste utilisable — mais il ne
   * prétend pas connaître une boutique qu'on ne lui a pas nommée.
   */
  devis?: {
    marchand?: { nom: string; adresse?: string; siret?: string };
    client?: { nom: string; adresse?: string };
    /** Le taux de TVA en millièmes (200 = 20 %). */
    tvaMilliemes?: number;
    validiteJours?: number;
    /** Le préfixe de référence — le numéro vient du compteur du widget. */
    prefixeReference?: string;
  };
  /**
   * L'OFFRE DE CRÉDIT DU MARCHAND, et rien d'autre : ce widget ne connaît
   * pas son partenaire financier, ni ses conditions du trimestre. Absente,
   * AUCUNE mensualité ne s'affiche — et c'est la bonne réponse plutôt qu'un
   * « à partir de 49 €/mois » que le Code de la consommation interdit.
   *
   * La forme est RECOPIÉE de `financement.ts` plutôt qu'importée, pour la
   * même raison qu'`EvenementTelemetrie` plus bas : c'est un CONTRAT avec
   * l'hôte, il a le droit d'être écrit en toutes lettres à l'endroit où
   * l'hôte le lit. La duplication a son comparateur — un test refuse que
   * les deux formes divergent.
   */
  credit?: {
    label: string;
    /** Le taux débiteur annuel fixe, en millièmes (5,90 % → 59). */
    tauxDebiteurMilliemes: number;
    dureeMois: number;
    fraisDossierCents?: number;
    assuranceMensuelleCents?: number;
    assuranceObligatoire?: boolean;
    taegAnnonceMilliemes?: number;
    apportCents?: number;
    /**
     * LES SEUILS DE L'USURE du trimestre, par tranche de capital, en
     * millièmes. Ils sont publiés CHAQUE TRIMESTRE par la Banque de France,
     * et c'est pour cela qu'ils ne peuvent pas vivre dans le code : les
     * figer reviendrait à valider pendant trois mois des offres devenues
     * illégales.
     *
     * Absents, le module ne valide RIEN et le DIT — il ne suppose pas que
     * l'offre est légale. C'est le marchand (ou son partenaire financier)
     * qui les renseigne, comme il renseigne son taux.
     */
    usure?: Array<{ jusquACents: number; tauxMilliemes: number }>;
  };
  /**
   * CE QUE LA MARQUE ACCORDE EN PLUS DU DROIT.
   *
   * Dix ans sur le profilé, dix ans contre la buée entre les verres, cinq
   * ans sur le moteur, vingt-cinq ans sur un thermolaquage QUALIMARINE :
   * ce sont des engagements de MARQUE, pas des règles de droit, et ils
   * changent d'une gamme à l'autre. Le widget ne les invente pas — ce
   * serait exactement ce que `garanties.ts` reproche au badge
   * « garantie 10 ans ».
   *
   * `piecesDetacheesMois` n'est pas une commodité : le vendeur DOIT
   * informer l'acheteur de cette durée (art. L111-4 du Code de la
   * consommation) et cette information l'ENGAGE. Absente, l'écran dit que
   * l'obligation n'est pas remplie.
   *
   * La forme est RECOPIÉE de `garanties.ts` pour la même raison que
   * `credit` : c'est un contrat avec l'hôte, et un test refuse que les deux
   * formes divergent.
   */
  garanties?: {
    commerciales?: Array<{
      code: string;
      label: string;
      dureeMois: number;
      fondement: string;
      couvre: string;
      materiaux?: Array<'pvc' | 'alu' | 'bois' | 'mixte'>;
      siMotorise?: boolean;
      siVitre?: boolean;
    }>;
    piecesDetacheesMois?: number;
  };
  /**
   * OÙ PARTENT LES ÉVÉNEMENTS DE TÉLÉMÉTRIE — et c'est l'hôte qui décide.
   *
   * Le widget ne fait AUCUNE requête de son propre chef : il appelle cette
   * fonction, et rien de plus. Un marchand qui ne la fournit pas n'émet
   * rien du tout — pas de « collecte par défaut », pas de point de mesure
   * caché, pas de tiers. C'est ce qui rend un widget en marque blanche
   * acceptable dans une boutique dont on ne connaît pas la politique de
   * données.
   *
   * Ce qui passe par là est déjà assaini (`telemetrie.assainir`) : un type,
   * une session opaque, un délai, et selon le cas un numéro d'étape ou un
   * code de règle. Jamais une cote, jamais un nom, jamais une adresse.
   */
  onEvenement?: (evenement: EvenementTelemetrie) => void;
}

/**
 * La forme d'un événement, recopiée du cœur plutôt qu'importée.
 *
 * Importer `telemetrie.ts` pour un TYPE ferait entrer le module dans le
 * chargement initial — la leçon de `Geometry3D`, déjà payée deux fois. Et
 * cette forme-ci est un CONTRAT avec l'hôte : elle a le droit d'être écrite
 * en toutes lettres à l'endroit où l'hôte la lit.
 */
export interface EvenementTelemetrie {
  type: 'ouverture' | 'premier-prix' | 'etape-ouverte' | 'refus' | 'devis' | 'commande';
  session: string;
  msDepuisOuverture: number;
  etape?: number;
  code?: string;
  famille?: FamilleId;
}

declare global {
  interface Window {
    __AHJC_CONTEXT__?: HostContext;
  }
}

/** Le contexte de la page, ou un contexte vide — jamais une exception. */
export function lireContexte(): HostContext {
  if (typeof window === 'undefined') return {};
  const brut = window.__AHJC_CONTEXT__;
  return brut && typeof brut === 'object' ? brut : {};
}

/**
 * Le catalogue effectif : les surcharges du marchand posées sur le défaut.
 * La fusion est volontairement peu profonde (familles et tables de premier
 * niveau) — un marchand remplace une matrice entière ou un barème entier,
 * jamais une cellule isolée : c'est plus simple à écrire, à relire dans son
 * back-office, et à comparer au portage PHP de la phase 4.
 */
export function resoudreCatalogue(pricing?: Partial<PricingCatalog>): PricingCatalog {
  if (!pricing) return DEFAULT_CATALOG;
  return {
    ...DEFAULT_CATALOG,
    ...pricing,
    familles: { ...DEFAULT_CATALOG.familles, ...(pricing.familles ?? {}) },
    coefGammeMilliemes: { ...DEFAULT_CATALOG.coefGammeMilliemes, ...(pricing.coefGammeMilliemes ?? {}) },
    coefVitrageMilliemes: { ...DEFAULT_CATALOG.coefVitrageMilliemes, ...(pricing.coefVitrageMilliemes ?? {}) },
    coefCouleurMilliemes: { ...DEFAULT_CATALOG.coefCouleurMilliemes, ...(pricing.coefCouleurMilliemes ?? {}) },
    coefRemplissagePorteMilliemes: {
      ...DEFAULT_CATALOG.coefRemplissagePorteMilliemes,
      ...(pricing.coefRemplissagePorteMilliemes ?? {}),
    },
    // Les poses se fusionnent CLÉ PAR CLÉ, comme les autres barèmes. Un
    // marchand qui ne redéfinit que le tarif de sa rénovation aurait sinon
    // remplacé les quatre modes par un seul : la pose par défaut — celle
    // sur laquelle retombe toute configuration muette — n'existait plus, et
    // le configurateur tombait au premier rendu.
    poses: { ...DEFAULT_CATALOG.poses, ...(pricing.poses ?? {}) },
    options: pricing.options ?? DEFAULT_CATALOG.options,
    thermique: { ...DEFAULT_CATALOG.thermique, ...(pricing.thermique ?? {}) },
    verre: { ...DEFAULT_CATALOG.verre, ...(pricing.verre ?? {}) },
  };
}

/**
 * Les familles à montrer — celles du contexte, filtrées par le MANIFESTE.
 *
 * Le manifeste et non le catalogue, depuis le lot 0.2 : à la première
 * milliseconde, aucun module de famille n'est arrivé et le catalogue est
 * vide. Lire les familles dedans donnait un écran de choix VIDE, où le
 * client ne pouvait même pas demander ce qu'il aurait fallu charger pour
 * le lui montrer. Le manifeste, lui, tient dans quelques centaines d'octets
 * et connaît les sept familles dès la première ligne.
 */
export function famillesOuvertes(contexte: HostContext, _catalogue: PricingCatalog): FamilleId[] {
  const toutes = Object.keys(MANIFESTE_FAMILLES) as FamilleId[];
  if (!contexte.famillesActives?.length) return toutes;
  const ouvertes = contexte.famillesActives.filter((famille) => toutes.includes(famille));
  return ouvertes.length > 0 ? ouvertes : toutes;
}
