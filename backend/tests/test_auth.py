import sqlite3

from tests.conftest import PASSWORD, signin, signup


def test_signup_creates_user(client):
    response = signup(client)
    assert response.status_code == 201
    assert response.json() == {"id": 1, "email": "user@example.com"}


def test_signup_stores_hashed_password(client, db_path):
    signup(client)
    with sqlite3.connect(db_path) as conn:
        (stored,) = conn.execute("SELECT password_hash FROM users").fetchone()
    assert stored != PASSWORD
    assert stored.startswith("$2b$")


def test_signup_rejects_duplicate_email_case_insensitively(client):
    signup(client)
    response = signup(client, email="USER@example.com")
    assert response.status_code == 409


def test_signup_rejects_invalid_email(client):
    assert signup(client, email="not-an-email").status_code == 422


def test_signup_rejects_short_password(client):
    assert signup(client, password="short").status_code == 422


def test_signup_rejects_password_longer_than_bcrypt_allows(client):
    assert signup(client, password="x" * 73).status_code == 422


def test_signin_with_valid_credentials(client):
    signup(client)
    response = signin(client)
    assert response.status_code == 200
    assert response.json() == {"id": 1, "email": "user@example.com"}


def test_signin_wrong_password_and_unknown_email_look_the_same(client):
    signup(client)
    wrong_password = signin(client, password="wrong-password")
    unknown_email = signin(client, email="nobody@example.com")
    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()
