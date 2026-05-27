"use client";

import Image, { type StaticImageData } from "next/image";
import { useMemo, useState } from "react";
import deepseekIcon from "@/assets/deepseek.png";
import googleIcon from "@/assets/google.webp";
import kimiIcon from "@/assets/kimi.png";
import metaIcon from "@/assets/meta.png";
import mistralIcon from "@/assets/mistral.png";
import qwenIcon from "@/assets/qwen.png";
import type { Settings } from "@/types/chat";
import type { ModelOption } from "@/types/models";

type AiPanelProps = {
  settings: Settings;
  models: ModelOption[];
  onSettingsChange: (settings: Settings) => void;
  onOpenInstructions: () => void;
};

const modelIcons: Record<ModelOption["icon"], StaticImageData> = {
  deepseek: deepseekIcon,
  google: googleIcon,
  kimi: kimiIcon,
  meta: metaIcon,
  mistral: mistralIcon,
  qwen: qwenIcon,
};

export default function AiPanel({
  settings,
  models,
  onSettingsChange,
  onOpenInstructions,
}: AiPanelProps) {
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [modelQuery, setModelQuery] = useState("");
  const selectedModel = models.find((model) => model.id === settings.model) ?? models[0];
  const filteredModels = useMemo(
    () =>
      models.filter((model) => {
        const query = modelQuery.toLowerCase();

        return (
          model.label.toLowerCase().includes(query) ||
          model.vendor.toLowerCase().includes(query) ||
          model.id.toLowerCase().includes(query)
        );
      }),
    [modelQuery, models],
  );

  return (
    <section className="shrink-0 p-3">
      <p className="mb-3 text-xs font-medium uppercase text-zinc-500">AI</p>
      <div className="space-y-3">
        <div className="relative">
          <span className="mb-1 block text-xs text-zinc-500">Model</span>
          <button
            className="flex h-12 w-full items-center gap-2 rounded-md border border-zinc-800 bg-transparent px-2.5 text-left text-zinc-200 transition hover:border-zinc-600"
            onClick={() => setIsModelPickerOpen((current) => !current)}
            type="button"
          >
            {selectedModel ? <ModelIcon model={selectedModel} /> : null}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">
                {selectedModel?.label ?? "Select model"}
              </span>
                <span className="block truncate text-xs text-zinc-600">
                  {selectedModel?.vendor ?? "NVIDIA NIM"}
                </span>
            </span>
            <span className="font-mono text-xs text-zinc-500">v</span>
          </button>
          {isModelPickerOpen ? (
            <div className="absolute bottom-full left-0 z-30 mb-2 w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 shadow-2xl">
              <input
                aria-label="Search models"
                className="mb-2 h-8 w-full rounded-md border border-zinc-800 bg-black px-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                onChange={(event) => setModelQuery(event.target.value)}
                placeholder="Search models..."
                value={modelQuery}
              />
              <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                {filteredModels.map((model) => (
                  <button
                    className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition ${
                      settings.model === model.id
                        ? "border-green-700 bg-green-950/30 text-green-100"
                        : "border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100"
                    }`}
                    key={model.id}
                    onClick={() => {
                      onSettingsChange({ ...settings, model: model.id });
                      setIsModelPickerOpen(false);
                      setModelQuery("");
                    }}
                    title={model.role}
                    type="button"
                  >
                    <ModelIcon model={model} />
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
          ) : null}
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

function ModelIcon({ model }: { model: ModelOption }) {
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded bg-black">
      <Image
        alt=""
        className="h-5 w-5 object-contain"
        height={20}
        src={modelIcons[model.icon]}
        width={20}
      />
    </span>
  );
}
