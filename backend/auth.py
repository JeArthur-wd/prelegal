"""Sign up, sign in and sessions.

Signing in creates a random session token, stored hashed in the sessions table
and sent to the browser in an HttpOnly cookie.
"""

import hashlib
import secrets
import sqlite3

import bcrypt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field, field_validator

from db import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])

SESSION_COOKIE = "prelegal_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 7  # one week

# Checked against when the email is unknown, so both failure cases take the same time.
_DUMMY_HASH = bcrypt.hashpw(b"dummy-password", bcrypt.gensalt())


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)

    @field_validator("password")
    @classmethod
    def fits_bcrypt(cls, password: str) -> str:
        if len(password.encode()) > 72:
            raise ValueError("Password must be at most 72 bytes")
        return password


class SigninRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _start_session(db: sqlite3.Connection, response: Response, user_id: int) -> None:
    token = secrets.token_urlsafe(32)
    with db:
        db.execute(
            "INSERT INTO sessions (token_hash, user_id) VALUES (?, ?)", (_hash_token(token), user_id)
        )
    response.set_cookie(
        SESSION_COOKIE, token, max_age=SESSION_MAX_AGE, httponly=True, samesite="lax", path="/"
    )


def current_user(
    session: str | None = Cookie(None, alias=SESSION_COOKIE),
    db: sqlite3.Connection = Depends(get_db),
) -> UserResponse:
    """Dependency for routes that require a signed-in user."""
    user = None
    if session:
        user = db.execute(
            "SELECT users.id, users.email FROM sessions JOIN users ON users.id = sessions.user_id"
            " WHERE sessions.token_hash = ?",
            (_hash_token(session),),
        ).fetchone()
    if user is None:
        raise HTTPException(status_code=401, detail="Please sign in to continue")
    return UserResponse(id=user["id"], email=user["email"])


@router.post("/signup", status_code=201, response_model=UserResponse)
def signup(
    body: SignupRequest, response: Response, db: sqlite3.Connection = Depends(get_db)
) -> UserResponse:
    password_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    try:
        with db:
            cursor = db.execute(
                "INSERT INTO users (email, password_hash) VALUES (?, ?)",
                (body.email, password_hash),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    _start_session(db, response, cursor.lastrowid)
    return UserResponse(id=cursor.lastrowid, email=body.email)


@router.post("/signin", response_model=UserResponse)
def signin(
    body: SigninRequest, response: Response, db: sqlite3.Connection = Depends(get_db)
) -> UserResponse:
    user = db.execute(
        "SELECT id, email, password_hash FROM users WHERE email = ?", (body.email,)
    ).fetchone()
    stored_hash = user["password_hash"].encode() if user else _DUMMY_HASH
    password_ok = bcrypt.checkpw(body.password.encode()[:72], stored_hash)
    if user is None or not password_ok:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    _start_session(db, response, user["id"])
    return UserResponse(id=user["id"], email=user["email"])


@router.post("/signout", status_code=204)
def signout(
    response: Response,
    session: str | None = Cookie(None, alias=SESSION_COOKIE),
    db: sqlite3.Connection = Depends(get_db),
) -> None:
    if session:
        with db:
            db.execute("DELETE FROM sessions WHERE token_hash = ?", (_hash_token(session),))
    response.delete_cookie(SESSION_COOKIE, path="/")


@router.get("/me", response_model=UserResponse)
def me(user: UserResponse = Depends(current_user)) -> UserResponse:
    return user
