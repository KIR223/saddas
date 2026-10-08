"""Уникальные кабинеты и преподаватели из текста занятий."""

import re
from collections.abc import Iterable

_SURNAME = r"[А-ЯЁA-Z][а-яёa-z]+(?:-[А-ЯЁA-Z][а-яёa-z]+)?"
_INITIAL = r"[А-ЯЁA-Z](?![а-яёa-z])\s*\.*"
_PERSON = re.compile(rf"{_SURNAME}(?:\s+{_INITIAL}(?:\s*{_INITIAL}){{0,2}})?")


def room_names(values: Iterable[str]) -> list[str]:
    found: dict[str, str] = {}
    for value in values:
        for part in re.split(r"[,;\n]+", value):
            name = part.strip()
            if not name:
                continue
            key = name.casefold()
            found.setdefault(key, name)
    return sorted(found.values(), key=str.casefold)


def teacher_names(values: Iterable[str]) -> list[str]:
    found: dict[str, str] = {}
    for value in values:
        for name in split_teachers(value):
            found.setdefault(name.casefold(), name)
    return sorted(found.values(), key=str.casefold)


def split_teachers(value: str) -> list[str]:
    names: list[str] = []
    for match in _PERSON.finditer(value or ""):
        name = canonicalize_teacher(match.group(0))
        if name:
            names.append(name)
    return names


def canonicalize_teacher(value: str) -> str:
    text = " ".join(value.split())
    text = re.sub(r"\s*\.+\s*", ".", text).strip(".")
    if not text:
        return ""
    surname, _, rest = text.partition(" ")
    letters = [char.upper() for char in rest if char.isalpha()]
    if not letters:
        return surname
    return f"{surname} {'.'.join(letters)}."
