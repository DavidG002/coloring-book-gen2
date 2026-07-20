import { apiRequest } from "./client";
import type {
  GenerationPlanInput,
  GenerationPlanResponse,
  GenerationRunResponse,
  GenerationStatusResponse,
} from "./types";

export function planGeneration(input: GenerationPlanInput) {
  return apiRequest<GenerationPlanResponse>("/generate/plan", { method: "POST", body: input });
}

export function runGeneration(input: GenerationPlanInput) {
  return apiRequest<GenerationRunResponse>("/generate/run", { method: "POST", body: input });
}

export function getGenerationStatus(jobId: number) {
  return apiRequest<GenerationStatusResponse>(`/generate/status/${jobId}`);
}

export function cancelGeneration(jobId: number) {
  return apiRequest<{ detail: string }>(`/generate/cancel/${jobId}`, { method: "POST" });
}