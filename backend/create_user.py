"""CLI for adding an invited user account — there is no public signup
page, so this is how David (or a future admin) creates an account for
someone before handing them their email + a starting password.

Usage (run from backend/, inside the venv, with DATABASE_URL pointed at
whichever database you want to add the user to — same as running the
app itself):

    python create_user.py --email zuzu@example.com --name "Zuzu" --password "some-temp-password"
    python create_user.py --email helper@example.com --name "Helper" --password "..." --admin

The person should change their password after first login once that
flow exists; for now, re-run this script with the same email to reset
one (it updates in place rather than failing on a duplicate).
"""

import argparse
import getpass
import sys

from dotenv import load_dotenv
load_dotenv()

from database import SessionLocal
from models import init_db, User
from services.auth import hash_password


def main():
    parser = argparse.ArgumentParser(description="Create or update an invited user account.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--password", help="If omitted, you'll be prompted (not echoed to the terminal).")
    parser.add_argument("--admin", action="store_true", help="Grant admin privileges.")
    args = parser.parse_args()

    password = args.password or getpass.getpass("Password: ")
    if not password:
        print("A password is required.", file=sys.stderr)
        sys.exit(1)

    init_db()  # harmless no-op if tables already exist — same as the app's own startup

    db = SessionLocal()
    try:
        email = args.email.strip().lower()
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.password_hash = hash_password(password)
            user.name = args.name.strip()
            user.is_admin = args.admin
            db.commit()
            print(f"Updated existing user: {email} (id={user.id}, admin={user.is_admin})")
        else:
            user = User(
                email=email,
                name=args.name.strip(),
                password_hash=hash_password(password),
                is_admin=args.admin,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"Created user: {email} (id={user.id}, admin={user.is_admin})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
