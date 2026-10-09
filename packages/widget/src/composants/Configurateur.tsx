/**
 * Pourquoi ce fichier existe : l'assemblage — viewport, panneau, barre de
 * prix, panier — et le seul endroit qui tienne l'état. Tout le reste est
 * fonction pure de la configuration : recharger la même configuration
 * redonne exactement le même écran.
 *
 * Solution écartée : émettre les événements depuis les composants qui les
 * provoquent. L'hôte (WordPress, le site, une boutique tierce) doit écouter
 * UN émetteur — le web component lui-même. Les événements partent donc d'ici,
 * par le rappel `onEvenement` que l'élément branche sur `dispatchEvent`.
 *
 * Incident fondateur : l'événement de panier transporte la CONFIGURATION
 * entière, jamais le montant. « Le prix du navigateur n'écrit jamais une
 * commande » (docs/00 §8) : la phase 4 recalculera en PHP avant d'écrire.
 */

import { Suspense, lazy, useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { familleChargee, type FamilleId, type JoineryConfiguration, type PricingCatalog } from '@ahjc/core';
import type { EvenementTelemetrie, HostContext, ModeVue } from '../host-context.ts';
import { famillesOuvertes, resoudreCatalogue } from '../host-context.ts';
import {
  ContexteTraduction,
  chargerLangue,
  codeLangue,
  sensDeLecture,
  traducteur,
  type Dictionnaire,
} from '../i18n.ts';
import {
  attendreFamille,
  cleDeLigne,
  configurationParDefaut,
  derive,
  reducteur,
  type Action,
  type EtatWidget,
} from '../etat.ts';
import { uniteDuContexte } from '../unites.ts';
import { Viewport } from './Viewport.tsx';
import { Panneau } from './Panneau.tsx';
import { BarrePrix } from './BarrePrix.tsx';
const Panier = lazy(() => import('./Panier.tsx').then((module) => ({ default: module.Panier })));
/**
 * TOUT CE QUI SE PASSE APRÈS LA SIGNATURE — financement, garanties,
 * entretien. Trois modules du cœur, un barème daté et une question que
 * personne ne pose (« qui pose ? »), et RIEN de tout cela dans le
 * chargement initial : celui qui compare des prix n'ouvre jamais ce
 * panneau, et celui qui l'ouvre a déjà décidé d'acheter.
 */
const ApresVente = lazy(() =>
  import('./ApresVente.tsx').then((module) => ({ default: module.ApresVente })),
);
/**
 * LES AIDES — leur MONTANT, et la comparaison de trois gammes. Le critère
 * technique, lui, reste dans l'entrée : c'est un fait sur le produit, qui se
 * vérifie sans rien demander. Le montant, non — il dépend de trois réponses
 * que seul le client a, et l'écran qui les pose n'arrive qu'avec elles.
 */
const Aides = lazy(() => import('./Aides.tsx').then((module) => ({ default: module.Aides })));

/**
 * L'INSTANT ZÉRO de la session, et l'identifiant opaque qui va avec.
 *
 * Ils sont pris UNE FOIS, au chargement du module, et jamais recalculés :
 * une session est la durée de vie d'une page. L'identifiant est tiré au
 * hasard et ne se corrèle à rien — ni cookie, ni empreinte, ni compte. Il
 * sert à ne pas compter quinze fois le même visiteur bloqué, et à rien
 * d'autre.
 *
 * `Date.now()` est ici et pas dans le cœur : c'est le WIDGET qui vit dans
 * le temps, `telemetrie.ts` reste une fonction pure qu'on peut rejouer.
 */
const SESSION = Math.random().toString(36).slice(2, 12);
const OUVERTURE_MS = Date.now();

/** Envoie un événement à l'hôte, horodaté depuis l'ouverture de la page. */
function mesurer(
  vers: (evenement: EvenementTelemetrie) => void,
  evenement: Omit<EvenementTelemetrie, 'session' | 'msDepuisOuverture'>,
): void {
  vers({ ...evenement, session: SESSION, msDepuisOuverture: Date.now() - OUVERTURE_MS });
}

export type EvenementWidget =
  | { nom: 'ahjc:configuration'; detail: { config: JoineryConfiguration; totalCents: number; errorCount: number } }
  | { nom: 'ahjc:panier'; detail: { config: JoineryConfiguration; quantite: number; cle: string } }
  /**
   * Le devis a été PRODUIT — le fichier est là, et l'hôte peut en faire ce
   * qu'il veut. L'événement porte les octets ET la configuration : un hôte
   * qui préfère son propre devis reprend la main sans que le widget cesse
   * de fonctionner seul (docs/00 §8, décision 4 — offline-first).
   */
  | {
      nom: 'ahjc:devis';
      detail: { config: JoineryConfiguration; fichier: Uint8Array; nom: string };
    };

/** La configuration d'ouverture : celle de l'hôte, complétée par les défauts. */
export function configurationInitiale(
  contexte: HostContext,
  catalogue: PricingCatalog,
): JoineryConfiguration {
  const famille = contexte.configurationInitiale?.famille ?? famillesOuvertes(contexte, catalogue)[0];
  return { ...configurationParDefaut(famille, catalogue), ...contexte.configurationInitiale, famille };
}

/**
 * Le SAS d'entrée. Depuis le lot 0.2, aucune famille n'est dans le
 * chargement initial : à la première milliseconde, le catalogue est vide et
 * `configurationParDefaut()` n'a pas de matrice à lire. Le configurateur
 * attend donc son premier module, exactement comme la vue 3D attend
 * three.js — et il le DIT, plutôt que de montrer un écran mort.
 *
 * Solution écartée : monter l'atelier avec une configuration bidon et la
 * remplacer à l'arrivée du module. Un prix faux affiché une demi-seconde est
 * un prix faux affiché ; « le prix est là dès la première seconde » ne veut
 * pas dire « un prix est là ».
 */
export function Configurateur(props: {
  contexte: HostContext;
  catalogue: PricingCatalog;
  vue: ModeVue;
  onEvenement: (evenement: EvenementWidget) => void;
}) {
  const familleDepart =
    props.contexte.configurationInitiale?.famille ??
    famillesOuvertes(props.contexte, props.catalogue)[0];
  const langue = langueDeLaPage(props.contexte);
  const [prete, setPrete] = useState(() => familleChargee(familleDepart) && langue === 'fr');
  // LE DICTIONNAIRE arrive par le même sas que le module de famille, et
  // pour la même raison : monter l'atelier en français puis le retourner en
  // anglais une frame plus tard serait un clignotement, pas un chargement.
  // Le français, lui, n'attend RIEN — la clé est le français.
  const [paquet, setPaquet] = useState<Dictionnaire | undefined>(undefined);
  // LA PANNE. Un `import()` échoue pour des raisons banales — réseau coupé
  // dans le train, morceau absent entre deux déploiements, proxy
  // d'entreprise. Sans cet état, la promesse rejetait dans le vide et
  // « Chargement du configurateur… » restait à l'écran POUR TOUJOURS. Un
  // écran qui ment sur ce qu'il fait est pire qu'un écran qui échoue : le
  // client attend, puis part, et le marchand ne saura jamais pourquoi.
  const [panne, setPanne] = useState(false);

  useEffect(() => {
    if (prete) return;
    let vivant = true;
    setPanne(false);
    Promise.all([
      attendreFamille(familleDepart),
      // Un dictionnaire qui n'arrive pas ne doit JAMAIS empêcher de vendre.
      // On retombe sur le français — qui est la clé — et l'écran reste
      // utilisable. C'est la seule panne du widget qui se rattrape toute
      // seule, et c'est parce qu'elle a un défaut sûr.
      chargerLangue(langue).catch(() => undefined),
    ])
      .then(([, dico]) => {
        if (!vivant) return;
        setPaquet(dico);
        setPrete(true);
      })
      .catch(() => {
        if (vivant) setPanne(true);
      });
    return () => {
      vivant = false;
    };
  }, [familleDepart, langue, prete]);

  if (!prete) {
    // Le traducteur du sas : le dictionnaire est peut-être arrivé, peut-être
    // pas. S'il manque, la clé est le français — donc ces deux écrans
    // s'affichent toujours, traduits quand c'est possible.
    const t = traducteur(paquet, props.contexte.traductions?.[langue]);
    if (panne) {
      return (
        <div className="racine">
          <div className="etat-panne" data-test="panne-chargement" role="alert">
            <p>{t('Le configurateur n’a pas pu se charger.')}</p>
            <p className="aide">
              {t('Vérifiez votre connexion, puis rechargez la page.')}
            </p>
            {/* RECHARGER, et pas « réessayer » en place. Quand un `import()`
                échoue, le navigateur mémorise l'échec dans sa carte des
                modules pour de bon : un second `import()` du même
                spécificateur rejette sans émettre une seule requête. Mesuré
                — une sonde compte une requête avant l'échec, une seule
                après. Un bouton qui « réessaie » sans rien redemander est
                un bouton qui ment, et c'est pire que pas de bouton. */}
            <button
              type="button"
              className="bouton bouton--primaire"
              data-test="reessayer"
              onClick={() => {
                if (typeof location !== 'undefined') location.reload();
              }}
            >
              {t('Recharger la page')}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="racine">
        <p className="chargement-famille" data-test="chargement-famille" role="status">
          {t('Chargement du configurateur…')}
        </p>
      </div>
    );
  }
  return <Atelier {...props} familleDepart={familleDepart} langue={langue} paquet={paquet} />;
}

/**
 * La langue retenue : celle que l'hôte impose, sinon celle que la page
 * déclare, sinon le français.
 *
 * On lit `<html lang>` et non la langue du NAVIGATEUR : le visiteur
 * allemand d'une boutique française doit voir la boutique, pas une moitié
 * d'allemand au milieu d'un catalogue français. C'est la page qui sait dans
 * quelle langue elle vend.
 */
function langueDeLaPage(contexte: HostContext): string {
  if (contexte.langue) return codeLangue(contexte.langue);
  if (typeof document === 'undefined') return 'fr';
  return codeLangue(document.documentElement.lang);
}

function Atelier(props: {
  contexte: HostContext;
  catalogue: PricingCatalog;
  vue: ModeVue;
  familleDepart: FamilleId;
  langue: string;
  /** Le dictionnaire livré par le paquet — absent en français, et pour les langues non livrées. */
  paquet: Dictionnaire | undefined;
  onEvenement: (evenement: EvenementWidget) => void;
}) {
  const { contexte } = props;
  // LES TROIS ÉTAGES, empilés ici et nulle part ailleurs : le dictionnaire
  // du paquet, puis celui du marchand. La langue, elle, a déjà choisi
  // lequel des deux on est allé chercher.
  const t = useMemo(
    () => traducteur(props.paquet, contexte.traductions?.[props.langue]),
    [props.paquet, props.langue, contexte.traductions],
  );
  // Le compteur de modules arrivés. Il ne sert qu'à REFAIRE le catalogue
  // quand un marchand a posé ses propres tarifs : `resoudreCatalogue()` en
  // prend alors une copie, qui ne verrait jamais la famille enregistrée
  // après coup. Sans surcharge marchande, le catalogue EST
  // `DEFAULT_CATALOG` — celui-là se remplit tout seul.
  const [modules, setModules] = useState(0);
  const catalogue = useMemo(
    () => resoudreCatalogue(contexte.pricing),
    [contexte.pricing, modules],
  );
  // Le motif du dernier refus de dossier. `null` tant qu'on n'a rien
  // demandé — et un refus s'AFFICHE, il ne se journalise pas.
  const [refusDossier, setRefusDossier] = useState<string | null>(null);
  // CE QUE LA FICHE TECHNIQUE RÉCLAME AU FABRICANT. Ce n'est pas un refus :
  // la fiche s'émet quand même, avec ses trous nommés. C'est la liste que
  // le prescripteur emporte pour savoir quoi demander.
  const [manquesFiche, setManquesFiche] = useState<string[]>([]);
  // « Après la signature », replié par défaut : la question n'arrive
  // qu'une fois le prix accepté, et son code n'arrive qu'avec elle.
  const [apresVenteOuvert, setApresVenteOuvert] = useState(false);
  // Les aides, repliées elles aussi. Elles décident de l'achat, et c'est
  // pour cela qu'elles sont AU-DESSUS d'« après la signature » : on arbitre
  // avant de signer, pas après.
  const [aidesOuvertes, setAidesOuvertes] = useState(false);
  const [raccordementOuvert, setRaccordementOuvert] = useState(false);
  /**
   * L'ÉCRAN DU LOT, replié par défaut et pour tout le monde. Il ne s'ouvre
   * pas tout seul sur un panier fourni : celui qui a quarante menuiseries à
   * chiffrer sait qu'il a un bordereau, et celui qui n'en a pas ne doit pas
   * découvrir un importeur de tableur au milieu de sa cuisine.
   */
  const [lotOuvert, setLotOuvert] = useState(false);
  const [etat, dispatch] = useReducer(useMemo(() => reducteur(catalogue), [catalogue]), undefined, () => ({
    config: configurationInitiale(contexte, catalogue),
    // RIEN DE DÉCLARÉ AU DÉPART, et c'est la bonne valeur : « je ne sais
    // pas » ouvre moins de droits qu'un défaut optimiste, et les deux
    // modules du cœur savent le dire en toutes lettres.
    situation: {},
    // Même règle pour le raccordement : rien de déclaré, donc rien de
    // supposé — et les avertissements du cœur nomment ce qui manque.
    raccordement: {},
    etape: 2,
    vue: '2d',
    panier: [],
    detailOuvert: false,
    familleEnAttente: null,
    familleIndisponible: null,
    sequence: 1,
    // Aucun relevé au départ : deux nombres saisis, et l'état des cotes
    // reste `declaree`. C'est le défaut prudent — on ne fabrique pas sur un
    // silence.
    releve: null,
    etatDesCotes: 'declaree',
  }) satisfies EtatWidget);

  /**
   * Le changement de famille passe par ici, et lui seul. Si le module du
   * groupe n'est pas là, on note l'ATTENTE et on la laisse à un effet : la
   * reconstruction de la configuration doit se faire sur un catalogue qui a
   * déjà reçu le module, et un effet est le seul endroit qui garantisse cet
   * ordre. Enchaîner « charger puis dispatcher » dans la même micro-tâche
   * laissait le réducteur d'un rendu antérieur lire un catalogue d'où la
   * famille était encore absente.
   */
  const envoyer = useCallback(
    (action: Action) => {
      if (action.type !== 'famille' || familleChargee(action.famille)) {
        dispatch(action);
        return;
      }
      dispatch({ type: 'attente', famille: action.famille });
      attendreFamille(action.famille)
        .then(() => setModules((n) => n + 1))
        // La tuile restait sur « chargement… » pour toujours quand le
        // morceau ne venait pas. Elle dit maintenant qu'il n'est pas venu,
        // et le client peut réessayer ou choisir autre chose.
        .catch(() => dispatch({ type: 'attente-echouee', famille: action.famille }));
    },
    [dispatch],
  );

  useEffect(() => {
    const attendue = etat.familleEnAttente;
    if (attendue && familleChargee(attendue)) dispatch({ type: 'famille', famille: attendue });
  }, [etat.familleEnAttente, modules]);

  const { prix, issues, erreurs, uw, acoustique, critereAides, elevation } = useMemo(
    () => derive(etat.config, catalogue),
    [etat.config, catalogue],
  );

  // L'hôte suit le prix en direct (badge de fiche produit, télémétrie).
  useEffect(() => {
    props.onEvenement({
      nom: 'ahjc:configuration',
      detail: { config: etat.config, totalCents: prix.totalCents, errorCount: erreurs.length },
    });
  }, [etat.config, prix.totalCents, erreurs.length]);

  // LA TÉLÉMÉTRIE, et elle n'existe QUE si l'hôte l'a demandée. Pas de
  // collecte par défaut, pas de point de mesure caché, pas de tiers : le
  // widget appelle `props.contexte.onEvenement` ou ne fait rien. Voir le contrat
  // dans `host-context.ts`.
  //
  // Ce qui sort d'ici est déjà tout ce qui sortira : un type, une session
  // opaque, un délai, un code de règle. Jamais une cote — et c'est
  // volontaire, même si un marchand aimerait les avoir.
  useEffect(() => {
    if (!props.contexte.onEvenement) return;
    mesurer(props.contexte.onEvenement, { type: 'ouverture' });
  }, [props.contexte.onEvenement]);

  useEffect(() => {
    if (!props.contexte.onEvenement || erreurs.length > 0) return;
    mesurer(props.contexte.onEvenement, { type: 'premier-prix', famille: etat.config.famille });
  }, [props.contexte.onEvenement, prix.totalCents > 0 && erreurs.length === 0]);

  useEffect(() => {
    if (!props.contexte.onEvenement || etat.etape <= 0) return;
    mesurer(props.contexte.onEvenement, { type: 'etape-ouverte', etape: etat.etape });
  }, [props.contexte.onEvenement, etat.etape]);

  useEffect(() => {
    if (!props.contexte.onEvenement) return;
    for (const refus of erreurs) {
      mesurer(props.contexte.onEvenement, { type: 'refus', code: refus.code, famille: etat.config.famille });
    }
    // On dépend des CODES et pas du tableau : un refus identique qui
    // revient à chaque frappe n'est pas un événement de plus. Le tableau de
    // bord compte en sessions, mais autant ne pas lui envoyer le bruit.
  }, [props.contexte.onEvenement, erreurs.map((refus) => refus.code).join('|')]);

  /**
   * LE DEVIS. Il se fabrique DANS LE NAVIGATEUR, sans serveur — c'est la
   * règle offline-first, et c'est ce qui permet au widget d'être complet
   * avant le plugin.
   *
   * L'écrivain PDF arrive par un `import()` : personne ne télécharge un
   * générateur de devis pour regarder un prix. Et la DATE vient d'ici, du
   * navigateur — jamais du cœur, qui n'a pas d'horloge.
   */
  const produireDevis = async () => {
    const { devisEnPdf } = await import('@ahjc/core/src/export/pdf.ts');
    // Le devis porte le CHANTIER quand il y en a un, et la configuration
    // courante sinon : on ne fait pas remplir un panier à qui veut juste
    // le prix de sa fenêtre.
    const lignes =
      etat.panier.length > 0
        ? etat.panier.map((ligne) => ({ config: ligne.config, quantite: ligne.quantite }))
        : [{ config: etat.config, quantite: etat.config.quantite ?? 1 }];
    const aujourdhui = new Date();
    const dateISO = [
      aujourdhui.getFullYear(),
      String(aujourdhui.getMonth() + 1).padStart(2, '0'),
      String(aujourdhui.getDate()).padStart(2, '0'),
    ].join('-');
    const fichier = devisEnPdf(
      lignes,
      {
        dateISO,
        reference: `${contexte.devis?.prefixeReference ?? 'DV'}-${dateISO.replace(/-/g, '')}-${etat.sequence}`,
        marchand: contexte.devis?.marchand,
        client: contexte.devis?.client,
        tvaMilliemes: contexte.devis?.tvaMilliemes,
        validiteJours: contexte.devis?.validiteJours,
        unite: uniteDuContexte(contexte),
      },
      catalogue,
    );
    const nom = `devis-${dateISO}.pdf`;
    props.onEvenement({ nom: 'ahjc:devis', detail: { config: etat.config, fichier, nom } });
    // Le téléchargement, sauf si l'hôte a dit qu'il s'en chargeait.
    if (typeof document === 'undefined') return;
    const url = URL.createObjectURL(new Blob([fichier as BlobPart], { type: 'application/pdf' }));
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = nom;
    // Le lien entre dans le document le temps du clic : un lien détaché
    // fonctionne sur Chrome et pas partout, et le devis est la sortie du
    // parcours — ce n'est pas l'endroit où parier sur un navigateur.
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    // Et l'URL ne se libère qu'APRÈS : la révoquer dans la foulée du clic
    // annule le téléchargement chez les navigateurs qui le démarrent au
    // tour suivant.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const ajouter = () => {
    // La clé est fabriquée par le réducteur, sur son compteur — l'écran la
    // recalcule à l'identique pour l'annoncer à l'hôte, mais ne l'invente
    // pas : deux fabricants finiraient par ne plus s'accorder.
    const cle = cleDeLigne(etat.config, etat.sequence);
    dispatch({ type: 'panier-ajouter' });
    props.onEvenement({
      nom: 'ahjc:panier',
      detail: { config: etat.config, quantite: etat.config.quantite ?? 1, cle },
    });
  };

  return (
    <ContexteTraduction.Provider value={t}>
    {/* Le sens d'écriture suit la langue. Sans lui, une traduction arabe
        passée par le contexte s'afficherait à l'envers — « RTL prévu »
        (docs/03 §8) ne veut rien dire si la première traduction arabe
        oblige à rouvrir le code. */}
    <div className="racine" dir={sensDeLecture(props.langue)}>
      <div className="atelier">
        <Viewport
          config={etat.config}
          catalogue={catalogue}
          elevation={elevation}
          uw={uw}
          acoustique={acoustique}
          vue={etat.vue}
          unite={uniteDuContexte(contexte)}
          modeleRa={contexte.modeleRa}
          onVue={(vue) => dispatch({ type: 'vue', vue })}
          onFacade={(patch) => dispatch({ type: 'champ', patch })}
        />
        <Panneau
          config={etat.config}
          catalogue={catalogue}
          contexte={contexte}
          issues={issues}
          etape={etat.etape}
          familleEnAttente={etat.familleEnAttente}
          familleIndisponible={etat.familleIndisponible}
          releve={etat.releve}
          dispatch={envoyer}
        />
      </div>

      {/* LE PANIER PLEIN PART À LA DEMANDE. Il consolide un CHANTIER —
          métré, teintes, matériaux, remarques de projet — et personne n'a de
          chantier avant sa première ligne. C'est le même raisonnement que
          pour la 3D : le prix ne paie pas ce que le client ne regarde pas.

          ET TANT QU'IL EST VIDE, IL N'Y A RIEN — plus même le paragraphe qui
          vivait ici. Le propriétaire du projet l'a vu à l'écran : « Le
          chantier (0) — aucune menuiserie pour l'instant ; chaque
          configuration ajoutée devient une ligne, les remises de quantité
          s'appliquent aux menuiseries identiques ». Un compteur de rien, et
          une phrase qui explique comment le moteur fonctionne. Elle est
          adressée à celui qui INTÈGRE le widget, pas à celui qui achète une
          fenêtre, et elle occupait un cadre entier au-dessous du panneau.

          CE N'EST PAS UN RENIEMENT DE « CHAQUE ÉTAT VIDE ENSEIGNE », c'en est
          la frontière : un état vide enseigne quand le client A DEMANDÉ
          quelque chose et n'a rien obtenu — une recherche sans résultat, un
          devis sans ligne, une famille dont le module n'est pas venu. Avant
          qu'il ait rien demandé, il n'y a rien à lui enseigner. Le bouton
          « Ajouter au panier » est dans la barre de prix, sous ses yeux ; le
          chantier apparaît avec sa première ligne, et c'est là qu'il
          s'explique. */}
      {etat.panier.length === 0 ? null : (
        <Suspense
          fallback={
            <section className="panier" data-test="panier">
              <p className="vide" role="status">
                {t('Chargement du chantier…')}
              </p>
            </section>
          }
        >
          <Panier
            lignes={etat.panier}
            catalogue={catalogue}
            unite={uniteDuContexte(contexte)}
            onHarmoniser={(lignes) => dispatch({ type: 'projet-harmoniser', lignes })}
            onQuantite={(cle, quantite) => dispatch({ type: 'panier-quantite', cle, quantite })}
            onRetirer={(cle) => dispatch({ type: 'panier-retirer', cle })}
          />
        </Suspense>
      )}

      <BarrePrix
        prix={prix}
        erreurs={erreurs}
        detailOuvert={etat.detailOuvert}
        peutAjouter={true}
        tvaMilliemes={contexte.devis?.tvaMilliemes}
        critereAides={critereAides}
        onDetail={() => dispatch({ type: 'detail' })}
        onAjouter={ajouter}
        etatDesCotes={etat.etatDesCotes}
        onDevis={produireDevis}
      />
      {/* LES AIDES, juste sous le prix : c'est là qu'un client arbitre, et
          c'est le seul endroit où le montant a un sens — à côté de ce qu'il
          vient réduire. */}
      <button
        type="button"
        className="lien-detail"
        data-test="ouvrir-aides"
        aria-expanded={aidesOuvertes}
        onClick={() => setAidesOuvertes((ouvert) => !ouvert)}
      >
        {aidesOuvertes ? t('Masquer les aides') : t('Aides et comparaison des gammes')}
      </button>
      {aidesOuvertes ? (
        <Suspense fallback={<p className="aide">{t('Chargement…')}</p>}>
          <Aides
            config={etat.config}
            catalogue={catalogue}
            situation={etat.situation}
            onSituation={(patch) => dispatch({ type: 'situation', patch })}
          />
        </Suspense>
      ) : null}


      {/* APRÈS LA SIGNATURE, sous le prix : c'est là qu'un client se demande
          ce qu'il aura vraiment, et combien de temps. Replié par défaut —
          la question n'arrive qu'une fois le prix accepté. */}
      <button
        type="button"
        className="lien-detail"
        data-test="ouvrir-apres-vente"
        aria-expanded={apresVenteOuvert}
        onClick={() => setApresVenteOuvert((ouvert) => !ouvert)}
      >
        {apresVenteOuvert
          ? t('Masquer « après la signature »')
          : t('Financement, garanties, entretien')}
      </button>
      {apresVenteOuvert ? (
        <Suspense fallback={<p className="aide">{t('Chargement…')}</p>}>
          <ApresVente
            config={etat.config}
            catalogue={catalogue}
            totalCents={prix.displayTotalCents}
            offre={contexte.credit}
            engagements={contexte.garanties}
            situation={etat.situation}
            onSituation={(patch) => dispatch({ type: 'situation', patch })}
          />
        </Suspense>
      ) : null}

    </div>
    </ContexteTraduction.Provider>
  );
}
