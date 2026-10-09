/**
 * Pourquoi ce fichier existe : LE LOT D26 — les phrases des refus du cœur, hors
 * du chargement initial.
 *
 * `validate.ts` décide ; ce module dit. Chaque fonction reçoit les VALEURS dans
 * l'ordre où la règle les passe et rend la phrase EXACTE qu'elle écrivait avant —
 * `phrases-des-refus.test.ts`, écrit avant le déplacement, compare chacune au
 * caractère près.
 *
 * Il s'enregistre en étant IMPORTÉ : `chargerGroupe` le charge avec le module de
 * chaque groupe, et les appelants hors navigateur l'importent eux-mêmes. Il n'est
 * pas réexporté par `index.ts` — cela le ferait rentrer dans l'entrée par la porte
 * que ce lot ferme.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import { enregistrerPhrasesDesRefus } from './couture-des-phrases.ts';
import { nommerMateriau as nommer, nommerVantaux } from './libelles.ts';

/** Un nombre à décimale fixe, en français — la virgule que les messages portaient déjà. */
function decimal(x: number, chiffres: number): string {
  return x.toFixed(chiffres).replace('.', ',');
}

enregistrerPhrasesDesRefus({
  'famille-inconnue': (v) => `La famille « ${v[0]} » n'existe pas au catalogue.`,
  'vantaux-hors-famille': (v) => `${v[0]} : de ${v[1]} à ${v[2]} vantaux (demandé : ${v[3]}).`,
  'largeur-hors-bornes': (v) =>
    `${v[0]}${v[1] ? '' : ` ${nommerVantaux(v[2])}`} : ${v[1] ? 'longueur' : 'largeur'} de ${v[3]} à ${v[4]} mm (demandé : ${v[5]} mm).`,
  'hauteur-hors-bornes': (v) => `${v[0]} ${nommerVantaux(v[1])} : hauteur de ${v[2]} à ${v[3]} mm (demandé : ${v[4]} mm).`,
  'materiau-indisponible': (v) =>
    `${v[0]} : pas de fabrication en ${nommer(v[1])} (disponible : ${v[2].map(nommer).join(', ')}).`,
  'systeme-inconnu': (v) => `La gamme « ${v[0]} » n'existe pas au catalogue.`,
  'systeme-hors-materiau': (v) => `La gamme « ${v[0]} » est une gamme ${nommer(v[1])}, pas ${nommer(v[2])}.`,
  'vantail-trop-large': (v) => `Vantail de ${v[0]} mm : le ${nommer(v[1])} admet ${v[2]} mm au plus.`,
  'vantail-trop-etroit': (v) => `Vantail de ${v[0]} mm : l'atelier fabrique à partir de ${v[1]} mm.`,
  'ouverture-hors-famille': (v) => `${v[0]} : ouverture « ${v[1]} » impossible (au choix : ${v[2].join(', ')}).`,
  'soufflet-monovantail': () => 'Un châssis à soufflet est monovantail — le vantail bascule sur toute la largeur.',
  'vitrage-trop-lourd': (v) =>
    `${v[0]} kg de vitrage par vantail : au-delà de ${v[1]} kg, aucune ferrure ne le porte.`,
  'ferrures-renforcees': (v) =>
    `${v[0]} kg de vitrage par vantail (admissible standard : ${v[1]} kg) — ferrures renforcées ajoutées, +12 % sur la base corrigée.`,
  'feuillete-impose': (v) =>
    `Vitrage feuilleté 44.2 appliqué d'office (${
      v[0] ? `allège à ${v[1]} mm, sous les ${v[2]} mm réglementaires` : "vitrage de porte, exposé jusqu'au sol"
    }) — le prix l'inclut.`,
  'aev-insuffisant': (v) =>
    `Zone de vent ${v[0]}${v[1] ? ' en étage élevé' : ''} : ` +
    `${v[2]} Pa de pression de pointe, soit un classement ${v[3]}. ` +
    'La gamme standard est tenue jusqu’à 800 Pa (classe 2).',
  'verre-sous-dimensionne': (v) =>
    `Vitrage de ${decimal(v[0], 2)} m² sous ${v[1]} Pa : ` +
    `face extérieure de ${v[2]} mm posée, ${v[3]} mm conseillés (EN 16612). ` +
    (v[4]
      ? 'Au-delà de 4 m² équivalents, il faut du trempé ou une note de calcul.'
      : 'Repère de terrain — il ne remplace pas une note de calcul.'),
  'fleche-renforcee': (v) =>
    `Montant de ${v[0]} mm en ${nommer(v[1])} sous ${v[2]} Pa : ` +
    `${decimal(v[3], 1)} mm de flèche même renforcé, ` +
    `pour ${decimal(v[4], 1)} mm admissibles ` +
    '(L/300, classe C). Il faut un meneau plus profond ou un calcul de structure.',
  'renfort-acier-impose': (v) =>
    `Montant de ${v[0]} mm sous ${v[1]} Pa : renfort acier ` +
    `(tube ${v[2]} mm, ${v[3]} cm⁴) prévu au débit — ` +
    `sans lui la flèche atteindrait ${decimal(v[4], 1)} mm ` +
    `pour ${decimal(v[5], 1)} mm admissibles.`,
  'fleche-bois': (v) =>
    `Montant de ${v[0]} mm en ${nommer(v[1])} sous ${v[2]} Pa : ` +
    `${decimal(v[3], 1)} mm de flèche pour ` +
    `${decimal(v[4], 1)} mm admissibles (L/300, classe C). ` +
    'Le bois ne se renforce pas : il faut une section plus forte.',
  'triple-vitrage-acoustique': (v) =>
    `${v[0]} Ce triple vitrage rend ${v[1]} dB` + (v[2] !== undefined ? ` ; un double asymétrique en rend ${v[2]}` : '') + '.',
  'option-inconnue': (v) => `Option « ${v[0]} » inconnue du catalogue.`,
  'option-hors-famille': (v) => `${v[0]} : indisponible sur ${v[1].toLowerCase()}.`,
  'option-quantite-excessive': (v) =>
    `${v[0]} : ${v[1]} vantaux équipés demandés, la menuiserie n'en a que ${v[2]}.`,
  'oscillo-battant-incompatible': (v) =>
    `Pas d'oscillo-battant sur une ouverture « ${v[0]} » — il se greffe sur la frappe à la française.`,
  'grilles-multiples': () => 'Une seule grille de défense par baie — les modèles ne se superposent pas.',
  'motorisations-multiples': () => 'Une seule motorisation par volet ou store.',
  'motorisation-sans-volet': () =>
    'La motorisation équipe un volet : ajoutez le bloc-baie, ou retirez la motorisation.',
  'moustiquaire-bloc-baie': () =>
    'Moustiquaire intégrée et bloc-baie ne cohabitent pas dans le coffre de la gamme standard.',
  'pose-sans-objet': (v) => `${v[0]} : le type de pose ne se règle pas ainsi — valeur ignorée.`,
  'pose-inconnue': (v) => `La pose « ${v[0]} » n'existe pas au catalogue.`,
  'tapee-sans-applique': (v) =>
    `La tapée d'isolation rattrape l'épaisseur d'un doublage : elle ne s'emploie qu'en pose applique — valeur ignorée en pose ${v[0].toLowerCase()}.`,
  'tapee-inconnue': (v) =>
    `Tapée de ${v[0]} mm : les épaisseurs vendues sont ${v[1].map((t: { epaisseurMm: number }) => t.epaisseurMm).join(', ')} mm.`,
  'applique-sans-tapee': () =>
    "Pose en applique sans tapée : le dormant s'arrêtera au nu de la maçonnerie et laissera l'épaisseur du doublage apparente.",
  'renovation-clair-reduit': (v) =>
    `Rénovation : le dormant neuf se loge dans l'ancien et vous prendrez environ ${v[0]} mm de clair de jour par côté, soit ${2 * v[0]} mm de largeur vitrée.`,
  'renovation-clair-critique': (v) =>
    `Il ne resterait que ${v[0]} mm de clair par vantail — la fenêtre serait plus cadre que verre.`,
  'tapee-sans-objet': (v) => `${v[0]} : la tapée d'isolation ne s'applique pas — valeur ignorée.`,
  'allege-sans-objet': () => "La hauteur d'allège ne concerne que les fenêtres — valeur ignorée.",
  'imposte-sans-objet': () =>
    "L'imposte ne concerne que les fenêtres, portes-fenêtres et portes d'entrée — valeur ignorée.",
  'bloc-baie-sans-menuiserie': () =>
    "Un bloc-baie est solidaire du dormant de la menuiserie : il se commande AVEC elle, " +
    "par l'option « Volet roulant bloc-baie » sur la fenêtre ou la porte-fenêtre. " +
    'Seul, un volet roulant se pose en coffre extérieur ou en coffre tunnel.',
  'modele-porte-sans-objet': (v) =>
    `${v[0]} : le modèle de panneau ne concerne que les portes d'entrée — valeur ignorée.`,
  'modele-porte-inconnu': (v) => `Le modèle de porte « ${v[0]} » n'existe pas au catalogue.`,
  'modele-porte-sans-panneau': (v) =>
    `Une porte toute vitrée n'a presque plus de panneau : le décor « ${v[0]} » ne s'y verra pas.`,
  'vitrage-sans-objet': (v) => `${v[0]} : pas de vitrage — valeur ignorée.`,
  'quantite-invalide': (v) => `Quantité « ${v[0]} » : il faut un entier d'au moins 1.`,
});
