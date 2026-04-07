"use client";

import dynamic from "next/dynamic";

const PostHogProvider = dynamic(
  () => import("@/lib/analytics/posthog").then((m) => m.PostHogProvider),
  { ssr: false }
);
const FloatingWhatsApp = dynamic(
  () => import("@/components/FloatingWhatsApp"),
  { ssr: false }
);

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PostHogProvider>
      {children}
      <FloatingWhatsApp />
    </PostHogProvider>
  );
}
