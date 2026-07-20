import { apiRequest } from "./client";
import type { Translation, TranslationCreateInput, TranslationUpdateInput } from "./types";

export function getTranslations(categoryName: string) {
  return apiRequest<Translation[]>(`/categories/${encodeURIComponent(categoryName)}/translations`);
}

export function getTranslation(categoryName: string, lang: string) {
  return apiRequest<Translation>(
    `/categories/${encodeURIComponent(categoryName)}/translations/${encodeURIComponent(lang)}`
  );
}

export function createTranslation(categoryName: string, input: TranslationCreateInput) {
  return apiRequest<Translation>(`/categories/${encodeURIComponent(categoryName)}/translations`, {
    method: "POST",
    body: input,
  });
}

export function updateTranslation(categoryName: string, lang: string, input: TranslationUpdateInput) {
  return apiRequest<Translation>(
    `/categories/${encodeURIComponent(categoryName)}/translations/${encodeURIComponent(lang)}`,
    { method: "PUT", body: input }
  );
}

export function deleteTranslation(categoryName: string, lang: string) {
  return apiRequest<void>(
    `/categories/${encodeURIComponent(categoryName)}/translations/${encodeURIComponent(lang)}`,
    { method: "DELETE" }
  );
}