import pytest

from forms_pilot.extraction.checks import check_values
from forms_pilot.extraction.schema import FieldKind, FormField, ModelValue


def field(id: str, kind: FieldKind = "text", **extra: object) -> FormField:
    return FormField.model_validate({"id": id, "label": id, "kind": kind, **extra})


def found(id: str, value: str, status: str = "found") -> ModelValue:
    return ModelValue.model_validate(
        {"field_id": id, "status": status, "value": value, "evidence": value, "image_index": 0}
    )


def check_one(form_field: FormField, value: str) -> tuple[str, list[str]]:
    [result] = check_values([form_field], [found(form_field.id, value)])
    return result.value, result.issues


def test_returns_one_value_per_field_in_form_order_and_drops_unknown_ids() -> None:
    fields = [field("b"), field("a")]

    results = check_values(fields, [found("a", "1"), found("zzz", "x")])

    assert [(r.field_id, r.value, r.status) for r in results] == [
        ("b", "", "missing"),
        ("a", "1", "found"),
    ]


def test_missing_required_value_is_an_issue() -> None:
    [result] = check_values([field("name", required=True)], [])

    assert result.status == "missing"
    assert result.issues == ["Required, but not found in the images."]


def test_a_value_the_model_marked_missing_is_dropped() -> None:
    [result] = check_values([field("name")], [found("name", "guess", status="missing")])

    assert (result.value, result.status, result.evidence) == ("", "missing", None)


def test_ambiguous_value_is_kept_but_flagged() -> None:
    [result] = check_values([field("name")], [found("name", "Acme", status="ambiguous")])

    assert result.value == "Acme"
    assert result.issues == ["The images show more than one possible value."]


def test_choices_normalize_to_the_option_the_form_offers() -> None:
    currency = field("currency", "select", options=["Euro", "US dollar"])

    assert check_one(currency, "euro") == ("Euro", [])
    assert check_one(currency, "Bitcoin")[1] == ["Not one of the choices: Euro, US dollar."]


@pytest.mark.parametrize(
    ("value", "expected"),
    [("2026-10-28", []), ("2026-02-30", ["Not a date in YYYY-MM-DD format."])],
)
def test_dates_must_exist_in_iso_format(value: str, expected: list[str]) -> None:
    assert check_one(field("d", "date"), value)[1] == expected


def test_day_first_dates_are_not_silently_reordered() -> None:
    assert check_one(field("d", "date"), "03/04/2026") == (
        "03/04/2026",
        ["Not a date in YYYY-MM-DD format."],
    )


@pytest.mark.parametrize(
    ("value", "expected"),
    [("12500.00", "12500.00"), ("12,500.00", "12500.00"), ("1 250", "1250")],
)
def test_numbers_lose_grouping(value: str, expected: str) -> None:
    assert check_one(field("n", "number"), value) == (expected, [])


def test_decimal_comma_is_flagged_rather_than_guessed() -> None:
    assert check_one(field("n", "number"), "12,5")[1] == ["Not a number."]


def test_checkbox_answers_become_yes_or_no() -> None:
    assert check_one(field("c", "checkbox"), "X") == ("yes", [])
    assert check_one(field("c", "checkbox"), "perhaps")[1] == ["Not a yes or no answer."]


def test_iban_checksum_catches_a_misread_character() -> None:
    iban = field("iban")

    assert check_one(iban, "NL91 ABNA 0417 1643 00") == ("NL91ABNA0417164300", [])
    assert check_one(iban, "NL91ABNA0417164800")[1] == [
        "The IBAN checksum does not match. A character was probably misread."
    ]
