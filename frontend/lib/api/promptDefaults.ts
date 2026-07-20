import { apiRequest } from "./client";
import type { PromptDefaults, PromptDefaultsUpdateInput } from "./types";

export function getPromptDefaults() {
  return apiRequest<PromptDefaults>("/defaults/prompt-template");
}

export function updatePromptDefaults(input: PromptDefaultsUpdateInput) {
  return apiRequest<PromptDefaults>("/defaults/prompt-template", { method: "PUT", body: input });
}