/**
 * Pourquoi ce fichier existe : le manifeste de fabrication refuse de
 * s'émettre tant que les cotes ne sont pas VALIDÉES, et jusqu'ici rien à
 * l'écran ne permettait d'y arriver. Le cœur avait la serrure
 * (`metrage.ts`) ; il manquait la poignée.
 *
 * Ce que cet écran demande : six mesures au lieu de deux. Trois largeurs —
 * en haut, au milieu, en bas —, trois hauteurs — à gauche, au milieu, à
 * droite —, et les deux diagonales. C'est ce que tout métreur fait et
 * qu'aucun configurateur ne demande.
 *
 * Solution écartée : demander deux nombres et prévenir en petits caractères
 * qu'il faut mesurer en trois points. C'est ce que fait le marché, et c'est
 * la première cause de rebut à la pose. Un conseil qu'on peut ignorer est
 * ignoré ; six champs à remplir ne s'ignorent pas.
 *
 * IL EST À LA DEMANDE, et c'est délibéré : la plupart des visiteurs ne
 * sortent pas leur mètre pendant qu'ils comparent des prix. Celui qui
 * l'ouvre a déjà décidé d'acheter.
 *
 * CE QU'IL NE FAIT PAS : décider. Toutes les règles — la cote retenue, les
 * seuils, l'état auquel le relevé donne droit — viennent de `metrage.ts`.
 * Cet écran collecte et montre, il ne juge pas.
 */

import { useState } from 'react';
import type { EtatDesCotes, ReleveTroisPoints } from '@ahjc/core';
// Par son CHEMIN et non par l'index : le relevé est un écran qu'on ouvre
// quand on a décidé d'acheter, et un export de confort le ramènerait dans
// le chargement initial de tout le monde.
import { computeMetrage } from '@ahjc/core/src/metrage.ts';
import { useT } from '../i18n.ts';

/** Ce que l'état des cotes dit, en une phrase que le client comprend. */
const PHRASE_ETAT: Record<EtatDesCotes, string> = {
  declaree: 'Cotes déclarées — personne du métier ne les a vérifiées.',
  confirmee: 'Cotes confirmées — relevé aux trois points, mais depuis chez vous.',
  validee: 'Cotes validées — relevé sur place. La fabrication peut être lancée.',
};

export function Releve(props: {
  releve: ReleveTroisPoints | null;
  largeurMm: number;
  hauteurMm: number;
  /**
   * La cote RETENUE voyage avec le relevé, et c'est cet écran qui la
   * calcule : il a déjà le rapport sous les yeux pour l'afficher. La
   * recalculer dans le réducteur ferait entrer `metrage.ts` dans le
   * chargement initial de tout le monde — mesuré : 1,1 ko.
   */
  onReleve: (
    releve: ReleveTroisPoints | null,
    coteRetenue?: { widthMm: number; heightMm: number },
    etatDesCotes?: EtatDesCotes,
  ) => void;
}) {
  const t = useT();
  // LA SAISIE EN COURS vit ici et pas dans l'état global, pour la même
  // raison que `ChampCote` garde sa frappe : entre « 12 » et « 1203 » il y
  // a « 120 », qui est une cote valide et absurde. On ne remonte qu'au
  // moment où le champ perd le curseur.
  const [brut, setBrut] = useState<Record<string, string>>({});

  const depart: ReleveTroisPoints = props.releve ?? {
    largeursMm: [props.largeurMm, props.largeurMm, props.largeurMm],
    hauteursMm: [props.hauteurMm, props.hauteurMm, props.hauteurMm],
  };
  const rapport = computeMetrage(depart);

  /**
   * Remonter un relevé AVEC sa cote retenue — sauf s'il bloque, auquel cas
   * on ne descend rien : la cote saisie vaut mieux qu'une cote absurde.
   */
  const remonter = (releve: ReleveTroisPoints) => {
    const verdict = computeMetrage(releve);
    props.onReleve(
      releve,
      verdict.blocages.length > 0
        ? undefined
        : { widthMm: verdict.largeurRetenueMm, heightMm: verdict.hauteurRetenueMm },
      verdict.etat,
    );
  };

  const poser = (
    axe: 'largeursMm' | 'hauteursMm' | 'diagonalesMm',
    rang: number,
    valeur: string,
  ) => {
    const nombre = Number.parseInt(valeur.replace(/\s/g, ''), 10);
    if (!Number.isFinite(nombre)) return;
    if (axe === 'diagonalesMm') {
      const diagonales: [number, number] = [...(depart.diagonalesMm ?? [0, 0])] as [number, number];
      diagonales[rang] = nombre;
      // Une seule diagonale ne dit rien : on n'envoie la paire que
      // lorsqu'elle est complète, sinon l'écart calculé serait celui d'un
      // zéro et crierait au faux équerrage.
      remonter({
        ...depart,
        ...(diagonales[0] > 0 && diagonales[1] > 0 ? { diagonalesMm: diagonales } : {}),
      });
      return;
    }
    const valeurs = [...depart[axe]] as [number, number, number];
    valeurs[rang] = nombre;
    remonter({ ...depart, [axe]: valeurs });
  };

  const champ = (
    axe: 'largeursMm' | 'hauteursMm' | 'diagonalesMm',
    rang: number,
    libelle: string,
  ) => {
    const cle = `${axe}-${rang}`;
    const courant =
      axe === 'diagonalesMm' ? (depart.diagonalesMm?.[rang] ?? '') : depart[axe][rang];
    return (
      <label key={cle} className="releve-champ">
        <span>{libelle}</span>
        <input
          type="text"
          inputMode="numeric"
          data-test={`releve-${cle}`}
          value={brut[cle] ?? String(courant)}
          onChange={(evenement) => setBrut({ ...brut, [cle]: evenement.target.value })}
          onBlur={(evenement) => {
            poser(axe, rang, evenement.target.value);
            setBrut({ ...brut, [cle]: '' });
          }}
        />
      </label>
    );
  };

  return (
    <div className="releve" data-test="releve">
      {/* LA PEAU DE CET ÉCRAN voyage AVEC lui, et pas dans la feuille
          principale. C'est le même raisonnement que `styles-vues.ts` à plus
          petite échelle : un écran que la plupart des visiteurs n'ouvrent
          jamais n'a pas à faire télécharger ses règles à tout le monde.
          
          Un `<style>` rendu dans l'arbre atterrit dans la racine fantôme,
          parce que c'est là que l'arbre vit. Deux instances n'en montent
          jamais deux : il n'y a qu'un relevé à l'écran à la fois. */}
      <style>{FEUILLE_RELEVE}</style>
      <p className="aide">
        {t(
          'Trois largeurs, trois hauteurs, deux diagonales. Un tableau n’est jamais un rectangle parfait — et c’est la plus PETITE cote qui décide si la menuiserie entre.',
        )}
      </p>

      <div className="releve-grille">
        <span className="champ">{t('Largeurs')}</span>
        {champ('largeursMm', 0, t('en haut'))}
        {champ('largeursMm', 1, t('au milieu'))}
        {champ('largeursMm', 2, t('en bas'))}
      </div>
      <div className="releve-grille">
        <span className="champ">{t('Hauteurs')}</span>
        {champ('hauteursMm', 0, t('à gauche'))}
        {champ('hauteursMm', 1, t('au milieu'))}
        {champ('hauteursMm', 2, t('à droite'))}
      </div>
      <div className="releve-grille">
        <span className="champ">{t('Diagonales')}</span>
        {champ('diagonalesMm', 0, t('haut gauche → bas droite'))}
        {champ('diagonalesMm', 1, t('haut droite → bas gauche'))}
      </div>

      {/* LE RELEVÉ SUR PLACE. Ce n'est pas une mesure de plus, c'est une
          DÉCLARATION DE RESPONSABILITÉ — et c'est elle, et elle seule, qui
          autorise la fabrication. */}
      <label className="bascule">
        <input
          type="checkbox"
          data-test="releve-sur-place"
          checked={depart.releveSurPlace === true}
          onChange={(evenement) =>
            remonter({ ...depart, releveSurPlace: evenement.target.checked })
          }
        />
        <span>{t('Relevé sur place par un professionnel')}</span>
      </label>

      <p className={`releve-etat releve-etat--${rapport.etat}`} data-test="etat-cotes">
        {PHRASE_ETAT[rapport.etat]}
      </p>

      {rapport.blocages.length > 0 ? (
        <ul className="liste-securites" data-test="releve-blocages">
          {rapport.blocages.map((blocage) => (
            <li key={blocage}>{blocage}</li>
          ))}
        </ul>
      ) : null}

      {rapport.consignes.length > 0 ? (
        <ul className="liste-securites" data-test="releve-consignes">
          {rapport.consignes.map((consigne) => (
            <li key={consigne}>{consigne}</li>
          ))}
        </ul>
      ) : null}

      {props.releve ? (
        <button type="button" className="lien-detail" onClick={() => props.onReleve(null)}>
          {t('Effacer le relevé')}
        </button>
      ) : null}
    </div>
  );
}

/** La peau du relevé — voir le commentaire à son point de rendu. */
const FEUILLE_RELEVE = `
/* LE RELEVE AUX TROIS POINTS. Une ligne par axe, un champ court par point :
   la forme dit ce qu'on demande sans qu'il faille le lire. Les champs sont
   etroits parce qu'une cote de menuiserie tient en quatre chiffres, et
   qu'un champ large invite a y ecrire autre chose. */
.releve { margin-top: 10px; padding: 12px 14px; background: var(--ahjc-papier); border-radius: var(--ahjc-rayon); }
.releve-grille { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; margin-bottom: 10px; }
.releve-grille .champ { flex: 0 0 100%; }
.releve-champ { display: flex; flex-direction: column; gap: 3px; font-size: 11px; color: var(--ahjc-encre-douce); }
.releve-champ input { width: 92px; min-height: 40px; padding: 6px 8px; border: 1px solid var(--ahjc-bord); border-radius: 6px; font: inherit; font-size: 14px; background: var(--ahjc-surface); color: var(--ahjc-encre); }
.releve-champ input:focus-visible { outline: 2px solid var(--ahjc-accent); outline-offset: 1px; }
/* L'ETAT DES COTES se lit d'un coup d'oeil : c'est lui qui decide si
   l'atelier a le droit de couper. Vert quand il l'a, encre douce sinon --
   jamais rouge, parce qu'une cote declaree n'est pas une faute, c'est une
   etape. */
.releve-etat { font-size: 12px; margin: 8px 0 0; font-weight: 600; color: var(--ahjc-encre-douce); }
.releve-etat--validee { color: var(--ahjc-accent); }
`;
