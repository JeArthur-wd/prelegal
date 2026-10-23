"""Structured-output LLM calls via LiteLLM and OpenRouter.

Defaults to gpt-oss-120b on Cerebras. Set PRELEGAL_LLM_MODEL to use another
OpenRouter model, e.g. a free one while developing without credits.
"""

import os

from litellm import completion
from pydantic import BaseModel

DEFAULT_MODEL = "openrouter/openai/gpt-oss-120b"
MODEL = os.getenv("PRELEGAL_LLM_MODEL") or DEFAULT_MODEL
# Cerebras is pinned only for the default model; other models use OpenRouter's routing.
EXTRA_BODY = {"provider": {"order": ["cerebras"]}} if MODEL == DEFAULT_MODEL else None


def complete_structured[T: BaseModel](messages: list[dict[str, str]], response_model: type[T]) -> T:
    """Ask the model for a reply matching `response_model` and parse it."""
    response = completion(
        model=MODEL,
        messages=messages,
        response_format=response_model,
        reasoning_effort="low",
        extra_body=EXTRA_BODY,
        drop_params=True,
        timeout=60,
    )
    return response_model.model_validate_json(response.choices[0].message.content)
