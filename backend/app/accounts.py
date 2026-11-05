"""Server-owned accounts. Passwords and session secrets never leave this module."""
import hashlib
import os
import secrets
import sqlite3

from app.db import get_conn


def hash_password(password: str) -> str:
    if not 12 <= len(password) <= 256:
        raise ValueError('пароль должен содержать от 12 до 256 символов')
    salt = secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return f'scrypt${salt}${digest}'


def verify_password(password: str, encoded: str) -> bool:
    try:
        scheme, salt, expected = encoded.split('$')
        if scheme != 'scrypt' or len(password) > 256:
            return False
        got = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
        return secrets.compare_digest(got, expected)
    except (ValueError, TypeError):
        return False


def public_user(row) -> dict:
    return {key: row[key] for key in ('id', 'login', 'role', 'status', 'teacher_name')}


def create_user(login, password, role='teacher', teacher_name=None):
    login = login.strip().casefold()
    if not login or len(login) > 80 or role not in ('admin', 'teacher'):
        raise ValueError('некорректный логин или роль')
    encoded = hash_password(password)
    with get_conn() as conn:
        if teacher_name and not conn.execute('SELECT 1 FROM teachers WHERE name=?', (teacher_name,)).fetchone():
            raise ValueError('преподаватель отсутствует в справочнике')
        if role == 'teacher' and not teacher_name:
            raise ValueError('нужна привязка преподавателя')
        row = conn.execute('INSERT INTO users(login,password_hash,role,teacher_name) VALUES(?,?,?,?) RETURNING *',
                           (login, encoded, role, teacher_name)).fetchone()
        from app.audit import context
        actor=context.get()
        if actor: context.set((*actor[:3],actor[3]+f"#user={row['id']}:{row['login']}"))
        return public_user(row)


def bootstrap_admin():
    with get_conn() as conn:
        conn.execute('BEGIN IMMEDIATE')
        if conn.execute('SELECT 1 FROM users LIMIT 1').fetchone():
            return
        login, password = os.getenv('BOOTSTRAP_ADMIN_LOGIN'), os.getenv('BOOTSTRAP_ADMIN_PASSWORD')
        if not login or not password:
            return  # No implicit development account. Mutations remain closed.
        conn.execute('INSERT INTO users(login,password_hash,role) VALUES(?,?,?)',
                     (login.strip().casefold(), hash_password(password), 'admin'))
