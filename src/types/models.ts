export type ModelOption = {
  id: string;
  label: string;
  icon: "deepseek" | "google" | "kimi" | "meta" | "mistral" | "qwen";
  vendor: string;
  role: string;
  badges?: string[];
  supportsImage?: boolean;
  supportsVideo?: boolean;
};
