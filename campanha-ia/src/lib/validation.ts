/**
 * Utilitários de validação usados em todas as rotas API.
 * Centralizar aqui reduz duplicação e garante consistência.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

/** Gera um erro JSON 400 padronizado. Use em route handlers. */
export function badRequest(msg: string, code = "BAD_REQUEST") {
  return Response.json({ error: msg, code }, { status: 400 });
}

export function unauthorized(msg = "Não autenticado") {
  return Response.json({ error: msg, code: "UNAUTHORIZED" }, { status: 401 });
}

export function forbidden(msg = "Acesso negado") {
  return Response.json({ error: msg, code: "FORBIDDEN" }, { status: 403 });
}

export function notFound(msg = "Não encontrado") {
  return Response.json({ error: msg, code: "NOT_FOUND" }, { status: 404 });
}
