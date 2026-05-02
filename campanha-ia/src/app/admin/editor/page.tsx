import { requireAdmin } from "@/lib/admin/guard";
import { redirect } from "next/navigation";
import EditorClient from "./EditorClient";

export default async function EditorPage() {
  const admin = await requireAdmin();
  if (!admin.isAdmin) redirect("/gerar");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground tracking-tight">Editor de Post</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monte posts prontos para Instagram — feed 4:5 ou stories 9:16
        </p>
      </div>
      <EditorClient />
    </div>
  );
}
