/**
 * Pourquoi ce fichier existe : afficher les remarques du moteur de règles —
 * et surtout le bouton qui les CORRIGE. C'est le paiement de tout le travail
 * de `validate.ts` : chaque refus porte l'alternative la plus proche sous
 * forme de patch, il ne reste qu'à l'appliquer d'un clic.
 *
 * Solution écartée : une pop-up de validation à la fin du parcours. Le
 * client corrigerait à l'aveugle, loin du champ fautif. Les notes vivent
 * DANS l'étape concernée, sous le champ, en ligne (docs/08, règle 3 : rien
 * ne disparaît sans raison dite).
 *
 * Incident fondateur : un « corriger » qui ne corrige pas est pire qu'un
 * refus sec — c'est pourquoi le test de `validate.ts` vérifie, refus par
 * refus, que le patch proposé fait bien disparaître le refus.
 */

import type { JoineryConfiguration, ValidationIssue } from '@ahjc/core';
import { useT } from '../i18n.ts';

export function Notes(props: {
  issues: ValidationIssue[];
  onCorriger: (patch: Partial<JoineryConfiguration>) => void;
}) {
  // `useT()` AVANT le retour anticipé : un crochet appelé après un `return`
  // conditionnel ne s'exécute pas à tous les rendus, et React le refuse.
  const t = useT();
  if (props.issues.length === 0) return null;
  return (
    <>
      {props.issues.map((issue) => (
        <div key={issue.code} className={`note note--${issue.severite}`} data-code={issue.code} role={issue.severite === 'erreur' ? 'alert' : undefined}>
          <span aria-hidden="true">{issue.severite === 'erreur' ? '✕' : issue.severite === 'info' ? 'ⓘ' : '!'}</span>
          <span>
            {issue.message}
            {issue.alternative ? (
              <>
                <br />
                <button type="button" onClick={() => props.onCorriger(issue.alternative!.patch)}>
                  {t(issue.alternative.label)}
                </button>
              </>
            ) : null}
          </span>
        </div>
      ))}
    </>
  );
}

/**
 * LES REMARQUES QUI CONCERNENT UNE ÉTAPE — chaque code est rattaché à un
 * écran, et il n'y a plus qu'UNE table pour cela.
 *
 * ELLES ÉTAIENT DEUX — une de codes ENTIERS, une de PRÉFIXES — et le lot O3
 * les a réunies pour rendre les quatre octets d'entrée qu'il demandait. Un
 * code entier EST un préfixe de lui-même (`startsWith` le dit), donc la
 * seconde table savait déjà faire le travail de la première : `PAR_ETAPE[3]`
 * portait depuis toujours deux codes ENTIERS employés comme préfixes. Deux
 * mécanismes pour une question, c'était une duplication sans comparateur.
 *
 * CE QU'ON PERD est le droit de ranger un code SANS ranger ce qui commence
 * comme lui. Aucun couple du cœur n'est dans ce cas — `notes-par-etape.test.ts`
 * le vérifie code par code, et il refuse qu'un code se range sous deux
 * écrans : le jour où deux codes se chevaucheraient, il tombe.
 */
const PAR_ETAPE: Record<number, string[]> = {
  1: ['famille-inconnue'],
  2: [
    'levage-', 'tapee-', 'renovation-', 'pose-', 'forme-', 'vantail-', 'fleche-', 'dessin-',
    // LES DEUX COTES DE POSE (lot O9a) — celle d'une moustiquaire et celle
    // d'un store intérieur. Elles vont à l'étape 2 et non à la 4 : elles
    // disent CE QU'IL FAUT MESURER selon la pose (« le dormant d'un bord à
    // l'autre » ou « le passage libre »), et c'est là qu'on tape la cote.
    // C'est la première cause de retour sur ces deux produits.
    'moustiquaire-cote', 'store-cote',
    // gammistes appellent « largeur » deux choses différentes, et prendre
    'portail-convention-de-cote',
    'vantaux-hors-famille',
    'largeur-hors-bornes',
    'hauteur-hors-bornes',
    'ouverture-hors-famille',
    'soufflet-monovantail',
    'allege-sans-objet',
    'imposte-sans-objet',
    'applique-sans-tapee',
    'rond-non-carre',
  ],
  // L'ÉTAPE 3 EST LA SEULE À CODES ENTIERS, et ce n'est pas un reste : ses
  // quatre entrées s'expliquent LÀ et nulle part ailleurs — la tuile de
  // matériau qui manque, le classement qui ne s'applique pas, l'aluminium
  // seul d'un BSO. Les traiter en préfixes les rangerait AUSSI ailleurs dès
  // qu'un code commencerait comme elles.
  3: ['materiau-indisponible', 'aev-insuffisant', 'bso-aluminium-seul', 'screen-aluminium-seul'],
  4: [
    // Le modèle de porte vit dans la même étape que sa part vitrée : c'est
    // la même décision — à quoi la porte ressemble.

  ],
  5: [
    // La motorisation vit à l'étape 5 : c'est là qu'on la choisit, et c'est
    // là que ses refus doivent se lire. Les trois entrées sont des PRÉFIXES
    // depuis le lot O9a — deux codes entiers y ont été coupés pour rendre les
    // octets que le rangement de la moustiquaire demandait, et aucun autre
    // code du cœur ne commence par l'un des trois (vérifié par
    // `notes-par-etape.test.ts`, qui refuse un code rangé sous deux écrans).
    'alimentation-', 'securites-', 'moteur-',
  ],
  // LES DEUX DERNIERS EMPLACEMENTS ONT GLISSÉ AU LOT D20 : la motorisation a
  // pris le 5, qui était celui des couleurs. Les options passent donc de 6 à
  // 7 et la quantité de 7 à 8 — l'emplacement est un IDENTIFIANT, pas un
  // rang, et c'est le panneau qui compte les rangs.
  7: [
    'oscillo-battant-incompatible',
    'moustiquaire-bloc-baie',
    'option-', 'motorisation',
  ],
  8: ['quantite-invalide'],
};


const PAR_ECRAN = new Map<string, number>();

/**
 * Un écran de famille déclare les codes qu'il montre. Appelée au niveau du
 * module, elle ne s'exécute qu'une fois — et jamais chez un visiteur qui
 * n'ouvre pas cet écran.
 */
export function rangerSousLEcran(etape: number, prefixes: readonly string[]): void {
  for (const prefixe of prefixes) PAR_ECRAN.set(prefixe, etape);
}

/**
 * LES DEUX EXCEPTIONS DE L'ÉTAPE 3 sont des CODES ENTIERS, pas des
 * préfixes : la tuile de matériau manquante s'explique là, et nulle part
 * ailleurs. Tout le reste se range par début de code.
 */
function rangeParPrefixe(code: string, etape: number): boolean {
  if (PAR_ETAPE[3].includes(code)) return etape === 3;
  if (etape === 3) return false;
  for (const [prefixe, sienne] of PAR_ECRAN) {
    if (code.startsWith(prefixe)) return sienne === etape;
  }
  return (PAR_ETAPE[etape] ?? []).some((prefixe) => code.startsWith(prefixe));
}

/**
 * Vrai si un code est rangé quelque part — par table ou par préfixe.
 *
 * IL BALAIE TOUS LES PRÉFIXES, et plus seulement ceux des étapes 2 et 4.
 * Écrit à la main, il ratait les étapes 5 et 6 dès que le lot MT4a y a
 * replié des codes : ils se seraient rangés à leur étape ET au
 * récapitulatif, c'est-à-dire deux fois. Une liste d'étapes écrite à la main
 * est une liste qui aura tort au prochain repli — même faute que le compte
 * de compétences du lot Z1.
 */
function estRange(code: string): boolean {
  for (const prefixe of PAR_ECRAN.keys()) if (code.startsWith(prefixe)) return true;
  return Object.values(PAR_ETAPE)
    .flat()
    .some((prefixe) => code.startsWith(prefixe));
}

/**
 * Le tri des remarques par étape. Un code inconnu de la table remonte à
 * l'étape 8 (le récapitulatif — 7 jusqu'au lot D20) plutôt que de disparaître : une règle
 * ajoutée dans core sans passer ici reste VISIBLE, quitte à être mal
 * rangée. Un message perdu serait un refus muet.
 */
export function notesDeLEtape(issues: ValidationIssue[], etape: number): ValidationIssue[] {
  return issues.filter(
    (issue) =>
      rangeParPrefixe(issue.code, etape) || (etape === 8 && !estRange(issue.code)),
  );
}
