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

const statusClassName = {
  active: "text-green-400",
  processing: "text-orange-400",
  limited: "text-orange-400",
  error: "text-red-400",
} as const;

export default function AiPanel({
  settings,
  models,
  onSettingsChange,
  onOpenInstructions,
}: AiPanelProps) {
  return (
    <section className="shrink-0 p-3">
      <p className="mb-3 text-xs font-medium uppercase text-zinc-500">AI</p>
      <div className="space-y-3 rounded-md border border-zinc-800 bg-black p-3">
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
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-zinc-800 p-2">
            <span className="block text-zinc-600">Limits</span>
            <span className="mt-1 block font-mono text-zinc-200">
              {settings.requestsRemaining} / 50
            </span>
          </div>
          <div className="rounded-md border border-zinc-800 p-2">
            <span className="block text-zinc-600">Restores</span>
            <span className="mt-1 block font-mono text-zinc-200">
              {settings.restoreTime}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-600">Status</span>
          <span className={`font-mono ${statusClassName[settings.status]}`}>
            {settings.status}
          </span>
        </div>
        <label className="flex items-center justify-between text-xs text-zinc-500">
          <span>Fallback</span>
          <input
            checked={settings.fallback}
            className="h-4 w-4 accent-green-500"
            onChange={(event) =>
              onSettingsChange({ ...settings, fallback: event.target.checked })
            }
            type="checkbox"
          />
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
