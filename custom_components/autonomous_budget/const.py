"""Constants for Autonomous Budget."""

DOMAIN = "autonomous_budget"
NAME = "Autonomous Budget"
VERSION = "1.0.2"
STORAGE_VERSION = 1
SIGNAL_CHANGED = f"{DOMAIN}_changed"
PANEL_PATH = "autonomous-budget"
STATIC_PATH = "/autonomous_budget_static"
PERIODS = ("daily", "weekly", "biweekly", "monthly", "yearly")
RECURRENCES = ("once", "daily", "weekly", "biweekly", "monthly", "quarterly", "yearly")
CATEGORIES = ("investment", "mandatory", "optional")
# ISO 4217 minor units. Explicit support prevents silent rounding of unknown currencies.
CURRENCIES = dict.fromkeys(
    "USD CAD EUR GBP CHF AUD NZD CNY HKD SGD INR BRL MXN SEK NOK DKK PLN CZK "
    "HUF ZAR AED SAR ILS THB MYR PHP IDR TRY RON BGN".split(),
    2,
) | {"ISK": 0, "JPY": 0, "KRW": 0, "CLP": 0, "VND": 0, "BHD": 3, "KWD": 3, "OMR": 3}
