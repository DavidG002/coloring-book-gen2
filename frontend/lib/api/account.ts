import { apiRequest } from "./client";
import type { SupportedLanguage } from "./types";

export function getSupportedLanguages() {
  return apiRequest<SupportedLanguage[]>("/account/languages");
}

export function addSupportedLanguage(code: string, name: string) {
  return apiRequest<SupportedLanguage>("/account/languages", {
    method: "POST",
    body: { code, name },
  });
}
