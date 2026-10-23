import pytest

from tests.conftest import signup

NDA = {
    "template_id": "mutual-nda",
    "title": "Mutual NDA: Acme Corp & Globex LLC",
    "values": {"party_a_name": "Acme Corp", "party_b_name": "Globex LLC"},
    "messages": [
        {"role": "assistant", "content": "Hi! What do you need?"},
        {"role": "user", "content": "An NDA between Acme Corp and Globex LLC."},
    ],
}


@pytest.fixture
def client(client):
    signup(client)
    return client


def create(client, **overrides):
    return client.post("/api/documents", json={**NDA, **overrides})


def test_create_and_get_document(client):
    created = create(client)

    assert created.status_code == 201
    document = created.json()
    assert {k: document[k] for k in NDA} == NDA
    assert document["created_at"] == document["updated_at"]
    assert client.get(f"/api/documents/{document['id']}").json() == document


def test_list_documents_most_recently_updated_first(client):
    first = create(client, title="First").json()
    create(client, title="Second")
    client.put(f"/api/documents/{first['id']}", json={**NDA, "title": "First, edited"})

    listed = client.get("/api/documents").json()

    assert [d["title"] for d in listed] == ["First, edited", "Second"]
    assert set(listed[0]) == {"id", "template_id", "title", "created_at", "updated_at"}


def test_update_document(client):
    document = create(client).json()
    changes = {
        **NDA,
        "template_id": "unilateral-nda",
        "title": "One-way NDA",
        "values": {"discloser_name": "Acme Corp"},
        "messages": [*NDA["messages"], {"role": "assistant", "content": "Switched."}],
    }

    response = client.put(f"/api/documents/{document['id']}", json=changes)

    assert response.status_code == 200
    updated = response.json()
    assert {k: updated[k] for k in changes} == changes
    assert updated["created_at"] == document["created_at"]
    assert updated["updated_at"] > document["updated_at"]


def test_delete_document(client):
    document = create(client).json()

    assert client.delete(f"/api/documents/{document['id']}").status_code == 204
    assert client.get(f"/api/documents/{document['id']}").status_code == 404
    assert client.get("/api/documents").json() == []


def test_rejects_unknown_document_type(client):
    assert create(client, template_id="lease-on-mars").status_code == 422


def test_rejects_empty_title(client):
    assert create(client, title="").status_code == 422


def test_missing_document_is_404(client):
    assert client.get("/api/documents/99").status_code == 404
    assert client.put("/api/documents/99", json=NDA).status_code == 404
    assert client.delete("/api/documents/99").status_code == 404


def test_documents_require_sign_in(client):
    document = create(client).json()
    client.cookies.clear()

    assert client.get("/api/documents").status_code == 401
    assert create(client).status_code == 401
    assert client.get(f"/api/documents/{document['id']}").status_code == 401
    assert client.put(f"/api/documents/{document['id']}", json=NDA).status_code == 401
    assert client.delete(f"/api/documents/{document['id']}").status_code == 401


def test_users_cannot_see_or_change_each_others_documents(client):
    alices = create(client).json()
    client.cookies.clear()
    signup(client, email="bob@example.com")

    assert client.get("/api/documents").json() == []
    assert client.get(f"/api/documents/{alices['id']}").status_code == 404
    assert client.put(f"/api/documents/{alices['id']}", json=NDA).status_code == 404
    assert client.delete(f"/api/documents/{alices['id']}").status_code == 404
