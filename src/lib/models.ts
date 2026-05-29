import type { ModelOption } from "@/types/models";

export const modelOptions: ModelOption[] = [
  {
    id: "google/gemma-3n-e4b-it",
    label: "Gemma 3n",
    icon: "google",
    vendor: "Google",
    role: "Fast general model",
    supportsImage: true,
    supportsVideo: true,
  },
  {
    id: "google/gemma-4-31b-it",
    label: "Gemma 4",
    icon: "google",
    vendor: "Google",
    role: "General model",
    supportsImage: true,
    supportsVideo: true,
  },
  {
    id: "deepseek-ai/deepseek-v4-flash",
    label: "DeepSeek Flash",
    icon: "deepseek",
    vendor: "DeepSeek",
    role: "Fast DeepSeek model",
  },
  {
    id: "deepseek-ai/deepseek-v4-pro",
    label: "DeepSeek Pro",
    icon: "deepseek",
    vendor: "DeepSeek",
    role: "High-capability DeepSeek model",
  },
  {
    id: "moonshotai/kimi-k2.6",
    label: "Kimi K2",
    icon: "kimi",
    vendor: "Moonshot AI",
    role: "Kimi model",
  },
  {
    id: "mistralai/mistral-medium-3.5-128b",
    label: "Mistral Medium",
    icon: "mistral",
    vendor: "Mistral AI",
    role: "Medium Mistral model",
  },
  {
    id: "mistralai/mistral-large-3-675b-instruct-2512",
    label: "Mistral Large",
    icon: "mistral",
    vendor: "Mistral AI",
    role: "Large Mistral instruct model",
  },
  {
    id: "meta/llama-3.2-90b-vision-instruct",
    label: "Llama Vision",
    icon: "meta",
    vendor: "Meta",
    role: "Vision-capable model",
    supportsImage: true,
  },
  {
    id: "qwen/qwen3.5-122b-a10b",
    label: "Qwen 122B",
    icon: "qwen",
    vendor: "Qwen",
    role: "Strong Qwen model",
    supportsImage: true,
    supportsVideo: true,
  },
  {
    id: "qwen/qwen3.5-397b-a17b",
    label: "Qwen 397B",
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
