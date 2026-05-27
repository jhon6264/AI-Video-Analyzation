import type { ProviderId } from "./chat";

export type ModelOption = {
  id: string;
  label: string;
  provider: ProviderId;
  role: string;
};
