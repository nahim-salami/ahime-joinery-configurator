/**
 * Pourquoi ce fichier existe : L'ÉCRIVAIN PDF EST PARTAGÉ.
 *
 * Il vivait dans `pdf.ts`, au service du devis seul. Le lot P8 ajoute la
 * FACTURE, qui a besoin exactement des mêmes primitives — des pages A4,
 * deux polices de base, du texte, des traits et des rectangles.
 *
 * IL A ÉTÉ DÉPLACÉ, PAS RECOPIÉ, et c'est tout l'objet de ce fichier. Deux
 * écrivains PDF dans un même dépôt divergent en trois mois : l'un apprend
 * l'espace fine insécable, l'autre non ; l'un échappe une parenthèse,
 * l'autre la laisse casser le flux. Et ce qui casse est le document qu'un
 * client PAIE.
 *
 * LE DÉPLACEMENT EST À L'IDENTIQUE, LIGNE POUR LIGNE — aucune ligne n'a
 * été retouchée, seuls les `export` ont été ajoutés. Ce qui l'atteste est
 * la suite du cœur, qui est passée sans qu'une épreuve change : elle
 * fouille le texte du PDF, ses octets de tête, ses mentions.
 *
 * ET DEPUIS, UN VERROU D'EMPREINTE. `pdf-primitives.test.ts` fige le
 * SHA-256 d'un devis de référence : le prochain qui touche à l'écrivain
 * saura, au caractère près, s'il a changé un document que des clients
 * paient. Ce verrou n'existait pas avant ce déménagement — il aurait dû.
 *
 * CE QU'IL NE SAIT PAS FAIRE, et qu'il faut dire : ce n'est pas un
 * écrivain PDF/A. Il n'embarque aucune police (il emploie les deux
 * polices de base, que PDF/A refuse), il n'a pas de profil de sortie
 * couleur, et il n'écrit pas de métadonnées XMP. Un Factur-X — qui est un
 * PDF/A-3 avec un XML embarqué — demande les trois, et le lot P8 le dit
 * plutôt que de le prétendre.
 *
 * Aucune horloge : la date est FOURNIE par l'appelant. `new Date()` ici
 * rendrait deux documents identiques différents d'un octet, donc
 * invérifiables.
 */


/** A4 en points PostScript (1 pt = 1/72 pouce). */
export const PAGE = { largeur: 595.28, hauteur: 841.89, marge: 42 };

/**
 * Le texte, encodé en WinAnsi — l'encodage des polices de base d'un PDF.
 * Il couvre le français au complet, y compris l'œ et le tiret cadratin, à
 * condition de les écrire à leur position et non en UTF-8.
 */
const WINANSI: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
  'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91,
  '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98,
  '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
  // L'ESPACE FINE INSÉCABLE. `toLocaleString('fr-FR')` sépare les milliers
  // avec elle (U+202F), et elle n'existe pas en WinAnsi : « 6 968,90 € »
  // s'imprimait « 6?968,90 € » sur le devis — sur la ligne du TOTAL, celle
  // que le client lit en premier. On la ramène à l'espace insécable
  // ordinaire, qui, elle, y est, et qui ne coupe pas davantage.
  '\u202f': 0xa0,
};

export function versWinAnsi(texte: string): number[] {
  const octets: number[] = [];
  for (const caractere of texte) {
    const code = caractere.codePointAt(0)!;
    if (WINANSI[caractere] !== undefined) octets.push(WINANSI[caractere]);
    else if (code <= 0xff) octets.push(code);
    // Tout ce qui sort de la plage est remplacé par un point d'interrogation
    // plutôt que par un octet muet : un devis qui perd un caractère en
    // silence est un devis qu'on ne relit pas.
    else octets.push(0x3f);
  }
  return octets;
}

/** Une chaîne littérale PDF, échappée. */
export function litteral(texte: string): string {
  const octets = versWinAnsi(texte);
  let sortie = '(';
  for (const octet of octets) {
    if (octet === 0x28 || octet === 0x29 || octet === 0x5c) sortie += '\\' + String.fromCharCode(octet);
    else if (octet < 32 || octet > 126) sortie += '\\' + octet.toString(8).padStart(3, '0');
    else sortie += String.fromCharCode(octet);
  }
  return sortie + ')';
}

/** Deux décimales au plus — un PDF lisible, et des octets stables. */
export function n(valeur: number): string {
  const arrondi = Math.round(valeur * 100) / 100;
  return Object.is(arrondi, -0) ? '0' : String(arrondi);
}

/** Le flux de dessin d'une page — on y empile des opérateurs PDF. */
export class Page {
  readonly operations: string[] = [];

  texte(x: number, y: number, contenu: string, taille = 9, gras = false, gris = 0): this {
    this.operations.push(
      'BT',
      `${n(gris)} g`,
      `/${gras ? 'F2' : 'F1'} ${n(taille)} Tf`,
      `1 0 0 1 ${n(x)} ${n(y)} Tm`,
      `${litteral(contenu)} Tj`,
      'ET',
      '0 g',
    );
    return this;
  }

  /** Un texte aligné à DROITE — les montants d'un devis se lisent ainsi. */
  texteDroite(xDroite: number, y: number, contenu: string, taille = 9, gras = false): this {
    // Largeur approchée d'Helvetica : 0,5 em par caractère. C'est faux au
    // caractère près et juste à l'œil, et un devis n'a pas besoin de mieux
    // pour aligner une colonne de montants.
    return this.texte(xDroite - contenu.length * taille * 0.5, y, contenu, taille, gras);
  }

  ligne(x1: number, y1: number, x2: number, y2: number, epaisseur = 0.5, gris = 0.6): this {
    this.operations.push(
      `${n(gris)} G`,
      `${n(epaisseur)} w`,
      `${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S`,
      '0 G',
    );
    return this;
  }

  rectangle(x: number, y: number, largeur: number, hauteur: number, remplir: number | null, trait = 0.4): this {
    if (remplir !== null) this.operations.push(`${n(remplir)} g`);
    this.operations.push(`${n(trait)} w`, `${n(x)} ${n(y)} ${n(largeur)} ${n(hauteur)} re`, remplir !== null ? 'B' : 'S', '0 g');
    return this;
  }

  fluxe(): string {
    return this.operations.join('\n');
  }
}

/** Assemble les objets et rend les octets du fichier. */
export function assembler(pages: Page[], dateISO: string): Uint8Array {
  const objets: string[] = [];
  const idPages = 2;
  const idPolice = 3;
  const idPoliceGrasse = 4;
  const idInfo = 5;
  const premierePage = 6;

  const idsPages = pages.map((_, index) => premierePage + index * 2);
  objets[1] = `<< /Type /Catalog /Pages ${idPages} 0 R >>`;
  objets[idPages] = `<< /Type /Pages /Kids [${idsPages.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objets[idPolice] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objets[idPoliceGrasse] =
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  // LA DATE vient de l'appelant. `new Date()` ici aurait rendu deux devis
  // identiques différents d'un octet — donc invérifiables.
  const horodatage = `D:${dateISO.replace(/-/g, '')}000000Z`;
  objets[idInfo] = `<< /Producer ${litteral('Joinery Configurator')} /CreationDate (${horodatage}) >>`;

  for (const [index, page] of pages.entries()) {
    const idPage = idsPages[index];
    const idFlux = idPage + 1;
    const flux = page.fluxe();
    objets[idPage] =
      `<< /Type /Page /Parent ${idPages} 0 R /MediaBox [0 0 ${n(PAGE.largeur)} ${n(PAGE.hauteur)}] ` +
      `/Resources << /Font << /F1 ${idPolice} 0 R /F2 ${idPoliceGrasse} 0 R >> >> /Contents ${idFlux} 0 R >>`;
    objets[idFlux] = `<< /Length ${versWinAnsi(flux).length} >>\nstream\n${flux}\nendstream`;
  }

  let sortie = '%PDF-1.4\n';
  const decalages: number[] = [];
  for (let id = 1; id < objets.length; id++) {
    decalages[id] = versWinAnsi(sortie).length;
    sortie += `${id} 0 obj\n${objets[id]}\nendobj\n`;
  }
  const debutXref = versWinAnsi(sortie).length;
  sortie += `xref\n0 ${objets.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objets.length; id++) {
    sortie += `${String(decalages[id]).padStart(10, '0')} 00000 n \n`;
  }
  sortie += `trailer\n<< /Size ${objets.length} /Root 1 0 R /Info ${idInfo} 0 R >>\nstartxref\n${debutXref}\n%%EOF\n`;

  return Uint8Array.from(versWinAnsi(sortie));
}


/** Découpe un texte en lignes qui tiennent dans une largeur donnée. */
export function envelopper(texte: string, caracteres: number): string[] {
  const lignes: string[] = [];
  let courante = '';
  for (const mot of texte.split(/\s+/)) {
    if (courante.length + mot.length + 1 > caracteres) {
      if (courante) lignes.push(courante);
      courante = mot;
    } else {
      courante = courante ? `${courante} ${mot}` : mot;
    }
  }
  if (courante) lignes.push(courante);
  return lignes;
}


/**
 * Un montant en euros, à la française. Les deux documents l'écrivent pareil.
 *
 * IL N'EMPLOIE PLUS `toLocaleString('fr-FR')`, et ce n'est pas une question
 * de style — c'était une faute contre l'invariant le plus dur du dépôt :
 * « un document rejoué est identique octet pour octet ».
 *
 * La locale ne dépend pas du code, elle dépend de l'ICU embarqué dans le
 * Node qui tourne. Sur cette machine, elle sépare les milliers par une
 * espace FINE insécable (U+202F) ; sur une autre, par une espace insécable
 * ordinaire ; et sur un Node compilé en `small-icu`, `fr-FR` n'existe pas du
 * tout et l'appel retombe sur l'anglais — une facture française y aurait
 * imprimé « 6,968.90 € » au lieu de « 6 968,90 € ». Pas une nuance de
 * typographie : un montant faux sur la ligne que le client lit en premier.
 *
 * LE CHANGEMENT EST NEUTRE EN OCTETS sur le PDF produit, et c'est ce qui le
 * rend sûr : `WINANSI` mappe déjà U+202F sur 0xA0, et U+00A0 y tombe par le
 * passage direct (son code vaut 0xA0). Les deux espaces sortaient donc
 * DÉJÀ du même octet — seule la chaîne intermédiaire changeait de machine
 * en machine. Un test le vérifie plutôt qu'un commentaire ne le promette.
 */
/**
 * Les milliers, séparés par une espace INSÉCABLE, écrite par son code.
 *
 * Elle est LOCALE, et ce n’est pas un oubli : ce fichier formate déjà ses
 * propres nombres (la fonction `n`, pour les coordonnées de dessin), parce
 * que ses octets sont figés par une empreinte SHA-256. Lui donner une
 * dépendance sur un module partagé ferait bouger un document que des clients
 * PAIENT le jour où ce module change pour une raison qui ne le concerne pas.
 * Le comparateur d’`ecriture-francaise.test.ts` le sait, et il le NOMME
 * plutôt que de le taire.
 */
function milliers(entier: number): string {
  const chiffres = String(entier);
  let sortie = '';
  for (let i = 0; i < chiffres.length; i += 1) {
    if (i > 0 && (chiffres.length - i) % 3 === 0) sortie += ' ';
    sortie += chiffres[i];
  }
  return sortie;
}
export const euros = (cents: number) => {
  // LE SIGNE EST GARDÉ, et c'est un AVOIR qui l'exige : une facture d'avoir
  // porte des montants négatifs, et `Math.abs` seul les aurait rendus
  // positifs — sur un document comptable, silencieusement.
  const signe = cents < 0 ? '-' : '';
  const absolus = Math.abs(cents);
  return `${signe}${milliers(Math.floor(absolus / 100))},${String(absolus % 100).padStart(2, '0')} €`;
};
