/**
 * Pourquoi ce fichier existe : l'etape du VITRAGE etait le plus gros bloc
 * qui restait dans `Panneau.tsx` -- pres de dix kilo-octets bruts -- et son
 * CORPS ne s'affiche qu'une fois l'etape ouverte. Un visiteur qui regarde
 * un prix et repart ne l'a jamais depliee.
 *
 * C'est la meme couture que l'etape 4 des fermetures, que le nuancier et
 * que les petits bois, et la meme regle : ce qui ne s'affiche qu'apres un
 * clic peut arriver apres ce clic.
 *
 * LE PIEGE, rate DEUX fois avant d'etre compris, et c'est pour cela qu'il
 * est ecrit ici autant que dans `scripts/verifier-bundle.mjs` :
 *
 *   1. le `<Etape numero={4}>` n'est pas au premier niveau -- il est
 *      enveloppe dans `{vitree ? (…) : null}`. Decouper sur la balise seule
 *      casse le JSX des deux cotes ;
 *   2. et il ne faut PAS reindenter ce qu'on deplace. La deuxieme tentative
 *      a voulu remonter les niveaux d'un cran ; les remplacements se sont
 *      manges entre eux et le fichier est sorti illisible. Le JSX se moque
 *      de l'indentation ; le relecteur, lui, prefere un bloc deplace tel
 *      quel a un bloc reformate de travers.
 *
 * `null` en attente et pas un texte de chargement : le morceau pese deux
 * kilo-octets, il arrive avant que l'oeil ne s'en apercoive, et un
 * clignotement dans un accordeon coute plus cher que l'attente qu'il
 * annonce.
 */

import type { ReactNode } from 'react';
import {
  computeUw,
  feuilleteImpose,
  modelePorteDe,
  type AspectVitrage,
  type CompositionPetitsBois,
  type JoineryConfiguration,
  type PricingCatalog,
  type RemplissagePorte,
  type VitrageBase,
} from '@ahjc/core';
import { aTraduire, useT } from '../i18n.ts';
import type { Unite } from '../unites.ts';
import { ChampCote, Etape, Tuile, delta, libelleDelta } from './briques.tsx';
import { rangerSousLEcran } from './Notes.tsx';

/**
 * CE QUE CET ÉCRAN MONTRE, ET QUE LE PANNEAU RANGERA SOUS SON ÉTAPE — lot
 * D22. LE VITRAGE ET L'ASPECT D'UNE PORTE — et le modèle de porte est ici parce
// que sa part vitrée s'y décide.
 *
 * Les rangements voyagent avec l'écran qui les montre : ils pesaient 137
 * octets du chargement initial pour tous les visiteurs, et ils ne servent
 * qu'ici. L'appel est au niveau du MODULE — il s'exécute une fois, par le
 * seul fait que ce morceau soit importé (patron du lot Z0).
 */
rangerSousLEcran(4, ['vitrage-', 'ferrures-renforcees', 'feuillete-impose', 'modele-porte-']);

export function EtapeVitrage(props: {
  config: JoineryConfiguration;
  catalogue: PricingCatalog;
  /** L'etape ouverte dans le panneau -- l'accordeon reste chez le parent. */
  etape: number;
  /** L'unite de SAISIE — une peau sur les cotes, jamais une donnee de prix. */
  unite: Unite;
  ouvrir: (etape: number) => void;
  champ: (patch: Partial<JoineryConfiguration>) => void;
  notes: (etape: number) => ReactNode;
}) {
  const t = useT();
  const { config, catalogue, champ, notes, ouvrir, unite } = props;
  // Deux valeurs derivees que SEULE cette etape lit : le modele de panneau
  // d'une porte d'entree, et le feuillete que la reglementation impose.
  const modele = modelePorteDe(catalogue, config.famille, config.modelePorte);
  const feuilleteVerrouille = feuilleteImpose(config, catalogue);

  return (
    <Etape
          numero={4}
          titre={
            config.famille === 'porte-entree' ? aTraduire('Panneau et vitrage') : aTraduire('Vitrage')
          }
          resume={
            config.famille === 'porte-entree'
              ? `${modele?.nom ?? t('Panneau uni')} · ${t(LIBELLE_REMPLISSAGE[config.remplissagePorte ?? 'pleine']).toLowerCase()}`
              : LIBELLE_VITRAGE[config.vitrage?.base ?? 'double']
          }
          ouverte={props.etape === 4}
          onOuvrir={() => ouvrir(4)}
        >
          {config.famille === 'porte-entree' ? (
            <>
              {/* Le MODÈLE d'abord : une porte se choisit avec les yeux, et
                  c'est son panneau qu'on regarde avant sa part de vitrage. */}
              {catalogue.modelesPorte.length > 0 ? (
                <div className="bloc">
                  <span className="champ">{t('Modèle de panneau')}</span>
                  <div className="tuiles" role="group" aria-label={t('Modèle de panneau')}>
                    {catalogue.modelesPorte.map((candidat) => (
                      <Tuile
                        key={candidat.id}
                        test={`modele-${candidat.id}`}
                        label={candidat.nom}
                        note={libelleDelta(delta(config, { modelePorte: candidat.id }, catalogue))}
                        actif={(config.modelePorte ?? catalogue.modelesPorte[0].id) === candidat.id}
                        raison={candidat.argument}
                        onClick={() => champ({ modelePorte: candidat.id })}
                      />
                    ))}
                  </div>
                  <p className="aide">{modele?.argument ?? catalogue.modelesPorte[0].argument}</p>
                </div>
              ) : null}
              <span className="champ">{t('Part vitrée')}</span>
              <div className="tuiles" role="group" aria-label={t('Part vitrée')}>
              {(Object.keys(catalogue.coefRemplissagePorteMilliemes) as RemplissagePorte[]).map((remplissage) => (
                <Tuile
                  key={remplissage}
                  test={`remplissage-${remplissage}`}
                  label={LIBELLE_REMPLISSAGE[remplissage]}
                  note={libelleDelta(delta(config, { remplissagePorte: remplissage }, catalogue))}
                  actif={(config.remplissagePorte ?? 'pleine') === remplissage}
                  onClick={() => champ({ remplissagePorte: remplissage })}
                />
              ))}
              </div>
              {/* L'imposte vitrée au-dessus de la porte : un classique du
                  pavillon, qui éclaire une entrée sans fenêtre. */}
              <div className="bloc">
                <ChampCote
                  id="ahjc-imposte-porte"
                  test="imposte-porte"
                  nom={aTraduire('Imposte vitrée')}
                  unite={unite}
                  facultatif
                  placeholder={t('sans imposte')}
                  valeurMm={config.imposteHauteurMm}
                  onChange={(imposteHauteurMm) => champ({ imposteHauteurMm })}
                />
                <p className="aide">
                  {t('Hauteur du fixe vitré au-dessus de la porte, prise sur la hauteur totale.')}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="tuiles" role="group" aria-label={t('Vitrage')}>
                {(Object.keys(catalogue.coefVitrageMilliemes) as VitrageBase[]).map((base) => {
                  const candidat = { ...config, vitrage: { ...config.vitrage, base } };
                  const uw = computeUw(candidat, catalogue);
                  return (
                    <Tuile
                      key={base}
                      test={`vitrage-${base}`}
                      label={LIBELLE_VITRAGE[base]}
                      note={`${uw ? `Uw ${uw.uw.toFixed(2).replace('.', ',')} · ` : ''}${libelleDelta(delta(config, { vitrage: { ...config.vitrage, base } }, catalogue))}`}
                      actif={(config.vitrage?.base ?? 'double') === base}
                      onClick={() => champ({ vitrage: { ...config.vitrage, base } })}
                    />
                  );
                })}
              </div>
              <div className="bloc">
                {/* Le bloc porte trois questions distinctes, et chacune a
                    désormais son intitulé : « Traitements » seul chapeautait
                    autrefois deux cases, il en chapeauterait maintenant
                    huit. Un titre qui couvre tout ne dit plus rien. */}
                {/* L'ASPECT : le seul choix de vitrage qui se regarde. Les
                    trois autres sont des arguments qu'il faut croire sur
                    parole ; celui-ci, le client le voit sur le dessin. */}
                <span className="champ">{t('Aspect du verre')}</span>
                <div className="tuiles" role="group" aria-label={t('Aspect du verre')}>
                  {(Object.keys(catalogue.coefAspectVitrageMilliemes) as AspectVitrage[]).map(
                    (aspect) => (
                      <Tuile
                        key={aspect}
                        test={`aspect-${aspect}`}
                        label={LIBELLE_ASPECT[aspect]}
                        note={libelleDelta(
                          delta(
                            config,
                            { vitrage: { base: config.vitrage?.base ?? 'double', ...config.vitrage, aspect } },
                            catalogue,
                          ),
                        )}
                        actif={(config.vitrage?.aspect ?? 'clair') === aspect}
                        onClick={() =>
                          champ({
                            vitrage: { base: config.vitrage?.base ?? 'double', ...config.vitrage, aspect },
                          })
                        }
                      />
                    ),
                  )}
                </div>
                <span className="champ">{t('Ce qui se voit dans le vitrage')}</span>
                <div className="tuiles" role="group" aria-label={t('Ce qui se voit dans le vitrage')}>
                  <Tuile
                    test="store-integre"
                    label="Store vénitien intégré"
                    note={libelleDelta(
                      delta(config, { vitrage: { base: config.vitrage?.base ?? 'double', ...config.vitrage, storeIntegre: !config.vitrage?.storeIntegre } }, catalogue),
                    )}
                    actif={Boolean(config.vitrage?.storeIntegre)}
                    raison="Entre les verres : ni poussière, ni entretien, ni cordon qui pend."
                    onClick={() =>
                      champ({
                        vitrage: { base: config.vitrage?.base ?? 'double', ...config.vitrage, storeIntegre: !config.vitrage?.storeIntegre },
                      })
                    }
                  />
                  <Tuile
                    test="warm-edge"
                    label="Intercalaire à bord chaud"
                    note={libelleDelta(
                      delta(config, { vitrage: { base: config.vitrage?.base ?? 'double', ...config.vitrage, warmEdge: !config.vitrage?.warmEdge } }, catalogue),
                    )}
                    actif={Boolean(config.vitrage?.warmEdge)}
                    raison="Le bord du vitrage est son pont thermique : en polymère, il conduit deux fois moins."
                    onClick={() =>
                      champ({
                        vitrage: { base: config.vitrage?.base ?? 'double', ...config.vitrage, warmEdge: !config.vitrage?.warmEdge },
                      })
                    }
                  />
                </div>
                <span className="champ">{t('Performances')}</span>
                <div className="tuiles" role="group" aria-label={t('Performances')}>
                  <Tuile
                    label="Phonique 10/16/4"
                    note={libelleDelta(
                      delta(config, { vitrage: { base: config.vitrage?.base ?? 'double', ...config.vitrage, phonique: !config.vitrage?.phonique } }, catalogue),
                    )}
                    actif={Boolean(config.vitrage?.phonique)}
                    onClick={() =>
                      champ({
                        vitrage: { base: config.vitrage?.base ?? 'double', ...config.vitrage, phonique: !config.vitrage?.phonique },
                      })
                    }
                  />
                  <Tuile
                    test="vitrage-feuillete"
                    label="Feuilleté 44.2"
                    note={
                      feuilleteVerrouille
                        ? 'imposé par la règle'
                        : libelleDelta(
                            delta(config, { vitrage: { base: config.vitrage?.base ?? 'double', ...config.vitrage, feuillete: !config.vitrage?.feuillete } }, catalogue),
                          )
                    }
                    actif={Boolean(config.vitrage?.feuillete) || feuilleteVerrouille}
                    desactive={feuilleteVerrouille}
                    raison={
                      feuilleteVerrouille
                        ? aTraduire('Vitrage de sécurité obligatoire — NF DTU 39')
                        : undefined
                    }
                    onClick={() =>
                      champ({
                        vitrage: { base: config.vitrage?.base ?? 'double', ...config.vitrage, feuillete: !config.vitrage?.feuillete },
                      })
                    }
                  />
                </div>
              </div>
            </>
          )}
          {notes(4)}
        </Etape>
  );
}

const LIBELLE_VITRAGE: Record<VitrageBase, string> = {
  double: aTraduire('Double 4/16/4'),
  'double-itr': aTraduire('Double ITR'),
  triple: aTraduire('Triple 4/16/4/16/4'),
};

const LIBELLE_ASPECT: Record<AspectVitrage, string> = {
  clair: aTraduire('Clair'),
  depoli: aTraduire('Dépoli'),
  sable: aTraduire('Sablé'),
  serigraphie: aTraduire('Sérigraphié'),
};

const LIBELLE_REMPLISSAGE: Record<RemplissagePorte, string> = {
  pleine: aTraduire('Pleine'),
  'semi-vitree': aTraduire('Semi-vitrée'),
  vitree: aTraduire('Vitrée'),
};
