/**
 * Pourquoi ce fichier existe : le viewport — l'aperçu de la menuiserie et
 * ses onglets 2D / 3D / RA / photo. Le 2D est le DÉFAUT (docs/00 §8, décision
 * 3) : le prix n'attend jamais la 3D. Les trois autres onglets existent déjà,
 * désactivés et étiquetés « phase 3 » — un onglet qui apparaîtra plus tard
 * ne surprend personne s'il s'annonce.
 *
 * Solution écartée : rendre le SVG en JSX, élément par élément. Le dessin
 * serait alors écrit deux fois (ici et dans `export/svg.ts` pour le devis et
 * la vignette) et divergerait. Le widget consomme la MÊME chaîne SVG que le
 * PDF — d'où l'insertion directe, sans risque : `elevationToSvg()` échappe
 * ses libellés et ne produit aucun script.
 *
 * Incident fondateur : « ce que le client a vu est ce que l'atelier lit »
 * (docs/08, règle 7).
 */

import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { aUneCoupeDeProfil } from '@ahjc/core';
import {
  computeMeasureReport,
  computeMetre,
  estLineaire,
  estPortail,
  elevationToSvg,
  moduleDe,
  refusFamilleNonChargee,
  type JoineryConfiguration,
  type PricingCatalog,
  type RapportAcoustique,
  type UwReport,
} from '@ahjc/core';
import type { Elevation, Geometry3D } from '@ahjc/core';
import type { EtatWidget } from '../etat.ts';
import { formater, type Unite } from '../unites.ts';
import { useT } from '../i18n.ts';
const Vue3D = lazy(() => import('./Vue3D.tsx').then((module) => ({ default: module.Vue3D })));
const VuePhoto = lazy(() =>
  import('./VuePhoto.tsx').then((module) => ({ default: module.VuePhoto })),
);
const VuePlan = lazy(() => import('./VuePlan.tsx').then((module) => ({ default: module.VuePlan })));
// LA FAÇADE — la pièce DP4. Elle porte sa propre saisie (largeur du mur,
// hauteur à l'égout, ce qu'on voit du toit) : trois cotes qui n'intéressent
// que celui qui monte un dossier d'urbanisme, et qui n'ont donc rien à faire
// dans le chargement initial de celui qui compare des prix.
const VueFacade = lazy(() =>
  import('./VueFacade.tsx').then((module) => ({ default: module.VueFacade })),
);
// LA PEAU DES VUES A LA DEMANDE. Le CSS du canevas, de la RA, de la photo
// et de la coupe suit leur code au lieu de voyager dans la feuille
// principale. On le rend comme un noeud React : il atterrit dans la racine
// fantome parce que c'est la que l'arbre vit, sans manipuler la racine.
const StylesVues = lazy(() =>
  import('../styles-vues.ts').then((module) => ({
    default: () => <style>{module.FEUILLE_VUES}</style>,
  })),
);

const VueCoupe = lazy(() =>
  import('./VueCoupe.tsx').then((module) => ({ default: module.VueCoupe })),
);

/**
 * LE DRAPEAU « disponible » EST PARTI — lot C12b, et c'est ce qui a payé les
 * trois conditions du pied de vue.
 *
 * Il datait du jour où les onglets 3D, RA et photo s'annonçaient « phase 3 » :
 * un onglet qui apparaîtra plus tard ne surprend personne s'il s'annonce. La
 * phase 3 est arrivée — **les six valaient `true`** —, et il restait donc un
 * champ, un `disabled`, un `title`, une garde au clavier et une au clic pour
 * une condition qui ne pouvait plus être fausse. Le libellé « Disponible en
 * phase 3 » part avec, du code et du dictionnaire.
 */
const ONGLETS: Array<{ id: EtatWidget['vue']; label: string }> = [
  { id: '2d', label: '2D' },
  // Le PLAN n'apparaît que sur un ouvrage linéaire : une fenêtre n'a pas de
  // terrain, et lui offrir une vue de dessus vide serait une promesse creuse.
  { id: 'plan', label: 'Plan' },
  // La FAÇADE n'apparaît pas sur un ouvrage linéaire — son élévation EST sa
  // façade, et le plan de masse dit le reste — ni sur un store intérieur,
  // qui ne se voit pas de la rue et ne relève d'aucune déclaration.
  { id: 'facade', label: 'Façade' },
  { id: '3d', label: '3D' },
  { id: 'photo', label: 'Photo' },
];

export function Viewport(props: {
  config: JoineryConfiguration;
  catalogue: PricingCatalog;
  elevation: Elevation;
  uw: UwReport | null;
  /** L'affaiblissement acoustique — null sur les familles sans vitrage. */
  acoustique: RapportAcoustique | null;
  vue: EtatWidget['vue'];
  /** L'unité des cotes affichées — celle de l'hôte. Le dessin reste en mm. */
  unite: Unite;
  /**
   * L'adresse qui sert le modèle de réalité augmentée, sans son `?c=`. Elle
   * traverse cet écran sans être lue : seul `VueRA` s'en sert, et il est un
   * morceau paresseux qu'on ne veut pas coupler au contexte de l'hôte.
   */
  modeleRa?: string;
  onVue: (vue: EtatWidget['vue']) => void;
  /** Un patch de configuration — la façade du DP4 se saisit dans son onglet. */
  onFacade: (patch: Partial<JoineryConfiguration>) => void;
}) {
  const t = useT();
  const mesure = computeMeasureReport(props.config, props.catalogue);
  const cote = (valeurMm: number) => formater(valeurMm, props.unite);
  const svg = elevationToSvg(props.elevation, {
    unite: props.unite,
    titre: `${t(props.catalogue.familles[props.config.famille].label)} ${cote(props.config.widthMm)} × ${cote(props.config.heightMm)}`,
  });
  // LE VOLUME, et TROIS paresses superposées — chacune payée par un lot
  // différent, chacune nécessaire :
  //
  //   1. le CODE du maillage (`geometry3d.ts`, 12,9 ko) n'est allé chercher
  //      qu'à l'ouverture d'un onglet qui le regarde. C'est le lot 7.5 :
  //      avant lui, il arrivait avec le module de famille, donc avec le
  //      prix, donc pour tout le monde ;
  //   2. le CALCUL n'a lieu que sur les onglets 3D et RA ;
  //   3. three.js lui-même n'est téléchargé qu'à l'affichage de la scène
  //      (phase 3).
  const [geometrie, setGeometrie] = useState<Geometry3D | null>(null);
  const enVolume = props.vue === '3d' || props.vue === 'ar';
  useEffect(() => {
    if (!enVolume) {
      setGeometrie(null);
      return;
    }
    const module = moduleDe(props.config.famille);
    if (!module) throw refusFamilleNonChargee(props.config.famille);
    let vivant = true;
    module.volume().then((calculer) => {
      if (vivant) setGeometrie(calculer(props.config, props.catalogue));
    });
    return () => {
      vivant = false;
    };
  }, [enVolume, props.config, props.catalogue]);
  // calculer pour n'importe quelle configuration, et il la sortait donc
  // de pont thermique, sous un produit qui est un simple tube. C'était
  // vendre au client une coupe de ce qu'il n'achète pas.
  //
  // quand elle apportera quelque chose. D'ici là, pas de coupe vaut mieux
  // qu'une coupe fausse.
  const portail = estPortail(props.config.famille);
  const lineaire = estLineaire(props.catalogue, props.config.famille);
  // CE QUE LE PIED ET LE BANDEAU ONT LE DROIT DE DIRE — lot C12b.
  //
  // Les trois phrases se lisaient sur les quarante familles : le vitrage, les
  // paumelles et le vantail. Elles se dérivent désormais de ce que le DESSIN
  // porte — un symbole d'ouverture, un ouvrant — et de ce que le CATALOGUE
  // déclare. Aucune liste de familles : « un verrou qui énumère a raison le
  // jour où on l'écrit et tort au lot suivant » (lots D3, D4, D9).
  const vitrable =
    props.catalogue.familles[props.config.famille]?.vitree ||
    props.config.famille === 'porte-entree';
  // UN SEUL PRÉDICAT POUR LES DEUX PHRASES DU PIED, et c'est une économie
  // MESURÉE : la première rédaction en avait deux — un symbole d'ouverture pour
  // les paumelles, un ouvrant pour le vantail — et l'entrée sortait à vingt et
  // un octets de trop. Un ouvrage qui porte un OUVRANT a un vantail et des
  // paumelles ; celui qui n'en porte pas n'a ni l'un ni l'autre.
  //
  // ET IL LIT LE CATALOGUE AVANT LE DESSIN, parce qu'un parcours l'a exigé :
  // SUR UNE MENUISERIE DE FORME, L'OUVRANT QUITTE `rects` POUR `contours`
  // (`drawing.ts`). Une fenêtre en trapèze perdait donc les deux phrases, sa
  // hauteur de document changeait au clic, et l'ancre de défilement du
  // navigateur lâchait : la page partait de 67 px. Le verrou du lot D19 —
  // « une tuile ordinaire ne fait pas défiler la page » — l'a dit au premier
  // passage. Une famille VITRÉE a toujours un vantail, quelle que soit sa
  // forme ; pour les autres, c'est le dessin qui décide.
  const resume = moduleDe(props.config.famille)?.resume?.(props.config);
  const ouvrant =
    vitrable || props.elevation.rects.some((rect) => rect.role === 'ouvrant');
  // Le PLAN n'existe que sur un ouvrage linéaire : les flèches du tablist
  // doivent circuler dans les onglets RÉELLEMENT présents, pas dans la
  // liste théorique — sinon une flèche mène à un onglet qui n'est pas là.
  const facadePossible = !lineaire && props.config.famille !== 'store-interieur';
  const onglets = ONGLETS.filter(
    (onglet) =>
      (onglet.id !== 'plan' || lineaire) && (onglet.id !== 'facade' || facadePossible),
  );
  const metre = useMemo(
    () => (lineaire ? computeMetre(props.config, props.catalogue) : null),
    [lineaire, props.config, props.catalogue],
  );
  // Les teintes doivent garder leur IDENTITÉ tant que les couleurs ne
  // changent pas : passées en objet littéral, elles étaient neuves à chaque
  // rendu du viewport, et la scène 3D se reconstruisait entièrement — parce
  // qu'on avait ouvert le détail du prix, par exemple.
  const teintes = useMemo(
    () => ({
      cadre: props.elevation.couleurs.cadreInterieur,
      cadreExterieur: props.elevation.couleurs.cadreExterieur,
      vitrage: props.elevation.couleurs.vitrage,
      // RIEN D'AUTRE QUE DES COULEURS, et c'est le lot D18 qui l'a resserré.
      //
      // Ce memo portait aussi l'aspect du verre, le fil du bois, la brillance
      // du laquage et son vernis. Ce sont des grandeurs de RENDU : elles ne
      // servent qu'à la scène en volume, qui est un morceau PARESSEUX, et
      // les calculer ici faisait entrer leurs tables dans le CHARGEMENT
      // INITIAL — payées par tout visiteur qui n'ouvre jamais l'onglet 3D.
      //
      // Elles vivent maintenant dans `Vue3D`, qui reçoit la configuration
      // entière et sait les tirer lui-même. Le viewport ne passe donc que ce
      // que le DESSIN sait : des couleurs. Mesuré en cherchant de quoi payer
      // la correction de l'accordéon, et c'est ce qui l'a payée.
    }),
    [
      props.elevation.couleurs.cadreInterieur,
      props.elevation.couleurs.cadreExterieur,
      props.elevation.couleurs.vitrage,
    ],
  );

  return (
<section className="viewport" aria-label={t('Aperçu de la menuiserie')}>
      <div className="viewport-barre">
        {/* UN VRAI TABLIST, ou pas de tablist du tout. `role="tab"` promet
            à un lecteur d'écran un motif complet : une seule tabulation
            entre dans le groupe, les flèches circulent dedans, et chaque
            onglet dit quel panneau il commande. Un tablist à moitié —
            cinq boutons dans la file de tabulation, sans `aria-controls`,
            sans flèches — annonce « onglet 3 sur 5 » et se comporte comme
            autre chose. C'était le cas ici. */}
        <div className="onglets" role="tablist" aria-label={t('Mode d’aperçu')}>
          {onglets.map((onglet) => (
            <button
              key={onglet.id}
              type="button"
              role="tab"
              id={`ahjc-onglet-${onglet.id}`}
              aria-selected={props.vue === onglet.id}
              aria-controls="ahjc-scene"
              // LE TABINDEX GLISSANT : seul l'onglet actif est dans la file
              // de tabulation. On entre dans le groupe d'un coup de Tab, on
              // y circule aux flèches, on en sort d'un autre Tab — au lieu
              // de traverser cinq boutons pour atteindre le panneau.
              tabIndex={props.vue === onglet.id ? 0 : -1}
              onKeyDown={(evenement) => {
                const pas =
                  evenement.key === 'ArrowRight' ? 1 : evenement.key === 'ArrowLeft' ? -1 : 0;
                if (pas === 0) return;
                evenement.preventDefault();
                const ici = onglets.findIndex((candidat) => candidat.id === props.vue);
                // On boucle : après le dernier vient le premier. C'est le
                // comportement attendu d'un tablist, et il évite le
                // cul-de-sac au bout de la rangée.
                const suivant = onglets[(ici + pas + onglets.length) % onglets.length];
                props.onVue(suivant.id);
              }}
              onClick={() => props.onVue(onglet.id)}
            >
              {onglet.label}
            </button>
          ))}
        </div>
        {props.uw ? (
          <p className="badge-uw" data-test="badge-performances">
            {t('Uw')} <strong>{props.uw.uw.toFixed(2).replace('.', ',')}</strong>{' '}
            {t('W/m²·K')}
            {/* LE FACTEUR SOLAIRE, à côté du Uw et pas ailleurs. Les aides
                posent un critère DOUBLE — Uw sous le seuil ET Sw au-dessus —
                et n'en montrer qu'un revient à promettre une aide qu'un
                dossier peut refuser. Deux nombres qui décident ensemble se
                lisent ensemble. */}
            {' · '}
            {t('Sw')} <strong>{props.uw.sw.toFixed(2).replace('.', ',')}</strong>
            {/* LE BRUIT. Deuxième argument d'achat après la thermique, et il
                n'était affiché nulle part : un client qui payait un vitrage
                phonique n'avait aucun chiffre pour savoir ce qu'il achetait,
                alors que le Uw se recalcule à chaque geste. */}
            {props.acoustique ? (
              <>
                {' · '}
                {t('Rw')} <strong>{props.acoustique.rwFenetreDb}</strong> {t('dB')}
              </>
            ) : null}
            {' · '}
            {t('calcul simplifié')}
          </p>
        ) : resume?.length ? (
          // LES GRANDEURS DE L'OUVRAGE, là où une fenêtre lit son Uw — lot I11.
          // Le GROUPE les calcule (`ModuleFamille.resume`) : ce composant est
          // ferait descendre la révolution chez tout visiteur.
          <p className="badge-uw" data-test="resume-ouvrage">
            {resume.map((g, i) => (
              <span key={g.nom}>
                {i ? ' · ' : ''}
                {g.nom} <strong>{g.valeur}</strong>
              </span>
            ))}
          </p>
        ) : vitrable ? (
          // « SANS VITRAGE » NE SE DIT QU'À UN OUVRAGE QUI POURRAIT EN AVOIR
          // UN — lot C12b, relevé à l'écran par le propriétaire du projet sur
          // posé sur un ouvrage qui n'en est pas une, et c'est la faute que le
          // lot C11a avait relevée sur la gamme de profilé (« PVC 86 » sur un
          <p className="badge-uw">{t('Sans vitrage — pas de coefficient thermique')}</p>
        ) : null}
      </div>

      <div
        className="scene"
        data-test="scene"
        id="ahjc-scene"
        role="tabpanel"
        aria-labelledby={`ahjc-onglet-${props.vue}`}
      >
        {props.vue === '2d' ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : null}
        {props.vue === 'plan' && lineaire ? (
          <VuePlan config={props.config} catalogue={props.catalogue} unite={props.unite} />
        ) : null}
        <Suspense fallback={<p className="a-venir">{t('Chargement de la façade…')}</p>}>
          {props.vue === 'facade' && facadePossible ? (
            <VueFacade
              config={props.config}
              catalogue={props.catalogue}
              unite={props.unite}
              onChamp={props.onFacade}
            />
          ) : null}
        </Suspense>
        <Suspense fallback={<p className="a-venir">{t('Chargement de la vue…')}</p>}>
        {props.vue === '3d' && geometrie ? (
          <Vue3D
            geometrie={geometrie}
            teintes={teintes}
            config={props.config}
            debordMurMm={
              props.config.ouverture === 'galandage'
                ? props.config.widthMm / Math.max(1, props.config.vantaux) + 500
                : undefined
            }
          />
        ) : null}
        {props.vue === 'photo' ? <VuePhoto elevation={props.elevation} /> : null}
        </Suspense>
      </div>

      {/* La coupe de profilé : l'argument technique rendu visible, à côté du
          dessin plutôt que dans une fiche que personne n'ouvre — mais À LA
          DEMANDE. C'est un argument, pas un prix : le client qui ne descend
          jamais jusque-là n'a aucune raison de payer son code. */}
      {aUneCoupeDeProfil(props.catalogue, props.config.famille) ? (
        <Suspense fallback={null}>
          <VueCoupe config={props.config} catalogue={props.catalogue} unite={props.unite} />
        </Suspense>
      ) : null}

      {/* La feuille des vues a la demande, chargee des qu'une d'elles est a
          l'ecran — la coupe comprise, qui s'affiche sur toute menuiserie. */}
      {props.vue !== '2d' || !portail ? (
        <Suspense fallback={null}>
          <StylesVues />
        </Suspense>
      ) : null}

      {/* LE MÉTRÉ, sous le dessin : ce que le dépôt prépare et ce que le
          maçon coule. C'est le pendant du pied de vue d'une menuiserie —
          vantail, clair, poids — sur un produit qui n'a ni l'un ni l'autre. */}
      {metre ? (
        <div className="viewport-pied" data-test="metre">
          <span>{t('{n} m développés', { n: Math.round(metre.longueurMm / 100) / 10 })}</span>
          {metre.poteaux > 0 ? (
            <span>
              {t('{n} poteaux', { n: metre.poteaux })}
              {metre.poteauxAngle > 0 ? t(' dont {n} d’angle', { n: metre.poteauxAngle }) : ''}
            </span>
          ) : null}
          {metre.panneaux > 0 ? <span>{t('{n} panneaux', { n: metre.panneaux })}</span> : null}
          <span>{t('{n} L de béton', { n: metre.betonLitres })}</span>
        </div>
      ) : null}

      <div className="viewport-pied">
        {ouvrant ? (
          <span>{t('Vue intérieure — la pointe du symbole désigne les paumelles')}</span>
        ) : null}
        {ouvrant ? (
          <span>
            {t('Vantail {l} × {h}', {
              l: cote(mesure.vantail.widthMm),
              h: cote(mesure.vantail.heightMm),
            })}
          </span>
        ) : null}
        {mesure.clairVitrage ? (
          <span>
            {t('Clair {l} × {h}', {
              l: cote(mesure.clairVitrage.widthMm),
              h: cote(mesure.clairVitrage.heightMm),
            })}
          </span>
        ) : null}
        {mesure.glassWeightKg > 0 ? (
          <span>{t('Vitrage {kg} kg', { kg: String(mesure.glassWeightKg).replace('.', ',') })}</span>
        ) : null}
      </div>
    </section>
  );
}
