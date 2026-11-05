"""Plain-code checks on values the model proposed.

The model's word is not enough: these checks catch values that cannot be right
(a date that does not exist, a choice the form does not offer, an IBAN whose
checksum fails) and turn them into issues the user sees before filling.
"""

import re
from datetime import date

from forms_pilot.extraction.schema import ExtractedValue, FormField, ModelValue

_TRUE_WORDS = {"true", "yes", "y", "1", "on", "checked", "x"}
_FALSE_WORDS = {"false", "no", "n", "0", "off", "unchecked"}
_PLAIN_NUMBER = re.compile(r"^-?\d+(\.\d+)?$")
_GROUPED_NUMBER = re.compile(r"^-?\d{1,3}(,\d{3})+(\.\d+)?$")
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_IBAN = re.compile(r"^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$")


def check_values(fields: list[FormField], answer: list[ModelValue]) -> list[ExtractedValue]:
    """One checked value per requested field, in the form's order. Unknown ids are dropped."""
    proposed = {item.field_id: item for item in answer}
    return [_check(field, proposed.get(field.id)) for field in fields]


def _check(field: FormField, proposed: ModelValue | None) -> ExtractedValue:
    found = proposed is not None and proposed.status != "missing" and proposed.value.strip() != ""
    value = proposed.value.strip() if proposed and found else ""
    status = proposed.status if proposed and found else "missing"
    issues: list[str] = []

    if value:
        value, problem = _normalize(field, value)
        if problem:
            issues.append(problem)
    elif field.required:
        issues.append("Required, but not found in the images.")

    if status == "ambiguous":
        issues.append("The images show more than one possible value.")

    return ExtractedValue(
        field_id=field.id,
        value=value,
        status=status,
        evidence=proposed.evidence if proposed and value else None,
        image_index=proposed.image_index if proposed and value else None,
        issues=issues,
    )


def _normalize(field: FormField, value: str) -> tuple[str, str | None]:
    """The value in the form the field takes, and a problem if it cannot be right."""
    match field.kind:
        case "select" | "radio":
            choice = next((o for o in field.options if o.casefold() == value.casefold()), None)
            if choice is None:
                return value, f"Not one of the choices: {', '.join(field.options)}."
            return choice, None
        case "checkbox":
            word = value.casefold()
            if word in _TRUE_WORDS:
                return "yes", None
            if word in _FALSE_WORDS:
                return "no", None
            return value, "Not a yes or no answer."
        case "date":
            try:
                if len(value) != 10:
                    raise ValueError
                date.fromisoformat(value)
            except ValueError:
                return value, "Not a date in YYYY-MM-DD format."
            return value, None
        case "number":
            compact = re.sub(r"\s", "", value)
            if _GROUPED_NUMBER.match(compact):
                compact = compact.replace(",", "")
            if not _PLAIN_NUMBER.match(compact):
                return value, "Not a number."
            return compact, None
        case "email":
            return value, None if _EMAIL.match(value) else "Not an email address."
        case _:
            if _looks_like_iban(field):
                return _check_iban(value)
            return value, None


def _looks_like_iban(field: FormField) -> bool:
    return "iban" in field.id.casefold() or "iban" in field.label.casefold()


def _check_iban(value: str) -> tuple[str, str | None]:
    compact = re.sub(r"\s", "", value).upper()
    if not _IBAN.match(compact):
        return compact, "Not an IBAN."
    rearranged = compact[4:] + compact[:4]
    digits = "".join(str(int(char, 36)) for char in rearranged)
    if int(digits) % 97 != 1:
        return compact, "The IBAN checksum does not match. A character was probably misread."
    return compact, None
