import type { Language } from '@pace/shared';

interface ResetText {
  subject: string;
  body: (name: string, link: string) => string;
}

// Server-side texts are limited to emails; everything else is translated in the client.
const RESET: Record<Language, ResetText> = {
  en: {
    subject: 'Reset your PACE password',
    body: (n, l) =>
      `Hi ${n},\n\nUse this link to choose a new password. It is valid for 30 minutes and can be used once:\n\n${l}\n\nDidn't ask for this? Then you can ignore this email; your password stays the same.\n\nPACE`,
  },
  nl: {
    subject: 'Stel je PACE-wachtwoord opnieuw in',
    body: (n, l) =>
      `Hoi ${n},\n\nMet deze link kies je een nieuw wachtwoord. Hij is 30 minuten geldig en werkt één keer:\n\n${l}\n\nHeb je dit niet aangevraagd? Dan kun je deze e-mail negeren; je wachtwoord blijft hetzelfde.\n\nPACE`,
  },
  de: {
    subject: 'Setze dein PACE-Passwort zurück',
    body: (n, l) =>
      `Hallo ${n},\n\nMit diesem Link wählst du ein neues Passwort. Er ist 30 Minuten gültig und funktioniert einmal:\n\n${l}\n\nDu hast das nicht angefordert? Dann ignoriere diese E-Mail; dein Passwort bleibt unverändert.\n\nPACE`,
  },
  fr: {
    subject: 'Réinitialise ton mot de passe PACE',
    body: (n, l) =>
      `Bonjour ${n},\n\nUtilise ce lien pour choisir un nouveau mot de passe. Il est valable 30 minutes et ne fonctionne qu'une fois :\n\n${l}\n\nTu n'as rien demandé ? Ignore simplement cet e-mail ; ton mot de passe reste inchangé.\n\nPACE`,
  },
  pt: {
    subject: 'Redefine a tua palavra-passe do PACE',
    body: (n, l) =>
      `Olá ${n},\n\nUsa esta ligação para escolher uma nova palavra-passe. É válida durante 30 minutos e só funciona uma vez:\n\n${l}\n\nNão pediste isto? Ignora este e-mail; a tua palavra-passe continua igual.\n\nPACE`,
  },
  it: {
    subject: 'Reimposta la tua password di PACE',
    body: (n, l) =>
      `Ciao ${n},\n\nUsa questo link per scegliere una nuova password. È valido per 30 minuti e funziona una sola volta:\n\n${l}\n\nNon l'hai richiesto tu? Ignora questa email; la tua password resta invariata.\n\nPACE`,
  },
  es: {
    subject: 'Restablece tu contraseña de PACE',
    body: (n, l) =>
      `Hola ${n}:\n\nUsa este enlace para elegir una nueva contraseña. Es válido durante 30 minutos y solo funciona una vez:\n\n${l}\n\n¿No lo has pedido tú? Ignora este correo; tu contraseña no cambia.\n\nPACE`,
  },
};

export function resetPasswordEmail(language: Language, name: string, link: string) {
  const t = RESET[language];
  return { subject: t.subject, text: t.body(name, link) };
}
