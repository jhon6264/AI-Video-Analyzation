"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "./CodeBlock";

type MarkdownMessageProps = {
  content: string;
};

const markdownComponents: Components = {
  a({ children, href }) {
    return (
      <a
        className="text-green-300 underline decoration-green-900 underline-offset-4 transition hover:text-green-200"
        href={href}
        rel="noreferrer"
        target="_blank"
      >
        {children}
      </a>
    );
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-zinc-700 pl-4 text-zinc-400">
        {children}
      </blockquote>
    );
  },
  code({ children, className }) {
    const match = /language-(\S+)/.exec(className ?? "");
    const text = String(children);

    if (className?.includes("language-")) {
      return <CodeBlock language={match?.[1]}>{text}</CodeBlock>;
    }

    return (
      <code className="rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-[0.9em] text-zinc-100">
        {children}
      </code>
    );
  },
  h1({ children }) {
    return <h1 className="text-xl font-semibold text-zinc-50">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-lg font-semibold text-zinc-50">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-base font-semibold text-zinc-100">{children}</h3>;
  },
  hr() {
    return <hr className="border-zinc-800" />;
  },
  ol({ children }) {
    return <ol className="ml-5 list-decimal space-y-1.5">{children}</ol>;
  },
  p({ children }) {
    return <p>{children}</p>;
  },
  pre({ children }) {
    return <>{children}</>;
  },
  table({ children }) {
    return (
      <div className="my-4 overflow-x-auto rounded-md border border-zinc-800">
        <table className="w-full border-collapse text-left text-sm">{children}</table>
      </div>
    );
  },
  td({ children }) {
    return <td className="border-t border-zinc-800 px-3 py-2">{children}</td>;
  },
  th({ children }) {
    return (
      <th className="border-b border-zinc-800 bg-zinc-950 px-3 py-2 font-semibold text-zinc-100">
        {children}
      </th>
    );
  },
  ul({ children }) {
    return <ul className="ml-5 list-disc space-y-1.5">{children}</ul>;
  },
};

export default function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="markdown-message max-w-none space-y-4 break-words text-sm leading-7 text-zinc-200">
      <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
