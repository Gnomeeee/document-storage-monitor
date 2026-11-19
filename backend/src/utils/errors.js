export class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export class ConfigError extends Error {}

export function publicError(error) {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message };
  }

  return {
    code: "SERVICE_UNAVAILABLE",
    message: "The operation could not be completed. Please retry.",
  };
}
