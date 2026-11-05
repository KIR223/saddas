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
    def test_admin_creates_teacher_disables_and_resets_password(self):
        self.client.post('/api/auth/login',json={'login':'owner','password':'test-password-123'})
        with get_conn() as c: c.execute("INSERT INTO teachers VALUES('Иванов И.И.')")
        r=self.client.post('/api/admin/users',json={'login':'teacher','password':'teacher-pass-123','teacher_name':'Иванов И.И.'})
        self.assertEqual(r.status_code,201,r.text)
        uid=r.json()['id']
        self.assertNotIn('password_hash',str(self.client.get('/api/admin/users').json()))
        self.assertEqual(self.client.patch('/api/admin/users/1',json={'status':'disabled'}).status_code,400)
        self.client.post('/api/auth/logout')
        self.assertEqual(self.client.post('/api/auth/login',json={'login':'teacher','password':'teacher-pass-123'}).status_code,200)
        self.assertEqual(self.client.get('/api/admin/users').status_code,403)
        self.client.post('/api/auth/logout')
        self.client.post('/api/auth/login',json={'login':'owner','password':'test-password-123'})
        self.assertEqual(self.client.patch(f'/api/admin/users/{uid}',json={'status':'disabled'}).status_code,200)
        self.client.post('/api/auth/logout')
        self.assertEqual(self.client.post('/api/auth/login',json={'login':'teacher','password':'teacher-pass-123'}).status_code,401)
    def test_teacher_sees_only_own_resolved_pairs(self):
        from app.accounts import create_user
        from app.db import upsert_pair_override
        with get_conn() as c:
            c.execute("INSERT INTO teachers VALUES('Иванов И.И.')")
            c.execute("INSERT INTO lessons(group_name,day,pair,week,subject,teacher,room) VALUES('ТМ-1','Понедельник',1,'green','Физика','Иванов И.И.','1')")
        with get_conn() as c: c.execute("INSERT OR IGNORE INTO groups(code) VALUES('ТМ-1')")
        create_user('teacher','teacher-pass-123',teacher_name='Иванов И.И.')
        self.client.post('/api/auth/login',json={'login':'teacher','password':'teacher-pass-123'})
        upsert_pair_override('ТМ-1','2026-11-02',2,False,'Математика','Иванов И.И.','2')
        r=self.client.get('/api/teacher/schedule?date=2026-11-02')
        self.assertEqual(r.status_code,200,r.text)
        self.assertIn(2,[p['pair'] for p in r.json()['days'][0]['pairs']])
        upsert_pair_override('ТМ-1','2026-11-02',2,False,'Математика','Петров П.П.','2')
        self.assertNotIn(2,[p['pair'] for p in self.client.get('/api/teacher/schedule?date=2026-11-02').json()['days'][0]['pairs']])
        self.assertEqual(self.client.put('/api/admin/bells',json={'pairs':[]}).status_code,403)
    def test_foreign_origin_rejected_and_production_defaults_fail(self):
        r=self.client.post('/api/auth/login',headers={'Origin':'https://evil.example'},json={'login':'owner','password':'test-password-123'})
        self.assertEqual(r.status_code,403)
        from app.perimeter import validate_environment
        with patch.dict(os.environ,APP_ENV='production',ALLOWED_ORIGINS='https://college.example',ADMIN_TOKEN='dev',COOKIE_SECURE='true'):
            with self.assertRaises(RuntimeError): validate_environment()
    def test_audit_survives_new_session_without_passwords(self):
        self.client.post('/api/auth/login',json={'login':'owner','password':'test-password-123'})
        r=self.client.post('/api/admin/users',json={'login':'second','password':'another-pass-123','role':'admin'})
        self.assertEqual(r.status_code,201)
        events=self.client.get('/api/admin/audit').json()['events']
        self.assertTrue(any(e['entity'].startswith('/api/admin/users') and e['actor_login']=='owner' for e in events))
        self.assertNotIn('another-pass-123',str(events))
    def test_empty_group_is_public_and_archive_hides_it(self):
        self.client.post('/api/auth/login',json={'login':'owner','password':'test-password-123'})
        self.assertEqual(self.client.post('/api/admin/groups',json={'code':'ТМ-999'}).status_code,201)
        self.assertIn('ТМ-999',self.client.get('/api/groups').json()['groups'])
        self.assertEqual(self.client.get('/api/schedule/day?group=ТМ-999&date=2026-11-02').json()['pairs'],[])
        self.client.patch('/api/admin/groups/ТМ-999',json={'active':False})
        self.assertNotIn('ТМ-999',self.client.get('/api/groups').json()['groups'])
    def test_manual_template_visible_and_separate_from_overrides(self):
        self.client.post('/api/auth/login',json={'login':'owner','password':'test-password-123'})
        self.client.post('/api/admin/groups',json={'code':'ТМ-999'})
        week=self.client.get('/api/info').json()['week']
        q=f'/api/admin/template?group=ТМ-999&day=1&week={week}'
        r=self.client.put(q,json={'pairs':[{'pair':1,'subject':'Физика','teacher':'Иванов И.И.','room':'307'}]})
        self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(self.client.get('/api/schedule?group=ТМ-999&week='+week).json()['days'][0]['pairs'][0]['subject'],'Физика')
        with get_conn() as c: self.assertEqual(c.execute('SELECT count(*) FROM lesson_overrides').fetchone()[0],0)
        self.assertTrue(self.client.get('/api/info').json()['revision'])
    def test_bell_profiles_exception_and_curator(self):
        self.client.post('/api/auth/login',json={'login':'owner','password':'test-password-123'})
        cfg=self.client.get('/api/admin/bell-config').json()
        self.assertEqual(self.client.get('/api/bells?date=2026-11-02').json()['curator']['day'],1)
        cfg['exceptions']['2026-11-02']=[{'pair':1,'start':'10:00','end':'10:40'}]
        self.assertEqual(self.client.put('/api/admin/bell-config',json=cfg).status_code,200)
        out=self.client.get('/api/bells?date=2026-11-02').json()
        self.assertEqual(out['pairs'][0]['start'],'10:00');self.assertIsNone(out['curator'])
        cfg['regular']=[{'pair':1,'start':'10:00','end':'11:00'},{'pair':2,'start':'10:30','end':'11:30'}]
        self.assertEqual(self.client.put('/api/admin/bell-config',json=cfg).status_code,400)
