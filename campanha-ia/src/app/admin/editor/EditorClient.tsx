"use client";
import dynamic from "next/dynamic";

const InstagramEditor = dynamic(() => import("@/components/InstagramEditor"), { ssr: false });

export default function EditorClient() {
  return <InstagramEditor />;
}
