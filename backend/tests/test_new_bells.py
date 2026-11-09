import sqlite3
import unittest

from app.migrations import apply_migrations
from app.migrations.runner import available_migrations


class NewBellsTest(unittest.TestCase):
    def test_upgrade_existing_database_and_keep_exceptions(self):
        conn = sqlite3.connect(':memory:')
        for version, path in available_migrations():
            if version < 8:
                conn.executescript(path.read_text())
        conn.execute("INSERT INTO bell_short_dates VALUES ('2026-11-10')")
        conn.execute("INSERT INTO bell_short_days VALUES ('2026-11-10',1,'10:00','10:20')")
        conn.commit()
        conn.executescript(next(p for v,p in available_migrations() if v == 8).read_text())
        expected = {
            'regular': [('08:30','09:00'),('09:05','09:35'),('09:40','10:10'),('10:15','10:45'),('10:50','11:20')],
            'monThu': [('08:35','09:05'),('09:10','09:40'),('09:45','10:15'),('10:20','10:50'),('10:55','11:25')],
            'thursday': [('09:05','09:35'),('09:40','10:10'),('10:15','10:45'),('10:50','11:20'),('11:25','11:55')],
        }
        for kind, slots in expected.items():
            rows = conn.execute('SELECT start_time,end_time FROM bell_regular ORDER BY pair') if kind == 'regular' else conn.execute('SELECT start_time,end_time FROM bell_profiles WHERE kind=? ORDER BY pair',(kind,))
            self.assertEqual(rows.fetchall(), slots)
        self.assertEqual(conn.execute('SELECT day,enabled,start_time,end_time FROM curator_slots ORDER BY day').fetchall(), [(1,1,'08:00','08:30'),(4,1,'08:30','09:00')])
        self.assertEqual(conn.execute('SELECT * FROM bell_short_days').fetchall(), [('2026-11-10',1,'10:00','10:20')])
        self.assertTrue(conn.execute("SELECT value FROM meta WHERE key='revision'").fetchone())
        conn.close()

    def test_fresh_database_migration_is_idempotent(self):
        conn = sqlite3.connect(':memory:')
        self.assertIn(8, apply_migrations(conn))
        self.assertEqual(apply_migrations(conn), [])
        self.assertEqual(conn.execute('SELECT count(*) FROM bell_regular').fetchone()[0], 5)
        conn.close()
