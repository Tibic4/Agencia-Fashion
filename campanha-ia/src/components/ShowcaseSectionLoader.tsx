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
        {/* Header skeleton */}
        <div className="text-center mb-8 md:mb-12">
          <div
            className="skeleton mx-auto mb-4"
            style={{ width: "120px", height: "28px", borderRadius: "999px" }}
          />
          <div
            className="skeleton mx-auto mb-3"
            style={{ width: "min(280px, 70%)", height: "36px", borderRadius: "8px" }}
          />
          <div
            className="skeleton mx-auto"
            style={{ width: "min(240px, 60%)", height: "18px", borderRadius: "6px" }}
          />
        </div>

        {/* Slider skeleton — matches 9:16 aspect ratio */}
        <div className="max-w-3xl mx-auto">
          <div
            className="skeleton rounded-2xl"
            style={{
              aspectRatio: "3 / 4",
              width: "100%",
            }}
          />
          {/* Dots skeleton */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="skeleton rounded-full"
                style={{ width: i === 1 ? "20px" : "8px", height: "8px" }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
