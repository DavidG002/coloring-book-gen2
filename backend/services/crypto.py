"""Encrypts/decrypts secrets stored at rest in the database (currently just
AppCredential.openai_api_key — see roadmap task 5). Uses Fernet (symmetric,
authenticated encryption) from the `cryptography` package.

Requires CREDENTIAL_ENCRYPTION_KEY in the environment (backend/.env) — a
Fernet key, i.e. 32 url-safe base64-encoded bytes. Generate one with:

    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

Losing this key makes every already-encrypted secret in the database
permanently unreadable — back it up the same way you'd back up a
database password, and never commit it to git.
"""

import os
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken


@lru_cache(maxsize=1)
def _get_fernet() -> Fernet:
    key = os.environ.get("CREDENTIAL_ENCRYPTION_KEY")
    if not key:
        raise RuntimeError(
            "CREDENTIAL_ENCRYPTION_KEY is not set. Add it to backend/.env — "
            'generate one with: python -c "from cryptography.fernet import '
            'Fernet; print(Fernet.generate_key().decode())"'
        )
    return Fernet(key.encode("utf-8"))


def encrypt_secret(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_secret(ciphertext: str) -> str:
    try:
        return _get_fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        raise ValueError(
            "Stored credential could not be decrypted — it may have been "
            "encrypted with a different CREDENTIAL_ENCRYPTION_KEY, or it "
            "predates encryption and needs to be re-entered in Settings."
        )
