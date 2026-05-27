"use client";

import { useEffect, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

type CodeBlockProps = {
  children: string;
  language?: string;
};

export default function CodeBlock({ children, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const label = language?.trim() || "text";
  const code = children.replace(/\n$/, "");

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1400);

    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
  }

  return (
    <div className="my-4 overflow-hidden rounded-md border border-zinc-800 bg-[#1e1e1e]">
      <div className="flex h-9 items-center justify-between border-b border-zinc-800 bg-[#181818] px-3">
        <span className="font-mono text-xs text-zinc-400">{label}</span>
        <button
          aria-label="Copy code"
          className="inline-flex h-7 items-center gap-1.5 rounded px-2 font-mono text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
          onClick={copyCode}
          type="button"
        >
          <CopyIcon />
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <SyntaxHighlighter
        codeTagProps={{
          className: "font-mono",
          style: {
            fontFamily: "var(--font-geist-mono)",
          },
        }}
        customStyle={{
          background: "#1e1e1e",
          fontFamily: "var(--font-geist-mono)",
          fontSize: "0.875rem",
          lineHeight: "1.6",
          margin: 0,
          padding: "1rem",
        }}
        language={language}
        PreTag="div"
        showLineNumbers={false}
        style={vscDarkPlus}
        wrapLongLines={false}
      >
        {code}
      </SyntaxHighlighter>
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
