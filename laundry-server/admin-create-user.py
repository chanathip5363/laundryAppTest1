import sqlite3
import getpass
import hashlib
import secrets

username = input("Admin username: ").strip()
password = getpass.getpass("New password (12+ characters): ")
confirm = getpass.getpass("Confirm password: ")

if not username:
    raise SystemExit("ERROR: Username required")

if len(password) < 12:
    raise SystemExit("ERROR: Password too short")

if password != confirm:
    raise SystemExit("ERROR: Passwords do not match")

salt = secrets.token_bytes(16)
digest = hashlib.scrypt(
    password.encode(),
    salt=salt,
    n=16384,
    r=8,
    p=1,
    dklen=64
)

stored_hash = f"scrypt:{salt.hex()}:{digest.hex()}"

db = sqlite3.connect("database.db")

try:
    db.execute(
        """INSERT INTO admin_users
           (username, password_hash, role, status)
           VALUES (?, ?, 'ADMIN', 'ACTIVE')""",
        (username, stored_hash)
    )
    db.commit()
    print("SUCCESS: Admin account created")
except sqlite3.IntegrityError:
    print("ERROR: Username already exists")
finally:
    db.close()
