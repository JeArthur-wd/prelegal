"""A signed-in user's saved documents: the chosen template, field values and conversation."""

import json
import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import UserResponse, current_user
from chat import ChatMessage
from db import get_db, now
from templates import load_catalog

router = APIRouter(prefix="/api/documents", tags=["documents"])


class DocumentIn(BaseModel):
    template_id: str
    title: str = Field(min_length=1, max_length=200)
    values: dict[str, str]
    messages: list[ChatMessage]


class DocumentSummary(BaseModel):
    id: int
    template_id: str
    title: str
    created_at: str
    updated_at: str


class Document(DocumentSummary):
    values: dict[str, str]
    messages: list[ChatMessage]


def _check_template(body: DocumentIn) -> None:
    if body.template_id not in load_catalog():
        raise HTTPException(status_code=422, detail="Unknown document type")


def _to_document(row: sqlite3.Row) -> Document:
    return Document(
        id=row["id"],
        template_id=row["template_id"],
        title=row["title"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        values=json.loads(row["field_values"]),
        messages=json.loads(row["messages"]),
    )


def _get_owned(db: sqlite3.Connection, document_id: int, user: UserResponse) -> sqlite3.Row:
    row = db.execute(
        "SELECT * FROM documents WHERE id = ? AND user_id = ?", (document_id, user.id)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return row


@router.get("", response_model=list[DocumentSummary])
def list_documents(
    user: UserResponse = Depends(current_user), db: sqlite3.Connection = Depends(get_db)
) -> list[DocumentSummary]:
    rows = db.execute(
        "SELECT id, template_id, title, created_at, updated_at FROM documents"
        " WHERE user_id = ? ORDER BY updated_at DESC, id DESC",
        (user.id,),
    )
    return [DocumentSummary(**row) for row in rows]


@router.post("", status_code=201, response_model=Document)
def create_document(
    body: DocumentIn,
    user: UserResponse = Depends(current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> Document:
    _check_template(body)
    timestamp = now()
    with db:
        cursor = db.execute(
            "INSERT INTO documents"
            " (user_id, template_id, title, field_values, messages, created_at, updated_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                user.id,
                body.template_id,
                body.title,
                json.dumps(body.values),
                json.dumps([message.model_dump() for message in body.messages]),
                timestamp,
                timestamp,
            ),
        )
    return _to_document(_get_owned(db, cursor.lastrowid, user))


@router.get("/{document_id}", response_model=Document)
def get_document(
    document_id: int,
    user: UserResponse = Depends(current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> Document:
    return _to_document(_get_owned(db, document_id, user))


@router.put("/{document_id}", response_model=Document)
def update_document(
    document_id: int,
    body: DocumentIn,
    user: UserResponse = Depends(current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> Document:
    _check_template(body)
    _get_owned(db, document_id, user)
    with db:
        db.execute(
            "UPDATE documents SET template_id = ?, title = ?, field_values = ?, messages = ?,"
            " updated_at = ? WHERE id = ?",
            (
                body.template_id,
                body.title,
                json.dumps(body.values),
                json.dumps([message.model_dump() for message in body.messages]),
                now(),
                document_id,
            ),
        )
    return _to_document(_get_owned(db, document_id, user))


@router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: int,
    user: UserResponse = Depends(current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> None:
    _get_owned(db, document_id, user)
    with db:
        db.execute("DELETE FROM documents WHERE id = ?", (document_id,))
