"""add keycloak_id to users

Revision ID: 002
Revises: 
Create Date: 2025-08-05 23:50:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add keycloak_id column to users table
    op.add_column('users', sa.Column('keycloak_id', sa.String(), nullable=True))
    op.create_index(op.f('ix_users_keycloak_id'), 'users', ['keycloak_id'], unique=True)
    
    # Make hashed_password nullable for Keycloak users
    op.alter_column('users', 'hashed_password', nullable=True)


def downgrade() -> None:
    # Remove keycloak_id column and index
    op.drop_index(op.f('ix_users_keycloak_id'), table_name='users')
    op.drop_column('users', 'keycloak_id')
    
    # Make hashed_password non-nullable again
    op.alter_column('users', 'hashed_password', nullable=False)
