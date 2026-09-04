"""UI setup for Autonomous Budget."""

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.helpers import selector
from homeassistant.util import dt as dt_util

from .const import CURRENCIES, DOMAIN, NAME, PERIODS
from .model import ValidationError, validate_settings


class AutonomousBudgetConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Configure one household; manage multiple budgets inside the sidebar."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Set the default currency and payday schedule."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        errors = {}
        if user_input is not None:
            try:
                data = validate_settings(
                    user_input
                    | {
                        "period": user_input.get("period") or "biweekly",
                        "anchor": user_input.get("anchor") or dt_util.now().date().isoformat(),
                    }
                )
            except ValidationError:
                errors["base"] = "invalid_settings"
            else:
                return self.async_create_entry(
                    title=NAME, data=data | {"start_view": user_input.get("start_view", "budgets")}
                )
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required("currency", default="CAD"): selector.SelectSelector(
                        selector.SelectSelectorConfig(
                            options=sorted(CURRENCIES), mode=selector.SelectSelectorMode.DROPDOWN
                        )
                    ),
                    vol.Optional("period", default="biweekly"): selector.SelectSelector(
                        selector.SelectSelectorConfig(options=list(PERIODS), translation_key="period")
                    ),
                    vol.Optional("anchor"): selector.DateSelector(),
                    vol.Optional("start_view", default="budgets"): selector.SelectSelector(
                        selector.SelectSelectorConfig(options=["budgets", "accounts"], translation_key="start_view")
                    ),
                }
            ),
            errors=errors,
        )
