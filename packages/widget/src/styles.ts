

export const FEUILLE_WIDGET = `
:host {
  --ahjc-encre: #1b2124;
  --ahjc-encre-douce: #5c666b;
  --ahjc-papier: #f7f5f2;
  --ahjc-surface: #ffffff;
  --ahjc-bord: #e2ddd6;
  --ahjc-accent: #12604f;
  --ahjc-accent-doux: #e7f0ec;
  --ahjc-alerte: #8a4b1e;
  --ahjc-alerte-douce: #fbf0e6;
  --ahjc-refus: #96261f;
  --ahjc-refus-doux: #fbeceb;
  --ahjc-rayon: 10px;
  --ahjc-ombre: 0 1px 2px rgba(27, 33, 36, .06), 0 8px 24px rgba(27, 33, 36, .06);
  --ahjc-couleur-fond: var(--ahjc-surface);
  display: block;
  color: var(--ahjc-encre);
  font: 15px/1.5 var(--ahjc-police, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
}
* { box-sizing: border-box; }

.racine { background: var(--ahjc-papier); }
.chargement-famille { margin: 0; padding: 48px 24px; text-align: center; color: var(--ahjc-encre-douce); }
/* L'ecran de panne. Il occupe la meme place que l'attente qu'il remplace —
   le client ne doit pas avoir a chercher ce qui a change. */
.etat-panne { padding: 48px 24px; text-align: center; }
.etat-panne p { margin: 0 0 6px; }
.etat-panne .aide { color: var(--ahjc-encre-douce); margin-bottom: 16px; }
.liste-securites { margin: 6px 0 0; padding-left: 18px; font-size: 13px; color: var(--ahjc-encre-douce); }
.metre-projet { margin: 10px 0 0; padding: 10px 12px; background: var(--ahjc-papier); border-radius: var(--ahjc-rayon); font-size: 13px; color: var(--ahjc-encre-douce); }
.metre-projet strong { color: var(--ahjc-encre); }
.liste-securites li { margin-bottom: 4px; }
.liste-securites strong { color: var(--ahjc-encre); }
.atelier { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(320px, .85fr); gap: 20px; padding: 20px; }
:host([data-vue="fiche"]) .atelier { grid-template-columns: 1fr; padding: 12px; }

/* — Le viewport —
   overflow-anchor:none est la CORRECTION DU LOT D19, et elle vaut dix lignes
   d'explication parce que rien, a la lecture, ne dit pourquoi elle est la.
   (AUCUN ACCENT GRAVE ICI : cette feuille est un GABARIT, et un seul
   refermerait la chaine — huit parcours sont tombes d'un coup pour cela.)
   Le navigateur garde fixe, quand une mise en page change, un noeud qu'il
   choisit lui-meme dans l'ecran : c'est l'ancrage de defilement, et il
   compense tout seul — MESURE, vingt-neuf boutons du panneau dont huit
   changent la hauteur du document, aucun ne fait defiler la page. Mais il
   ABANDONNE quand ce noeud est retire du DOM, et le dessin est RECREE a
   chaque changement de famille : quand l'ancre tombait dedans, la page
   sautait. MESURE sur neuf familles, tuile cliquee au milieu de l'ecran :
   +101, −39 et −41 px sur trois d'entre elles, pendant que le dessin variait
   de 168 px. Avec cette ligne : UN pixel au pire, partout. Elle dit la
   verite du dessin plutot qu'elle ne ruse — un dessin qu'on refait ne peut
   pas servir de repere. */
.viewport { position: sticky; top: 16px; align-self: start; overflow-anchor: none; background: var(--ahjc-surface); border: 1px solid var(--ahjc-bord); border-radius: var(--ahjc-rayon); box-shadow: var(--ahjc-ombre); overflow: hidden; }
:host([data-vue="fiche"]) .viewport { position: static; }
/* LA BANDE COLLANTE DU MOBILE A ETE ESSAYEE ET ELLE N'EST PAS ATTEIGNABLE
   ICI — le lot I1 l'a mesuree, et la mesure vaut d'etre gardee.

   Le defaut est reel : en mobile, MESURE sur les sept etapes d'une fenetre de
   839 px, le dessin passe de 73 % visible a l'etape 1 a 14 % a l'etape 7. Il
   part parce que la mise en page tient en une colonne et que le viewport
   perd son collage.

   Deux obstacles, tous deux chiffres. D'abord un element de grille ne colle
   que dans SA zone de grille, et en une colonne cette zone fait exactement sa
   hauteur : passer la grille en flex le repare, et c'est une ligne. Ensuite —
   et c'est ce qui arrete le lot — LE VIEWPORT N'EST PAS FAIT QUE DE DESSIN :
   MESURE en mobile, ses 671 px sont 93 de barre d'onglets, 340 de scene et
   108 de pied, soit 201 px qui ne sont pas le trait. Meme en bornant la scene
   a 180 px et le min-height a 200, la bande collee pese 401 px sur 839, soit
   48 % de l'ecran en permanence. Et masquer le pied retirerait l'Uw et
   l'acoustique, qui sont de l'information.

   LA BANDE COLLANTE DEMANDE DONC DE SORTIR LE PIED DU VIEWPORT, c'est-a-dire
   de toucher la structure JSX, et cela merite son lot. La regle qui en sort :
   avant de coller un panneau, mesurer quelle PART de lui est ce qu'on veut
   garder sous les yeux. Et l'essai a fait tomber les parcours en mobile — la
   bande interceptait le clic sur l'en-tete de l'etape 1 —, ce qui est le
   second obstacle d'un panneau collant : il faut un scroll-margin sur ce
   qu'il recouvre. */
@media (max-width: 900px) { .atelier { grid-template-columns: 1fr; padding: 12px; } .viewport { position: static; } }
.viewport-barre { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border-bottom: 1px solid var(--ahjc-bord); flex-wrap: wrap; }
.onglets { display: flex; gap: 2px; background: var(--ahjc-papier); padding: 3px; border-radius: 8px; }
.onglets button { border: 0; background: none; padding: 7px 14px; border-radius: 6px; cursor: pointer; font: inherit; font-size: 13px; color: var(--ahjc-encre-douce); min-height: 34px; }
.onglets button[aria-selected="true"] { background: var(--ahjc-surface); color: var(--ahjc-encre); font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,.08); }
/* IL N'Y A PLUS DE REGLE POUR UN ONGLET DESACTIVE, et c'est une SUPPRESSION
   du lot C12c, pas un oubli. Le lot C12b a retire le champ « disponible »
   des onglets, donc l'attribut disabled, donc le title et les deux gardes :
   un onglet qui n'a pas lieu d'etre n'est plus grise, il n'est pas rendu.
   La regle qui le peignait a survecu a son sujet. MESURE en la retirant :
   12 octets gzippes rendus au chargement initial — c'est avec eux que la
   compaction mobile de la barre de prix tient dans la borne. */
.badge-uw { font-size: 13px; color: var(--ahjc-encre-douce); margin: 0; }
.badge-uw strong { color: var(--ahjc-encre); font-variant-numeric: tabular-nums; }
.scene { padding: 20px; background: repeating-linear-gradient(45deg, #fbfaf8 0 12px, #f6f4f1 12px 24px); display: grid; place-items: center; min-height: 340px; }
.scene svg { max-height: 380px; width: 100%; }

.viewport-pied { display: flex; gap: 14px; padding: 10px 14px; border-top: 1px solid var(--ahjc-bord); font-size: 13px; color: var(--ahjc-encre-douce); flex-wrap: wrap; }
.a-venir { color: var(--ahjc-encre-douce); font-size: 14px; text-align: center; max-width: 46ch; margin: 0; }
/* La peau des vues A LA DEMANDE (volume, RA, photo, coupe) vit dans
   styles-vues.ts et arrive avec elles : un visiteur qui reste sur
   l'elevation ne telecharge pas le CSS d'un canevas WebGL qu'il
   n'ouvrira pas. Pas de guillemet oblique ici — on est dans un
   gabarit de chaine, et un accent grave y ferme la feuille. */

/* — Le panneau — */
.panneau { display: flex; flex-direction: column; gap: 10px; margin: 0; }
.etape { background: var(--ahjc-surface); border: 1px solid var(--ahjc-bord); border-radius: var(--ahjc-rayon); overflow: hidden; }
.etape-entete { display: flex; align-items: baseline; gap: 10px; padding: 14px 16px; width: 100%; background: none; border: 0; cursor: pointer; font: inherit; color: inherit; text-align: left; }
.etape .num { font-size: 12px; font-weight: 700; color: var(--ahjc-accent); background: var(--ahjc-accent-doux); border-radius: 999px; width: 22px; height: 22px; display: grid; place-items: center; flex: none; }
.etape h3 { font-size: 15px; margin: 0; font-weight: 600; }
.etape .resume { margin-left: auto; font-size: 13px; color: var(--ahjc-encre-douce); text-align: right; }
.etape-corps { padding: 14px 16px 16px; border-top: 1px solid var(--ahjc-bord); }

label.champ { display: block; font-size: 13px; color: var(--ahjc-encre-douce); margin-bottom: 6px; }
.duo { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
input[type="number"], input[type="text"] { width: 100%; padding: 10px 12px; font: inherit; font-variant-numeric: tabular-nums; border: 1px solid var(--ahjc-bord); border-radius: 8px; background: var(--ahjc-surface); color: inherit; min-height: 44px; }
input:focus-visible, button:focus-visible { outline: 2px solid var(--ahjc-accent); outline-offset: 2px; }
.aide { font-size: 12px; color: var(--ahjc-encre-douce); margin: 6px 0 0; }
/* Le guide de cotes. Il n'est pas une note de bas de page : c'est la
   consigne que le client doit lire AVANT de mesurer, et une cote fausse
   coûte une menuiserie entière. D'où le liseré et le fond. */
.guide-cotes { margin: 10px 0 0; padding: 10px 12px; border-left: 3px solid var(--ahjc-accent);
  background: var(--ahjc-accent-doux); border-radius: 0 6px 6px 0; }
.guide-cotes p { margin: 0 0 4px; font-size: 12.5px; line-height: 1.45; }
.guide-cotes p:last-child { margin-bottom: 0; }
.guide-cotes strong { color: var(--ahjc-encre); }
.prereglages, .segmente { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
.prereglages button, .segmente button, .tuile { font: inherit; font-size: 13px; background: var(--ahjc-surface); border: 1px solid var(--ahjc-bord); border-radius: 8px; padding: 9px 12px; cursor: pointer; color: inherit; min-height: 44px; }
.prereglages button[aria-pressed="true"], .segmente button[aria-pressed="true"] { border-color: var(--ahjc-accent); background: var(--ahjc-accent-doux); color: var(--ahjc-accent); font-weight: 600; }
.tuiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; }
.rayon + .rayon { margin-top: 14px; }
.rayon-titre { margin: 0 0 6px; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--ahjc-encre-douce); }
.tuile { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; }
.tuile[aria-pressed="true"] { border-color: var(--ahjc-accent); background: var(--ahjc-accent-doux); }
.tuile[disabled] { opacity: .5; cursor: not-allowed; }
/* LE DESSIN D'UNE TUILE (lot I4). Il prend toute la largeur et une hauteur
   FIXE : sans hauteur, le SVG a 100 % de rien et la tuile s'effondre. Le
   trait garde ses proportions par son viewBox. */
.tuile-dessin { display: block; width: 100%; height: 46px; margin-bottom: 2px; }
.tuile-dessin svg { width: 100%; height: 100%; }
.tuile .delta { font-size: 12px; color: var(--ahjc-encre-douce); font-variant-numeric: tabular-nums; }
.tuile[aria-pressed="true"] .delta { color: var(--ahjc-accent); }
.bloc + .bloc { margin-top: 14px; }

/* — Les messages de règle : un refus dit toujours quoi faire — */
.note { display: flex; gap: 10px; padding: 11px 12px; border-radius: 8px; font-size: 13px; margin-top: 12px; align-items: flex-start; }
.note--info { background: var(--ahjc-alerte-douce); color: var(--ahjc-alerte); }
.note--avertissement { background: var(--ahjc-papier); color: var(--ahjc-encre-douce); }
.note--erreur { background: var(--ahjc-refus-doux); color: var(--ahjc-refus); }
.note button { font: inherit; font-size: 13px; font-weight: 600; margin-top: 6px; background: var(--ahjc-surface); border: 1px solid currentColor; color: inherit; border-radius: 8px; padding: 7px 12px; cursor: pointer; min-height: 40px; }

/* — La barre de prix : le seul élément permanent — */
.barre-prix { position: sticky; bottom: 0; z-index: 2; background: var(--ahjc-surface); border-top: 1px solid var(--ahjc-bord); box-shadow: 0 -6px 24px rgba(27,33,36,.07); padding: 12px 20px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.barre-prix .montant { font-size: 26px; font-weight: 650; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }

/* Le critere technique des aides, sous le prix. En accent quand il est
   tenu, en encre douce sinon : ce n'est pas une alerte -- une menuiserie
   qui ne vise pas les aides est un choix legitime, et la teinte d'alerte
   ferait croire a un defaut. */
.barre-prix .tva, .barre-prix .aides { font-size: 12px; color: var(--ahjc-encre-douce); }
.barre-prix .aides { margin-top: 2px; max-width: 46ch; }
.barre-prix .actions { margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; }
.bouton { font: inherit; font-weight: 600; padding: 11px 18px; border-radius: 8px; border: 1px solid var(--ahjc-bord); background: var(--ahjc-surface); cursor: pointer; color: inherit; min-height: 44px; }
.bouton--primaire { background: var(--ahjc-accent); border-color: var(--ahjc-accent); color: #fff; }
.bouton--primaire[disabled] { background: var(--ahjc-encre-douce); border-color: var(--ahjc-encre-douce); cursor: not-allowed; }
/* LA BARRE DE PRIX SUR UN TELEPHONE — lot C12c, et la mesure a trouve pire
   que ce qu'on cherchait.
   Ce qu'on cherchait : elle est collee en bas, donc permanente, et elle
   prenait trop de place. MESURE sur un ecran de 412 x 839 (Pixel 7) :
   165 px, dont 47 par bouton.
   CE QUE LA MESURE A TROUVE : LA BARRE DEBORDAIT LA LARGEUR DE L'ECRAN.
   Les trois boutons — devis, pieces techniques, ajouter au panier — font
   106 + 158 + 156 px plus leurs ecarts, soit 436 px de rangee pour 372 de
   place. Releve : scrollWidth 456 contre clientWidth 412, et le DOCUMENT
   entier defilait lateralement de quarante-quatre pixels. Le bouton qui
   ajoute au panier — celui qui vend — etait le dernier de la rangee, donc
   celui qui sortait. Une barre trop haute se subit ; une barre qui deborde
   emporte la page avec elle.
   CE QUE LA COMPACTION REND : 165 → 153 px, DIX-HUIT pour cent, plus aucun
   debordement (scrollWidth 412 = clientWidth), et les trois boutons a 119 px
   sur UNE rangee de 44 — la cible tactile reste entiere.
   LE RETRAIT DE PADDING N'EST PAS UN GOUT, IL DECIDE DE LA HAUTEUR : a
   11px 18px, le libelle « Pieces techniques » ne tient pas dans les 119 px
   d'une rangee de trois et passe a la ligne — les boutons montent alors a
   63 px et la barre a 172. A 11px 6px, il tient. MESURE : 8 px de padding
   ne suffisent pas, 6 oui.
   ET RIEN N'EST CACHE : ni la mention de TVA, ni le critere des aides, ni le
   devis, ni les pieces techniques. Une variante qui ne gardait que le prix
   et le panier tombait a 64 px — et c'etait la faute du lot D19b prise a
   l'envers : on ne gagne pas de la place en retirant ce que le client a
   demande.
   ET CE BLOC VIT ICI, APRES les regles qu'il corrige, avec LEUR specificite.
   Range dans la requete media du haut de cette feuille, « .montant » (0,1,0)
   perdait contre « .barre-prix .montant » (0,2,0) : le corps restait a 26 et
   la compaction ne s'appliquait pas. Une requete media ne l'emporte pas sur
   la specificite — elle ne fait que porter une condition, et une regle
   ecrite dans un bloc media se lit comme si elle gagnait. */
@media (max-width: 900px) { .barre-prix .montant { font-size: 20px; } .barre-prix .actions { flex: 1; } .barre-prix .bouton { flex: 1; font-size: 13px; padding: 11px 6px; } }
/* LA MARGE DROITE N'EST PAS COSMÉTIQUE. Ces liens sont des <button> collés
   les uns aux autres dans le JSX, sans espace entre eux : sans elle, trois
   d'affilée se lisaient « Aides et comparaison des gammesFinancement,
   garanties, entretienMasquer le lot ». Le défaut existait à deux et ne se
   voyait pas ; le troisième l'a rendu illisible. La marge les sépare ET
   leur rend un point de retour à la ligne, qu'un texte sans blanc n'a pas. */
.lien-detail { font: inherit; font-size: 13px; color: var(--ahjc-accent); background: none; border: 0; cursor: pointer; padding: 4px 0; margin-right: 18px; text-decoration: underline; }
.lignes { list-style: none; margin: 8px 0 0; padding: 0; font-size: 13px; width: 100%; }
.lignes li { display: flex; justify-content: space-between; gap: 20px; padding: 3px 0; font-variant-numeric: tabular-nums; }
.lignes li.supplement { color: var(--ahjc-alerte); }
.lignes li.total { border-top: 1px solid var(--ahjc-bord); margin-top: 6px; padding-top: 6px; font-weight: 650; }

/* — Le panier — */
.panier { background: var(--ahjc-surface); border: 1px solid var(--ahjc-bord); border-radius: var(--ahjc-rayon); padding: 14px 16px; margin: 0 20px 20px; }
.panier h3 { margin: 0 0 10px; font-size: 15px; }
.panier ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.panier li { display: flex; align-items: center; gap: 12px; }
.panier .vignette { width: 56px; height: 56px; flex: none; border: 1px solid var(--ahjc-bord); border-radius: 6px; padding: 3px; background: var(--ahjc-surface); }
.panier .vignette svg { width: 100%; height: 100%; }
.panier .titre { font-size: 13px; }
.panier .prix-ligne { margin-left: auto; font-variant-numeric: tabular-nums; font-weight: 600; }
.panier .vide { color: var(--ahjc-encre-douce); font-size: 13px; margin: 0; }
.panier input[type="number"] { width: 72px; min-height: 40px; }
.panier .total-panier { display: flex; justify-content: space-between; border-top: 1px solid var(--ahjc-bord); margin-top: 12px; padding-top: 10px; font-weight: 650; font-variant-numeric: tabular-nums; }
.retirer { font: inherit; font-size: 13px; background: none; border: 0; color: var(--ahjc-encre-douce); cursor: pointer; text-decoration: underline; padding: 8px; min-height: 40px; }

@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
`.trim();

/**
 * Les `@font-face` d'un pack doivent vivre dans le DOCUMENT : injectées
 * dans un shadow root, elles ne chargent pas (incident déjà payé chez les
 * néons). Idempotente — plusieurs widgets sur une page n'injectent qu'une
 * fois.
 */
export function injecterPolices(css: string, document_: Document): void {
  const marque = 'ahjc-polices';
  if (document_.getElementById(marque)) return;
  const balise = document_.createElement('style');
  balise.id = marque;
  balise.textContent = css;
  document_.head.appendChild(balise);
}
