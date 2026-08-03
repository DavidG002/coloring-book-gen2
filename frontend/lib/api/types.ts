
//  ---------- Books ----------

export interface Book {
  id: number;
  name: string;
  base_prompt: string;
  product_noun: string;
  canvas_width: number;
  canvas_height: number;
  subject_size_ratio: number;
  white_clean_threshold: number;
  black_clean_threshold: number;
  palette_colors: number;
  category_count: number;
}

export interface BookSummary {
  id: number;
  name: string;
  category_count: number;
}

export interface BookCreateInput {
  name: string;
  base_prompt: string;
  product_noun?: string;
  canvas_width?: number;
  canvas_height?: number;
  subject_size_ratio?: number;
  white_clean_threshold?: number;
  black_clean_threshold?: number;
  palette_colors?: number;
}

export type BookUpdateInput = Partial<BookCreateInput>;



// ---------- Category ----------

export interface Subject {
  id: number;
  name: string;
}

export interface Variation {
  id: number;
  text: string;
  order: number;
}

export interface Category {
  id: number;
  name: string;
  book_id: number;
  book_name: string;
  subjects: Subject[];
  variations: Variation[];
}

export interface CategorySummary {
  id: number;
  name: string;
  book_id: number;
  book_name: string;
  subject_count: number;
  variation_count: number;
}

export interface CategoryCreateInput {
  name: string;
  book_id: number;
  subjects: string[];
  variations: string[];
}

export interface CategoryUpdateInput {
  subjects?: string[];
  variations?: string[];
}

// ---------- Translations ----------

export interface TranslationItem {
  id: number;
  subject_id: number;
  subject_name: string;
  translated_text: string;
}

export interface VariationTranslationItem {
  id: number;
  variation_id: number;
  variation_text: string;
  translated_text: string;
}

export interface Translation {
  id: number;
  category_id: number;
  lang: string;
  category_translated: string;
  filename_template: string;
  alt_template: string;
  title_template: string;
  items: TranslationItem[];
  variation_items: VariationTranslationItem[];
}

export interface TranslationItemInput {
  subject_name: string;
  translated_text: string;
}

export interface VariationTranslationItemInput {
  variation_text: string;
  translated_text: string;
}

export interface TranslationCreateInput {
  lang: string;
  category_translated: string;
  filename_template: string;
  alt_template: string;
  title_template: string;
  items: TranslationItemInput[];
  variation_items: VariationTranslationItemInput[];
}

export interface TranslationUpdateInput {
  category_translated?: string;
  filename_template?: string;
  alt_template?: string;
  title_template?: string;
  items?: TranslationItemInput[];
  variation_items?: VariationTranslationItemInput[];
}

// ---------- Settings ----------

export interface Settings {
  batch_confirmation_threshold: number;
  sleep_between_calls: number;
  sleep_on_failure: number;
}

export type SettingsUpdateInput = Partial<Settings>;

// ---------- Prompt Defaults ----------

export interface PromptDefaults {
  base_prompt: string;
  variations: string[];
}

export interface PromptDefaultsUpdateInput {
  base_prompt?: string;
  variations?: string[];
}

// ---------- Generation ----------

export interface GenerationPlanInput {
  category: string;
  subjects?: string[];
  new_variations_per_subject: number;
  max_images?: number;
}

export interface PlannedTask {
  category: string;
  subject: string;
  variation_number: number;
  variation_text: string;
}

export interface GenerationPlanResponse {
  tasks: PlannedTask[];
  total_images: number;
  estimated_cost_usd: number;
}

export interface GenerationRunResponse {
  job_id: number;
  status: string;
  total_images: number;
}

export type JobStatus = "pending" | "running" | "done" | "failed" | "cancelled";

export interface GenerationStatusResponse {
  job_id: number;
  status: JobStatus;
  total_images: number;
  completed_images: number;
  error_message: string | null;
  current_task: string | null;
}