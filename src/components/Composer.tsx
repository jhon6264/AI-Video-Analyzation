"use client";

import { FormEvent, useRef, useState } from "react";

type ComposerProps = {
  isSending: boolean;
  onSubmit: (prompt: string) => void;
  onStop: () => void;
};

export default function Composer({ isSending, onStop, onSubmit }: ComposerProps) {
  const [prompt, setPrompt] = useState("");
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const value = prompt.trim();

    if (!value || isSending) {
      return;
    }

    onSubmit(value);
    setPrompt("");
    textAreaRef.current?.focus();
  }

  return (
    <form
      className="border-t border-zinc-800 bg-black px-4 py-4 sm:px-6"
      onSubmit={submit}
    >
      <div className="mx-auto flex max-w-4xl items-end gap-2 rounded-md border border-zinc-800 bg-zinc-950 p-2 focus-within:border-zinc-600">
        <textarea
          aria-label="Message Alaws"
          className="max-h-40 min-h-12 flex-1 resize-none bg-transparent px-2 py-2 font-mono text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-600"
          disabled={isSending}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              submit();
            }
          }}
          placeholder="Message Alaws..."
          ref={textAreaRef}
          rows={2}
          value={prompt}
        />
        <button
          aria-label={isSending ? "Stop" : "Send"}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-md border text-lg transition ${
            isSending
              ? "border-red-900 text-red-300 hover:border-red-500 hover:text-red-200"
              : "border-zinc-800 text-zinc-200 hover:border-green-500 hover:text-green-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
          }`}
          disabled={!isSending && !prompt.trim()}
          onClick={isSending ? onStop : undefined}
          type={isSending ? "button" : "submit"}
        >
          {isSending ? "x" : <span aria-hidden="true">&rarr;</span>}
        </button>
      </div>
    </form>
  );
}
