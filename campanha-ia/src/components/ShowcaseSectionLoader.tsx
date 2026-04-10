"use client";

import dynamic from "next/dynamic";

/**
 * Lazy-loaded ShowcaseSection com skeleton placeholder.
 * - O JS do slider + autoplay só carrega quando o componente entra no viewport
 * - Skeleton animado evita layout shift (CLS = 0)
 * - ssr: false porque depende de ResizeObserver + window events
 */
const ShowcaseSection = dynamic(() => import("@/components/ShowcaseSection"), {
  ssr: false,
  loading: () => <ShowcaseSkeleton />,
});

export default ShowcaseSection;

/** Skeleton fiel ao layout real — mesma height/spacing */
function ShowcaseSkeleton() {
  return (
    <section className="section" style={{ background: "var(--surface)" }}>
      <div className="container">
        {/* Header real (para evitar reflow e shift de fonte) */}
        <div className="text-center mb-6 md:mb-12">
          <div className="badge badge-brand mb-3 md:mb-4 inline-flex">Virtual Try-On</div>
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-2 md:mb-4">
            Foto real → <span className="gradient-text">modelo IA</span>
          </h2>
          <p className="text-sm md:text-lg max-w-xl mx-auto" style={{ color: "var(--muted)" }}>
            Arraste para comparar. A peça real, vestida numa modelo gerada por IA.
          </p>
        </div>

        {/* Slider skeleton — matches 9:16 aspect ratio */}
        <div className="w-full max-w-[400px] mx-auto relative rounded-2xl overflow-hidden" style={{ aspectRatio: "9/16", background: "var(--background)", border: "1px solid var(--border)" }}>
           <div className="absolute inset-0 animate-pulse bg-zinc-800/40" />
        </div>
      </div>
    </section>
  );
}
