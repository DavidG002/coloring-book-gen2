"""add user_id to app_credentials

Revision ID: b609e8143cbc
Revises: cf9633cfc532
Create Date: 2026-09-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b609e8143cbc'
down_revision: Union[str, None] = 'cf9633cfc532'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Roadmap task 5: per-user OpenAI keys, with a house-key fallback.
    # No backfill needed here (unlike books/generation_jobs in the previous
    # migration) — every existing app_credentials row (just id=1, the house
    # key) is meant to stay user_id=NULL; that's what makes it "the house
    # key" rather than anyone's personal key. NULL is unique-constraint-safe
    # in both SQLite and Postgres (multiple NULLs are allowed), so this is
    # just an additive column + constraint, added straight as nullable.
    op.add_column('app_credentials', sa.Column('user_id', sa.Integer(), nullable=True))
    op.create_unique_constraint('uq_app_credentials_user_id', 'app_credentials', ['user_id'])
    op.create_foreign_key(None, 'app_credentials', 'users', ['user_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint(None, 'app_credentials', type_='foreignkey')
    op.drop_constraint('uq_app_credentials_user_id', 'app_credentials', type_='unique')
    op.drop_column('app_credentials', 'user_id')
