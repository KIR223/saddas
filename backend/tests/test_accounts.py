import os
import tempfile
import unittest
from unittest.mock import patch
from app.accounts import bootstrap_admin, create_user, verify_password
from app.db import get_conn, init_db

class AccountsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, DATABASE_PATH=self.tmp.name+'/db', BOOTSTRAP_ADMIN_LOGIN='owner', BOOTSTRAP_ADMIN_PASSWORD='test-password-123')
        self.env.start()
        init_db()
    def tearDown(self):
        self.env.stop()
        self.tmp.cleanup()
    def test_bootstrap_is_idempotent_and_password_is_hashed(self):
        bootstrap_admin(); bootstrap_admin()
        with get_conn() as c:
            rows=c.execute('SELECT * FROM users').fetchall()
        self.assertEqual(len(rows),1)
        self.assertNotEqual(rows[0]['password_hash'],'test-password-123')
        self.assertTrue(verify_password('test-password-123', rows[0]['password_hash']))
        self.assertFalse(verify_password('wrong', rows[0]['password_hash']))
    def test_teacher_requires_existing_catalogue_identity(self):
        with self.assertRaises(ValueError):
            create_user('teacher','test-password-123')
        with get_conn() as c:
            c.execute("INSERT INTO teachers VALUES('Иванов И.И.')")
        user=create_user('teacher','test-password-123',teacher_name='Иванов И.И.')
        self.assertNotIn('password_hash',user)
