export function responseHeaders(_req, res, next) {
  res.set("Cache-Control", "no-store");
  res.set("X-Content-Type-Options", "nosniff");
  next();
}

export function notFound(_req, res) {
  res
    .status(404)
    .json({
      error: { code: "NOT_FOUND", message: "Use /ws for dashboard communication." },
    });
}

// Express recognizes error middleware by its four arguments.
export function errorHandler(error, _req, res, next) {
  if (res.headersSent) return next(error);
  res
    .status(500)
    .json({
      error: { code: "INTERNAL_ERROR", message: "The request could not be completed." },
    });
}
