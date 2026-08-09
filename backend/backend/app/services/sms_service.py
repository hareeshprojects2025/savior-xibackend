import asyncio
import logging
import re

from app.core.config import TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

logger = logging.getLogger("savior.sms")

LOCATION_SMS_TEMPLATE = (
    "SAVIOR Alert: Please share your location for emergency response.\n"
    "Click: {location_url}\n"
    "Link expires in 5 minutes."
)


def _normalize_phone(phone: str) -> str | None:
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 10:
        return f"+91{digits}"
    if len(digits) > 10 and not digits.startswith("1"):
        return f"+{digits}"
    if digits.startswith("1") and len(digits) == 11:
        return f"+{digits}"
    logger.warning("Unable to normalize phone number: %s", phone)
    return None


async def send_sms(phone: str, message: str) -> bool:
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN or not TWILIO_PHONE_NUMBER:
        logger.warning("Twilio credentials not set — SMS not sent to %s", phone)
        return False

    to_phone = _normalize_phone(phone)
    if to_phone is None:
        return False

    try:
        from twilio.rest import Client

        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

        msg = await asyncio.to_thread(
            client.messages.create,
            body=message,
            from_=TWILIO_PHONE_NUMBER,
            to=to_phone,
        )
        logger.info("SMS sent to %s: sid=%s", to_phone, msg.sid)
        return True
    except Exception as e:
        logger.error("Twilio SMS failed for %s: %s", to_phone, e)
        return False


def build_location_sms(phone: str, emergency_id: int, base_url: str) -> tuple[str, str]:
    location_url = f"{base_url}/api/location/{emergency_id}"
    message = LOCATION_SMS_TEMPLATE.format(location_url=location_url)
    return phone, message
