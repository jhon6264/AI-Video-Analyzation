"use client";

import { useState } from "react";
import { defaultInstructions, instructionPresets } from "@/lib/prompts";

type InstructionsModalProps = {
  instructions: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (instructions: string) => void;
};

export default function InstructionsModal({
  instructions,
  isOpen,
  onClose,
  onSave,
}: InstructionsModalProps) {
  const [draft, setDraft] = useState(instructions);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4">
      <section className="w-full max-w-2xl rounded-md border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-mono text-sm font-semibold text-zinc-100">
              System Instructions
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Stored locally in this browser.
            </p>
          </div>
          <button
            aria-label="Close instructions"
            className="h-8 w-8 rounded-md border border-zinc-800 text-zinc-400 transition hover:border-zinc-600 hover:text-white"
            onClick={onClose}
            type="button"
          >
            &times;
          </button>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {instructionPresets.map((preset) => (
            <button
              className="rounded-md border border-zinc-800 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-green-500 hover:text-green-300"
              key={preset.name}
              onClick={() => setDraft(preset.value)}
              type="button"
            >
              {preset.name}
            </button>
          ))}
        </div>
        <textarea
          className="h-72 w-full resize-none rounded-md border border-zinc-800 bg-black p-3 font-mono text-sm leading-6 text-zinc-100 outline-none focus:border-zinc-600"
          onChange={(event) => setDraft(event.target.value)}
          value={draft}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="h-9 rounded-md border border-zinc-800 px-3 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-white"
            onClick={() => setDraft(defaultInstructions)}
            type="button"
          >
            Reset to default
          </button>
          <button
            className="h-9 rounded-md border border-green-700 bg-green-950 px-3 text-sm text-green-200 transition hover:border-green-500 hover:text-green-100"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            type="button"
          >
            Save
          </button>
        </div>
      </section>
    </div>
  );
}
