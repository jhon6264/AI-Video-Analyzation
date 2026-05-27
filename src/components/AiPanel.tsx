"use client";

import { providerLabels } from "@/lib/models";
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
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-500">Provider</span>
          <select
            className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                provider: event.target.value as Settings["provider"],
              })
            }
            value={settings.provider}
          >
            {Object.entries(providerLabels).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-500">Model</span>
          <select
            className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
            onChange={(event) =>
              onSettingsChange({ ...settings, model: event.target.value })
            }
            value={settings.model}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </label>
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
