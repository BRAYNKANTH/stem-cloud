# -*- coding: utf-8 -*-
"""Create or reset an admin account for STEM Cloud.

Usage:
    python tools/manage_admin.py list
    python tools/manage_admin.py create <username> <password> [display_name]
"""
import os, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'api'))

from index import db, hash_pw, USER_RE


def list_users():
    with db() as con:
        rows = con.execute('SELECT id, username, display_name, role, created_at, last_seen FROM users').fetchall()
        if not rows:
            print("No users found in database.")
            return
        print(f"{'ID':<4} {'USERNAME':<16} {'ROLE':<10} {'NAME':<20}")
        print("-" * 55)
        for r in rows:
            print(f"{r['id']:<4} @{r['username']:<15} {r['role']:<10} {r['display_name']:<20}")


def create_or_reset_admin(username, password, display_name='Admin'):
    username = username.strip().lower()
    if not USER_RE.match(username):
        sys.exit("Error: Username must be 3-20 letters, numbers, or underscore.")
    if len(password) < 8:
        sys.exit("Error: Password must be at least 8 characters.")
    pwh = hash_pw(password)
    now = int(time.time())
    with db() as con:
        row = con.execute('SELECT id FROM users WHERE username=?', (username,)).fetchone()
        if row:
            con.execute("UPDATE users SET pw=?, role='admin', display_name=? WHERE id=?", (pwh, display_name, row['id']))
            print(f"[OK] User @{username} updated to ADMIN with new password.")
        else:
            con.execute("INSERT INTO users(username, display_name, pw, role, created_at, last_seen) VALUES(?,?,?,?,?,?)",
                        (username, display_name, pwh, 'admin', now, now))
            print(f"[OK] New ADMIN account created: @{username}")
        print("Credentials:")
        print(f"  Username: {username}")
        print(f"  Password: {password}")
        print(f"  Role:     admin")
        print("  Login at: /login (then go to /admin)")


if __name__ == '__main__':
    args = sys.argv[1:]
    cmd = args[0] if args else 'list'
    if cmd == 'list':
        list_users()
    elif cmd in ('create', 'set'):
        if len(args) < 3:
            sys.exit("Usage: python tools/manage_admin.py create <username> <password> [display_name]   (there is no default password)")
        u, p = args[1], args[2]
        d = args[3] if len(args) > 3 else 'Site Admin'
        create_or_reset_admin(u, p, d)
    else:
        print("Usage: python tools/manage_admin.py [list|create] <username> <password> [display_name]")
