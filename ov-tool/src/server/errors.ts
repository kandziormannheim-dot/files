/** Fehler mit Meldung, die dem Nutzer angezeigt werden darf. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export class ForbiddenError extends UserError {
  constructor(message = "Dafür fehlt Ihnen die Berechtigung.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends UserError {
  constructor(message = "Nicht gefunden.") {
    super(message);
    this.name = "NotFoundError";
  }
}
