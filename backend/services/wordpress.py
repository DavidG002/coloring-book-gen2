import httpx


def mask_key(key: str) -> str:
    if not key or len(key) < 8:
        return "****"
    return f"{key[:6]}...{key[-4:]}"


def test_wordpress_connection(site_url: str, username: str, app_password: str) -> tuple[bool, str]:
    """Verifies credentials by hitting WP's own /users/me endpoint —
    the standard, cheap way to confirm Application Password auth works
    before ever attempting a real publish."""
    if not site_url or not username or not app_password:
        return False, "Site URL, username, and Application Password are all required."

    url = site_url.rstrip("/") + "/wp-json/wp/v2/users/me"

    try:
        response = httpx.get(url, auth=(username, app_password), timeout=10.0)
    except httpx.RequestError as e:
        return False, f"Could not reach site: {e}"

    if response.status_code == 200:
        data = response.json()
        name = data.get("name", username)
        return True, f"Connected successfully as {name}."
    elif response.status_code == 401:
        return False, "Authentication failed — check username and Application Password."
    else:
        return False, f"Unexpected response ({response.status_code}) from site."