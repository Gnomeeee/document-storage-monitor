export class AppError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
export function publicError(error) {
  return error instanceof AppError ? { code: error.code, message: error.message } : { code: 'SERVICE_UNAVAILABLE', message: 'The operation could not be completed. Please retry.' };
}
