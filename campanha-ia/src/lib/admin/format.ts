/**
 * Admin formatting helpers.
 * Avoid toLocaleDateString on SSR — Node may not have pt-BR locale installed.
 */

/** dd/MM/yyyy */
export function formatDateBR(dateString: string | Date): string {
  const d = typeof dateString === "string" ? new Date(dateString) : dateString;
  if (isNaN(d.getTime())) return "—";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** dd/MM HH:mm */
export function formatDateTimeBR(dateString: string | Date): string {
  const d = typeof dateString === "string" ? new Date(dateString) : dateString;
  if (isNaN(d.getTime())) return "—";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** HH:mm:ss */
export function formatTimeBR(dateString: string | Date): string {
  const d = typeof dateString === "string" ? new Date(dateString) : dateString;
  if (isNaN(d.getTime())) return "—";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
