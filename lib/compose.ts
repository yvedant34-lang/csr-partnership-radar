// Opens the user's own mailbox with the draft filled in. The radar never sends to a company:
// Ananya reviews and presses Send in her own account.

export interface ComposeInput { to: string | null; subject: string; body: string }

/** Drafts are stored as the email body, then "---", then the LinkedIn note. Keep only the email. */
export function emailBodyFromDraft(draft: string): string {
  return draft.split(/\n\s*---\s*\nLinkedIn note:/)[0].trim();
}

export function linkedinNoteFromDraft(draft: string): string | null {
  const m = /\n\s*---\s*\nLinkedIn note:\s*([\s\S]*)$/.exec(draft);
  return m ? m[1].trim() : null;
}

export function composeLinks({ to, subject, body }: ComposeInput) {
  const enc = encodeURIComponent;
  const recipient = to ?? "";
  return {
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(recipient)}&su=${enc(subject)}&body=${enc(body)}`,
    outlook: `https://outlook.office.com/mail/deeplink/compose?to=${enc(recipient)}&subject=${enc(subject)}&body=${enc(body)}`,
    mailto: `mailto:${recipient}?subject=${enc(subject)}&body=${enc(body)}`,
  };
}
