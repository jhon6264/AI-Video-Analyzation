"use client";

import dynamic from "next/dynamic";

const AppShell = dynamic(() => import("./AppShell"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="flex h-screen items-center justify-center font-mono text-sm text-zinc-500">
        &gt; loading Alaws lang.
      </div>
    </div>
  ),
});

export default function ClientApp() {
  return <AppShell />;
}
