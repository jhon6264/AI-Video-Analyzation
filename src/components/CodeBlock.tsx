"use client";

import { useEffect, useState } from "react";

type CodeBlockProps = {
  children: string;
  language?: string;
};

export default function CodeBlock({ children, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const label = language?.trim() || "text";

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1400);

    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function copyCode() {
    await navigator.clipboard.writeText(children.replace(/\n$/, ""));
    setCopied(true);
  }

  return (
    <div className="my-4 overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
      <div className="flex h-9 items-center justify-between border-b border-zinc-800 bg-black px-3">
        <span className="font-mono text-xs text-zinc-500">{label}</span>
        <button
          aria-label="Copy code"
          className="inline-flex h-7 items-center gap-1.5 rounded border border-zinc-800 px-2 font-mono text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-100"
          onClick={copyCode}
          type="button"
        >
          <CopyIcon />
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-6 text-zinc-100">
        <code className="font-mono">{children.replace(/\n$/, "")}</code>
      </pre>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}
