"""Azure OpenAI wrapper for structured analysis calls (gpt-5-mini)."""
from __future__ import annotations

import json
from functools import lru_cache

from openai import AzureOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import get_settings


@lru_cache(maxsize=1)
def _client() -> AzureOpenAI:
    s = get_settings()
    return AzureOpenAI(
        api_key=s.AZURE_OPENAI_API_KEY,
        azure_endpoint=s.AZURE_OPENAI_ENDPOINT,
        api_version=s.AZURE_OPENAI_API_VERSION,
    )


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=20))
def complete_json(system_prompt: str, user_prompt: str, json_schema: dict) -> dict:
    s = get_settings()
    resp = _client().chat.completions.create(
        model=s.GPT_DEPLOYMENT,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_schema", "json_schema": json_schema},
        max_completion_tokens=4000,
    )
    return json.loads(resp.choices[0].message.content)
