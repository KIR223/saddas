import os,tempfile,unittest,sqlite3
from types import SimpleNamespace
from unittest.mock import patch
from app.db import get_conn,init_db,replace_schedule,upsert_pair_override
class ImportPolicyTest(unittest.TestCase):
 def test_policy_and_template_rollback_together(self):
  with tempfile.TemporaryDirectory() as d,patch.dict(os.environ,DATABASE_PATH=d+'/db'):
   init_db();upsert_pair_override('ТМ-1','2099-01-01',1,True,'','','')
   broken=SimpleNamespace(group_name='ТМ-1',day='Понедельник',pair=1,week='green',subject=None,teacher='',room='')
   with self.assertRaises(sqlite3.IntegrityError): replace_schedule([broken],'x.xlsx','x','replace','all')
   with get_conn() as c: self.assertEqual(c.execute('SELECT count(*) FROM lesson_overrides').fetchone()[0],1)
   diff=replace_schedule([],'x.xlsx','x','replace','all')
   self.assertEqual(diff['overrides_removed'],1)
