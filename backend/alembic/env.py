import os
import sys

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# Make the backend package importable (models.py, database.py) the same
# way main.py already does, regardless of the working directory alembic
# is invoked from.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import Base  # noqa: E402  (must come after sys.path fix above)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Autogenerate diffs against this — every model in models.py, since they
# all share the one Base/declarative_base().
target_metadata = Base.metadata


def get_database_url() -> str:
    # Same variable and same default as models.py, so alembic always
    # targets whatever database the app itself is actually configured
    # for, and never drifts out of sync with it.
    return os.environ.get("DATABASE_URL", "sqlite:///./data.db")


def run_migrations_offline() -> None:
    context.configure(
        url=get_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = get_database_url()
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
