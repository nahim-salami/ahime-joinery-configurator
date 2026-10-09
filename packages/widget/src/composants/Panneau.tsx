/**
 * Pourquoi ce fichier existe : le panneau de réglages — les sept écrans du
 * parcours (docs/08 §1), **une décision par écran**. Chaque tuile affiche le
 * DELTA de prix qu'elle coûterait avant d'être choisie : « chaque prix bouge
 * sous les yeux, jamais après » (docs/08, règle 2).
 *
 * Solution écartée : un tarif indicatif figé par option (« alu +40 % »). Le
 * delta réel se calcule en rejouant le moteur sur la configuration candidate
 * — c'est gratuit (des fonctions pures, aucun réseau) et c'est exact, y
 * compris quand un choix en entraîne un autre (le vitrage lourd qui impose
 * les ferrures renforcées apparaît dans le delta du vitrage).
 *
 * Incident fondateur : le piège Neuffer — quatorze étapes qui découragent
 * (docs/09). D'où les préréglages avant la saisie libre, les étapes
 * repliées avec leur résumé, et aucune option cachée sans sa raison.
 */

import { Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  computePrice,
  computeUw,
  feuilleteImpose,
  flecheEffective,
  flecheParDefaut,
  formeDe,
  formesDeLaFamille,
  modelePorteDe,
  estLineaire,
  moteursDeLaFamille,
  nommerVantaux,
  poseApplicable,
  posePourFamille,
  systemesDuMateriau,
  type AspectVitrage,
  type Couleur,
  type FamilleId,
  type Gamme,
  type JoineryConfiguration,
  type Materiau,
  type Ouverture,
  type Pose,
  type PricingCatalog,
  type RemplissagePorte,
  type ReleveTroisPoints,
  type ValidationIssue,
  type VitrageBase,
} from '@ahjc/core';
import { MANIFESTE_FAMILLES, UNIVERS, familleCatalog, familleChargee } from '@ahjc/core';
import type { Univers } from '@ahjc/core';
import type { HostContext } from '../host-context.ts';
import { famillesOuvertes } from '../host-context.ts';
import { depuisMm, etiquette, formater, uniteDuContexte, versMm, type Unite } from '../unites.ts';
import { configurationParDefaut, euros, presetsParDefaut, type Action } from '../etat.ts';
import { Notes, notesDeLEtape } from './Notes.tsx';
import { ChampCote, Etape, Tuile, delta, libelleDelta } from './briques.tsx';
import { aTraduire, useT } from '../i18n.ts';

const VueGuide = lazy(() =>
  import('./VueGuide.tsx').then((module) => ({ default: module.VueGuide })),
);

// elle pesait dix pour cent du chargement initial pour des ecrans qu'une
// fenetre n'affiche jamais.
// Le nuancier et les décors — voir l'en-tête de leur fichier : une
// menuiserie blanche, qui reste le défaut, n'en affiche aucun.
// LE RELEVÉ AUX TROIS POINTS — six champs, et la case qui engage. Voir
// l'en-tête de son fichier : c'est lui qui ouvre le verrou du manifeste, et
// il n'arrive que si on le demande.
const Releve = lazy(() => import('./Releve.tsx').then((module) => ({ default: module.Releve })));

// L'etape du VITRAGE -- le plus gros bloc du panneau, et son corps ne
// s'affiche qu'une fois l'etape ouverte.
const EtapeVitrage = lazy(() =>
  import('./EtapeVitrage.tsx').then((module) => ({ default: module.EtapeVitrage })),
);

const ChoixTeinte = lazy(() =>
  import('./ChoixTeinte.tsx').then((module) => ({ default: module.ChoixTeinte })),
);
const ChoixPetitsBois = lazy(() =>
  import('./ChoixTeinte.tsx').then((module) => ({ default: module.ChoixPetitsBois })),
);

const EtapesFermetures = lazy(() =>
  import('./EtapesFermetures.tsx').then((module) => ({ default: module.EtapesFermetures })),
);

// LES PROTECTIONS SOLAIRES ont leur propre morceau, comme elles ont leur
// propre groupe dans le cœur. Les mettre dans `EtapesFermetures` aurait
// fait voyager la table de classe de vent avec chaque volet roulant —
// exactement ce que la séparation du groupe venait d'éviter.
const EtapesSolaire = lazy(() =>
  import('./EtapesSolaire.tsx').then((module) => ({ default: module.EtapesSolaire })),
);

const FAMILLES_A_FERMETURES = new Set<string>([
  'cloture',
  'garde-corps',
  'volet-roulant',
  'volet-battant',
  'moustiquaire',
  'store-interieur',
  // LE STORE BANNE ENTRE AU LOT O9b : sa TOILE fait 79 à 85 % de son image
  // (lot D17) et ne se choisissait nulle part. Sept octets d'entrée pour le
  // premier poste de décision du produit.
  'store-banne',
]);

const LIBELLE_MATERIAU: Record<Materiau, string> = {
  pvc: aTraduire('PVC'),
  alu: aTraduire('Aluminium'),
  bois: aTraduire('Bois'),
  mixte: aTraduire('Mixte bois-alu'),
};
const LIBELLE_GAMME: Record<Gamme, string> = {
  standard: aTraduire('Standard'),
  confort: aTraduire('Confort'),
  performance: aTraduire('Performance'),
};
const LIBELLE_COULEUR: Record<Couleur, string> = {
  blanc: aTraduire('Blanc'),
  plaxe: aTraduire('Teinte plaxée'),
  'ral-1-face': aTraduire('RAL une face'),
  bicolore: aTraduire('Bicolore int./ext.'),
};
const LIBELLE_OUVERTURE: Record<Ouverture, string> = {
  frappe: aTraduire('À la française'),
  fixe: aTraduire('Fixe'),
  soufflet: aTraduire('Soufflet'),
  coulissant: aTraduire('Coulissant'),
  galandage: aTraduire('Galandage'),
  levage: aTraduire('Coulissant à levage'),
};
/**
 * L'aspect du verre. Trois procédés qui s'EXCLUENT — on n'acidifie pas un
 * verre déjà sablé — d'où des tuiles et non des cases à cocher.
 */


/**
 * LE NOM D'UN RAYON, tel qu'il s'affiche.
 *
 * Il vit ICI et non dans le manifeste, pour deux raisons. La première est
 * le poids : le manifeste est dans le chargement initial et n'y porte que
 * l'identifiant du rayon, qui gzippe à presque rien parce qu'il se répète.
 * La seconde est la LANGUE : ces titres passent par `t()`, donc par le
 * dictionnaire — ce que les libellés de famille ne font pas encore, et
 * c'est une dette nommée, pas un modèle à suivre.
 *
 * Les noms sont ceux d'une VITRINE, pas d'un catalogue technique :
 * « Volets, stores et moustiquaires » plutôt que « fermetures », parce
 * qu'un client ne cherche pas une fermeture, il cherche un volet.
 */
const NOM_DE_RAYON: Record<Univers, string> = {
  menuiserie: aTraduire('Fenêtres et portes'),
  fermeture: aTraduire('Volets, stores et moustiquaires'),
};

export function Panneau(props: {
  config: JoineryConfiguration;
  catalogue: PricingCatalog;
  contexte: HostContext;
  issues: ValidationIssue[];
  etape: number;
  /** La famille dont le module est en route — sa tuile le dit. */
  familleEnAttente?: FamilleId | null;
  /** La famille dont le module n'est pas arrivé — sa tuile le DIT. */
  familleIndisponible?: FamilleId | null;
  /** Le relevé aux trois points, quand le client l'a fait. */
  releve: ReleveTroisPoints | null;
  dispatch: (action: Action) => void;
}) {
  const t = useT();
  const [guideOuvert, setGuideOuvert] = useState(false);
  const [releveOuvert, setReleveOuvert] = useState(false);
  const { config, catalogue, contexte, dispatch } = props;
  // L'unité de l'hôte — une PEAU sur les cotes. Elle n'entre jamais dans
  // `config` : le moteur de prix ne peut donc pas en dépendre.
  const unite = uniteDuContexte(contexte);
  const cote = (valeurMm: number) => formater(valeurMm, unite);
  // `familleCatalog()` et non un accès direct : depuis le lot 0.2 une
  // famille n'est au catalogue qu'une fois son module chargé, et un refus
  // qui nomme l'appel manquant vaut mieux qu'un « undefined.label ».
  const fam = familleCatalog(catalogue, config.famille);
  const ouvrir = (etape: number) => dispatch({ type: 'etape', etape: props.etape === etape ? 0 : etape });
  const champ = (patch: Partial<JoineryConfiguration>) => dispatch({ type: 'champ', patch });
  const notes = (etape: number) => (
    <Notes issues={notesDeLEtape(props.issues, etape)} onCorriger={champ} />
  );

  const materiaux = Object.keys(fam.coefMateriauMilliemes) as Materiau[];
  const nomDuMateriau = (materiau: Materiau) => fam.libelleMateriau ?? LIBELLE_MATERIAU[materiau];
  /** Le « dès … » d'une tuile — ou « sur devis » quand rien n'est chiffré. */
  const prixDeLaTuile = (famille: FamilleId) => {
    const prix = computePrice(configurationParDefaut(famille, catalogue), catalogue);
    return prix.lines.length > 0 ? `dès ${euros(prix.displayTotalCents)}` : t('sur devis');
  };
  const gammesNommees = systemesDuMateriau(catalogue, config.famille, config.materiau);
  const presets = contexte.presets?.[config.famille] ?? presetsParDefaut(config, catalogue);
  const optionsFamille = catalogue.options.filter((option) => option.familles.includes(config.famille));
  const aUneEtape7 =
    optionsFamille.length > 0 || notesDeLEtape(props.issues, 7).length > 0;
  const vitree = fam.vitree || config.famille === 'porte-entree';
  // LE GROUPE DE LA FAMILLE, et il remplace trois énumérations. L'écran des
  // protections solaires nommait `bso` et `screen-zip`, celui de
  // familles — alors que chacune de ces listes est exactement un groupe. Ce
  // n'est pas qu'une économie d'octets dans le chargement initial : une
  // personne ne l'aurait vu (c'est la faute du lot MT5, et celle du lot D9).
  const groupe = MANIFESTE_FAMILLES[config.famille].groupe;
  // La pose commande la cote à saisir : elle s'affiche DANS l'étape des
  // dimensions, avant les champs, et son guide s'y lit à voix haute.
  const poseVisible = poseApplicable(catalogue, config.famille);
  const etapesFermetures = FAMILLES_A_FERMETURES.has(config.famille);
  const aUneEtape4 =
    vitree ||
    etapesFermetures ||
    // et n'y entre pas : ses champs de toiture attendent la décision D-3.
    // pour les poser, et la numérotation sautait de 3 à 5 chez eux.
    groupe === 'solaire';
  const coefficientsInertes = fam.unitePrix === 'piece';
  /**
   * L'ÉTAPE DES COULEURS EXISTE-T-ELLE ? Elle disparaît là où la teinte ne
   * change ni le prix ni le dessin — voir `coefficientsInertes` ci-dessus. Ses
   * remarques la retiennent malgré tout : une étape absente les ferait
   * DISPARAÎTRE au lieu de les renvoyer au récapitulatif (leçon du lot D19b).
   */
  const aUneEtape6 = !coefficientsInertes || notesDeLEtape(props.issues, 6).length > 0;
  /**
   * LE NUMÉRO AFFICHÉ SE DÉRIVE DES EMPLACEMENTS PRÉSENTS, il ne s'énumère
   * plus. Trois étapes sont désormais conditionnelles — la 4, la 5 et la 6 —,
   * et les ternaires imbriqués qui les comptaient auraient eu tort à la
   * quatrième : « un verrou qui ÉNUMÈRE a raison le jour où on l'écrit et tort
   * au lot suivant » (lots D3, D4, D9). Les EMPLACEMENTS, eux, ne bougent pas :
   * ce sont l'état de l'accordéon et le rangement des remarques.
   */
  const aUneEtapeMoteur = moteursDeLaFamille(catalogue, config.famille).length > 0;
  const emplacements = [
    1,
    2,
    3,
    ...(aUneEtape4 ? [4] : []),
    ...(aUneEtapeMoteur ? [5] : []),
    ...(aUneEtape6 ? [6] : []),
    ...(aUneEtape7 ? [7] : []),
    8,
  ];
  const numero = (emplacement: number) => emplacements.indexOf(emplacement) + 1;
  const dansUnTableau = true;
  const modele = modelePorteDe(catalogue, config.famille, config.modelePorte);
  // manœuvre d'un volet roulant se dérivent désormais DANS
  // `EtapesFermetures.tsx` — avec les écrans qui les montrent. Ce qui reste
  // ici est ce que toute famille affiche.
  // La FORME. Elle vient en tête de l'étape des dimensions : c'est elle
  // qui décide de ce que « hauteur » veut dire — sur un plein cintre, la
  // hauteur va du seuil au SOMMET de l'arc, pas à la naissance.
  const formes = formesDeLaFamille(catalogue, config.famille);
  const forme = formeDe(catalogue, config.forme);
  const formeCintree = forme.id !== 'rectangle';
  const pose = posePourFamille(catalogue, config.famille, config.pose);
  const feuilleteVerrouille = feuilleteImpose(config, catalogue);

  // LES RAYONS. Une grille plate de trente et une tuiles est un mur : le
  // « Fenêtre ». On les range donc par UNIVERS — le rayon du manifeste, qui
  // n'est pas le groupe de chargement (voir `registre.ts`).
  //
  // Le titre ne paraît QUE s'il y a plus d'un rayon. Un marchand qui ne
  // vend que des fenêtres a déclaré ses `famillesActives` : lui coller un
  // titre « Fenêtres et portes » au-dessus de sa seule grille serait du
  // bruit, et l'écran d'un configurateur en marque blanche doit rester
  // celui de la boutique, pas le nôtre.
  const rayons = useMemo(() => {
    const ouvertes = famillesOuvertes(contexte, catalogue);
    const parRayon = new Map<Univers, FamilleId[]>();
    for (const famille of ouvertes) {
      const univers = MANIFESTE_FAMILLES[famille].univers;
      const deja = parRayon.get(univers);
      if (deja) deja.push(famille);
      else parRayon.set(univers, [famille]);
    }
    // L'ORDRE VIENT DE `UNIVERS`, pas de l'ordre d'arrivée : le marchand
    // peut déclarer ses familles dans n'importe quel ordre, et le rayon le
    // plus vendu doit rester en tête.
    return UNIVERS.filter((univers) => parRayon.has(univers)).map(
      (univers) => [univers, parRayon.get(univers)!] as const,
    );
  }, [contexte, catalogue]);

  return (
    <form className="panneau" onSubmit={(evenement) => evenement.preventDefault()}>

      <Etape
        numero={1}
        titre={aTraduire('Famille')}
        resume={`${t(fam.label)}${fam.bornes.vantauxMax > 1 ? ` · ${nommerVantaux(config.vantaux)}` : ''}`}
        ouverte={props.etape === 1}
        onOuvrir={() => ouvrir(1)}
      >
        {rayons.map(([univers, familles]) => (
          <div className="rayon" key={univers}>
            {rayons.length > 1 ? <h3 className="rayon-titre">{t(NOM_DE_RAYON[univers])}</h3> : null}
            <div
              className="tuiles"
              role="group"
              aria-label={rayons.length > 1 ? t(NOM_DE_RAYON[univers]) : t('Famille')}
            >
              {familles.map((famille: FamilleId) => {
            const chargee = familleChargee(famille);
            const enRoute = props.familleEnAttente === famille;
            // Le module n'est pas venu. La tuile le DIT — elle restait sur
            // « chargement… » pour toujours. Elle ne promet PAS de
            // réessayer : le navigateur mémorise l'échec d'un `import()`
            // définitivement, et recliquer ne redemanderait rien. Le seul
            // remède est le rechargement, et la tuile le dit aussi.
            const indisponible = props.familleIndisponible === famille;
            return (
              <Tuile
                key={famille}
                test={`famille-${famille}`}
                label={MANIFESTE_FAMILLES[famille].label}
                note={
                  chargee
                    ? // « DÈS 0,00 € » N'EXISTE PAS. Une famille dont le prix ne
                      // rend aucune ligne n'a rien pu chiffrer — c'est le cas de
                      // déclare aucun prix de poste (lot C11b). La tuile dit
                      // donc « sur devis », ce que le métier dit depuis
                      // toujours, plutôt que d'annoncer la gratuité.
                      prixDeLaTuile(famille)
                    : indisponible
                      ? t('indisponible')
                      : enRoute
                        ? t('chargement…')
                        : t('voir les tarifs')
                }
                raison={
                  indisponible
                    ? aTraduire(
                        'Ce type de menuiserie n’a pas pu être chargé. Rechargez la page pour réessayer.',
                      )
                    : undefined
                }
                actif={config.famille === famille}
                onClick={() => dispatch({ type: 'famille', famille })}
              />
            );
              })}
            </div>
          </div>
        ))}
        {notes(1)}
      </Etape>

      {/* « ET POSE » NE SE DIT QUE LÀ OÙ IL Y EN A UNE. MESURÉ : `poseApplicable`
          est vraie pour QUATRE familles sur quarante — fenêtre, porte-fenêtre,
          coulissant, porte d'entrée —, et les quarante affichaient ce titre. Un
          titre qui promet une décision que l'écran ne contient pas envoie le
          client la chercher ; le corps de l'étape, lui, était déjà
          conditionnel. */}
      <Etape
        numero={2}
        titre={poseVisible ? aTraduire('Dimensions et pose') : aTraduire('Dimensions')}
        resume={`${formeCintree ? `${t(forme.label)} · ` : ''}${cote(config.widthMm)} × ${cote(config.heightMm)}${poseVisible ? ` · ${t(pose.label).toLowerCase()}` : ''}`}
        ouverte={props.etape === 2}
        onOuvrir={() => ouvrir(2)}
      >
        {formes.length > 1 ? (
          <div className="bloc">
            <span className="champ">{t('Forme')}</span>
            <div className="tuiles" role="group" aria-label={t('Forme')}>
              {formes.map((candidate) => (
                <Tuile
                  key={candidate.id}
                  test={`forme-${candidate.id}`}
                  label={candidate.label}
                  note={libelleDelta(delta(config, { forme: candidate.id }, catalogue))}
                  actif={forme.id === candidate.id}
                  raison={candidate.argument}
                  onClick={() => champ({ forme: candidate.id, flecheMm: undefined })}
                />
              ))}
            </div>
            <p className="aide">{forme.argument}</p>
          </div>
        ) : null}

        {poseVisible ? (
          <div className="bloc">
            <span className="champ">{t('Type de pose')}</span>
            <div className="tuiles" role="group" aria-label={t('Type de pose')}>
              {(Object.keys(catalogue.poses) as Pose[]).map((identifiant) => (
                <Tuile
                  key={identifiant}
                  test={`pose-${identifiant}`}
                  label={catalogue.poses[identifiant].label}
                  note={libelleDelta(delta(config, { pose: identifiant }, catalogue))}
                  actif={pose.id === identifiant}
                  onClick={() => champ({ pose: identifiant })}
                />
              ))}
            </div>
            <p className="aide">{pose.argument}</p>
          </div>
        ) : null}

        {/* Le guide de cotes vient du CATALOGUE, pas d'ici : un marchand qui
            ajoute une pose ajoute ses lignes de mesure avec. Sans cela,
            « trois mesures par axe » est le seul conseil que le client
            reçoit — vrai partout, utile nulle part. */}
        {poseVisible ? (
          <div className="guide-cotes" data-test="guide-cotes">
            <p><strong>{t('Largeur')}</strong> — {t(pose.mesureLargeur)}</p>
            <p><strong>{t('Hauteur')}</strong> — {t(pose.mesureHauteur)}</p>
            <p className="aide">
              {t('Trois mesures par axe, on retient la plus petite. Vérifiez les diagonales.')}
            </p>
            {/* LE GUIDE ILLUSTRÉ s'ouvre à la demande. Il ne s'impose pas :
                le piège Neuffer est de noyer le client (docs/09), et celui
                qui connaît sa pose doit pouvoir saisir ses cotes sans
                traverser un manuel. */}
            <button
              type="button"
              className="lien-detail"
              data-test="ouvrir-guide"
              aria-expanded={guideOuvert}
              onClick={() => setGuideOuvert((ouvert) => !ouvert)}
            >
              {guideOuvert ? t('Masquer le guide') : t('Voir où mesurer')}
            </button>
            {guideOuvert ? (
              <Suspense fallback={<p className="aide">{t('Chargement du guide…')}</p>}>
                <VueGuide
                  catalogue={catalogue}
                  pose={pose.id}
                  onFermer={() => setGuideOuvert(false)}
                />
              </Suspense>
            ) : null}
          </div>
        ) : (
          <p className="aide">
            {dansUnTableau
              ? t('Trois mesures par axe, on retient la plus petite.')
              : t('Ces cotes sont celles de l’ouvrage à construire.')}
          </p>
        )}

        {/* LE RELEVÉ AUX TROIS POINTS. C'est lui qui fait passer les cotes
            de « déclarées » à « confirmées », puis à « validées » quand un
            professionnel signe le relevé sur place — et c'est ce passage,
            et lui seul, qui autorise le dossier de fabrication.
            
            Il est à la demande : la plupart des visiteurs ne sortent pas
            leur mètre pendant qu'ils comparent des prix. Celui qui l'ouvre
            a déjà décidé d'acheter. */}
        <button
          type="button"
          className="lien-detail"
          data-test="ouvrir-releve"
          aria-expanded={releveOuvert}
          onClick={() => setReleveOuvert((ouvert) => !ouvert)}
        >
          {releveOuvert ? t('Masquer le relevé') : t('Relever aux trois points')}
        </button>
        {releveOuvert ? (
          <Suspense fallback={<p className="aide">{t('Chargement du relevé…')}</p>}>
            <Releve
              releve={props.releve}
              largeurMm={config.widthMm}
              hauteurMm={config.heightMm}
              onReleve={(releve, coteRetenue, etatDesCotes) =>
                dispatch({ type: 'releve', releve, coteRetenue, etatDesCotes })
              }
            />
          </Suspense>
        ) : null}

        <div className="duo">
          <div>
            <ChampCote
              id="ahjc-largeur"
              test="largeur"
              nom={
                fam.libelleLargeur ??
                (estLineaire(catalogue, config.famille) ? aTraduire('Longueur') : aTraduire('Largeur'))
              }
              unite={unite}
              valeurMm={config.widthMm}
              onChange={(widthMm) => widthMm !== undefined && champ({ widthMm })}
            />
          </div>
          <div>
            <ChampCote
              id="ahjc-hauteur"
              test="hauteur"
              nom={aTraduire('Hauteur')}
              unite={unite}
              valeurMm={config.heightMm}
              onChange={(heightMm) => heightMm !== undefined && champ({ heightMm })}
            />
          </div>
        </div>
        {/* La MONTÉE. Elle ne veut pas dire la même chose d'une forme à
            l'autre — le libellé le dit, plutôt qu'une note de bas de page
            que personne ne lit. */}
        {formeCintree && forme.id !== 'rond' && forme.id !== 'ovale' && forme.id !== 'plein-cintre' ? (
          <div className="bloc">
            <ChampCote
              id="ahjc-fleche"
              test="fleche"
              nom={
                forme.id === 'trapeze'
                  ? aTraduire('Chute du côté bas')
                  : forme.id === 'triangle'
                    ? aTraduire('Hauteur des montants droits')
                    : aTraduire('Montée de l’arc')
              }
              unite={unite}
              facultatif
              valeurMm={
                config.flecheMm ?? Math.round(flecheParDefaut(forme.id, config.widthMm, config.heightMm))
              }
              onChange={(flecheMm) => champ({ flecheMm })}
            />
            <p className="aide">
              Retenue : {cote(Math.round(flecheEffective(forme.id, config.widthMm, config.heightMm, config.flecheMm)))}.
            </p>
          </div>
        ) : null}

        {forme.id === 'trapeze' ? (
          <div className="bloc">
            <span className="champ">{t('Côté bas du rampant')}</span>
            <div className="segmente" role="group" aria-label={t('Côté bas')}>
              {(['gauche', 'droite'] as const).map((cote) => (
                <button
                  key={cote}
                  type="button"
                  data-test={`cote-bas-${cote}`}
                  aria-pressed={(config.formeCoteBas ?? 'gauche') === cote}
                  onClick={() => champ({ formeCoteBas: cote })}
                >
                  {cote === 'gauche' ? t('À gauche') : t('À droite')}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {pose.tapee ? (
          <div className="bloc">
            <span className="champ">{t('Tapée d’isolation')}</span>
            <div className="segmente" role="group" aria-label={t('Épaisseur de tapée')}>
              {catalogue.tapees.map((tapee) => (
                <button
                  key={tapee.epaisseurMm}
                  type="button"
                  data-test={`tapee-${tapee.epaisseurMm}`}
                  aria-pressed={config.tapeeMm === tapee.epaisseurMm}
                  onClick={() => champ({ tapeeMm: tapee.epaisseurMm })}
                >
                  {cote(tapee.epaisseurMm)}
                </button>
              ))}
            </div>
            <p className="aide">
              {t('L’épaisseur de votre doublage isolant, mesurée du mur au parement.')}
            </p>
          </div>
        ) : null}

        <div className="bloc">
          <span className="champ">{t('Dimensions courantes')}</span>
          <div className="prereglages" role="group" aria-label={t('Dimensions courantes')}>
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                aria-pressed={config.widthMm === preset.widthMm && config.heightMm === preset.heightMm}
                onClick={() => champ({ widthMm: preset.widthMm, heightMm: preset.heightMm })}
              >
                {/* En pouces, le libellé se recompose depuis les cotes : un
                    « 1200 × 1350 » lu par un client américain ne lui dit
                    rien. Le libellé du marchand, lui, reste souverain en
                    millimètres — c'est son catalogue qui parle. */}
                {unite === 'mm'
                  ? preset.label
                  : `${depuisMm(preset.widthMm, unite)} × ${depuisMm(preset.heightMm, unite)}`}
              </button>
            ))}
          </div>
        </div>

        {fam.bornes.vantauxMax > fam.bornes.vantauxMin ? (
          <div className="bloc">
            <span className="champ">{t('Vantaux')}</span>
            <div className="segmente" role="group" aria-label={t('Nombre de vantaux')}>
              {Array.from(
                { length: fam.bornes.vantauxMax - fam.bornes.vantauxMin + 1 },
                (_, i) => fam.bornes.vantauxMin + i,
              ).map((vantaux) => (
                <button
                  key={vantaux}
                  type="button"
                  data-test={`vantaux-${vantaux}`}
                  aria-pressed={config.vantaux === vantaux}
                  onClick={() => champ({ vantaux })}
                >
                  {vantaux}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {fam.ouvertures && fam.ouvertures.length > 1 ? (
          <div className="bloc">
            <span className="champ">{t('Ouverture')}</span>
            <div className="segmente" role="group" aria-label={t('Type d’ouverture')}>
              {fam.ouvertures.map((ouverture) => (
                <button
                  key={ouverture}
                  type="button"
                  aria-pressed={(config.ouverture ?? fam.ouvertures![0]) === ouverture}
                  onClick={() => champ({ ouverture })}
                >
                  {LIBELLE_OUVERTURE[ouverture]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {config.famille === 'fenetre' ? (
          <div className="bloc">
            <ChampCote
              id="ahjc-allege"
              test="allege"
              nom={aTraduire('Hauteur d’allège')}
              unite={unite}
              facultatif
              placeholder={t('non renseignée')}
              valeurMm={config.hauteurAllegeMm}
              onChange={(hauteurAllegeMm) => champ({ hauteurAllegeMm })}
            />
            <p className="aide">
              Du sol fini au bas de la baie — sous{' '}
              {cote(catalogue.feuilleteImposeAllegeSousMm)}, le vitrage de sécurité s'impose.
            </p>
          </div>
        ) : null}

        {notes(2)}
      </Etape>

      <Etape
        numero={3}
        titre={coefficientsInertes ? aTraduire('Matériau') : aTraduire('Matériau et gamme')}
        resume={
          coefficientsInertes
            ? nomDuMateriau(config.materiau)
            : `${nomDuMateriau(config.materiau)} · ${LIBELLE_GAMME[config.gamme].toLowerCase()}`
        }
        ouverte={props.etape === 3}
        onOuvrir={() => ouvrir(3)}
      >
        <div className="tuiles" role="group" aria-label={t('Matériau')}>
          {materiaux.map((materiau) => (
            <Tuile
              key={materiau}
              test={`materiau-${materiau}`}
              label={nomDuMateriau(materiau)}
              note={libelleDelta(delta(config, { materiau }, catalogue))}
              actif={config.materiau === materiau}
              onClick={() => champ({ materiau })}
            />
          ))}
        </div>
        {/* Le marchand qui a saisi ses gammes vend des SYSTÈMES nommés ;
            celui qui n'en a pas s'en tient aux trois paliers. Les deux
            écrans existent, et c'est le catalogue qui décide. */}
        {coefficientsInertes ? null : gammesNommees.length > 0 ? (
          <div className="bloc">
            <span className="champ">{t('Gamme de profilé')}</span>
            <div className="tuiles" role="group" aria-label={t('Gamme de profilé')}>
              {gammesNommees.map((systeme) => (
                <Tuile
                  key={systeme.id}
                  test={`systeme-${systeme.id}`}
                  label={systeme.nom}
                  note={`${systeme.epaisseurMm} mm · Uf ${systeme.uf} · ${libelleDelta(delta(config, { systeme: systeme.id, gamme: systeme.gamme }, catalogue))}`}
                  actif={config.systeme === systeme.id}
                  raison={systeme.argument}
                  onClick={() => champ({ systeme: systeme.id, gamme: systeme.gamme })}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="bloc">
            <span className="champ">{t('Gamme de profilé')}</span>
            <div className="tuiles" role="group" aria-label={t('Gamme de profilé')}>
              {(Object.keys(catalogue.coefGammeMilliemes) as Gamme[]).map((gamme) => (
                <Tuile
                  key={gamme}
                  test={`gamme-${gamme}`}
                  label={LIBELLE_GAMME[gamme]}
                  // LE Uf NE S'AFFICHE QUE LÀ OÙ IL VEUT DIRE QUELQUE CHOSE.
                  // ni dormant ni ouvrant à isoler. Un coefficient de
                  // transmission de CADRE n'a de sens que sur la menuiserie
                  // qui en a un, et c'est exactement ce que `vitree` désigne
                  // ici (les quatre vitrées, plus la porte d'entrée).
                  note={
                    vitree
                      ? `Uf ${catalogue.thermique.ufParMateriau[config.materiau][gamme]} · ${libelleDelta(delta(config, { gamme }, catalogue))}`
                      : libelleDelta(delta(config, { gamme }, catalogue))
                  }
                  actif={config.gamme === gamme}
                  onClick={() => champ({ gamme })}
                />
              ))}
            </div>
          </div>
        )}
        {notes(3)}
      </Etape>

      {/* L'ETAPE DU VITRAGE. Son corps -- pres de dix kilo-octets de
          compositions, d'aspects et d'arguments -- ne s'affiche qu'une fois
          l'etape ouverte : il arrive donc avec ce clic. L'enveloppe
          conditionnelle reste ICI, parce que c'est elle qui decide si
          l'etape existe. */}
      {vitree ? (
        <Suspense fallback={null}>
          <EtapeVitrage
            config={config}
            catalogue={catalogue}
            etape={props.etape}
            unite={unite}
            ouvrir={ouvrir}
            champ={champ}
            notes={notes}
          />
        </Suspense>
      ) : null}

      {etapesFermetures ? (
        <Suspense fallback={null}>
          <EtapesFermetures
            config={config}
            catalogue={catalogue}
            etape={props.etape}
            numero={numero}
            ouvrir={ouvrir}
            champ={champ}
            notes={notes}
          />
        </Suspense>
      ) : null}

      {/* LES TROIS CHAMPS QUE SEULES LES PROTECTIONS SOLAIRES ONT : le
          modèle de lame, le linteau disponible et la toile. Sans cet écran,
          le moteur du lot S1 tournait sur ses défauts et ses trois règles
          n'étaient atteignables par personne. */}





      {groupe === 'solaire' ? (
        <Suspense fallback={null}>
          <EtapesSolaire
            config={config}
            catalogue={catalogue}
            etape={props.etape}
            ouvrir={ouvrir}
            champ={champ}
            notes={notes}
          />
        </Suspense>
      ) : null}


      {aUneEtape6 ? (
      <Etape
        numero={numero(6)}
        titre={aTraduire('Couleurs')}
        resume={LIBELLE_COULEUR[config.couleur]}
        ouverte={props.etape === 6}
        onOuvrir={() => ouvrir(6)}
      >
        <div className="tuiles" role="group" aria-label={t('Couleurs')}>
          {(Object.keys(catalogue.coefCouleurMilliemes) as Couleur[]).map((couleur) => (
            <Tuile
              key={couleur}
              test={`couleur-${couleur}`}
              label={LIBELLE_COULEUR[couleur]}
              note={libelleDelta(delta(config, { couleur }, catalogue))}
              actif={config.couleur === couleur}
              onClick={() => champ({ couleur })}
            />
          ))}
        </div>

        {/* LE CHOIX DE TEINTE — nuancier RAL, décors plaxés, et ce que le
            choix impose. Il ne s'affiche QUE si le client quitte le blanc,
            qui reste le défaut ; il part donc dans son propre morceau, comme
            l'étape 4 des fermetures. */}
        {config.couleur !== 'blanc' ? (
          <Suspense fallback={null}>
            <ChoixTeinte config={config} champ={champ} />
          </Suspense>
        ) : null}
        {notes(6)}
      </Etape>
      ) : null}

      {aUneEtape7 ? (
      <Etape
        numero={numero(7)}
        titre={aTraduire('Options')}
        resume={
          (config.options ?? []).length === 0
            ? 'aucune'
            : `${(config.options ?? []).length} option${(config.options ?? []).length > 1 ? 's' : ''}`
        }
        ouverte={props.etape === 7}
        onOuvrir={() => ouvrir(7)}
      >
        <div className="tuiles" role="group" aria-label={t('Options')}>
          {optionsFamille.map((option) => {
            const choisie = (config.options ?? []).find((candidate) => candidate.id === option.id);
            return (
              <Tuile
                key={option.id}
                test={`option-${option.id}`}
                label={option.label}
                note={`${euros(option.amountCents)}${option.unite === 'parVantail' ? ' / vantail' : ''}`}
                actif={Boolean(choisie)}
                onClick={() =>
                  dispatch({
                    type: 'option',
                    option: option.id,
                    actif: !choisie,
                    quantite: option.unite === 'parVantail' ? 1 : undefined,
                  })
                }
              />
            );
          })}
        </div>
        {/* LA COMPOSITION DES PETITS-BOIS — droits, losanges, croisée
            impériale. Elle ne change pas le prix (même baguette, même
            travail) mais elle change tout le dessin.
            
            Elle est partie avec le nuancier, dans le morceau des choix
            RARES : l'option petits-bois n'est prise que sur une minorité de
            configurations, et celles qui ne la prennent pas n'ont rien à
            faire de ses trois libellés. */}
        {(config.options ?? []).some((choisie) => choisie.id === 'petits-bois') ? (
          <Suspense fallback={null}>
            <ChoixPetitsBois config={config} champ={champ} />
          </Suspense>
        ) : null}

        {optionsFamille
          .filter((option) => option.unite === 'parVantail')
          .filter((option) => (config.options ?? []).some((choisie) => choisie.id === option.id))
          .map((option) => (
            <div className="bloc" key={`quantite-${option.id}`}>
              <span className="champ">{t(option.label)} — {t('vantaux équipés')}</span>
              <div className="segmente" role="group" aria-label={`${option.label}, vantaux équipés`}>
                {Array.from({ length: config.vantaux }, (_, i) => i + 1).map((quantite) => (
                  <button
                    key={quantite}
                    type="button"
                    data-test={`quantite-${option.id}-${quantite}`}
                    aria-pressed={
                      ((config.options ?? []).find((choisie) => choisie.id === option.id)?.quantite ?? 1) === quantite
                    }
                    onClick={() => dispatch({ type: 'option', option: option.id, actif: true, quantite })}
                  >
                    {quantite}
                  </button>
                ))}
              </div>
            </div>
          ))}
        {notes(7)}
      </Etape>
      ) : null}

      <Etape
        numero={numero(8)}
        titre={aTraduire('Quantité')}
        resume={
          // Le pluriel se règle par UNE CLÉ PAR CAS, pas par une règle
          // grammaticale : « 1 menuiserie » et « 2 menuiseries » sont deux
          // phrases à traduire, et une langue qui compte autrement — le
          // russe en a trois — n'aurait rien à faire d'un « s » ajouté.
          // ET « MENUISERIE » N'EST PAS LE MOT DE TOUS LES MÉTIERS. Le
          // catalogue le déclare déjà pour la ligne de remise (`motDeLUnite`,
          // parle pas de menuiseries.
          fam.motDeLUnite
            ? (config.quantite ?? 1) > 1
              ? t('{n} exemplaires', { n: config.quantite ?? 1 })
              : t('{n} exemplaire', { n: 1 })
            : (config.quantite ?? 1) > 1
              ? t('{n} menuiseries', { n: config.quantite ?? 1 })
              : t('{n} menuiserie', { n: 1 })
        }
        ouverte={props.etape === 8}
        onOuvrir={() => ouvrir(8)}
      >
        <label className="champ" htmlFor="ahjc-quantite">
          {fam.motDeLUnite
            ? t('Nombre d’exemplaires identiques')
            : t('Nombre de menuiseries identiques')}
        </label>
        <input
          id="ahjc-quantite"
          data-test="quantite"
          type="number"
          inputMode="numeric"
          min={1}
          value={config.quantite ?? 1}
          onChange={(evenement) => {
            const valeur = Number((evenement.target as HTMLInputElement).value);
            champ({ quantite: Number.isFinite(valeur) ? Math.round(valeur) : 1 });
          }}
        />
        <p className="aide">
          Une remise s'applique dès {catalogue.remisesQuantite[0].quantiteMin}{' '}
          {fam.motDeLUnite ?? 'menuiseries'} identiques.
        </p>
        {notes(8)}
      </Etape>

    </form>
  );
}
