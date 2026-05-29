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
    <section className="shrink-0 px-3 py-3">
      <p className="mb-2 text-xs font-medium uppercase text-zinc-500">AI</p>
      <div className="space-y-3">
        <div className="relative">
          <button
            className="flex min-h-16 w-full items-start gap-2 rounded-md border border-zinc-800 bg-black px-2.5 py-2.5 text-left text-zinc-200 transition hover:border-zinc-600"
            onClick={() => setIsModelPickerOpen((current) => !current)}
            type="button"
          >
            {selectedModel ? <ModelIcon model={selectedModel} /> : null}
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-2">
                <span className="block min-w-0 flex-1 truncate text-sm">
                  {selectedModel?.label ?? "Select model"}
                </span>
                <span className="shrink-0 font-mono text-xs text-zinc-500">
                  <ChevronIcon isOpen={isModelPickerOpen} />
                </span>
              </span>
              <span className="block truncate text-xs text-zinc-600">
                {selectedModel?.vendor ?? "NVIDIA NIM"}
              </span>
              {selectedModel ? (
                <span className="mt-1.5 flex flex-wrap gap-1">
                  <CapabilityChips model={selectedModel} />
                  <ModelBadges model={selectedModel} />
                </span>
              ) : null}
            </span>
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
                {filteredModels.length ? filteredModels.map((model) => (
                  <button
                    className={`flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition ${
                      settings.model === model.id
                        ? "border-zinc-700 bg-zinc-900 text-zinc-100"
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
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="block min-w-0 flex-1 truncate text-sm">
                          {model.label}
                        </span>
                        {settings.model === model.id ? (
                          <span className="shrink-0 rounded border border-green-800 px-1.5 py-0.5 font-mono text-[10px] uppercase text-green-400">
                            current
                          </span>
                        ) : null}
                      </span>
                      <span className="block truncate text-xs text-zinc-600">
                        {model.vendor}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        <CapabilityChips model={model} />
                        <ModelBadges model={model} />
                      </span>
                    </span>
                  </button>
                )) : (
                  <div className="rounded-md border border-dashed border-zinc-800 px-3 py-5 text-center font-mono text-xs text-zinc-500">
                    No models found
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
        <div className="border-t border-zinc-900 pt-3">
          <button
            className="h-9 w-full rounded-md border border-zinc-800 text-sm text-zinc-200 transition hover:border-green-500 hover:text-green-300"
            onClick={onOpenInstructions}
            type="button"
          >
            Instructions
          </button>
        </div>
      </div>
    </section>
  );
}

function CapabilityChips({ model }: { model: ModelOption }) {
  const capabilities = [
    model.supportsImage ? "image" : null,
    model.supportsVideo ? "video" : null,
  ].filter((capability): capability is string => Boolean(capability));

  if (!capabilities.length) {
    return null;
  }

  return capabilities.map((capability) => (
    <span
      className="rounded border border-zinc-800 px-1.5 py-0.5 font-mono text-[10px] uppercase text-zinc-500"
      key={capability}
    >
      {capability}
    </span>
  ));
}

function ModelBadges({ model }: { model: ModelOption }) {
  return model.badges?.map((badge) => (
    <span
      className="rounded border border-zinc-800 px-1.5 py-0.5 font-mono text-[10px] uppercase text-zinc-500"
      key={badge}
    >
      {badge}
    </span>
  ));
}

function ModelIcon({ model }: { model: ModelOption }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded border border-zinc-900 bg-black">
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

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
