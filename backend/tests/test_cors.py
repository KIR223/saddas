"""Exercise the real deployed frontend/API origin boundary, including cookies."""
import os
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from app.main import app
from app.perimeter import origins

SITE = 'https://melmksch.fvds.ru'


class DeploymentCorsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, DATABASE_PATH=self.tmp.name + '/db')
        self.env.start()
        self.client = TestClient(app)

    def tearDown(self):
        self.env.stop()
        self.tmp.cleanup()

    def test_deployed_site_can_read_public_api_with_credentials(self):
        for path in ['/api/info', '/api/groups', '/api/bells/config']:
            response = self.client.get(path, headers={'Origin': SITE})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers.get('access-control-allow-origin'), SITE)
            self.assertEqual(response.headers.get('access-control-allow-credentials'), 'true')
            self.assertIn('Origin', response.headers.get('vary', ''))

    def test_deployed_site_preflight_allows_session_login(self):
        response = self.client.options('/api/auth/login', headers={
            'Origin': SITE,
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get('access-control-allow-origin'), SITE)
        self.assertEqual(response.headers.get('access-control-allow-credentials'), 'true')

    def test_foreign_site_still_cannot_read_or_mutate(self):
        response = self.client.get('/api/groups', headers={'Origin': 'https://evil.example'})
        self.assertNotIn('access-control-allow-origin', response.headers)
        response = self.client.post('/api/auth/logout', headers={'Origin': 'https://evil.example'})
        self.assertEqual(response.status_code, 403)

    def test_explicit_environment_allowlist_is_respected(self):
        with patch.dict(os.environ, ALLOWED_ORIGINS='https://custom.example'):
            self.assertEqual(origins(), ['https://custom.example'])
