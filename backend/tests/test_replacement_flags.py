import os
import tempfile
import unittest
from unittest.mock import patch
from app.db import get_conn, init_db, resolve_day, upsert_pair_override


class ReplacementFlagsTest(unittest.TestCase):
    def test_only_actual_changed_slot_is_marked(self):
        with tempfile.TemporaryDirectory() as d, patch.dict(os.environ, DATABASE_PATH=d+'/db'):
            init_db()
            with get_conn() as c:
                for pair in [1,2,3]:
                    c.execute('INSERT INTO lessons(group_name,day,pair,week,subject,teacher,room) VALUES(?,?,?,?,?,?,?)',
                              ('G','Понедельник',pair,'green','Физика','Иванов И.И.','307'))
            def day(): return resolve_day('G','Понедельник','green','2026-11-02')
            pairs, custom = day()
            self.assertFalse(custom)
            self.assertTrue(all(not p['replaced'] for p in pairs))
            upsert_pair_override('G','2026-11-02',3,True,'','','')
            pairs, custom = day()
            self.assertTrue(custom)
            self.assertTrue(all(not p['replaced'] for p in pairs))
            upsert_pair_override('G','2026-11-02',1,False,'Физика','Иванов И.И.','307')
            self.assertTrue(all(not p['replaced'] for p in day()[0]))
            upsert_pair_override('G','2026-11-02',2,False,'Химия','Петров П.П.','101')
            pairs, _ = day()
            self.assertEqual([p['pair'] for p in pairs if p['replaced']], [2])
            self.assertEqual(pairs[1]['original']['subject'],'Физика')
            upsert_pair_override('G','2026-11-02',6,False,'Практика','','')
            self.assertEqual([p['pair'] for p in day()[0] if p['replaced']], [2,6])
