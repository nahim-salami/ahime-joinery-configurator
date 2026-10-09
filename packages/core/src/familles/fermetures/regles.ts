
import type { PricingCatalog } from '../../catalog.ts';
import type { JoineryConfiguration, ValidationIssue } from '../../types.ts';

export function reglesFermetures(contexte: {
  config: JoineryConfiguration;
  catalog: PricingCatalog;
}): ValidationIssue[] {
  const { config } = contexte;
  const issues: ValidationIssue[] = [];

  // Une manœuvre manuelle sur un volet MOTORISÉ ne veut rien dire : le
  // moteur remplace la sangle et la manivelle, il ne s'y ajoute pas. Le
  // prix l'ignore déjà ; l'écran doit le dire plutôt que de laisser deux
  // tuiles allumées qui se contredisent.
  if (
    config.famille === 'volet-roulant' &&
    config.manoeuvre === 'manivelle' &&
    (config.options ?? []).some((choisie) => String(choisie.id).startsWith('motorisation-'))
  ) {
    issues.push({
      code: 'manoeuvre-et-moteur',
      severite: 'avertissement',
      message:
        'Un volet motorisé ne porte pas de manivelle — le moteur remplace la manœuvre manuelle, il ne s’y ajoute pas.',
      alternative: { label: 'Revenir à la sangle', patch: { manoeuvre: 'sangle' } },
    });
  }

  // LE MOTEUR SOLAIRE CONTRAINT LE CÔTÉ, et c'était une incompatibilité
  // MUETTE — lot O5.
  //
  // Le relevé de Fenetre24 (docs/51 §4.2) le déclare en toutes lettres :
  // « panneau solaire toujours monté sur le côté GAUCHE, vu de l'intérieur ».
  // Ce catalogue vend une motorisation solaire à 388 € sans dire de quel côté
  // le panneau se pose : un client qui a demandé sa manœuvre à droite
  // commandait donc un volet infabricable, et rien ne le lui disait — ni le
  // prix, ni le dessin, ni une remarque.
  //
  // C'EST UNE ERREUR, PAS UN AVERTISSEMENT : le panneau ne se déplace pas, et
  // il n'y a pas de version droite du produit. L'alternative qui MARCHE est de
  // ramener la manœuvre à gauche ; l'autre sortie — la motorisation radio —
  // est nommée dans la phrase, parce qu'elle change le prix et que c'est au
  // client d'arbitrer (règle du lot Z9).
  //
  // LA CONVENTION EST CELLE DE L'ÉLÉVATION — vue intérieure —, et les deux
  // sources coïncident : le dire évite la faute du lot C0, où « 60° » ne
  // disait pas quel angle.
  //
  // ET LE CODE COMMENCE PAR `motorisation-`, CE QUI N'EST PAS UN DÉTAIL DE
  // NOM : c'est lui qui décide de l'ÉCRAN où la remarque se lit. Le refus est
  // provoqué au moment où le client coche la motorisation solaire — à l'étape
  // des options —, et le premier jet l'avait rangé sous l'écran du COFFRE,
  // celui du côté. Le parcours l'a dit : l'accordéon n'affiche que le corps
  // OUVERT, et le client voyait donc son panier se bloquer sans un mot. C'est
  // la leçon du lot MT2c — un refus se range là où le geste a eu lieu, et son
  // alternative marche depuis n'importe où.
  if (
    config.famille === 'volet-roulant' &&
    config.coteManoeuvre === 'droite' &&
    (config.options ?? []).some((choisie) => choisie.id === 'motorisation-solaire')
  ) {
    issues.push({
      code: 'motorisation-solaire-cote',
      severite: 'erreur',
      message:
        'Motorisation solaire : le panneau se monte toujours à GAUCHE, vu de l’intérieur — et la ' +
        'manœuvre est demandée à droite. Les deux ne se fabriquent pas ensemble. La motorisation ' +
        'radio, elle, se pose des deux côtés.',
      alternative: { label: 'Passer la manœuvre à gauche', patch: { coteManoeuvre: 'gauche' } },
    });
  }

  return issues;
}
