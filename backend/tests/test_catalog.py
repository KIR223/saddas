import unittest

from app.catalog import room_names, teacher_names


class CatalogTest(unittest.TestCase):
    def test_teachers_drop_extra_dots_and_spaces(self):
        names = teacher_names(
            [
                "Проценко Н.В Леонов А.С",
                "Башилова Ю.А",
                "Башилова Ю.А.",
                "Башилова  Ю.А..",
                "Иванов  И.  И.",
                "Иванов И.И..",
                "Кидалова О.В Цветкова А.В.",
            ]
        )
        self.assertEqual(
            names,
            [
                "Башилова Ю.А.",
                "Иванов И.И.",
                "Кидалова О.В.",
                "Леонов А.С.",
                "Проценко Н.В.",
                "Цветкова А.В.",
            ],
        )

    def test_rooms_split_and_ignore_case(self):
        names = room_names(["502, 204", " 307 ", "С/З", "с/з", "204"])
        self.assertEqual(names, ["204", "307", "502", "С/З"])


if __name__ == "__main__":
    unittest.main()