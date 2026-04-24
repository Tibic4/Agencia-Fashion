import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";

async function getCampaignByToken(token: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("campaigns")
    .select("*, campaign_outputs(*), campaign_scores(nota_geral), stores(name)")
    .eq("preview_token", token)
    .eq("status", "completed")
    .single();
  return data;
}

export default async function PreviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const campaign = await getCampaignByToken(token);

  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Link inválido ou expirado</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>Esta prévia não está mais disponível.</p>
          <Link href="/" className="btn-primary mt-6 inline-block">Conheça o CriaLook</Link>
        </div>
      </div>
    );
  }

  const output = campaign.campaign_outputs?.[0] || campaign.campaign_outputs;
  const score = campaign.campaign_scores?.[0] || campaign.campaign_scores;
  const storeName = (campaign.stores as unknown as { name: string })?.name || "Loja";

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header className="glass fixed top-0 left-0 right-0 z-50" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="container flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-1.5">
            <Image src="/logo.webp" alt="CriaLook" width={36} height={36} className="rounded-full" />
            <span className="text-sm font-bold">Cria<span className="gradient-text">Look</span></span>
          </Link>
          <span className="text-xs px-3 py-1 rounded-full" style={{ background: "var(--brand-100)", color: "var(--brand-600)" }}>
            Prévia de campanha
          </span>
        </div>
      </header>

      <main className="pt-20 pb-16 container max-w-3xl">
        {/* Meta */}
        <div className="mb-6">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Criado por <strong>{storeName}</strong> • {new Date(campaign.created_at).toLocaleDateString("pt-BR")}
          </p>
          {score && (
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold"
              style={{ background: "var(--brand-100)", color: "var(--brand-600)" }}>
              ⭐ Score: {score.nota_geral}/100
            </div>
          )}
        </div>

        {/* Produto — next/image com priority (é LCP do preview público) */}
        {campaign.product_photo_url && (
          <div className="relative rounded-2xl overflow-hidden mb-8 bg-[#f8f8f8]" style={{ border: "1px solid var(--border)", minHeight: "256px", aspectRatio: "4/5" }}>
            <Image
              src={campaign.product_photo_url}
              alt={`Produto da campanha${output?.headline_principal ? ": " + String(output.headline_principal).slice(0, 80) : ""}`}
              fill
              sizes="(max-width: 640px) 100vw, 768px"
              className="object-contain"
              priority
            />
          </div>
        )}

        {/* Headlines */}
        {output?.headline_principal && (
          <div className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--muted)" }}>Headlines</h2>
            <div className="space-y-3">
              <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="text-lg font-bold">{output.headline_principal}</p>
              </div>
              {output.headline_variacao_1 && (
                <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <p className="font-medium">{output.headline_variacao_1}</p>
                </div>
              )}
              {output.headline_variacao_2 && (
                <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <p className="font-medium">{output.headline_variacao_2}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instagram Feed */}
        {output?.instagram_feed && (
          <div className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--muted)" }}>📸 Instagram Feed</h2>
            <div className="rounded-xl p-4 sm:p-5 whitespace-pre-wrap break-words text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              {output.instagram_feed}
            </div>
          </div>
        )}

        {/* WhatsApp */}
        {output?.whatsapp && (
          <div className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--muted)" }}>💬 WhatsApp</h2>
            <div className="rounded-xl p-4 sm:p-5 whitespace-pre-wrap break-words text-sm" style={{ background: "#dcf8c6", border: "1px solid #b5e3a0", color: "#111" }}>
              {output.whatsapp}
            </div>
          </div>
        )}

        {/* Hashtags */}
        {output?.hashtags && output.hashtags.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--muted)" }}># Hashtags</h2>
            <div className="flex flex-wrap gap-2">
              {(output.hashtags as string[]).map((tag: string, i: number) => (
                <span key={i} className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: "var(--brand-100)", color: "var(--brand-600)" }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="text-center mt-8 sm:mt-12 rounded-2xl p-5 sm:p-8" style={{ background: "var(--gradient-brand-soft)", border: "1px solid var(--border)" }}>
          <h3 className="text-lg sm:text-xl font-bold mb-2">Quer criar campanhas assim?</h3>
          <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
            Só com uma foto → Campanha pronta pra postar.
          </p>
          <Link href="/sign-up" className="btn-primary inline-block">
            Testar na prática
          </Link>
        </div>
      </main>

      <footer className="py-6 text-center text-xs" style={{ borderTop: "1px solid var(--border)", color: "var(--muted)" }}>
        Gerado com <Link href="/" className="gradient-text font-semibold">CriaLook</Link>
      </footer>
    </div>
  );
}
