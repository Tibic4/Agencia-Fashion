"use client";
import Link from "next/link";
import { trackCtaClick } from "@/utils/analytics";

interface ClientCTAProps {
  href: string;
  className: string;
  label: string;
  location: string;
  children: React.ReactNode;
}

export default function ClientCTA({ href, className, label, location, children }: ClientCTAProps) {
  const handleClick = () => {
    trackCtaClick(location, label);
  };

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
