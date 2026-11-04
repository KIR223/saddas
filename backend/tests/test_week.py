import unittest
from datetime import date, datetime, timezone
from unittest.mock import patch

from app.week import MOSCOW, current_week, moscow_today, week_bounds


class WeekTest(unittest.TestCase):
    def test_odd_iso_week_is_green(self):
        self.assertEqual(date(2026, 10, 6).isocalendar().week, 41)
        self.assertEqual(current_week(date(2026, 10, 5)), "green")
        self.assertEqual(current_week(date(2026, 10, 6)), "green")
        self.assertEqual(current_week(date(2026, 10, 11)), "green")
        self.assertEqual(current_week(date(2026, 10, 12)), "red")
        self.assertEqual(current_week(date(2026, 9, 28)), "red")

    def test_iso_year_boundary(self):
        self.assertEqual(date(2025, 12, 28).isocalendar().week, 52)
        self.assertEqual(current_week(date(2025, 12, 28)), "red")
        self.assertEqual(date(2025, 12, 29).isocalendar().week, 1)
        self.assertEqual(current_week(date(2025, 12, 29)), "green")
        self.assertEqual(date(2026, 1, 1).isocalendar().week, 1)
        self.assertEqual(current_week(date(2026, 1, 1)), "green")

    def test_bounds_are_monday_to_sunday(self):
        start, end = week_bounds(date(2026, 10, 6))
        self.assertEqual(start, date(2026, 10, 5))
        self.assertEqual(end, date(2026, 10, 11))

    def test_today_uses_moscow_not_utc(self):
        utc = datetime(2026, 10, 11, 21, 30, tzinfo=timezone.utc)
        moscow = utc.astimezone(MOSCOW)
        self.assertEqual(moscow.date(), date(2026, 10, 12))
        self.assertEqual(utc.date(), date(2026, 10, 11))
        with patch("app.week.now_moscow", return_value=moscow):
            self.assertEqual(moscow_today(), date(2026, 10, 12))
            self.assertEqual(date(2026, 10, 12).isocalendar().week, 42)
            self.assertEqual(current_week(), "red")
            self.assertEqual(current_week(utc.date()), "green")


if __name__ == "__main__":
    unittest.main()
