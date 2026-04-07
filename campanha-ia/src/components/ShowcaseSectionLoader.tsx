"use client";

import dynamic from "next/dynamic";

const ShowcaseSection = dynamic(() => import("@/components/ShowcaseSection"), {
  ssr: false,
  loading: () => (
    <section className="section" style={{ background: "var(--surface)" }}>
      <div className="container text-center py-20">
        <div className="w-10 h-10 border-3 border-[var(--brand-200)] border-t-[var(--brand-500)] rounded-full animate-spin mx-auto" />
      </div>
    </section>
  ),
});

export default function ShowcaseSectionLoader() {
  return <ShowcaseSection />;
}
