"""Application-wide permissions derived from the authenticated Home Assistant user."""

from .model import ValidationError


def authorize_finance(command, payload, is_admin):
    creating = (
        command == "provider_create_account"
        or command == "restore"
        or (command == "save" and not payload.get("id") and payload.get("kind") != "preferences")
    )
    if creating and not is_admin:
        raise ValidationError("A Home Assistant administrator must create financial records.")
