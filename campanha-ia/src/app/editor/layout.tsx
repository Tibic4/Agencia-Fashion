import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CriaLook — Editor de Post",
  description: "Monte posts prontos para Instagram — feed 4:5 ou stories 9:16",
  robots: { index: false, follow: false },
};

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#050505] text-[#FAFAFA] selection:bg-fuchsia-500/30">
      <main className="w-full min-h-screen">
        {children}
      </main>
    </div>
  );
}
