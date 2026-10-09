/**
 * Pourquoi ce fichier existe : le PLAN DE FAÇADE — la pièce DP4 d'une
 * déclaration préalable. Le plan de masse (DP2) dit où l'ouvrage se pose ;
 * celui-ci dit de quoi il aura l'air, et c'est celui-là que l'instructeur
 * d'urbanisme regarde pour accepter ou refuser.
 *
 * IL PORTE SA PROPRE SAISIE, et c'est la décision de ce fichier. La façade
 * ne se devine pas — largeur, hauteur à l'égout, ce qu'on voit du toit — et
 * ces trois cotes n'intéressent QUE cet onglet. Les mettre dans le panneau
 * de configuration les aurait fait payer, en octets et en attention, à tous
 * ceux qui achètent une fenêtre sans rien déclarer en mairie. Elles vivent
 * donc ici, dans le morceau que seul ouvre celui qui monte un dossier.
 *
 * IL MONTRE DEUX ÉTATS, parce qu'un DP4 en demande deux : ce qui existe et
 * ce qui est projeté. La différence entre les deux planches est exactement
 * l'ouvrage — c'est ce que la mairie veut voir, et rien d'autre.
 *
 * CE QU'IL NE FAIT PAS : décider. Le refus, la déduction du faîtage, le
 * raccourci d'une fenêtre de toit, la phrase qui dit ce qui manque — tout
 * vient de `export/facade.ts`. Cet écran collecte et montre.
 */

import { useMemo } from 'react';
import {
  elevationToSvg,
  type JoineryConfiguration,
  type FacadeDeclaree,
  type PricingCatalog,
  type ToitureVue,
  type Unite,
} from '@ahjc/core';
// Par leur CHEMIN et non par l'index : le plan de façade est un écran qu'on
// ouvre quand on monte un dossier d'urbanisme, et un export de confort le
// ramènerait dans le chargement initial de tout le monde.
import {
  computePlanDeFacade,
  planDeFacadeManquant,
  poseAuSol,
} from '@ahjc/core/src/export/facade.ts';
import { ChampCote } from './briques.tsx';
import { useT, aTraduire } from '../i18n.ts';

/** Ce que chaque vue de toiture montre — dit en clair, parce qu'on confond. */
const TOITURES: Array<{ id: ToitureVue; nom: string }> = [
  { id: 'gouttiere', nom: aTraduire('Côté gouttière — on voit la bande du toit') },
  { id: 'pignon', nom: aTraduire('Pignon — on voit le triangle') },
  { id: 'monopente', nom: aTraduire('Monopente') },
  { id: 'terrasse', nom: aTraduire('Toit-terrasse') },
];

/** La façade de départ : une maison courante, à compléter et à corriger. */
const DEPART: FacadeDeclaree = { largeurMm: 8000, hauteurEgoutMm: 5400, toiture: 'gouttiere' };

export function VueFacade(props: {
  config: JoineryConfiguration;
  catalogue: PricingCatalog;
  unite: Unite;
  /**
   * Un PATCH de configuration, et non « une façade ». L'allège fait partie
   * des cotes que ce dessin réclame, et elle vit sur la configuration, pas
   * sur la façade : elle y était déjà, pour la règle du feuilleté. Deux
   * champs pour une hauteur, c'est un jour où ils se contredisent.
   */
  onChamp: (patch: Partial<JoineryConfiguration>) => void;
}) {
  const t = useT();
  const facade = props.config.facade;
  const manque = useMemo(
    () => planDeFacadeManquant(props.config, props.catalogue),
    [props.config, props.catalogue],
  );
  const planches = useMemo(() => {
    if (manque) return null;
    const dessiner = (etat: 'existant' | 'projete', titre: string) => {
      const plan = computePlanDeFacade(props.config, props.catalogue, { etat });
      return plan ? elevationToSvg(plan, { unite: props.unite, titre }) : null;
    };
    return {
      existant: dessiner('existant', t('Façade — état existant')),
      projete: dessiner('projete', t('Façade — état projeté')),
    };
  }, [manque, props.config, props.catalogue, props.unite, t]);

  const modifier = (patch: Partial<FacadeDeclaree>) =>
    props.onChamp({ facade: { ...DEPART, ...facade, ...patch } });
  // L'ALLÈGE N'EST RÉCLAMÉE QUE SI L'OUVRAGE N'EST PAS AU SOL — et elle est
  // saisie ICI parce que le panneau ne l'offre qu'aux fenêtres : un volet
  // sans ce champ leur plan de façade restait bloqué sans recours.
  const allegeUtile = !poseAuSol(props.config.famille) && props.config.famille !== 'fenetre-toit';

  return (
    <div className="vue-facade" data-test="plan-de-facade">
      <div className="facade-saisie">
        <div className="duo">
          <div>
            <ChampCote
              id="ahjc-facade-largeur"
              test="facade-largeur"
              nom={aTraduire('Largeur de la façade')}
              unite={props.unite}
              valeurMm={facade?.largeurMm}
              facultatif
              onChange={(valeurMm) => modifier({ largeurMm: valeurMm ?? 0 })}
            />
          </div>
          <div>
            <ChampCote
              id="ahjc-facade-egout"
              test="facade-egout"
              nom={aTraduire('Hauteur à l’égout')}
              unite={props.unite}
              valeurMm={facade?.hauteurEgoutMm}
              facultatif
              onChange={(valeurMm) => modifier({ hauteurEgoutMm: valeurMm ?? 0 })}
            />
          </div>
        </div>
        <div className="duo">
          <div>
            <label className="champ" htmlFor="ahjc-facade-toiture">
              {t('Ce qu’on voit du toit')}
            </label>
            <select
              id="ahjc-facade-toiture"
              data-test="facade-toiture"
              value={facade?.toiture ?? DEPART.toiture}
              onChange={(evenement) =>
                modifier({ toiture: evenement.target.value as ToitureVue })
              }
            >
              {TOITURES.map((toiture) => (
                <option key={toiture.id} value={toiture.id}>
                  {t(toiture.nom)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <ChampCote
              id="ahjc-facade-faitage"
              test="facade-faitage"
              nom={aTraduire('Hauteur au faîtage')}
              unite={props.unite}
              valeurMm={facade?.hauteurFaitageMm}
              facultatif
              onChange={(valeurMm) => modifier({ hauteurFaitageMm: valeurMm })}
            />
          </div>
        </div>
        <div className="duo">
          {allegeUtile ? (
            <div>
              <ChampCote
                id="ahjc-facade-allege"
                test="facade-allege"
                nom={aTraduire('Hauteur d’allège')}
                unite={props.unite}
                valeurMm={props.config.hauteurAllegeMm}
                facultatif
                onChange={(hauteurAllegeMm) => props.onChamp({ hauteurAllegeMm })}
              />
            </div>
          ) : null}
          <div>
            <ChampCote
              id="ahjc-facade-implantation"
              test="facade-implantation"
              nom={aTraduire('Depuis l’angle gauche')}
              unite={props.unite}
              valeurMm={facade?.implantationXMm}
              facultatif
              onChange={(valeurMm) => modifier({ implantationXMm: valeurMm })}
            />
            {/* CENTRÉ TANT QU'ON NE DIT RIEN, et il faut le dire : c'est la
                cote que l'instructeur recoupe avec le plan de masse, et un
                ouvrage centré par défaut n'est pas un ouvrage mesuré. */}
            <p className="aide">
              {t('Sans cette cote, l’ouvrage est centré sur la façade — ce n’est pas une mesure.')}
            </p>
          </div>
        </div>
      </div>

      {manque ? (
        <p className="a-venir" data-test="facade-manque">
          {manque}
        </p>
      ) : (
        <div className="facade-planches">
          {/* LES DEUX ÉTATS, côte à côte. Un DP4 en demande deux, et la
              différence entre les deux planches EST le projet. */}
          <figure>
            <figcaption>{t('État existant')}</figcaption>
            <div dangerouslySetInnerHTML={{ __html: planches!.existant ?? '' }} />
          </figure>
          <figure>
            <figcaption>{t('État projeté')}</figcaption>
            <div
              data-test="facade-projete"
              dangerouslySetInnerHTML={{ __html: planches!.projete ?? '' }}
            />
          </figure>
        </div>
      )}
    </div>
  );
}
