"""Permission checks on the actual registered mutation handler."""

from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from homeassistant.exceptions import Unauthorized

from custom_components.autonomous_budget.websocket import websocket_mutate


@pytest.mark.parametrize("user", [None, SimpleNamespace(is_admin=False)])
def test_non_admin_cannot_modify_budgets(user):
    connection = SimpleNamespace(user=user)
    hass = Mock()
    with pytest.raises(Unauthorized):
        websocket_mutate(
            hass, connection, {"id": 1, "action": "budget_delete", "payload": {"budget_id": "x"}, "revision": 0}
        )
    hass.async_create_background_task.assert_not_called()
