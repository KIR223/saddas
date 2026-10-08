import unittest
from datetime import date

from app.week import current_week, week_bounds


class WeekTest(unittest.TestCase):
    def test_odd_iso_week_is_green(self):
        self.assertEqual(date(2026, 10, 6).isocalendar().week, 41)
        self.assertEqual(current_week(date(2026, 10, 5)), "green")
        self.assertEqual(current_week(date(2026, 10, 6)), "green")
        self.assertEqual(current_week(date(2026, 10, 11)), "green")
        self.assertEqual(current_week(date(2026, 10, 12)), "red")
        self.assertEqual(current_week(date(2026, 9, 28)), "red")

    def test_bounds_are_monday_to_sunday(self):
        start, end = week_bounds(date(2026, 10, 6))
        self.assertEqual(start, date(2026, 10, 5))
        self.assertEqual(end, date(2026, 10, 11))


if __name__ == "__main__":
    unittest.main()
