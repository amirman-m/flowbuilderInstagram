import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime

from app.api.v1.flows import router as flows_router
from app.api.deps import get_current_user, get_current_active_user, get_db
from app.models.flow import Flow
from app.models.user import User
from app.models.nodes import NodeInstance, NodeConnection, Base as NodesBase
from app.core.database import Base as CoreBase

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create all tables from both metadata sets
CoreBase.metadata.create_all(bind=engine)
NodesBase.metadata.create_all(bind=engine)

app = FastAPI()
# Match production mounting: /flows prefix
app.include_router(flows_router, prefix="/flows")

# ---------------- Fixtures ---------------- #
@pytest.fixture
def db_session():
    """Yield a SQLAlchemy session with a rollback after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()

@pytest.fixture(autouse=True)
def override_get_db(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    yield
    app.dependency_overrides.pop(get_db, None)

@pytest.fixture
def test_user(db_session):
    user = User(id=1, email="test@example.com", name="Test User", hashed_password="x", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def auth_override(test_user):
    app.dependency_overrides[get_current_user] = lambda: test_user
    app.dependency_overrides[get_current_active_user] = lambda: test_user
    yield
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_current_active_user, None)

@pytest.fixture
def client():
    return TestClient(app)

# ---------------- Helper ---------------- #

def make_payload():
    return {
        "flow_name": "My Flow",
        "nodes": [
            {
                "id": "n1",
                "typeId": "chat-input",
                "label": "Chat",
                "position": {"x": 10, "y": 20},
                "settings": {"model": "gpt-3.5"},
            }
        ],
        "edges": []
    }

# ---------------- Tests ---------------- #

def test_save_flow_success(client, db_session, test_user, auth_override):
    # Create flow belonging to user
    flow = Flow(id=1, user_id=test_user.id, name="My Flow", status="draft", created_at=datetime.utcnow())
    db_session.add(flow)
    db_session.commit()

    response = client.post(f"/flows/{flow.id}/save", json=make_payload())
    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    assert body["version"] == 1
    assert "saved_at" in body

    # Assert DB inserts
    node_count = db_session.query(NodeInstance).filter(NodeInstance.flow_id == flow.id).count()
    assert node_count == 1

    conn_count = db_session.query(NodeConnection).filter(NodeConnection.flow_id == flow.id).count()
    assert conn_count == 0


def test_save_flow_not_found(client, auth_override):
    response = client.post("/flows/999/save", json=make_payload())
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_save_flow_unauthenticated(client):
    response = client.post("/flows/1/save", json=make_payload())
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
