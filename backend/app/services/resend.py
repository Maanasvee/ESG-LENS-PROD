"""
ESG Lens — Resend Email Service
Dispatches personalised ESG digest emails via Resend API.
Free tier: 3,000 emails/month.
"""

import logging
from typing import Optional

import resend

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _init_resend():
    resend.api_key = settings.resend_api_key


def build_digest_html(digest_content: str, user_name: Optional[str] = None) -> str:
    """Wraps digest plain text in a styled HTML email template."""
    name_greeting = f"Hi {user_name}," if user_name else "Hello,"

    # Convert plain text sections to HTML paragraphs
    sections = digest_content.strip().split("\n\n")
    html_sections = ""
    for section in sections:
        lines = section.strip().split("\n")
        if lines:
            first_line = lines[0]
            rest = " ".join(lines[1:])
            if first_line.startswith(("HEADLINE", "WHAT CHANGED", "WHY IT MATTERS", "REQUIRED ACTION")):
                html_sections += f"""
                <div style="margin-bottom: 24px;">
                    <h3 style="color: #22C55E; font-size: 12px; text-transform: uppercase;
                               letter-spacing: 1px; margin: 0 0 8px 0; font-family: Inter, sans-serif;">
                        {first_line.replace(":", "").strip()}
                    </h3>
                    <p style="color: #E2E8F0; font-size: 15px; line-height: 1.6; margin: 0; font-family: Inter, sans-serif;">
                        {rest}
                    </p>
                </div>
                """
            else:
                html_sections += f"""
                <p style="color: #E2E8F0; font-size: 15px; line-height: 1.6; font-family: Inter, sans-serif;">
                    {section}
                </p>
                """

    return f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="background-color: #0A0F0D; margin: 0; padding: 0;">
        <div style="max-width: 640px; margin: 0 auto; padding: 40px 20px;">
            <!-- Header -->
            <div style="margin-bottom: 32px;">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <span style="background: linear-gradient(135deg, #0F4C3A, #22C55E);
                                 color: white; font-weight: 700; font-size: 18px;
                                 padding: 6px 14px; border-radius: 6px; font-family: Inter, sans-serif;">
                        ESG Lens
                    </span>
                    <span style="color: #64748B; font-size: 12px; margin-left: 12px; font-family: Inter, sans-serif;">
                        by Bevolve.ai
                    </span>
                </div>
                <h1 style="color: #F8FAFC; font-size: 24px; margin: 16px 0 4px 0; font-family: Inter, sans-serif;">
                    Your ESG Policy Brief
                </h1>
                <p style="color: #64748B; font-size: 14px; margin: 0; font-family: Inter, sans-serif;">
                    Personalised intelligence for sustainability leaders
                </p>
            </div>

            <!-- Greeting -->
            <p style="color: #94A3B8; font-size: 15px; margin-bottom: 24px; font-family: Inter, sans-serif;">
                {name_greeting}
            </p>

            <!-- Content -->
            <div style="background: #111B14; border: 1px solid #1E3A2F; border-radius: 12px; padding: 28px;">
                {html_sections}
            </div>

            <!-- Footer -->
            <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #1E3A2F;">
                <p style="color: #475569; font-size: 12px; text-align: center; font-family: Inter, sans-serif;">
                    ESG Lens by <a href="https://bevolve.ai" style="color: #22C55E; text-decoration: none;">Bevolve.ai</a>
                    &nbsp;·&nbsp;
                    <a href="{{unsubscribe_url}}" style="color: #475569;">Unsubscribe</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    """


async def dispatch_digest_email(
    *,
    to_email: str,
    user_name: Optional[str],
    digest_content: str,
    digest_id: int,
) -> bool:
    """
    Sends a digest email via Resend.
    Returns True on success, False on failure.
    """
    _init_resend()

    try:
        html = build_digest_html(digest_content, user_name)

        result = resend.Emails.send({
            "from": f"ESG Lens <{settings.resend_from_email}>",
            "to": [to_email],
            "subject": "🌿 Your Daily ESG Policy Brief — ESG Lens",
            "html": html,
        })

        logger.info(f"Digest email dispatched to {to_email} (digest_id={digest_id}): {result}")
        return True

    except Exception as e:
        logger.error(f"Failed to dispatch digest to {to_email}: {e}")
        return False
