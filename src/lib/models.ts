import type { ModelOption } from "@/types/models";

export const providerLabels = {
  nvidia: "NVIDIA NIM",
  openrouter: "OpenRouter",
} as const;

export const modelOptions: ModelOption[] = [
  {
    id: "nvidia/cosmos-reason2-8b",
    label: "cosmos-reason2-8b",
    provider: "nvidia",
    role: "Primary video-analysis model",
  },
  {
    id: "qwen/qwen3.5-122b-a10b",
    label: "Qwen3.5-122B-A10B",
    provider: "nvidia",
    role: "Strong NVIDIA fallback",
  },
  {
    id: "qwen/qwen3.5-397b-a17b",
    label: "Qwen3.5-397B-A17B",
    provider: "nvidia",
    role: "High-capability NVIDIA fallback",
  },
  {
    id: "google/gemma-4-31b-it",
    label: "Gemma 4 31B IT",
    provider: "nvidia",
    role: "NVIDIA Gemma fallback",
  },
  {
    id: "google/gemma-3n-e4b-it",
    label: "gemma-3n-e4b-it",
    provider: "nvidia",
    role: "Smaller NVIDIA fallback",
  },
  {
    id: "google/gemma-4-31b-it:free",
    label: "google/gemma-4-31b-it:free",
    provider: "openrouter",
    role: "Free OpenRouter fallback",
  },
  {
    id: "google/gemma-4-26b-a4b-it:free",
    label: "google/gemma-4-26b-a4b-it:free",
    provider: "openrouter",
    role: "Free OpenRouter fallback",
  },
];

export function getModelsForProvider(provider: keyof typeof providerLabels) {
  return modelOptions.filter((model) => model.provider === provider);
}
