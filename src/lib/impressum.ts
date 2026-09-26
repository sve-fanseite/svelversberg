// Angaben für Impressum/Datenschutz; im echten Build (nicht Vorschau) dürfen keine Platzhalter übrig sein.
import raw from '../data/impressum.json';
import { isPreview } from './url.ts';

export interface Anbieter {
  name: string;
  strasse: string;
  ort: string;
  email: string;
  telefon: string | null;
  stand: string;
}

export function getAnbieter(): Anbieter & { hasPlaceholders: boolean } {
  const a = raw as Anbieter;
  const hasPlaceholders = [a.name, a.strasse, a.ort, a.email].some((v) => !v || /\[.*\]/.test(v));
  if (hasPlaceholders && import.meta.env.PROD && !isPreview()) {
    throw new Error('src/data/impressum.json enthält noch Platzhalter in [eckigen Klammern]. Bitte deine Angaben eintragen – ohne vollständiges Impressum wird nicht veröffentlicht.');
  }
  return { ...a, hasPlaceholders };
}
