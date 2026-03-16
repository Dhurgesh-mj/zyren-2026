import hmac
import hashlib
import json
import time
import qrcode
import io
import os
import base64
from PIL import Image, ImageDraw, ImageFont
from app.config import QR_SECRET_KEY, QR_CODE_DIR


def generate_qr_signature(event_id: int, user_id: int, timestamp: int) -> str:
    """Generate HMAC-SHA256 signature for QR token."""
    message = f"{event_id}:{user_id}:{timestamp}"
    signature = hmac.new(
        QR_SECRET_KEY.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    return signature


def generate_qr_token(event_id: int, user_id: int) -> str:
    """Generate a signed QR token payload."""
    timestamp = int(time.time())
    signature = generate_qr_signature(event_id, user_id, timestamp)
    payload = {
        "event_id": event_id,
        "user_id": user_id,
        "timestamp": timestamp,
        "signature": signature,
    }
    return base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()


def verify_qr_token(token: str) -> dict | None:
    """Verify a QR token and return the payload if valid."""
    try:
        decoded = base64.urlsafe_b64decode(token.encode()).decode()
        payload = json.loads(decoded)

        event_id = payload["event_id"]
        user_id = payload["user_id"]
        timestamp = payload["timestamp"]
        signature = payload["signature"]

        # Verify signature
        expected_signature = generate_qr_signature(event_id, user_id, timestamp)
        if not hmac.compare_digest(signature, expected_signature):
            return None

        # Check token age (valid for 24 hours)
        current_time = int(time.time())
        if current_time - timestamp > 86400:
            return None

        return payload
    except Exception:
        return None


def generate_qr_image_base64(data: str) -> str:
    """Generate a QR code image as base64 string."""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return base64.b64encode(buffer.getvalue()).decode()


def generate_qr_ticket(
    token: str,
    event_title: str,
    user_name: str,
    event_date: str,
    event_venue: str,
    event_id: int,
    user_id: int,
) -> tuple[str, str]:
    """
    Generate a branded QR ticket image with event details.
    
    Returns:
        (file_path, base64_image)
    """
    # Generate QR code
    qr = qrcode.QRCode(
        version=2,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=8,
        border=4,
    )
    qr.add_data(token)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#1a1a2e", back_color="white").convert("RGB")
    qr_width, qr_height = qr_img.size

    # Create ticket canvas
    ticket_width = max(qr_width + 80, 400)
    ticket_height = qr_height + 200
    ticket = Image.new("RGB", (ticket_width, ticket_height), "#0f0f23")
    draw = ImageDraw.Draw(ticket)

    # Try to use a nice font, fall back to default
    try:
        font_title = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 20)
        font_normal = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14)
        font_small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 11)
    except Exception:
        font_title = ImageFont.load_default()
        font_normal = ImageFont.load_default()
        font_small = ImageFont.load_default()

    # Header gradient bar
    for x in range(ticket_width):
        ratio = x / ticket_width
        r = int(59 + ratio * (139 - 59))
        g = int(130 + ratio * (92 - 130))
        b = int(246 + ratio * (246 - 246))
        draw.line([(x, 0), (x, 4)], fill=(r, g, b))

    # Title
    draw.text((20, 15), "🛡️ EventIQ Secure", fill="#6366f1", font=font_title)
    draw.text((20, 45), "ENTRY TICKET", fill="#a5b4fc", font=font_normal)

    # Divider
    draw.line([(20, 70), (ticket_width - 20, 70)], fill="#2d2d5e", width=1)

    # Event info
    y_offset = 80
    draw.text((20, y_offset), event_title, fill="#ffffff", font=font_title)
    y_offset += 30
    draw.text((20, y_offset), f"📅 {event_date}  |  📍 {event_venue}", fill="#94a3b8", font=font_normal)
    y_offset += 22
    draw.text((20, y_offset), f"👤 {user_name}", fill="#94a3b8", font=font_normal)
    y_offset += 30

    # Divider
    draw.line([(20, y_offset), (ticket_width - 20, y_offset)], fill="#2d2d5e", width=1)
    y_offset += 15

    # Paste QR code centered
    qr_x = (ticket_width - qr_width) // 2
    ticket.paste(qr_img, (qr_x, y_offset))
    y_offset += qr_height + 10

    # Footer
    draw.text(
        (20, y_offset),
        "Scan this QR code at the venue for check-in",
        fill="#64748b", font=font_small,
    )
    draw.text(
        (ticket_width - 180, y_offset),
        "HMAC-SHA256 Signed ✓",
        fill="#22c55e", font=font_small,
    )

    # Bottom gradient bar
    for x in range(ticket_width):
        ratio = x / ticket_width
        r = int(16 + ratio * (139 - 16))
        g = int(185 + ratio * (92 - 185))
        b = int(129 + ratio * (246 - 129))
        draw.line([(x, ticket_height - 4), (x, ticket_height)], fill=(r, g, b))

    # Save file
    filename = f"ticket_e{event_id}_u{user_id}.png"
    filepath = os.path.join(QR_CODE_DIR, filename)
    ticket.save(filepath, "PNG")

    # Base64
    buffer = io.BytesIO()
    ticket.save(buffer, format="PNG")
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.getvalue()).decode()

    return filepath, img_base64
