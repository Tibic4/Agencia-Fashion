/**
 * Skeleton mostrado entre navegações de rotas autenticadas (`/gerar`,
 * `/historico`, `/modelo`, `/configuracoes`, `/plano`). Renderiza dentro da
 * shell do `(auth)/layout.tsx` — sidebar e tabs continuam visíveis enquanto
 * o conteúdo carrega. Antes a navegação caía no `app/loading.tsx` global
 * (logo pulsando full-page), que dava sensação de tela inteira recarregando.
 */
export default function AuthSegmentLoading() {
  return (
    <div className="animate-fade-in max-w-5xl mx-auto p-4 md:p-8">
      {/* Title placeholder */}
      <div className="mb-6">
        <div
          className="h-8 w-56 rounded-md mb-2"
          style={{ background: "var(--surface-2)" }}
        />
        <div
          className="h-4 w-72 rounded"
          style={{ background: "var(--surface-2)" }}
        />
      </div>

      {/* Generic content blocks */}
      <div className="space-y-3">
        <div
          className="h-32 rounded-2xl"
          style={{ background: "var(--surface-2)" }}
        />
        <div
          className="h-24 rounded-2xl"
          style={{ background: "var(--surface-2)" }}
        />
        <div
          className="h-24 rounded-2xl w-3/4"
          style={{ background: "var(--surface-2)" }}
        />
      </div>
    </div>
  );
}
