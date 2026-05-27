import type { ModelOption } from "@/types/models";

export const modelOptions: ModelOption[] = [
  {
    id: "google/gemma-3n-e4b-it",
    label: "Gemma 3n E4B IT",
    icon: "G",
    vendor: "Google",
    role: "Fast general NVIDIA model",
  },
  {
    id: "google/gemma-4-31b-it",
    label: "Gemma 4 31B IT",
    icon: "G",
    vendor: "Google",
    role: "General NVIDIA model",
  },
  {
    id: "deepseek-ai/deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    icon: "D",
    vendor: "DeepSeek",
    role: "Fast DeepSeek model",
  },
  {
    id: "deepseek-ai/deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    icon: "D",
    vendor: "DeepSeek",
    role: "High-capability DeepSeek model",
  },
  {
    id: "moonshotai/kimi-k2.6",
    label: "Kimi K2.6",
    icon: "K",
    vendor: "Moonshot AI",
    role: "Kimi NVIDIA model",
  },
  {
    id: "mistralai/mistral-medium-3.5-128b",
    label: "Mistral Medium 3.5 128B",
    icon: "M",
    vendor: "Mistral AI",
    role: "Medium Mistral model",
  },
  {
    id: "mistralai/mistral-large-3-675b-instruct-2512",
    label: "Mistral Large 3 675B",
    icon: "M",
    vendor: "Mistral AI",
    role: "Large Mistral instruct model",
  },
  {
    id: "meta/llama-3.2-90b-vision-instruct",
    label: "Llama 3.2 90B Vision",
    icon: "L",
    vendor: "Meta",
    role: "Vision-capable NVIDIA model",
  },
  {
    id: "qwen/qwen3.5-122b-a10b",
    label: "Qwen3.5 122B A10B",
    icon: "Q",
    vendor: "Qwen",
    role: "Strong Qwen model",
  },
  {
    id: "qwen/qwen3.5-397b-a17b",
    label: "Qwen3.5 397B A17B",
    icon: "Q",
    vendor: "Qwen",
    role: "High-capability Qwen model",
  },
];

export function getModelById(modelId: string) {
  return modelOptions.find((model) => model.id === modelId);
}
