"""Tests for the document persistence routes."""

from tests.conftest import signup

NDA = {
    "document_type": "mutual_nda",
    "title": "Acme NDA",
    "form_data": {"purpose": "Evaluating a partnership", "party1": {"company": "Acme"}},
}


def test_documents_require_authentication(client):
    assert client.get("/api/documents").status_code == 401
    assert client.post("/api/documents", json=NDA).status_code == 401
    assert client.get("/api/documents/1").status_code == 401
    assert client.put("/api/documents/1", json={"title": "x", "form_data": {}}).status_code == 401
    assert client.delete("/api/documents/1").status_code == 401


def test_save_and_get_document(auth_client):
    saved = auth_client.post("/api/documents", json=NDA)

    assert saved.status_code == 200
    doc = saved.json()
    assert doc["title"] == "Acme NDA"
    assert doc["document_type"] == "mutual_nda"
    assert doc["form_data"] == NDA["form_data"]

    fetched = auth_client.get(f"/api/documents/{doc['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == doc


def test_save_rejects_unknown_document_type(auth_client):
    response = auth_client.post("/api/documents", json={**NDA, "document_type": "lease"})
    assert response.status_code == 422


def test_list_documents_most_recently_updated_first(auth_client):
    first = auth_client.post("/api/documents", json={**NDA, "title": "First"}).json()
    auth_client.post("/api/documents", json={**NDA, "title": "Second"})
    auth_client.put(
        f"/api/documents/{first['id']}", json={"title": "First (edited)", "form_data": {}}
    )

    titles = [d["title"] for d in auth_client.get("/api/documents").json()["documents"]]

    assert titles == ["First (edited)", "Second"]


def test_update_document(auth_client):
    doc = auth_client.post("/api/documents", json=NDA).json()

    response = auth_client.put(
        f"/api/documents/{doc['id']}",
        json={"title": "Renamed", "form_data": {"purpose": "Updated"}},
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Renamed"
    assert response.json()["form_data"] == {"purpose": "Updated"}


def test_delete_document(auth_client):
    doc = auth_client.post("/api/documents", json=NDA).json()

    assert auth_client.delete(f"/api/documents/{doc['id']}").status_code == 200
    assert auth_client.get(f"/api/documents/{doc['id']}").status_code == 404
    assert auth_client.get("/api/documents").json()["documents"] == []


def test_missing_document_returns_404(auth_client):
    assert auth_client.get("/api/documents/999").status_code == 404
    assert auth_client.put("/api/documents/999", json={"title": "x", "form_data": {}}).status_code == 404
    assert auth_client.delete("/api/documents/999").status_code == 404


def test_users_cannot_access_each_others_documents(client):
    signup(client, email="alice@example.com")
    alice_doc = client.post("/api/documents", json=NDA).json()

    client.cookies.clear()
    signup(client, email="bob@example.com")

    assert client.get("/api/documents").json()["documents"] == []
    assert client.get(f"/api/documents/{alice_doc['id']}").status_code == 404
    assert (
        client.put(
            f"/api/documents/{alice_doc['id']}", json={"title": "Hijacked", "form_data": {}}
        ).status_code
        == 404
    )
    assert client.delete(f"/api/documents/{alice_doc['id']}").status_code == 404
