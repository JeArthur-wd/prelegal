"""Sign up and sign in against the users table.

Sessions are not issued yet; they arrive with the login UI.
"""

import sqlite3

import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator

from db import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])

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


@router.post("/signup", status_code=201, response_model=UserResponse)
def signup(body: SignupRequest, db: sqlite3.Connection = Depends(get_db)) -> UserResponse:
    password_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    try:
        with db:
            cursor = db.execute(
                "INSERT INTO users (email, password_hash) VALUES (?, ?)",
                (body.email, password_hash),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Email already registered")
    return UserResponse(id=cursor.lastrowid, email=body.email)


@router.post("/signin", response_model=UserResponse)
def signin(body: SigninRequest, db: sqlite3.Connection = Depends(get_db)) -> UserResponse:
    user = db.execute(
        "SELECT id, email, password_hash FROM users WHERE email = ?", (body.email,)
    ).fetchone()
    stored_hash = user["password_hash"].encode() if user else _DUMMY_HASH
    password_ok = bcrypt.checkpw(body.password.encode()[:72], stored_hash)
    if user is None or not password_ok:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return UserResponse(id=user["id"], email=user["email"])
