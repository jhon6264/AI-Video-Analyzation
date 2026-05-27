import type { ModelOption } from "@/types/models";

export const modelOptions: ModelOption[] = [
  {
    id: "google/gemma-3n-e4b-it",
    label: "Gemma 3n E4B IT",
    icon: "google",
    vendor: "Google",
    role: "Fast general NVIDIA model",
    supportsImage: true,
    supportsVideo: true,
  },
  {
    id: "google/gemma-4-31b-it",
    label: "Gemma 4 31B IT",
    icon: "google",
    vendor: "Google",
    role: "General NVIDIA model",
    supportsImage: true,
    supportsVideo: true,
  },
  {
    id: "deepseek-ai/deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    icon: "deepseek",
    vendor: "DeepSeek",
    role: "Fast DeepSeek model",
  },
  {
    id: "deepseek-ai/deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    icon: "deepseek",
    vendor: "DeepSeek",
    role: "High-capability DeepSeek model",
  },
  {
    id: "moonshotai/kimi-k2.6",
    label: "Kimi K2.6",
    icon: "kimi",
    vendor: "Moonshot AI",
    role: "Kimi NVIDIA model",
  },
  {
    id: "mistralai/mistral-medium-3.5-128b",
    label: "Mistral Medium 3.5 128B",
    icon: "mistral",
    vendor: "Mistral AI",
    role: "Medium Mistral model",
  },
  {
    id: "mistralai/mistral-large-3-675b-instruct-2512",
    label: "Mistral Large 3 675B",
    icon: "mistral",
    vendor: "Mistral AI",
    role: "Large Mistral instruct model",
  },
  {
    id: "meta/llama-3.2-90b-vision-instruct",
    label: "Llama 3.2 90B Vision",
    icon: "meta",
    vendor: "Meta",
    role: "Vision-capable NVIDIA model",
    supportsImage: true,
  },
  {
    id: "qwen/qwen3.5-122b-a10b",
    label: "Qwen3.5 122B A10B",
    icon: "qwen",
    vendor: "Qwen",
    role: "Strong Qwen model",
    supportsImage: true,
    supportsVideo: true,
  },
  {
    id: "qwen/qwen3.5-397b-a17b",
    label: "Qwen3.5 397B A17B",
    icon: "qwen",
    vendor: "Qwen",
    role: "High-capability Qwen model",
    supportsImage: true,
    supportsVideo: true,
  },
];

export function getModelById(modelId: string) {
  return modelOptions.find((model) => model.id === modelId);
}
