/**
 * Pourquoi ce fichier existe : le lot MT2b a rencontré, dans une SECONDE
 * famille, le piège que le BSO avait déjà payé au lot S1 — un gammiste qui
 * annonce une « classe 8 » d'une norme qui s'arrête à 6.
 *
 * Griesser écrit, sur la fiche du volet coulissant : « classe de vent 6 selon
 * EN 13659 (600 Pa), standard interne classe 8 (800 Pa) ». `bso.ts` portait
 * déjà `LA_NORME_S_ARRETE_A` et la phrase qui va avec. Deux copies d'une même
 * borne de norme, ce sont deux vérités le jour où l'une est corrigée — et la
 * maison exigerait alors un comparateur, c'est-à-dire un test dont le seul
 * rôle serait de réparer une duplication qu'on n'était pas obligé de créer.
 * La borne remonte donc ici, où les deux familles la lisent.
 *
 * CE QUE CE FICHIER NE PORTE PAS, ET C'EST LA TROUVAILLE DU LOT MT2b :
 * AUCUNE TABLE DE NOMBRES PAR CLASSE. Il n'y en a pas une, il y en a deux, et
 * elles ne disent pas la même chose.
 *
 *   · `bso.ts` donne la classe 6 à **92 km/h**. C'est un RÉGLAGE DE CAPTEUR :
 *     la vitesse à laquelle le poseur fait remonter le store. Soit 400 Pa.
 *   · La fiche du volet coulissant donne la classe 6 à **600 Pa**. C'est une
 *     PRESSION D'ESSAI : ce que le panneau encaisse sans se déformer. Soit
 *     113 km/h.
 *
 * MESURÉ : **×1,5 en pression, ×1,225 en vitesse, pour le même numéro de
 * classe.** Les deux nombres sont justes ; ils répondent à deux questions —
 * « quand est-ce que ça se range ? » et « qu'est-ce que ça tient ? ». C'est
 * exactement la faute du lot Z17 et celle du lot MT1b, retrouvées une
 * troisième fois : un même mot qui couvre deux grandeurs.
 *
 * SOLUTION ÉCARTÉE : monter ici une table `PRESSION_DE_CLASSE_PA` à côté de
 * `VITESSE_DE_CLASSE_KMH`. Elles se seraient retrouvées côte à côte, indexées
 * par le même numéro, et un écran aurait fini par afficher « classe 6 :
 * 92 km/h — 600 Pa », qui est faux dans les deux sens. Chaque famille garde
 * le nombre que SA source publie, avec le nom de ce qu'il mesure ; seule la
 * BORNE DE LA NORME, qui n'appartient à aucun produit, est commune.
 *
 * Il ne réexporte rien depuis `index.ts` : il vit hors du chargement initial,
 * dans les morceaux paresseux qui le lisent.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

/**
 * LA DERNIÈRE CLASSE QUE LA NORME PRODUIT DÉFINIT.
 *
 * Au-delà, ce sont des désignations de gammiste. Les afficher sans le dire
 * vendrait une classe qui n'en est pas une.
 */
export const LA_NORME_S_ARRETE_A = 6;

/**
 * CE QU'ON DIT D'UNE CLASSE HORS ÉCHELLE — et ce n'est pas un refus.
 *
 * Le produit DÉPASSE la classe 6 sans la certifier au-delà : il ne s'oppose
 * donc pas à un CCTP qui exige « classe 6 ». Refuser serait faux ; se taire
 * laisserait croire à une classe normative. C'est une information.
 */
export function phraseDeClasseHorsEchelle(classe: number): string {
  return (
    `Classe ${classe} annoncée : la norme produit EN 13659 s’arrête à ` +
    `${LA_NORME_S_ARRETE_A}. C’est une désignation du gammiste, et elle ne s’oppose pas à ` +
    `un CCTP qui exige « classe ${LA_NORME_S_ARRETE_A} » — elle le dépasse, sans le certifier.`
  );
}
