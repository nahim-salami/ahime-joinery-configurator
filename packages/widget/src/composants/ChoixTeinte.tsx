/**
 * Pourquoi ce fichier existe : le nuancier ne s'affiche QUE si le client
 * quitte le blanc. Le blanc est le defaut, il l'est encore pour cinquante-
 * cinq pour cent des poses, et une fenetre blanche n'a besoin ni des
 * quinze pastilles RAL, ni des six decors plaxes, ni de leurs libelles.
 *
 * C'est la meme couture que `EtapesFermetures.tsx`, et pour la meme raison :
 * un ecran qu'une configuration n'affiche jamais n'a rien a faire dans ce
 * qu'elle telecharge.
 *
 * Ce qui reste dans l'entree, et il le faut : `resoudreTeintes` et le
 * nuancier lui-meme, cote coeur. Le DESSIN doit savoir peindre un 7016 des
 * la premiere seconde -- une configuration partagee par lien s'ouvre sur sa
 * teinte, pas sur du blanc en attendant. C'est l'ECRAN DE CHOIX qui part,
 * pas la donnee.
 */

import {
  DECORS_PLAXES,
  NUANCIER,
  type CompositionPetitsBois,
  type JoineryConfiguration,
} from '@ahjc/core';
// Par son CHEMIN et non par l'index : les conseils ne doivent pas entrer
// dans le chargement initial, et un export de confort les y remettrait.
import { conseilsDeTeinte } from '@ahjc/core/src/conseils-teinte.ts';
import { useT } from '../i18n.ts';
import { Tuile } from './briques.tsx';

export function ChoixTeinte(props: {
  config: JoineryConfiguration;
  champ: (patch: Partial<JoineryConfiguration>) => void;
}) {
  const t = useT();
  const { config, champ } = props;
  const conseils = conseilsDeTeinte({
    couleur: config.couleur,
    materiau: config.materiau,
    ralExterieur: config.ralExterieur,
    ralInterieur: config.ralInterieur,
    decorPlaxe: config.decorPlaxe,
    finition: config.finition,
  });

  return (
    <>
      {/* LA PEAU DE CET ÉCRAN voyage AVEC lui — même raisonnement que le
          relevé et que `styles-vues.ts` : une menuiserie blanche, qui reste
          le défaut, n'a pas à télécharger les règles d'un nuancier qu'elle
          n'ouvrira pas. */}
      <style>{FEUILLE_TEINTE}</style>
      {/* LE NUANCIER. Quarante-cinq pour cent des poses sont colorées, et
          ce panneau proposait « RAL une face » sans jamais demander LEQUEL —
          le client payait un supplément pour un gris qu'il n'avait pas
          choisi et qui n'existait pas. */}
      {config.couleur === 'ral-1-face' || config.couleur === 'bicolore' ? (
        <Nuancier
          prefixe="ral"
          libelle={config.couleur === 'bicolore' ? t('Teinte extérieure') : t('Teinte')}
          choisi={config.ralExterieur ?? NUANCIER[0].code}
          onChoisir={(ralExterieur) => champ({ ralExterieur })}
        />
      ) : null}

      {config.couleur === 'bicolore' ? (
        <Nuancier
          prefixe="ral-int"
          libelle={t('Teinte intérieure')}
          choisi={config.ralInterieur ?? '9016'}
          onChoisir={(ralInterieur) => champ({ ralInterieur })}
        />
      ) : null}

      {config.couleur === 'plaxe' ? (
        <div className="bloc">
          <span className="champ">{t('Décor')}</span>
          <div className="tuiles" role="group" aria-label={t('Décor')}>
            {DECORS_PLAXES.map((decor) => (
              <Tuile
                key={decor.id}
                test={`plaxe-${decor.id}`}
                label={decor.nom}
                actif={(config.decorPlaxe ?? DECORS_PLAXES[0].id) === decor.id}
                onClick={() => champ({ decorPlaxe: decor.id })}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* CE QUE LE CHOIX IMPOSE, dit par le coeur et pas par cet ecran :
          un delai de laquage hors standard, la dilatation d'un PVC fonce,
          une bicoloration qui n'en est pas une.
          
          Les conseils arrivent AVEC cet ecran (`conseils-teinte.ts`) et pas
          avec le dessin : quatre paragraphes de francais que tout visiteur
          telechargeait, y compris celui qui reste au blanc. */}
      {conseils.length > 0 ? (
        <ul className="liste-securites" data-test="remarques-teinte">
          {conseils.map((conseil) => (
            <li key={conseil}>{conseil}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/**
 * UNE GRILLE DE PASTILLES. Les deux faces d'une bicoloration en demandent
 * une chacune, et les ecrire deux fois aurait fait diverger la seconde a la
 * premiere correction.
 *
 * Chaque pastille porte SON CODE, parce que c'est lui qu'on commande : un
 * atelier ne recoit pas << le gris fonce >>, il recoit du 7016. Une pastille
 * sans code oblige a survoler pour savoir ce qu'on choisit, et sur un
 * telephone il n'y a pas de survol.
 */
function Nuancier(props: {
  prefixe: string;
  libelle: string;
  choisi: string;
  onChoisir: (code: string) => void;
}) {
  return (
    <div className="bloc">
      <span className="champ">{props.libelle}</span>
      <div className="pastilles" role="group" aria-label={props.libelle}>
        {NUANCIER.map((teinte) => (
          <button
            key={teinte.code}
            type="button"
            className="pastille"
            data-test={`${props.prefixe}-${teinte.code}`}
            style={{ background: teinte.hex }}
            aria-pressed={props.choisi === teinte.code}
            title={`RAL ${teinte.code} — ${teinte.nom}${teinte.standard ? '' : ' (hors standard, délai)'}`}
            onClick={() => props.onChoisir(teinte.code)}
          >
            <span>{teinte.code}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * LA COMPOSITION DES PETITS-BOIS. Elle vit dans ce fichier et pas dans le
 * sien parce qu'elle partage son SORT : un ecran que la plupart des
 * configurations n'ouvrent jamais. Trois morceaux minuscules coutent plus
 * cher au reseau qu'un seul -- trois requetes, trois poignees de main.
 *
 * Elle ne change pas le prix : meme baguette, meme travail. Elle change
 * tout le dessin.
 */
export function ChoixPetitsBois(props: {
  config: JoineryConfiguration;
  champ: (patch: Partial<JoineryConfiguration>) => void;
}) {
  const t = useT();
  const { config, champ } = props;
  return (
    <div className="bloc">
      <span className="champ">{t('Composition des petits-bois')}</span>
      <div className="segmente" role="group" aria-label={t('Composition des petits-bois')}>
        {(Object.keys(LIBELLE_PETITS_BOIS) as CompositionPetitsBois[]).map((composition) => (
          <button
            key={composition}
            type="button"
            data-test={`petits-bois-${composition}`}
            aria-pressed={(config.compositionPetitsBois ?? 'droits') === composition}
            onClick={() => champ({ compositionPetitsBois: composition })}
          >
            {t(LIBELLE_PETITS_BOIS[composition])}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Les trois compositions, nommees comme un menuisier les nomme. */
const LIBELLE_PETITS_BOIS: Record<CompositionPetitsBois, string> = {
  droits: 'Droits',
  losanges: 'Losanges',
  imperiale: 'Croisée impériale',
};

/** La peau du nuancier — voir le commentaire à son point de rendu. */
const FEUILLE_TEINTE = `
/* LE NUANCIER. Des pastilles de couleur, et le CODE RAL dessus -- c'est lui
   qu'on commande, et une pastille sans son code oblige a survoler pour
   savoir ce qu'on choisit. Le code s'ecrit en blanc ou en noir selon la
   teinte, par un melange (mix-blend-mode) plutot que par un calcul : le
   navigateur sait faire, et cela evite de recalculer une luminance qui vit
   deja dans le coeur. */
.pastilles { display: flex; flex-wrap: wrap; gap: 6px; }
.pastille { width: 54px; height: 40px; border: 1px solid var(--ahjc-bord); border-radius: 6px; cursor: pointer; padding: 0; display: grid; place-items: end center; overflow: hidden; }
.pastille span { font-size: 10px; font-weight: 600; color: #fff; mix-blend-mode: difference; padding-bottom: 3px; letter-spacing: .02em; }
.pastille[aria-pressed="true"] { outline: 2px solid var(--ahjc-accent); outline-offset: 2px; border-color: var(--ahjc-accent); }
.pastille:focus-visible { outline: 2px solid var(--ahjc-accent); outline-offset: 2px; }
`;
