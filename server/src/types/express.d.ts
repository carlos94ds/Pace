declare global {
  namespace Express {
    interface Request {
      /** Set by loadSession when a valid session cookie is present. */
      auth?: { userId: string; sessionId: string };
    }
  }
}

export {};
