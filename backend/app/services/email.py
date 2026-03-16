"""
Send transactional emails via SMTP.
Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env.
Works with Gmail (use an App Password, not your main password).
If no SMTP config is set, emails are silently skipped.
"""
import os
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", SMTP_USER)


async def send_email(to: str, subject: str, html: str) -> None:
    if not all([SMTP_HOST, SMTP_USER, SMTP_PASS]):
        return  # SMTP not configured — skip silently

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = EMAIL_FROM
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))

    await aiosmtplib.send(
        msg,
        hostname=SMTP_HOST,
        port=SMTP_PORT,
        username=SMTP_USER,
        password=SMTP_PASS,
        start_tls=True,
    )


async def send_welcome_email(to: str) -> None:
    html = """
    <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 32px;">
      <h2 style="color: #1a1a2e;">Welcome to UpAlpha! 🎉</h2>
      <p>Your account has been created successfully.</p>
      <p>You can now log in and start paper trading. Every trade you make will get
         AI-powered coaching to help you learn and improve.</p>
      <p style="margin-top: 24px; color: #888; font-size: 13px;">
        This is an automated message from your local UpAlpha instance.
      </p>
    </div>
    """
    await send_email(to, "Welcome to UpAlpha!", html)
