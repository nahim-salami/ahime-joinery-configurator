
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Phrases = Readonly<Record<string, (v: any[]) => string>>;

let PHRASES: Phrases | undefined;

/** Enregistrer les phrases — par `textes-des-refus.ts`, et par lui seul. */
export function enregistrerPhrasesDesRefus(phrases: Phrases): void {
  PHRASES = phrases;
}

/**
 * La phrase d'un refus, ou une chaîne vide tant que les textes ne sont pas
 * chargés. Le vide est le mode d'échec de la couture : il ne casse rien, il rend
 * un refus muet — `phrases-des-refus.test.ts` le refuse.
 */
export function dire(cle: string, v: unknown[] = []): string {
  return PHRASES?.[cle]?.(v) ?? '';
}
