"use client";

import type { Settings } from "@/types/chat";
import type { ModelOption } from "@/types/models";

type AiPanelProps = {
  settings: Settings;
  models: ModelOption[];
  onSettingsChange: (settings: Settings) => void;
  onOpenInstructions: () => void;
};

export default function AiPanel({
  settings,
  models,
  onSettingsChange,
  onOpenInstructions,
}: AiPanelProps) {
  return (
    <section className="shrink-0 p-3">
      <p className="mb-3 text-xs font-medium uppercase text-zinc-500">AI</p>
      <div className="space-y-3">
        <div>
          <span className="mb-1 block text-xs text-zinc-500">Model</span>
          <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
            {models.map((model) => (
              <button
                className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition ${
                  settings.model === model.id
                    ? "border-green-700 bg-green-950/30 text-green-100"
                    : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-950 hover:text-zinc-100"
                }`}
                key={model.id}
                onClick={() => onSettingsChange({ ...settings, model: model.id })}
                title={model.role}
                type="button"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded border border-zinc-700 font-mono text-xs text-zinc-200">
                  {model.icon}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm">{model.label}</span>
                  <span className="block truncate text-xs text-zinc-600">
                    {model.vendor}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <button
          className="h-9 w-full rounded-md border border-zinc-800 text-sm text-zinc-200 transition hover:border-green-500 hover:text-green-300"
          onClick={onOpenInstructions}
          type="button"
        >
          Instructions
        </button>
      </div>
    </section>
  );
}
