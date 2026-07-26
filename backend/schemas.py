from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


# ---------- Subject ----------

class SubjectBase(BaseModel):
    name: str


class SubjectCreate(SubjectBase):
    pass


class SubjectRead(SubjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------- Variation ----------

class VariationBase(BaseModel):
    text: str
    order: int


class VariationCreate(BaseModel):
    text: str
    # order is assigned server-side based on list position, not client-supplied


class VariationRead(VariationBase):
    model_config = ConfigDict(from_attributes=True)
    id: int

# ---------- Book ----------

class BookBase(BaseModel):
    name: str
    base_prompt: str
    canvas_width: int = 595
    canvas_height: int = 842
    subject_size_ratio: float = 0.50
    white_clean_threshold: int = 245
    black_clean_threshold: int = 10
    palette_colors: int = 8


class BookCreate(BookBase):
    pass


class BookUpdate(BaseModel):
    name: Optional[str] = None
    base_prompt: Optional[str] = None
    canvas_width: Optional[int] = None
    canvas_height: Optional[int] = None
    subject_size_ratio: Optional[float] = None
    white_clean_threshold: Optional[int] = None
    black_clean_threshold: Optional[int] = None
    palette_colors: Optional[int] = None


class BookRead(BookBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    category_count: int = 0


class BookSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    category_count: int

# ---------- Category ----------

class CategoryBase(BaseModel):
    name: str


class CategoryCreate(CategoryBase):
    book_id: int
    subjects: list[str] = []
    variations: list[str] = []


class CategoryUpdate(BaseModel):
    subjects: Optional[list[str]] = None
    variations: Optional[list[str]] = None


class CategoryRead(CategoryBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    book_id: int
    book_name: str
    subjects: list[SubjectRead] = []
    variations: list[VariationRead] = []


class CategorySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    book_id: int
    book_name: str
    subject_count: int
    variation_count: int


    # ---------- Translation ----------

class TranslationItemInput(BaseModel):
    subject_name: str       # matches Subject.name within the same category
    translated_text: str

class VariationTranslationItemInput(BaseModel):
    variation_text: str       # matches Variation.text within the same category
    translated_text: str

class TranslationItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    subject_id: int
    subject_name: str        # filled in manually in the route, not a direct DB column
    translated_text: str

class VariationTranslationItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    variation_id: int
    variation_text: str        # filled in manually in the route, not a direct DB column
    translated_text: str

class TranslationBase(BaseModel):
    lang: str
    category_translated: str
    filename_template: str
    alt_template: str
    title_template: str


class TranslationCreate(TranslationBase):
    items: list[TranslationItemInput] = []
    variation_items: list[VariationTranslationItemInput] = []


class TranslationUpdate(BaseModel):
    category_translated: Optional[str] = None
    filename_template: Optional[str] = None
    alt_template: Optional[str] = None
    title_template: Optional[str] = None
    items: Optional[list[TranslationItemInput]] = None
    variation_items: Optional[list[VariationTranslationItemInput]] = None


class TranslationRead(TranslationBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    category_id: int
    items: list[TranslationItemRead] = []
    variation_items: list[VariationTranslationItemRead] = []

class TranslateVariationsRequest(BaseModel):
    lang: str


class TranslateVariationsResponse(BaseModel):
    translated_count: int
    skipped_count: int  # already had a translation, left untouched

class TranslateCategoryNameResponse(BaseModel):
    translated_text: str

class LanguageTemplateDefaultRead(BaseModel):
    lang: str
    filename_template: str
    alt_template: str
    title_template: str


class LanguageTemplateDefaultUpdate(BaseModel):
    filename_template: Optional[str] = None
    alt_template: Optional[str] = None
    title_template: Optional[str] = None

# ---------- Settings ----------

class SettingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    key: str
    value: str


class SettingsUpdate(BaseModel):
    batch_confirmation_threshold: Optional[int] = None
    sleep_between_calls: Optional[float] = None
    sleep_on_failure: Optional[float] = None


class SettingsRead(BaseModel):
    batch_confirmation_threshold: int
    sleep_between_calls: float
    sleep_on_failure: float

# ---------- BookPreview ---------

class BookPreviewRequest(BaseModel):
    canvas_width: int
    canvas_height: int
    subject_size_ratio: float
    white_clean_threshold: int
    black_clean_threshold: int
    palette_colors: int
    category_name: Optional[str] = None

class BookPreviewAvailability(BaseModel):
    available: bool
    all_categories: list[str] = []
    eligible_categories: list[str] = []
    sample_subject: Optional[str] = None
    sample_variation: Optional[str] = None
    sample_category: Optional[str] = None

class BookPreviewRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    category: str
    subject: str
    variation_text: str
    canvas_width: int
    canvas_height: int
    subject_size_ratio: float
    white_clean_threshold: int
    black_clean_threshold: int
    palette_colors: int
    created_at: datetime

# ---------- Generation ----------

class GenerationPlanRequest(BaseModel):
    category: str
    subjects: Optional[list[str]] = None   # omit = all subjects in category
    new_variations_per_subject: int = 1
    max_images: Optional[int] = None


class PlannedTask(BaseModel):
    category: str
    subject: str
    variation_number: int
    variation_text: str


class GenerationPlanResponse(BaseModel):
    tasks: list[PlannedTask]
    total_images: int
    estimated_cost_usd: float


class GenerationRunRequest(GenerationPlanRequest):
    pass  # same shape — plan and run take identical input


class GenerationRunResponse(BaseModel):
    job_id: int
    status: str
    total_images: int


class GenerationStatusResponse(BaseModel):
    job_id: int
    status: str                # pending/running/done/failed/cancelled
    total_images: int
    completed_images: int
    error_message: Optional[str] = None
    current_task: Optional[str] = None

# ---------- Prompt Defaults ----------

class PromptDefaultsRead(BaseModel):
    base_prompt: str
    variations: list[str]


class PromptDefaultsUpdate(BaseModel):
    base_prompt: Optional[str] = None
    variations: Optional[list[str]] = None

# ---------- Publishing ----------

class PublishRequest(BaseModel):
    category: str
    lang: str
    only_new: bool = False


class PublishedFileInfo(BaseModel):
    source_path: str
    target_filename: str
    alt_text: str
    title_text: str
    subject_en: str
    subject_translated: str
    variation_text_en: str
    variation_translated: Optional[str] = None
    variation_number: int
    is_new: bool


class PublishPlanResponse(BaseModel):
    files: list[PublishedFileInfo]
    total_files: int
    new_count: int
    already_published_count: int
    skipped_subjects: list[str]


class PublishRunResponse(BaseModel):
    published_count: int
    new_count: int
    already_published_count: int
    manifest_path: str
    skipped_subjects: list[str]
    run_id: int


class PublishHistoryFileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    target_filename: str
    alt_text: str
    title_text: str
    was_new: bool


class PublishHistoryRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    category: str
    lang: str
    published_count: int
    new_count: int
    already_published_count: int
    manifest_path: str
    created_at: datetime
    files: list[PublishHistoryFileRead] = []