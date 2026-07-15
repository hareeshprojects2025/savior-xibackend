import logging

import httpx

from app.core.config import FAST2SMS_API_KEY

FAST2SMS_URL = "https://www.fast2sms.com/dev/bulkV2"

logger = logging.getLogger("savior.sms")

LOCATION_SMS_TEMPLATE = (
    "SAVIOR Alert: Please share your location for emergency response.\n"
    "Click: {location_url}\n"
    "Link expires in 5 minutes."
)


async def send_sms(phone: str, message: str) -> bool:
    """Send SMS to a single phone number via Fast2SMS API.
    CRITICAL: Uses form-encoded data (data=), NOT JSON (json=)."""
    if not FAST2SMS_API_KEY:
        logger.warning("FAST2SMS_API_KEY not set — SMS not sent to %s", phone)
        return False

    payload = {
        "message": message,
        "language": "english",
        "route": "q",
        "numbers": phone,
    }
    headers = {
        "authorization": FAST2SMS_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(FAST2SMS_URL, data=payload, headers=headers, timeout=15)
            resp.raise_for_status()
            result = resp.json()
            if result.get("return"):
                logger.info("SMS sent to %s: request_id=%s", phone, result.get("request_id"))
                return True
            logger.warning("SMS send failed for %s: %s", phone, result)
            return False
    except Exception as e:
        logger.error("SMS send error for %s: %s", phone, e)
        return False


def build_location_sms(phone: str, emergency_id: int, base_url: str) -> tuple[str, str]:
    """Build SMS message with location capture link.
    Returns (phone, message_body)."""
    location_url = f"{base_url}/location/{emergency_id}"
    message = LOCATION_SMS_TEMPLATE.format(location_url=location_url)
    return phone, message
