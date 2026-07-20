import { apiRequest } from "./client";
import type { Category, CategorySummary, CategoryCreateInput, CategoryUpdateInput } from "./types";

export function getCategories() {
  return apiRequest<CategorySummary[]>("/categories");
}

export function getCategory(name: string) {
  return apiRequest<Category>(`/categories/${encodeURIComponent(name)}`);
}

export function createCategory(input: CategoryCreateInput) {
  return apiRequest<Category>("/categories", { method: "POST", body: input });
}

export function updateCategory(name: string, input: CategoryUpdateInput) {
  return apiRequest<Category>(`/categories/${encodeURIComponent(name)}`, { method: "PUT", body: input });
}

export function deleteCategory(name: string) {
  return apiRequest<void>(`/categories/${encodeURIComponent(name)}`, { method: "DELETE" });
}