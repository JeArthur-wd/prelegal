"""Tests for the authentication routes."""

from tests.conftest import PASSWORD, signup


def test_signup_returns_user_and_sets_httponly_cookie(client):
    response = signup(client)

    assert response.status_code == 200
    assert response.json()["user"]["email"] == "user@example.com"
    set_cookie = response.headers["set-cookie"]
    assert "access_token=" in set_cookie
    assert "HttpOnly" in set_cookie


def test_signup_rejects_duplicate_email(client):
    signup(client)
    response = signup(client)

    assert response.status_code == 400
    assert response.json()["detail"] == "Email already registered"


def test_signup_rejects_short_password(client):
    response = signup(client, password="short")
    assert response.status_code == 400


def test_signup_rejects_invalid_email(client):
    response = signup(client, email="not-an-email")
    assert response.status_code == 422


def test_password_is_not_stored_in_plain_text(client, engine):
    signup(client)

    with engine.connect() as conn:
        stored = conn.exec_driver_sql("SELECT hashed_password FROM users").scalar_one()

    assert stored != PASSWORD
    assert stored.startswith("$2")


def test_signin_with_valid_credentials(client):
    signup(client)
    client.cookies.clear()

    response = client.post(
        "/api/auth/signin", json={"email": "user@example.com", "password": PASSWORD}
    )

    assert response.status_code == 200
    assert "access_token=" in response.headers["set-cookie"]


def test_signin_wrong_password_and_unknown_email_give_same_error(client):
    signup(client)
    client.cookies.clear()

    wrong_password = client.post(
        "/api/auth/signin", json={"email": "user@example.com", "password": "wrongpass1"}
    )
    unknown_email = client.post(
        "/api/auth/signin", json={"email": "nobody@example.com", "password": PASSWORD}
    )

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()


def test_me_returns_current_user(auth_client):
    response = auth_client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.json()["email"] == "user@example.com"


def test_me_requires_authentication(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_rejects_invalid_token(client):
    client.cookies.set("access_token", "not-a-jwt")
    assert client.get("/api/auth/me").status_code == 401


def test_signout_clears_session(auth_client):
    response = auth_client.post("/api/auth/signout")

    assert response.status_code == 200
    assert auth_client.get("/api/auth/me").status_code == 401
