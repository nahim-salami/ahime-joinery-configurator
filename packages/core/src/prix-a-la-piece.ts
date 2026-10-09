
import { roundHalfUpDiv } from './matrix.ts';
import { enregistrerLePrixALaPiece } from './couture-du-prix-a-la-piece.ts';
import { finaliser } from './pricing.ts';
import { optionDef, type FamilleCatalog, type PricingCatalog } from './catalog.ts';
import type {
  JoineryConfiguration,
  PriceLine,
  PriceResult,
  ValidationIssue,
} from './types.ts';

/**
 * LES SIX BASES, et la liste est FERMÉE.
 *
 * Chacune décide d'une unité affichée. Une septième se DÉCIDE — elle ne
 * s'ajoute pas par une chaîne libre dans un catalogue, sinon deux marchands
 * écriront « h » et « heures » pour la même chose et le devis les affichera
 * toutes les deux.
 *
 * `forfait` existe pour une raison précise : sans lui, une ligne indivisible
 * s'écrirait « 1 unité », et quelqu'un finirait par en mettre deux.
 */
export type BasePoste = 'kg' | 'm' | 'm2' | 'unite' | 'heure' | 'forfait';

/**
 * L'EMPREINTE de ce module, sur le patron exact de celle des modules de
 * famille (`familles/registre.ts`) : une chaîne écrite ICI et NULLE PART
 * ailleurs, que `verifier-bundle.mjs` cherche dans le TEXTE du chargement
 * initial.
 *
 * Elle existe parce que le budget d'entrée ne suffit pas à garder ce module
 * dehors : il pèse 1,2 ko gzippés, et le jour où la marge sera de deux
 * kilo-octets, un import statique le ramènerait dans l'entrée sans que rien
 * ne le dise. Compter les morceaux ne suffirait pas non plus — un import
 * statique fait INLINER le module, et il n'y a plus de morceau à compter.
 */
export const EMPREINTE_DU_PRIX_A_LA_PIECE = 'ahjc:prix-a-la-piece:module-paresseux';


/** L'unité telle qu'elle s'imprime sur un devis. */
export const UNITE_DE_BASE: Record<BasePoste, string> = {
  kg: 'kg',
  m: 'm',
  m2: 'm²',
  unite: 'u',
  heure: 'h',
  forfait: 'forfait',
};

/**
 * UN POSTE AU CATALOGUE — ce que le marchand déclare.
 *
 * `prixUnitaireCents` est FACULTATIF, et c'est tout le sujet : un catalogue
 * qui n'a pas encore son prix d'achat déclare le poste sans son prix, et le
 * moteur refuse la configuration au lieu de la chiffrer à zéro.
 */
export interface PosteDef {
  id: string;
  /** Ce qui s'imprime à gauche du montant. */
  libelle: string;
  base: BasePoste;
  /** Le prix d'UNE unité de base, en centimes entiers. Absent = non déclaré. */
  prixUnitaireCents?: number;
  quantiteMilliemesParDefaut?: number;
  ordreDeGrandeur?: { readonly source: string };
}

export type PostureDePrix =
  | 'aucun-poste'
  | 'a-declarer'
  | 'bordereau-du-marchand'
  | 'ordre-de-grandeur';

export function postureDePrix(postes: readonly PosteDef[]): PostureDePrix {
  if (postes.length === 0) return 'aucun-poste';
  const chiffres = postes.filter((poste) => poste.prixUnitaireCents !== undefined);
  if (chiffres.length === 0) return 'a-declarer';
  return chiffres.some((poste) => poste.ordreDeGrandeur) ? 'ordre-de-grandeur' : 'bordereau-du-marchand';
}

/** Ce que la configuration déclare : un poste, et combien. */
export interface PosteChoisi {
  id: string;
  /** Millièmes de l'unité de base — 412,5 kg s'écrit 412 500. */
  quantiteMilliemes?: number;
}

/** Pourquoi un poste demandé n'a produit aucune ligne. */
export type MotifDePoste = 'poste-inconnu' | 'prix-unitaire-non-declare' | 'quantite-negative';

export interface RefusDePoste {
  id: string;
  motif: MotifDePoste;
  /** La phrase telle qu'elle s'affiche — grandeur, borne, alternative. */
  message: string;
}

export interface SommeDePostes {
  /** Les lignes CHIFFRÉES, dans l'ordre du catalogue de la famille. */
  lignes: PriceLine[];
  /** Leur somme, au centime. C'est le `baseCents` d'une famille à la pièce. */
  totalCents: number;
  /** Ce qui n'a pas été chiffré, et pourquoi. Vide = tout est chiffré. */
  refus: RefusDePoste[];
}

/** La quantité écrite comme on la lit : 412 500 millièmes → « 412,5 ». */
export function quantiteEnClair(quantiteMilliemes: number): string {
  const entier = Math.trunc(quantiteMilliemes / 1000);
  const reste = Math.abs(quantiteMilliemes % 1000);
  if (reste === 0) return String(entier);
  // Trois décimales au plus, sans zéro inutile — « 18,4 », pas « 18,400 ».
  return `${entier},${String(reste).padStart(3, '0').replace(/0+$/, '')}`;
}

/**
 * LE MONTANT D'UN POSTE, à l'entier de bout en bout.
 *
 *     montantCents = arrondiMoitiéHaut(quantitéMillièmes × prixUnitaireCents / 1000)
 *
 * La même arithmétique que les coefficients en millièmes, pour la même
 * raison : le PHP fait le même calcul dans le même ordre, et le harnais de
 * parité compare le dernier centime.
 */
export function montantDePoste(quantiteMilliemes: number, prixUnitaireCents: number): number {
  return roundHalfUpDiv(quantiteMilliemes * prixUnitaireCents, 1000);
}

export function sommeDesPostes(
  declares: readonly PosteDef[],
  choisis: readonly PosteChoisi[] | undefined,
): SommeDePostes {
  const lignes: PriceLine[] = [];
  const refus: RefusDePoste[] = [];
  const parId = new Map(declares.map((poste) => [poste.id, poste]));
  const demandes = new Map<string, number | undefined>();

  for (const choisi of choisis ?? []) {
    if (!parId.has(choisi.id)) {
      refus.push({
        id: choisi.id,
        motif: 'poste-inconnu',
        message:
          `Le poste « ${choisi.id} » n’est pas déclaré au catalogue de cette famille. ` +
          'Le déclarer, ou le retirer de la configuration.',
      });
      continue;
    }
    demandes.set(choisi.id, choisi.quantiteMilliemes);
  }

  for (const poste of declares) {
    const demande = demandes.has(poste.id)
      ? demandes.get(poste.id)
      : poste.quantiteMilliemesParDefaut;
    // Un poste ni demandé ni imposé ne s'écrit pas. C'est le patron des
    // options : le catalogue déclare ce qui EST POSSIBLE, la configuration
    // dit ce qui est PRIS.
    if (demande === undefined) continue;

    if (demande < 0) {
      // Une quantité négative fabrique un avoir déguisé en ligne de devis.
      // Les remises passent par des lignes tracées (`finaliser`), jamais par
      // un poste — « un dérivé ne se saisit pas » vaut aussi dans ce sens.
      refus.push({
        id: poste.id,
        motif: 'quantite-negative',
        message:
          `Le poste « ${poste.libelle} » est demandé pour une quantité négative ` +
          `(${quantiteEnClair(demande)} ${UNITE_DE_BASE[poste.base]}). Une remise se règle par ` +
          'une ligne tracée, pas par un poste en moins.',
      });
      continue;
    }

    if (poste.prixUnitaireCents === undefined) {
      refus.push({
        id: poste.id,
        motif: 'prix-unitaire-non-declare',
        message:
          `Le poste « ${poste.libelle} » est demandé pour ${quantiteEnClair(demande)} ` +
          `${UNITE_DE_BASE[poste.base]}, mais son prix unitaire n’est pas déclaré au catalogue. ` +
          `Le déclarer (en centimes par ${UNITE_DE_BASE[poste.base]}), ou retirer le poste : un ` +
          'poste sans prix ne vaut pas zéro euro, il vaut un prix INCONNU.',
      });
      continue;
    }

    // ZÉRO DEMANDÉ NE S'IMPRIME PAS — mais un montant qui TOMBE à zéro, si.
    //
    // La distinction est apparue en lisant la sortie du harnais de parité :
    // 0,499 unité à un centime rend « 0,00 € », et la première réaction est
    // d'effacer la ligne. Ce serait une faute. Un montant nul MESURÉ dit
    // « vous l'avez demandé, et ça coûte moins d'un centime » ; un poste sans
    // prix unitaire dit « on ne sait pas ». Les faire se ressembler
    // reviendrait à cacher le second derrière le premier — et c'est
    // exactement ce que ce module existe pour empêcher.
    if (demande === 0) continue;

    // L'ORDRE DE GRANDEUR SE DIT SUR LA LIGNE, ET IL NOMME SA SOURCE. Un
    // chiffre qu'on sait approché et qu'on affiche comme un prix redevient un
    // prix dès qu'il est imprimé : c'est la leçon du €/L (lot C4), où le
    // témoin est calculé, NOMMÉ et tenu hors de tout total.
    //
    // IL N'EST PAS PORTÉ EN PHP, ET IL N'A PAS À L'ÊTRE : c'est un LIBELLÉ, et
    // `ahjc_somme_des_postes` n'en construit aucun — elle rend un code, un type
    // et un montant. Le harnais compare la suite des lignes par leurs codes et
    // leurs montants, jamais par leurs mots (« les libellés ont le droit de
    // différer entre les deux langages », scripts/parity-check.mjs). Le jour où
    // le PHP écrira des libellés, cette ligne partira avec eux.
    const mention = poste.ordreDeGrandeur ? ` (ordre de grandeur — ${poste.ordreDeGrandeur.source})` : '';
    lignes.push({
      code: `poste-${poste.id}`,
      label:
        poste.base === 'forfait'
          ? `${poste.libelle}${mention}`
          : `${poste.libelle} — ${quantiteEnClair(demande)} ${UNITE_DE_BASE[poste.base]}${mention}`,
      // UNE LIGNE DE POSTE EST DE TYPE « base », ET IL Y EN A PLUSIEURS.
      // Tout ce qui lisait « la » ligne de base la supposait unique ; sur une
      // famille à la pièce, la base est la SOMME de ces lignes.
      type: 'base',
      amountCents: montantDePoste(demande, poste.prixUnitaireCents),
    });
  }

  return {
    lignes,
    totalCents: lignes.reduce((somme, ligne) => somme + ligne.amountCents, 0),
    refus,
  };
}

export function prixALaPiece(
  config: JoineryConfiguration,
  fam: FamilleCatalog,
  catalog: PricingCatalog,
): PriceResult {
  const somme = sommeDesPostes(fam.postes ?? [], config.postes);
  const lines: PriceLine[] = [...somme.lignes];

  for (const choisie of config.options ?? []) {
    const def = optionDef(catalog, choisie.id);
    if (!def || !def.familles.includes(config.famille)) continue; // la validation l'a dit
    const quantite = def.unite === 'parVantail' ? Math.max(1, choisie.quantite ?? 1) : 1;
    lines.push({
      code: `option-${def.id}`,
      label: quantite > 1 ? `${def.label} × ${quantite}` : def.label,
      type: 'option',
      amountCents: def.amountCents * quantite,
    });
  }

  return finaliser(lines, somme.totalCents, config.quantite ?? 1, catalog, fam.motDeLUnite);
}

export function refusDePostes(
  fam: FamilleCatalog,
  config: JoineryConfiguration,
): ValidationIssue[] {
  const { refus } = sommeDesPostes(fam.postes ?? [], config.postes);
  return refus.map((refuse) => ({
    code: `poste-${refuse.motif}`,
    severite: 'erreur' as const,
    message: refuse.message,
    alternative: {
      label: 'Retirer le poste',
      patch: { postes: (config.postes ?? []).filter((poste) => poste.id !== refuse.id) },
    },
  }));
}

// L'ENREGISTREMENT PAR LE SEUL FAIT D'ÊTRE IMPORTÉ — voir
// `couture-du-prix-a-la-piece.ts`. Le cœur appelle deux emplacements que ce
// module remplit en arrivant, si bien que le chargement initial ne porte pas
// une ligne de ce fichier : il coûtait 1,2 ko gzippés à tout visiteur venu
// pour une fenêtre, et le verrou du bundle l'a refusé.
enregistrerLePrixALaPiece({
  marque: EMPREINTE_DU_PRIX_A_LA_PIECE,
  prix: prixALaPiece,
  refus: refusDePostes,
});
