
import { useEffect, useState, type ReactNode } from 'react';
import { computePrice, type JoineryConfiguration, type PricingCatalog } from '@ahjc/core';
import { euros } from '../etat.ts';
import { depuisMm, versMm, type Unite } from '../unites.ts';
import { useT } from '../i18n.ts';

/** Ce que coûterait ce choix, à configuration égale par ailleurs. */
export function delta(
  config: JoineryConfiguration,
  patch: Partial<JoineryConfiguration>,
  catalogue: PricingCatalog,
): number {
  return (
    computePrice({ ...config, ...patch }, catalogue).totalCents -
    computePrice(config, catalogue).totalCents
  );
}

export function libelleDelta(cents: number): string {
  if (cents === 0) return 'inclus';
  return `${cents > 0 ? '+' : '−'}${euros(Math.abs(cents))}`;
}


export function Tuile(props: {
  label: string;
  note?: string;
  actif: boolean;
  desactive?: boolean;
  raison?: string;
  /**
   * LE DESSIN DE CE CHOIX, en SVG — lot I4.
   *
   * Il vient d'`elevationToSvg(computeElevation(candidate))`, comme la
   * vignette d'une ligne de panier depuis le lot du chantier : la tuile
   * montre donc LE MÊME dessin que le viewport, par construction. Un croquis
   * écrit à la main aurait été un second dessin à tenir d'accord avec le
   * premier, et le premier est celui qui part en atelier.
   *
   * Il n'est pas passé partout : une vignette qui ne DIFFÈRE pas de sa
   * voisine ne montre rien, et `vignettes.test.ts` mesure lesquelles
   * diffèrent. Le type de coffre, par exemple, n'en a pas — trois tuiles
   * pour deux images.
   */
  vignette?: string;
  onClick: () => void;
  test?: string;
}) {
  // LA TRADUCTION SE FAIT ICI, pas chez les quarante appelants. Envelopper
  // chaque `label={…}` aurait ete quarante occasions d'en oublier un, et un
  // oubli laisse une ile de francais au milieu d'un ecran traduit. Un
  // libelle sans entree au dictionnaire — le nom d'une gamme du marchand,
  // par exemple — ressort tel quel : c'est la regle de la cle.
  const t = useT();
  return (
    <button
      type="button"
      className="tuile"
      aria-pressed={props.actif}
      disabled={props.desactive}
      title={props.raison ? t(props.raison) : undefined}
      data-test={props.test}
      onClick={props.onClick}
    >
      {props.vignette ? (
        <span className="tuile-dessin" aria-hidden="true" dangerouslySetInnerHTML={{ __html: props.vignette }} />
      ) : null}
      <span>{t(props.label)}</span>
      {props.note ? <span className="delta">{props.note}</span> : null}
    </button>
  );
}

/**
 * L'ACCORDÉON RENVOYAIT LE CLIENT EN BAS DE LA PAGE, et ce n'est pas un
 * défaut de style : c'est de l'arithmétique de défilement.
 *
 * MESURÉ sur la page de démonstration, en cliquant l'étape « Couleurs »
 * pendant que « Dimensions et pose » était ouverte : la hauteur du document
 * tombe de **1 844 px à 949**, et la position de défilement, qui valait 900,
 * est ÉCRÊTÉE par le navigateur à **49** — le maximum d'une page devenue
 * courte. L'étape qu'on vient de cliquer a disparu de l'écran, et il faut
 * remonter à la main pour la retrouver.
 *
 * Une seule étape est ouverte à la fois : en ouvrir une en referme donc une
 * autre, et si celle-ci était PLUS HAUT dans la page, tout ce qui suit
 * remonte de sa hauteur. Le client n'a rien demandé de tel — il a cliqué un
 * titre, et ce titre doit rester sous son doigt.
 *
 * LE REMÈDE TIENT EN UNE SOUSTRACTION : on relève où est l'en-tête avant le
 * rendu, où il est après, et on rattrape l'écart. Il se joue dans une
 * `requestAnimationFrame` — donc APRÈS que React ait posé le nouveau DOM (un
 * clic est un événement DISCRET, React le rend sans attendre) et AVANT que
 * l'écran soit peint. Fait plus tard, on verrait la page sauter puis
 * revenir.
 *
 * ET LE LOT D18 AVAIT ÉCRIT AUTRE CHOSE : `scrollIntoView({ block:
 * 'nearest' })`. Le propriétaire du projet a redit la même remarque un lot
 * plus tard — « c'est un bouton, que cela ne défile pas » —, et il avait
 * raison. MESURÉ sur un en-tête cliqué à 274 px du haut d'une fenêtre de
 * 598 :
 *
 *   sans rien                        il finit à **−312** — hors écran
 *   `scrollIntoView({block:…})`      il finit à **0** — la page a bougé de 274
 *   `scrollBy(après − avant)`        il finit à **274** — rien n'a bougé
 *
 * `scrollIntoView` NE COMPENSE PAS, IL NAVIGUE : il ne fait rien tant que
 * l'élément est dans l'écran, puis le colle au bord dès qu'il en sort. Il
 * rattrape la perte au lieu de l'empêcher, et ce que le client voit est
 * exactement ce dont il se plaignait — la page qui saute. La soustraction,
 * elle, rend l'écart EXACT : ce qu'on a pointé ne bouge pas d'un pixel, et le
 * contenu se replie autour. Un bouton ne navigue pas.
 *
 * ET LE NAVIGATEUR FAIT DÉJÀ CE TRAVAIL PARTOUT AILLEURS, ce qui dit où
 * s'arrête ce gestionnaire. Balayé : vingt-neuf boutons du panneau, **huit
 * changent la hauteur du document, AUCUN ne fait défiler la page** — c'est
 * l'ancrage de défilement (`overflow-anchor`), qui garde fixe un nœud visible
 * qu'il choisit lui-même. (Une tuile de forme descend de 22 px en bureau, et
 * ce n'est pas un défilement : `scrollY` ne bouge pas, c'est le RÉSUMÉ de son
 * étape qui gagne un mot et passe à la ligne.) Il abandonne dans un cas, et la spécification le
 * dit : **quand ce nœud est RETIRÉ du DOM**. Fermer le corps d'une étape qui
 * occupait le haut de l'écran, c'est précisément supprimer son ancre. D'où ce
 * rattrapage ici et nulle part ailleurs : l'écrire sur les vingt-sept autres
 * boutons casserait ce qui marche.
 *
 * SA LIMITE EST NOMMÉE : il défile la PAGE. Un widget posé dans une colonne
 * qui défile toute seule garde l'ancien comportement — retrouver le bon
 * conteneur demande de remonter les ancêtres en lisant leur style calculé,
 * et cela pèse plus que la marge du chargement initial. Les intégrations
 * connues (WooCommerce, PrestaShop, page hébergée) défilent la page.
 *
 * ET IL TIENT DANS LE GESTIONNAIRE DE CLIC, sans état ni référence, parce
 * que le chargement initial était à QUATRE-VINGT-DOUZE octets de sa borne
 * quand ce lot a commencé. Deux rédactions ont été pesées et refusées :
 * une fonction nommée avec un garde-fou au pixel près (**+146 octets** au
 * delà de la borne), puis la même repliée dans un `useLayoutEffect` avec
 * ses deux `useRef` (**+124**). `evenement.currentTarget` donne le même
 * bouton sans rien mémoriser.
 */
export function Etape(props: {
  numero: number;
  titre: string;
  resume: string;
  ouverte: boolean;
  onOuvrir: () => void;
  children: ReactNode;
}) {
  const t = useT();
  return (
    // « Déplié » ne dit pas déplié OÙ : sans `aria-controls`, un lecteur
    // d'écran annonce sept titres dépliables sans pouvoir dire lequel a
    // ouvert le corps qu'il vient de rencontrer.
    <section className="etape" data-etape={props.numero}>
      <button
        type="button"
        className="etape-entete"
        data-test={`etape-${props.numero}`}
        aria-expanded={props.ouverte}
        aria-controls={`ahjc-etape-${props.numero}`}
        onClick={(evenement) => {
          const bouton = evenement.currentTarget;
          const haut = () => bouton.getBoundingClientRect().top;
          const avant = haut();
          props.onOuvrir();
          requestAnimationFrame(() => scrollBy(0, haut() - avant));
        }}
      >
        <span className="num">{props.numero}</span>
        <h3>{t(props.titre)}</h3>
        <span className="resume">{t(props.resume)}</span>
      </button>
      {props.ouverte ? (
        <div className="etape-corps" id={`ahjc-etape-${props.numero}`}>
          {props.children}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Un champ de COTE — la seule façon d'écrire une dimension dans ce panneau.
 *
 * Solution écartée : un `<input type="number">` piloté directement par
 * `config.widthMm`, comme avant. En pouces, une cote s'écrit « 47 1/4 » : ce
 * n'est pas un nombre, et un champ numérique le refuse. Surtout, un champ
 * entièrement piloté par la configuration efface la frappe en cours — entre
 * « 47 » et « 47 1/4 » il y a « 47 1 », qui ne se lit pas encore. D'où la
 * saisie BRUTE gardée en local tant que le champ a le curseur, et la
 * configuration qui ne bouge qu'aux instants où la cote est complète.
 *
 * La bascule d'unité, elle, ne réécrit JAMAIS `valeurMm` : elle ne change
 * que la façon de le lire (voir `core/src/unites.ts` — un seizième est plus
 * gros qu'un millimètre, réécrire ferait dériver la menuiserie).
 */
export function ChampCote(props: {
  id: string;
  test: string;
  /** Le libellé du champ. Traduit ICI, comme chez `Tuile` et `Etape`. */
  nom: string;
  unite: Unite;
  valeurMm: number | undefined;
  facultatif?: boolean;
  placeholder?: string;
  onChange: (valeurMm: number | undefined) => void;
}) {
  const t = useT();
  const { unite, valeurMm } = props;
  const [brut, setBrut] = useState<string | null>(null);
  // Un changement venu d'AILLEURS — un préréglage cliqué, une correction de
  // refus, une bascule d'unité — reprend la main sur la frappe en cours.
  useEffect(() => setBrut(null), [valeurMm, unite]);

  const affiche = brut ?? (valeurMm === undefined ? '' : depuisMm(valeurMm, unite));
  return (
    <>
      {/* Le NOM se traduit, et l'UNITÉ aussi : « mm » est universel, mais
          « pouces » ne l'est pas — un marchand anglophone écrit « inches ». */}
      <label className="champ" htmlFor={props.id}>
        {t('{nom} ({unite})', {
          nom: t(props.nom),
          unite: unite === 'pouce' ? t('pouces') : t('mm'),
        })}
      </label>
      <input
        id={props.id}
        data-test={props.test}
        // En millimètres le champ reste NUMÉRIQUE : le pavé du téléphone
        // s'ouvre sur les chiffres et rien ne change pour un marchand
        // français. En pouces il devient textuel — « 47 1/4 » n'est pas un
        // nombre, et `type="number"` le viderait sans un mot.
        type={unite === 'pouce' ? 'text' : 'number'}
        inputMode={unite === 'pouce' ? 'text' : 'numeric'}
        value={affiche}
        placeholder={props.placeholder}
        onChange={(evenement) => {
          const texte = (evenement.target as HTMLInputElement).value;
          setBrut(texte);
          if (texte.trim() === '') {
            if (props.facultatif) props.onChange(undefined);
            return;
          }
          const mm = versMm(texte, unite);
          if (mm === null) return;
          // « Lire n'est pas écrire », et ce garde-fou le rend DÉLIBÉRÉ.
          // En pouces, plusieurs millimètres portent la même cote : 1349 et
          // 1350 mm se lisent tous deux « 53 1/8" ». Retaper la cote déjà
          // affichée ne doit donc rien déplacer — sinon la menuiserie
          // glisserait d'un millimètre, et le devis de vingt centimes, sans
          // qu'un seul écran ne montre la différence. Sans cette ligne, le
          // comportement dépendait du suivi de valeur interne de React,
          // c'est-à-dire de rien.
          if (
            props.valeurMm !== undefined &&
            depuisMm(props.valeurMm, unite) === depuisMm(mm, unite)
          ) {
            return;
          }
          props.onChange(mm);
        }}
        onBlur={() => setBrut(null)}
      />
    </>
  );
}
