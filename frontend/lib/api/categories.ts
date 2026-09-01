import { apiRequest } from "./client";
import type { Category, CategorySummary, CategoryCreateInput, CategoryUpdateInput } from "./types";

export function getCategories() {
  return apiRequest<CategorySummary[]>("/categories");
}

export function getCategory(categoryId: number) {
  return apiRequest<Category>(`/categories/${categoryId}`);
}

export function createCategory(input: CategoryCreateInput) {
  return apiRequest<Category>("/categories", { method: "POST", body: input });
}

export function updateCategory(categoryId: number, input: CategoryUpdateInput) {
  return apiRequest<Category>(`/categories/${categoryId}`, { method: "PUT", body: input });
}

export function deleteCategory(categoryId: number) {
  return apiRequest<void>(`/categories/${categoryId}`, { method: "DELETE" });
}