import { apiRequest } from "./client";
import type { Translation, TranslationCreateInput, TranslationUpdateInput } from "./types";

export function getTranslations(categoryId: number) {
  return apiRequest<Translation[]>(`/categories/${categoryId}/translations`);
}

export function getTranslation(categoryId: number, lang: string) {
  return apiRequest<Translation>(
    `/categories/${categoryId}/translations/${encodeURIComponent(lang)}`
  );
}

export function createTranslation(categoryId: number, input: TranslationCreateInput) {
  return apiRequest<Translation>(`/categories/${categoryId}/translations`, {
    method: "POST",
    body: input,
  });
}

export function updateTranslation(categoryId: number, lang: string, input: TranslationUpdateInput) {
  return apiRequest<Translation>(
    `/categories/${categoryId}/translations/${encodeURIComponent(lang)}`,
    { method: "PUT", body: input }
  );
}

export function deleteTranslation(categoryId: number, lang: string) {
  return apiRequest<void>(
    `/categories/${categoryId}/translations/${encodeURIComponent(lang)}`,
    { method: "DELETE" }
  );
}