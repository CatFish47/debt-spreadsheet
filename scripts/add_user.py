#!/usr/bin/env python3
"""Create a new user and print their permanent login link.

Usage (inside container):
    python scripts/add_user.py --name "Alice"

Or via make:
    make add-user
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.config import settings
from app.database import SessionLocal
from app.models import group, history, transaction  # noqa: F401 — register all models
from app.models.user import User


def main():
    parser = argparse.ArgumentParser(description="Add a user to the debt app")
    parser.add_argument("--name", required=True, help="Display name for the user")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        user = User(name=args.name)
        db.add(user)
        db.commit()
        db.refresh(user)

        login_url = f"{settings.app_url}/login?key={user.personal_key}"
        print(f"\nCreated user: {user.name}")
        print(f"Login link:   {login_url}")
        print(f"\nSend this link to {user.name}.")
        print("Anyone with this link can log in as this user — keep it private.\n")
    finally:
        db.close()


if __name__ == "__main__":
    main()
