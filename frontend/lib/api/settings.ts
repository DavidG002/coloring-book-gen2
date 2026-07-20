import { apiRequest } from "./client";
import type { Settings, SettingsUpdateInput } from "./types";

export function getSettings() {
  return apiRequest<Settings>("/settings");
}

export function updateSettings(input: SettingsUpdateInput) {
  return apiRequest<Settings>("/settings", { method: "PUT", body: input });
}