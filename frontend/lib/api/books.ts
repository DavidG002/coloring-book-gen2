import { apiRequest } from "./client";
import type { Book, BookSummary, BookCreateInput, BookUpdateInput } from "./types";

export function getBooks() {
  return apiRequest<BookSummary[]>("/books");
}

export function getBook(id: number) {
  return apiRequest<Book>(`/books/${id}`);
}

export function createBook(input: BookCreateInput) {
  return apiRequest<Book>("/books", { method: "POST", body: input });
}

export function updateBook(id: number, input: BookUpdateInput) {
  return apiRequest<Book>(`/books/${id}`, { method: "PUT", body: input });
}

export function deleteBook(id: number) {
  return apiRequest<void>(`/books/${id}`, { method: "DELETE" });
}