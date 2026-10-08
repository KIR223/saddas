import io
import os
import tempfile
import unittest

from fastapi.testclient import TestClient
from openpyxl import Workbook
from openpyxl.styles import PatternFill

from app.main import app


def build_upload() -> bytes:
    book = Workbook()
    sheet = book.active
    sheet.title = "261-266"
    sheet["A1"] = "Расписание занятий на 1 семестр 2026-2027"
    sheet["C2"] = "ТМ-261"
    sheet["A3"] = "Понедельник"
    sheet.merge_cells("A3:A4")
    sheet["B3"] = 1
    sheet.merge_cells("B3:B4")
    sheet["C4"] = "Физика\nКурницкая Т.С."
    sheet["C4"].fill = PatternFill(start_color="C6E0B4", end_color="C6E0B4", fill_type="solid")
    sheet["D4"] = 307
    buffer = io.BytesIO()
    book.save(buffer)
    return buffer.getvalue()


class ApiTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["DATABASE_PATH"] = os.path.join(self.tmp.name, "schedule.db")
        os.environ["ADMIN_TOKEN"] = "secret"
        self.client = TestClient(app)

    def tearDown(self):
        self.tmp.cleanup()

    def test_upload_and_schedule(self):
        info = self.client.get("/api/info")
        self.assertEqual(info.status_code, 200)
        payload = info.json()
        self.assertIn(payload["week"], ("green", "red"))
        self.assertEqual(payload["title"], "")
        self.assertIsNone(payload["uploaded_at"])

        self.assertEqual(self.client.get("/api/groups").json(), {"groups": []})

        denied = self.client.post(
            "/api/admin/upload",
            files={"file": ("schedule.xlsx", build_upload(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        self.assertEqual(denied.status_code, 401)

        uploaded = self.client.post(
            "/api/admin/upload",
            headers={"X-Admin-Token": "secret"},
            files={"file": ("schedule.xlsx", build_upload(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        self.assertEqual(uploaded.status_code, 200, uploaded.text)
        body = uploaded.json()
        self.assertEqual(body["groups"], 1)
        self.assertEqual(body["lessons"], 1)
        self.assertEqual(body["warnings"], [])

        groups = self.client.get("/api/groups").json()["groups"]
        self.assertEqual(groups, ["ТМ-261"])

        schedule = self.client.get("/api/schedule", params={"group": "ТМ-261", "week": "green"})
        self.assertEqual(schedule.status_code, 200)
        day = schedule.json()["days"][0]
        self.assertEqual(day["day"], "Понедельник")
        self.assertEqual(day["pairs"][0]["subject"], "Физика")
        self.assertEqual(day["pairs"][0]["teacher"], "Курницкая Т.С.")
        self.assertEqual(day["pairs"][0]["room"], "307")

        red = self.client.get("/api/schedule", params={"group": "ТМ-261", "week": "red"})
        self.assertEqual(red.status_code, 200)
        self.assertEqual(red.json()["days"], [])

        missing = self.client.get("/api/schedule", params={"group": "НЕТ-000", "week": "green"})
        self.assertEqual(missing.status_code, 404)

        bad_week = self.client.get("/api/schedule", params={"group": "ТМ-261", "week": "blue"})
        self.assertEqual(bad_week.status_code, 400)

        info_after = self.client.get("/api/info").json()
        self.assertIn("Расписание занятий", info_after["title"])
        self.assertIsNotNone(info_after["uploaded_at"])


if __name__ == "__main__":
    unittest.main()
