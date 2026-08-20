from sqlalchemy import (
    create_engine, Column, Integer, String, Text, Float, Boolean,
    ForeignKey, DateTime, UniqueConstraint
)
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()

class BookPreview(Base):
    __tablename__ = "book_previews"

    id = Column(Integer, primary_key=True)
    book_id = Column(Integer, ForeignKey("books.id"), nullable=False)
    category = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    variation_text = Column(Text, nullable=False)
    canvas_width = Column(Integer, nullable=False)
    canvas_height = Column(Integer, nullable=False)
    subject_size_ratio = Column(Float, nullable=False)
    white_clean_threshold = Column(Integer, nullable=False)
    black_clean_threshold = Column(Integer, nullable=False)
    palette_colors = Column(Integer, nullable=False)
    prompt_used = Column(Text, nullable=True)
    file_path = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    book = relationship("Book")
    
class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    base_prompt = Column(Text, nullable=False)
    product_noun = Column(String, nullable=False, default="coloring page")

    canvas_width = Column(Integer, nullable=False, default=595)
    canvas_height = Column(Integer, nullable=False, default=842)
    subject_size_ratio = Column(Float, nullable=False, default=0.50)
    white_clean_threshold = Column(Integer, nullable=False, default=245)
    black_clean_threshold = Column(Integer, nullable=False, default=10)
    palette_colors = Column(Integer, nullable=False, default=8)

    categories = relationship("Category", back_populates="book", cascade="all, delete-orphan")

    watermark_enabled = Column(Boolean, nullable=False, default=False)
    watermark_position = Column(String, nullable=False, default="bottom-right")
    watermark_opacity = Column(Float, nullable=False, default=0.6)
    watermark_scale = Column(Float, nullable=False, default=0.15)
    watermark_filename = Column(String, nullable=True)


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)       # e.g. "dinosaurs"
    book_id = Column(Integer, ForeignKey("books.id"), nullable=False)

    book = relationship("Book", back_populates="categories")
    subjects = relationship("Subject", back_populates="category", cascade="all, delete-orphan", order_by="Subject.id")
    variations = relationship("Variation", back_populates="category", cascade="all, delete-orphan")
    translations = relationship("Translation", back_populates="category", cascade="all, delete-orphan")

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    name = Column(String, nullable=False)                     # e.g. "T-Rex"

    category = relationship("Category", back_populates="subjects")
    translation_items = relationship("TranslationItem", back_populates="subject", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("category_id", "name", name="uq_subject_per_category"),)


class Variation(Base):
    __tablename__ = "variations"

    id = Column(Integer, primary_key=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    text = Column(Text, nullable=False)                       # e.g. "facing left, walking pose..."
    order = Column(Integer, nullable=False)                   # cycling order matters

    category = relationship("Category", back_populates="variations")
    variation_translation_items = relationship(
        "VariationTranslationItem", back_populates="variation", cascade="all, delete-orphan"
    )

class Translation(Base):
    __tablename__ = "translations"

    id = Column(Integer, primary_key=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    lang = Column(String, nullable=False)                     # e.g. "he"
    category_translated = Column(String, nullable=False)      # _category
    filename_template = Column(Text, nullable=False)
    alt_template = Column(Text, nullable=False)
    title_template = Column(Text, nullable=False)

    category = relationship("Category", back_populates="translations")
    items = relationship("TranslationItem", back_populates="translation", cascade="all, delete-orphan")
    variation_items = relationship("VariationTranslationItem", back_populates="translation", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("category_id", "lang", name="uq_translation_per_category_lang"),)


class TranslationItem(Base):
    __tablename__ = "translation_items"

    id = Column(Integer, primary_key=True)
    translation_id = Column(Integer, ForeignKey("translations.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    translated_text = Column(String, nullable=False)

    translation = relationship("Translation", back_populates="items")
    subject = relationship("Subject", back_populates="translation_items")

    __table_args__ = (UniqueConstraint("translation_id", "subject_id", name="uq_item_per_translation_subject"),)

class VariationTranslationItem(Base):
    __tablename__ = "variation_translation_items"

    id = Column(Integer, primary_key=True)
    translation_id = Column(Integer, ForeignKey("translations.id"), nullable=False)
    variation_id = Column(Integer, ForeignKey("variations.id"), nullable=False)
    translated_text = Column(String, nullable=False)

    translation = relationship("Translation", back_populates="variation_items")
    variation = relationship("Variation", back_populates="variation_translation_items")

    __table_args__ = (
       UniqueConstraint("translation_id", "variation_id", name="uq_variation_item_per_translation_variation"),
    )

class LanguageTemplateDefault(Base):
    __tablename__ = "language_template_defaults"

    id = Column(Integer, primary_key=True)
    book_id = Column(Integer, ForeignKey("books.id"), nullable=False)
    lang = Column(String, nullable=False)
    filename_template = Column(Text, nullable=False)
    alt_template = Column(Text, nullable=False)
    title_template = Column(Text, nullable=False)

    __table_args__ = (
        UniqueConstraint("book_id", "lang", name="uq_template_default_per_book_lang"),
    )

class GenerationJob(Base):
    __tablename__ = "generation_jobs"

    id = Column(Integer, primary_key=True)
    category = Column(String, nullable=False)
    params_json = Column(Text, nullable=False)                # serialized GenerationRequest
    status = Column(String, nullable=False, default="pending")  # pending/running/done/failed/cancelled
    total_images = Column(Integer, default=0)
    completed_images = Column(Integer, default=0)
    cost_estimate = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    images = relationship("GenerationImage", back_populates="job", cascade="all, delete-orphan")


class GenerationImage(Base):
    __tablename__ = "generation_images"

    id = Column(Integer, primary_key=True)
    job_id = Column(Integer, ForeignKey("generation_jobs.id"), nullable=False)
    category = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    variation_number = Column(Integer, nullable=False)
    variation_text = Column(Text, nullable=True)  # nullable: images generated before this column existed won't have it
    file_path = Column(String, nullable=False)
    status = Column(String, nullable=False, default="approved")
    created_at = Column(DateTime, default=datetime.utcnow)
    wp_excluded = Column(Boolean, nullable=False, default=False)

    job = relationship("GenerationJob", back_populates="images")

class PublishRun(Base):
    __tablename__ = "publish_runs"

    id = Column(Integer, primary_key=True)
    category = Column(String, nullable=False)
    lang = Column(String, nullable=False)
    published_count = Column(Integer, nullable=False)
    new_count = Column(Integer, nullable=False, default=0)
    already_published_count = Column(Integer, nullable=False, default=0)
    skipped_subjects_json = Column(Text, nullable=True)
    manifest_path = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    files = relationship("PublishedFile", back_populates="run", cascade="all, delete-orphan")


class PublishedFile(Base):
    __tablename__ = "published_files"

    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey("publish_runs.id"), nullable=False)
    source_path = Column(String, nullable=False)
    target_filename = Column(String, nullable=False)
    alt_text = Column(Text, nullable=False)
    title_text = Column(Text, nullable=False)
    excerpt_text = Column(Text, nullable=True)
    content_text = Column(Text, nullable=True)
    was_new = Column(Boolean, nullable=False, default=True)

    run = relationship("PublishRun", back_populates="files")


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String, primary_key=True)                    # e.g. "canvas_width"
    value = Column(String, nullable=False)                    # stored as string, cast on read


# --- Engine setup ---
DATABASE_URL = "sqlite:///./data.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def init_db():
    Base.metadata.create_all(bind=engine)


class AppCredential(Base):
    """Single-row table (id=1 always) holding provider credentials.
    DB-backed rather than .env so it's editable from the UI and ready
    for a future multi-user model."""
    __tablename__ = "app_credentials"

    id = Column(Integer, primary_key=True, default=1)
    openai_api_key = Column(String, nullable=True)


class WordPressIntegration(Base):
    __tablename__ = "wordpress_integration"

    id = Column(Integer, primary_key=True, default=1)
    site_url = Column(String, nullable=True)
    username = Column(String, nullable=True)
    app_password = Column(String, nullable=True)
    post_type = Column(String, nullable=False, default="post")
    taxonomy = Column(String, nullable=False, default="category")
    last_test_status = Column(String, nullable=True)
    last_test_message = Column(Text, nullable=True)
    last_tested_at = Column(DateTime, nullable=True)
    use_polylang_linking = Column(Boolean, nullable=False, default=False)


class WordPressCategoryTerm(Base):
    """Tracks the WP taxonomy term ID created for a given (category, language)
    pair — created once, reused for every image ever published under it."""
    __tablename__ = "wordpress_category_terms"

    id = Column(Integer, primary_key=True)
    category = Column(String, nullable=False)
    lang = Column(String, nullable=False)
    wp_term_id = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    site_url = Column(String, nullable=False, default="")

    __table_args__ = (
        UniqueConstraint("category", "lang", "site_url", name="uq_wp_term_per_category_lang_site"),
    )


class WordPressPublishedItem(Base):
    """Tracks each (image, language) pair that has been pushed to WordPress —
    the source of truth for 'already pushed' vs 'new' on future batches."""
    __tablename__ = "wordpress_published_items"

    id = Column(Integer, primary_key=True)
    source_path = Column(String, nullable=False)
    category = Column(String, nullable=False)
    lang = Column(String, nullable=False)
    wp_media_id = Column(Integer, nullable=False)
    wp_post_id = Column(Integer, nullable=False)
    wp_post_url = Column(String, nullable=True)
    status = Column(String, nullable=False, default="publish")  # "publish" | "draft"
    created_at = Column(DateTime, default=datetime.utcnow)
    pushed_title = Column(Text, nullable=True)
    pushed_alt_text = Column(Text, nullable=True)
    pushed_excerpt = Column(Text, nullable=True)
    pushed_content = Column(Text, nullable=True)
    site_url = Column(String, nullable=False, default="")

    __table_args__ = (
        UniqueConstraint("source_path", "lang", name="uq_wp_item_per_source_lang"),
    )


class SupportedLanguage(Base):
    __tablename__ = "supported_languages"

    code = Column(String, primary_key=True)  # e.g. "he"
    name = Column(String, nullable=False)    # e.g. "Hebrew"


class ContentVariant(Base):
    """Naturally-written, SEO-oriented text for a specific subject+variation+
    language combination — generated once, reused for every image that uses
    this exact subject+variation+language, regardless of how many exist."""
    __tablename__ = "content_variants"

    id = Column(Integer, primary_key=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    variation_id = Column(Integer, ForeignKey("variations.id"), nullable=False)
    lang = Column(String, nullable=False)

    seo_title = Column(String, nullable=False)
    seo_alt_text = Column(String, nullable=False)
    seo_excerpt = Column(Text, nullable=False)
    seo_content = Column(Text, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    subject = relationship("Subject")
    variation = relationship("Variation")

    __table_args__ = (
        UniqueConstraint("subject_id", "variation_id", "lang", name="uq_content_variant"),
    )

class CategoryDescription(Base):
    """One generated description per (category, language) — used as the
    WordPress taxonomy term's description, cached and reused forever."""
    __tablename__ = "category_descriptions"

    id = Column(Integer, primary_key=True)
    category = Column(String, nullable=False)
    lang = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("category", "lang", name="uq_category_description"),
    )

class BackupSettings(Base):
    """Single-row settings for the in-app backup feature."""
    __tablename__ = "backup_settings"

    id = Column(Integer, primary_key=True, default=1)
    auto_backup_enabled = Column(Boolean, nullable=False, default=True)
    backup_interval_hours = Column(Integer, nullable=False, default=24)
    local_retention_count = Column(Integer, nullable=False, default=5)
    last_backup_at = Column(DateTime, nullable=True)


class BackupRecord(Base):
    """History of backup runs."""
    __tablename__ = "backup_records"

    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    folder_path = Column(String, nullable=False)
    db_size_bytes = Column(Integer, nullable=False, default=0)
    content_size_bytes = Column(Integer, nullable=False, default=0)
    triggered_by = Column(String, nullable=False, default="manual")  # "manual" | "auto"
    success = Column(Boolean, nullable=False, default=True)
    error_message = Column(Text, nullable=True)