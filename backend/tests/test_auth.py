import os
import tempfile
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.db import get_conn

class AuthTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.env=patch.dict(os.environ, DATABASE_PATH=self.tmp.name+'/db', BOOTSTRAP_ADMIN_LOGIN='owner', BOOTSTRAP_ADMIN_PASSWORD='test-password-123', COOKIE_SECURE='false')
        self.env.start()
        self.client=TestClient(app)
        self.client.__enter__()
    def tearDown(self):
        self.client.__exit__(None,None,None);self.env.stop();self.tmp.cleanup()
    def test_session_logout_and_disabled_user(self):
        self.assertEqual(self.client.get('/api/auth/me').status_code,401)
        self.assertEqual(self.client.post('/api/auth/login',json={'login':'owner','password':'wrong'}).status_code,401)
        r=self.client.post('/api/auth/login',json={'login':'owner','password':'test-password-123'})
        self.assertEqual(r.status_code,200)
        self.assertIn('HttpOnly',r.headers['set-cookie'])
        self.assertNotIn('password_hash',r.json())
        self.assertEqual(self.client.get('/api/auth/me').json()['role'],'admin')
        with get_conn() as c: c.execute("UPDATE users SET status='disabled'")
        self.assertEqual(self.client.get('/api/auth/me').status_code,401)
        self.client.post('/api/auth/logout')
        self.assertEqual(self.client.get('/api/auth/me').status_code,401)
    def test_lock_and_legacy_token_rejected(self):
        for _ in range(5): self.client.post('/api/auth/login',json={'login':'owner','password':'bad'})
        self.assertEqual(self.client.post('/api/auth/login',json={'login':'owner','password':'test-password-123'}).status_code,429)
        self.assertEqual(self.client.put('/api/admin/bells',headers={'X-Admin-Token':'dev'},json={'pairs':[]}).status_code,401)
