
import {
  coffreDe,
  computeElevation,
  computePriseAuVent,
  computeRapportVantail,
  elevationToSvg,
  estPortail,
  manoeuvreDe,
  modelePortailDe,
  modeleVoletDe,
  moteursDeLaFamille,
  nommerZoneVent,
  type AlimentationMoteur,
  type JoineryConfiguration,
  type PricingCatalog,
} from '@ahjc/core';
import { entier } from '@ahjc/core/src/ecriture-francaise.ts';
// LA DÉCLARATION, PAS LE GROUPE — lot MT5, appliqué au lot O9a : les types de
// moustiquaire et de store intérieur, leurs toiles et leurs lames.
import {
  LAMES_VENITIEN,
  TOILES,
  TYPES_MOUSTIQUAIRE,
  TYPES_STORE_INTERIEUR,
  type Toile,
} from '@ahjc/core/src/types-de-moustiquaire-et-de-store.ts';
// LA TEINTE DE LA TOILE — lot O9b. La déclaration vit à la RACINE du cœur, et
import { nomDeLaToile, TEINTES_DE_TOILE } from '@ahjc/core/src/toiles-de-store.ts';
// LA PÉDAGOGIE D'UN COFFRE ET D'UNE MANŒUVRE — lot D25. Elle vivait dans le
// catalogue, donc dans le chargement initial, et ne se lit QUE sur cet écran :
// 289 octets gzippés rendus à tout visiteur venu configurer une fenêtre. Le
// champ du catalogue reste facultatif, et il PRIME — un marchand qui écrit son
// argument garde le sien.
import {
  ARGUMENTS_DE_COFFRE,
  ARGUMENTS_DE_MANOEUVRE,
} from '@ahjc/core/src/arguments-de-fermeture.ts';
import { aTraduire, useT } from '../i18n.ts';
import { Etape, Tuile, delta, libelleDelta } from './briques.tsx';
import type { ReactNode } from 'react';
import { rangerSousLEcran } from './Notes.tsx';
// LA DÉCLARATION, PAS LA RÈGLE (lot D6) : les trois tailles de lame et la
// hauteur de coffre dérivée sont des LECTURES. Les refus du volet roulant
// restent dans `familles/fermetures/regles.ts`, avec le groupe qui les porte.
import {
  coffreDuVoletMm,
  LAMES_DE_VOLET,
  lameDuVoletMm,
} from '@ahjc/core/src/lames-de-volet.ts';

rangerSousLEcran(4, ['coffre-', 'venitien-', 'toile-', 'moustiquaire-devant', 'tableau-', 'manoeuvre-et-moteur', 'bloc-baie-sans-menuiserie', 'prise-au-vent-elevee']);

/**
 * LE BLOC DE LA TEINTE DE TOILE — lot O9b, et il sert TROIS familles de cet
 * écran : le store banne, la moustiquaire et le store intérieur.
 *
 * Il est écrit une fois ici et une fois dans `EtapesSolaire.tsx`, pour le
 * screen zip. C'est une duplication ASSUMÉE, et elle a son comparateur
 * (`teinte-de-toile.test.ts`) : le sortir dans son propre morceau paresseux
 * coûterait son préambule d'imports — le lot MT5 l'a mesuré à 1 051 octets
 * bruts —, et le poser dans `briques.tsx` le ferait entrer dans le
 * chargement initial, où il ne restait que dix-sept octets.
 *
 * LA PASTILLE PORTE LA COULEUR, comme le nuancier RAL de `ChoixTeinte` : un
 * nom de couleur sans sa pastille demande au client d'imaginer « Nuances de
 * gris ».
 */
function BlocDeToile(props: {
  config: JoineryConfiguration;
  champ: (patch: Partial<JoineryConfiguration>) => void;
  t: (cle: string) => string;
}) {
  const { config, champ, t } = props;
  return (
    <div className="bloc">
      <span className="champ">{t('Teinte de la toile')}</span>
      <div className="prereglages" role="group" aria-label={t('Teinte de la toile')}>
        {TEINTES_DE_TOILE.map((teinte) => (
          <button
            key={teinte.id}
            type="button"
            data-test={`teinte-toile-${teinte.id}`}
            aria-pressed={config.teinteToile === teinte.id}
            onClick={() => champ({ teinteToile: teinte.id })}
          >
            <span
              style={{
                background: teinte.hex,
                // LA PASTILLE EST POSÉE EN LIGNE, et pas par une classe : les
                // styles `.pastille` du nuancier RAL vivent dans le morceau
                // paresseux de `ChoixTeinte`, qui n'arrive que si le client
                // quitte le blanc. Une classe d'ici y aurait cherché un style
                // absent — un carré invisible, et personne pour le dire. La
                // feuille principale, elle, est dans le chargement initial,
                // où il ne restait que dix-sept octets.
                display: 'inline-block',
                width: '14px',
                height: '14px',
                borderRadius: '3px',
                border: '1px solid var(--ahjc-bord)',
                marginRight: '6px',
                verticalAlign: '-2px',
              }}
              aria-hidden="true"
            />
            {teinte.nom}
          </button>
        ))}
      </div>
      <p className="aide" data-test="toile-aide">
        {nomDeLaToile(config) === null
          ? aTraduire(
              'Non déclarée : la toile est le premier poste de décision du produit, et c’est la seule pièce qu’on regarde depuis la rue. Le dessin la montre au vert d’eau tant qu’elle n’est pas choisie.',
            )
          : `${nomDeLaToile(config)} — ${t(aTraduire('le nom se commande ; la pastille n’est qu’un équivalent d’écran'))}.`}
      </p>
    </div>
  );
}

export function EtapesFermetures(props: {
  config: JoineryConfiguration;
  catalogue: PricingCatalog;
  /** L'etape ouverte dans le panneau -- l'accordeon reste chez le parent. */
  etape: number;
  /**
   * LE NUMÉRO AFFICHÉ D'UN EMPLACEMENT — lot D20. Cet écran rendait un `5` en
   * dur sur l'étape de motorisation, que le panneau employait déjà pour les
   * couleurs : deux étapes numérotées 5, ouvertes ensemble, et chaque remarque
   * de motorisation affichée deux fois. Le panneau seul sait combien d'étapes
   * une famille a devant celle-ci ; il prête donc sa numérotation.
   */
  numero: (emplacement: number) => number;
  ouvrir: (etape: number) => void;
  champ: (patch: Partial<JoineryConfiguration>) => void;
  /** Les remarques de l'etape, rendues par le parent : elles lui appartiennent. */
  notes: (etape: number) => ReactNode;
}) {
  const t = useT();
  const { catalogue, config, champ, notes, ouvrir } = props;
  const vignetteDe = (patch: Partial<JoineryConfiguration>) =>
    elevationToSvg(computeElevation({ ...config, ...patch }, catalogue), { cotes: false });

  // Le garnissage d'un volet battant -- persienne par defaut, et
  // `modeleVoletDe()` le dit plutot que le widget ne le devine.
  const modeleVolet = modeleVoletDe(catalogue, config.famille, config.modeleVolet);
  // met en tete parce que c'est le compromis que le metier vend le plus.
  const remplissagePortail = modelePortailDe(catalogue, config.famille, config.remplissagePortail);
  // LA PRISE AU VENT, calculee a chaque geste. C'est le pendant du Uw d'une
  // menuiserie : une valeur physique qui EXPLIQUE un choix au lieu de
  // l'imposer. Elle s'affiche la ou elle se decide -- sur l'ecran du
  // remplissage, pas dans une fiche technique que personne n'ouvre.
  const vent = computePriseAuVent(config, catalogue);
  const vantailPortail = computeRapportVantail(config, catalogue);
  // Le coffre et la manoeuvre d'un volet roulant. Le coffre decide de ce
  // qu'on VOIT ; la manoeuvre disparait des qu'un moteur est choisi, parce
  // qu'un moteur remplace la main, il ne s'y ajoute pas.
  const coffre = coffreDe(catalogue, config.famille, config.coffre);
  const motorise = (config.options ?? []).some((choisie) =>
    String(choisie.id).startsWith('motorisation-'),
  );
  const manoeuvre = manoeuvreDe(catalogue, config.famille, config.manoeuvre);
  // LES MOTEURS que le module a livres. La liste est VIDE tant qu'aucun
  // module n'en apporte -- c'est ce qui fait qu'une fenetre n'a jamais vu
  // cette etape, et c'est pourquoi elle a sa place ici plutot que dans le
  // panneau commun.
  const moteurs = moteursDeLaFamille(catalogue, config.famille);
  // LE TYPE RETENU d'une moustiquaire et d'un store intérieur — lot O9a. Les
  // deux listes portent le nom ET l'argument, et `?? ` dit le défaut une
  // seule fois : le répéter à chaque tuile aurait été six occasions de ne pas
  // dire le même.
  const typeMoustiquaire =
    TYPES_MOUSTIQUAIRE.find(
      (candidat) => candidat.id === (config.typeMoustiquaire ?? 'enroulable-verticale'),
    ) ?? TYPES_MOUSTIQUAIRE[0];
  const typeStore =
    TYPES_STORE_INTERIEUR.find(
      (candidat) => candidat.id === (config.typeStoreInterieur ?? 'venitien'),
    ) ?? TYPES_STORE_INTERIEUR[0];

  return (
    <>

      {/* LA MOUSTIQUAIRE — lot O9a, et « son type décide de tout » est écrit
          dans son module depuis le premier jour : une enroulable a un coffre
          et deux coulisses, un cadre fixe se clipse, une plissée se replie.
          La nomenclature en fabrique DEUX anatomies, et le refus du coffre
          propose « passer en plissée » — un patch que rien ne permettait de
          voir, puisque aucune tuile ne montrait le type. */}
      {config.famille === 'moustiquaire' ? (
        <Etape
          numero={4}
          titre={aTraduire('Type et pose')}
          resume={typeMoustiquaire.nom}
          ouverte={props.etape === 4}
          onOuvrir={() => ouvrir(4)}
        >
          <div className="tuiles" role="group" aria-label={t('Type de moustiquaire')}>
            {TYPES_MOUSTIQUAIRE.map((candidat) => (
              <Tuile
                key={candidat.id}
                test={`moustiquaire-${candidat.id}`}
                label={candidat.nom}
                note={libelleDelta(delta(config, { typeMoustiquaire: candidat.id }, catalogue))}
                actif={typeMoustiquaire.id === candidat.id}
                raison={candidat.argument}
                onClick={() => champ({ typeMoustiquaire: candidat.id })}
              />
            ))}
          </div>
          <p className="aide">{typeMoustiquaire.argument}</p>

          {/* L'OUVRANT QUI SORT — le refus qu'aucun configurateur n'oppose, et
              qui était inatteignable : une moustiquaire est DEVANT, et un
              ouvrant à la française qui sort vient buter dedans. Ce n'est pas
              une question sur la moustiquaire, c'est une question sur la
              MENUISERIE QU'ELLE PROTÈGE — d'où son libellé. */}
          <div className="bloc">
            <span className="champ">{t('La menuiserie protégée')}</span>
            <div className="tuiles" role="group" aria-label={t('La menuiserie protégée')}>
              {[false, true].map((candidat) => (
                <Tuile
                  key={String(candidat)}
                  test={`ouvrant-sort-${candidat ? 'oui' : 'non'}`}
                  label={
                    candidat
                      ? aTraduire('Elle s’ouvre vers l’extérieur')
                      : aTraduire('Elle s’ouvre vers l’intérieur, ou elle coulisse')
                  }
                  note={
                    candidat
                      ? aTraduire('l’ouvrant viendra buter dans la toile')
                      : aTraduire('rien ne vient buter dans la toile')
                  }
                  actif={(config.ouvrantProtegeSort ?? false) === candidat}
                  onClick={() => champ({ ouvrantProtegeSort: candidat })}
                />
              ))}
            </div>
          </div>

          {/* LA MAILLE EST UNE TOILE, et sa teinte décide de ce qu'on voit au
              travers : le relevé la vend « fibre de verre — NOIR », et c'est
              le noir qu'on ne voit pas de l'intérieur. */}
          <BlocDeToile config={config} champ={champ} t={t} />
          {notes(4)}
        </Etape>
      ) : null}

      {/* LE STORE BANNE — lot O9b, et c'est sa PREMIÈRE étape de famille. Il
          n'en avait aucune : sa toile, qui fait 79 à 85 % de son image (lot
          D17) et que le relevé de Fenetre24 donne comme son premier poste de
          décision, ne se choisissait nulle part. */}
      {config.famille === 'store-banne' ? (
        <Etape
          numero={4}
          titre={aTraduire('Toile')}
          resume={nomDeLaToile(config) ?? aTraduire('non déclarée')}
          ouverte={props.etape === 4}
          onOuvrir={() => ouvrir(4)}
        >
          <BlocDeToile config={config} champ={champ} t={t} />
          {notes(4)}
        </Etape>
      ) : null}

      {/* LE STORE INTÉRIEUR — lot O9a. Trois champs que `regles.ts` lit et que
          personne ne posait, dont celui qui porte « la première réclamation du
          métier » : un SCREEN n'occulte pas, et un client qui en commande un
          pour une chambre commande la mauvaise chose. */}
      {config.famille === 'store-interieur' ? (
        <Etape
          numero={4}
          titre={aTraduire('Type et toile')}
          resume={typeStore.nom}
          ouverte={props.etape === 4}
          onOuvrir={() => ouvrir(4)}
        >
          <div className="tuiles" role="group" aria-label={t('Type de store')}>
            {TYPES_STORE_INTERIEUR.map((candidat) => (
              <Tuile
                key={candidat.id}
                test={`store-${candidat.id}`}
                label={candidat.nom}
                note={libelleDelta(delta(config, { typeStoreInterieur: candidat.id }, catalogue))}
                actif={typeStore.id === candidat.id}
                raison={candidat.argument}
                onClick={() => champ({ typeStoreInterieur: candidat.id })}
              />
            ))}
          </div>

          {/* LA TOILE NE SE DEMANDE QUE POUR UN ENROULEUR, parce que la règle
              ne s'applique qu'à lui : un vénitien n'a pas de toile, il a des
              lames. Une tuile qui ne déciderait de rien serait celle du lot
              C11d. */}
          {typeStore.id === 'enrouleur' ? (
            <div className="bloc">
              <span className="champ">{t('Toile')}</span>
              <div className="tuiles" role="group" aria-label={t('Toile')}>
                {(Object.keys(TOILES) as Toile[]).map((candidat) => (
                  <Tuile
                    key={candidat}
                    test={`toile-${candidat}`}
                    label={TOILES[candidat].nom}
                    note={
                      TOILES[candidat].occulte
                        ? aTraduire('il occulte')
                        : aTraduire('il N’OCCULTE PAS')
                    }
                    actif={config.toileStore === candidat}
                    raison={TOILES[candidat].argument}
                    onClick={() => champ({ toileStore: candidat })}
                  />
                ))}
              </div>
              {/* LA TEINTE EST UN AUTRE CHAMP QUE LA TOILE, et ce sont deux
                  grandeurs : celle-ci dit s'il OCCULTE, celle-là ce qu'on
                  voit. Deux toiles de la même couleur et d'occultations
                  différentes ne font pas le même produit. */}
              <BlocDeToile config={config} champ={champ} t={t} />
            </div>
          ) : null}

          {/* LA LAME D'UN VÉNITIEN décide de son CAISSON : une lame de 50 ne
              se range pas dans un caisson de 25 — c'est de la géométrie, pas
              une préférence, et la remarque le dit en millimètres. */}
          {typeStore.id === 'venitien' ? (
            <div className="bloc">
              <span className="champ">{t('Largeur de lame')}</span>
              <div className="segmente" role="group" aria-label={t('Largeur de lame')}>
                {LAMES_VENITIEN.map((candidat) => (
                  <button
                    key={candidat.largeurMm}
                    type="button"
                    data-test={`lame-${candidat.largeurMm}`}
                    aria-pressed={(config.lameStoreMm ?? 25) === candidat.largeurMm}
                    onClick={() => champ({ lameStoreMm: candidat.largeurMm })}
                  >
                    {entier(candidat.largeurMm)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {notes(4)}
        </Etape>
      ) : null}



      {/* Le COFFRE et la MANŒUVRE d'un volet roulant. Ils occupent la même
          étape 4 que le garnissage d'un volet battant et que le panneau
          d'une porte : c'est l'écran de « ce à quoi il ressemble ». */}
      {config.famille === 'volet-roulant' ? (
        <Etape
          numero={4}
          titre={aTraduire('Coffre et manœuvre')}
          resume={`${t(catalogue.coffres[coffre ?? 'exterieur'].label)}${
            motorise ? ` · ${t('motorisé')}` : ` · ${t(catalogue.manoeuvres[manoeuvre ?? 'sangle'].label).toLowerCase()}`
          }`}
          ouverte={props.etape === 4}
          onOuvrir={() => ouvrir(4)}
        >
          <div className="bloc">
            <span className="champ">{t('Type de coffre')}</span>
            <div className="tuiles" role="group" aria-label={t('Type de coffre')}>
              {(Object.keys(catalogue.coffres) as Array<keyof typeof catalogue.coffres>).map(
                (candidat) => (
                  <Tuile
                    key={candidat}
                    test={`coffre-${candidat}`}
                    label={catalogue.coffres[candidat].label}
                    note={libelleDelta(delta(config, { coffre: candidat }, catalogue))}
                    actif={coffre === candidat}
                    raison={catalogue.coffres[candidat].argument ?? ARGUMENTS_DE_COFFRE[candidat]}
                    onClick={() => champ({ coffre: candidat })}
                  />
                ),
              )}
            </div>
            <p className="aide">
              {catalogue.coffres[coffre ?? 'exterieur'].argument ??
                ARGUMENTS_DE_COFFRE[coffre ?? 'exterieur']}
            </p>
          </div>

          {/* La manœuvre manuelle s'efface devant un moteur : deux tuiles
              allumées qui se contredisent valent moins qu'une phrase. */}
          {motorise ? (
            <p className="aide">
              Volet motorisé — la manœuvre manuelle est remplacée par le moteur, pas complétée
              par lui.
            </p>
          ) : (
            <div className="bloc">
              <span className="champ">{t('Manœuvre')}</span>
              <div className="segmente" role="group" aria-label={t('Manœuvre')}>
                {(Object.keys(catalogue.manoeuvres) as Array<keyof typeof catalogue.manoeuvres>).map(
                  (candidat) => (
                    <button
                      key={candidat}
                      type="button"
                      data-test={`manoeuvre-${candidat}`}
                      aria-pressed={manoeuvre === candidat}
                      onClick={() => champ({ manoeuvre: candidat })}
                    >
                      {t(catalogue.manoeuvres[candidat].label)}
                    </button>
                  ),
                )}
              </div>
              <p className="aide">
                {catalogue.manoeuvres[manoeuvre ?? 'sangle'].argument ??
                  ARGUMENTS_DE_MANOEUVRE[manoeuvre ?? 'sangle']}
              </p>
            </div>
          )}

          {/* LA TAILLE DE LAME, ET LE COFFRE QU'ELLE DONNE — lot O5.

              La note de chaque tuile porte la hauteur de coffre DÉRIVÉE, et
              c'est tout l'argument : le relevé de Fenetre24 fait choisir le
              caisson (165 · 180 · 205) et explique le compromis en prose,
              quand ce moteur le CALCULE depuis la spirale d'enroulement.
              Montrer le nombre à côté du choix dit au client ce qu'il achète
              — et mesuré, 37 et 41 donnent le MÊME coffre sur les six
              hauteurs du tarif : c'est l'épaisseur qui enroule, pas la
              hauteur de lame. Une tuile qui ne changerait rien du tout
              serait la faute du lot C11d ; celle-ci change le NOMBRE de
              lames, donc le débit, le poids et le trait. */}
          <div className="bloc">
            <span className="champ">{t('Taille de lame')}</span>
            <div className="tuiles" role="group" aria-label={t('Taille de lame')}>
              {LAMES_DE_VOLET.map((candidate) => (
                <Tuile
                  key={candidate.mm}
                  test={`lame-${candidate.mm}`}
                  label={candidate.label}
                  note={`${t(aTraduire('coffre'))} ${coffreDuVoletMm({ ...config, lameVoletMm: candidate.mm })} mm`}
                  actif={lameDuVoletMm(config) === candidate.mm}
                  raison={candidate.argument}
                  onClick={() => champ({ lameVoletMm: candidate.mm })}
                />
              ))}
            </div>
            <p className="aide" data-test="coffre-aide">
              {`${t(aTraduire('Coffre dérivé'))} : ${coffreDuVoletMm(config)} mm. `}
              {aTraduire(
                'Il vient de la spirale d’enroulement, pas d’une fraction de la hauteur — et sur une façade qui porte plusieurs volets, c’est la plus grande des hauteurs qu’il faut retenir pour qu’ils s’alignent.',
              )}
            </p>
          </div>

          {/* LE CÔTÉ DE LA MANŒUVRE, et sa CONVENTION dans le titre : « vu de
              l'intérieur », qui est aussi le point de vue de toute élévation
              de ce cœur. Il décide du côté où le symbole se dessine — il ne
              s'y dessinait nulle part avant ce lot — et il se heurte au
              panneau d'un moteur solaire, toujours à gauche. */}
          <div className="bloc">
            <span className="champ">{t('Côté de la manœuvre (vu de l’intérieur)')}</span>
            <div className="segmente" role="group" aria-label={t('Côté de la manœuvre')}>
              {(['gauche', 'droite'] as const).map((candidat) => (
                <button
                  key={candidat}
                  type="button"
                  data-test={`cote-${candidat}`}
                  aria-pressed={(config.coteManoeuvre ?? 'droite') === candidat}
                  onClick={() => champ({ coteManoeuvre: candidat })}
                >
                  {candidat === 'gauche' ? t(aTraduire('À gauche')) : t(aTraduire('À droite'))}
                </button>
              ))}
            </div>
          </div>
          {notes(4)}
        </Etape>
      ) : null}

      {/* Le GARNISSAGE d'un volet battant. Il occupe la même étape 4 que le
          panneau d'une porte, et pour la même raison : c'est ce qui se
          choisit avec les yeux. Un volet plein et un persienné ne se vendent
          pas au même client, et le catalogue les distingue depuis le lot 1.1
          — mais un modèle qu'aucun écran ne propose n'est pas vendu. */}
      {config.famille === 'volet-battant' && catalogue.modelesVolet.length > 0 ? (
        <Etape
          numero={4}
          titre={aTraduire('Garnissage')}
          resume={modeleVolet?.nom ?? aTraduire('Persienné')}
          ouverte={props.etape === 4}
          onOuvrir={() => ouvrir(4)}
        >
          <div className="tuiles" role="group" aria-label={t('Garnissage')}>
            {catalogue.modelesVolet.map((candidat) => (
              <Tuile
                key={candidat.id}
                test={`volet-${candidat.id}`}
                label={candidat.nom}
                note={libelleDelta(delta(config, { modeleVolet: candidat.id }, catalogue))}
                actif={modeleVolet?.id === candidat.id}
                vignette={vignetteDe({ modeleVolet: candidat.id })}
                raison={candidat.argument}
                onClick={() => champ({ modeleVolet: candidat.id })}
              />
            ))}
          </div>
          <p className="aide">{modeleVolet?.argument}</p>
          {notes(4)}
        </Etape>
      ) : null}

      {moteurs.length > 0 ? (
        <Etape
          numero={props.numero(5)}
          titre={aTraduire('Motorisation')}
          resume={
            config.motorisation
              ? (moteurs.find((moteur) => moteur.id === config.motorisation!.type)?.nom ?? 'motorisé')
              : 'manuel'
          }
          ouverte={props.etape === 5}
          onOuvrir={() => ouvrir(5)}
        >
          <div className="tuiles" role="group" aria-label={t('Motorisation')}>
            <Tuile
              test="moteur-aucun"
              label="Manuel"
              note={config.motorisation ? libelleDelta(delta(config, { motorisation: undefined }, catalogue)) : 'inclus'}
              actif={!config.motorisation}
              raison="Sans moteur : aucune sécurité imposée, aucune alimentation à tirer."
              onClick={() => champ({ motorisation: undefined })}
            />
            {moteurs.map((moteur) => {
              const candidat = {
                type: moteur.id,
                alimentation: config.motorisation?.alimentation ?? moteur.alimentations[0],
              };
              return (
                <Tuile
                  key={moteur.id}
                  test={`moteur-${moteur.id}`}
                  label={moteur.nom}
                  note={`≤ ${moteur.poidsMaxKg} kg · ${libelleDelta(delta(config, { motorisation: candidat }, catalogue))}`}
                  actif={config.motorisation?.type === moteur.id}
                  raison={moteur.argument}
                  onClick={() => champ({ motorisation: candidat })}
                />
              );
            })}
          </div>

          {config.motorisation ? (
            <>
              <div className="bloc">
                <span className="champ">{t('Alimentation')}</span>
                <div className="segmente" role="group" aria-label={t('Alimentation')}>
                  {(Object.keys(catalogue.coefAlimentationMilliemes) as AlimentationMoteur[]).map(
                    (alimentation) => (
                      <button
                        key={alimentation}
                        type="button"
                        data-test={`alimentation-${alimentation}`}
                        aria-pressed={config.motorisation!.alimentation === alimentation}
                        onClick={() =>
                          champ({ motorisation: { ...config.motorisation!, alimentation } })
                        }
                      >
                        {alimentation === 'filaire' ? t('Filaire 230 V') : t('Solaire')}
                      </button>
                    ),
                  )}
                </div>
              </div>
              <div className="bloc" data-test="securites">
                <span className="champ">{t('Sécurités imposées — EN 12453')}</span>
                <ul className="liste-securites">
                  {catalogue.securites.map((securite) => (
                    <li key={securite.id}>
                      <strong>{securite.nom}</strong> — {securite.exigence}
                    </li>
                  ))}
                </ul>
                <p className="aide">
                  Ces dispositifs sont inclus et chiffrés. La déclaration CE de l’ensemble motorisé
                  revient à celui qui met en service — pas à ce configurateur.
                </p>
              </div>
            </>
          ) : null}
          {notes(5)}
        </Etape>
      ) : null}
    </>
  );
}
