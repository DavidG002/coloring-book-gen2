from sqlalchemy import (
    create_engine, Column, Integer, String, Text, Float, Boolean,
    ForeignKey, DateTime, UniqueConstraint
)
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()


class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    base_prompt = Column(Text, nullable=False)

    canvas_width = Column(Integer, nullable=False, default=595)
    canvas_height = Column(Integer, nullable=False, default=842)
    subject_size_ratio = Column(Float, nullable=False, default=0.50)
    white_clean_threshold = Column(Integer, nullable=False, default=245)
    black_clean_threshold = Column(Integer, nullable=False, default=10)
    palette_colors = Column(Integer, nullable=False, default=8)

    categories = relationship("Category", back_populates="book", cascade="all, delete-orphan")


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

    lang = Column(String, primary_key=True)
    filename_template = Column(Text, nullable=False)
    alt_template = Column(Text, nullable=False)
    title_template = Column(Text, nullable=False)

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