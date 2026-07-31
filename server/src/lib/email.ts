import { config } from '../config.js';

/**
 * Transactional email.
 *
 * Sending mail genuinely requires an outside service — there is no way to make
 * this self-contained. What it does avoid is the failure mode where the API
 * reports "check your email" and nothing was ever sent: `isEmailConfigured()`
 * lets callers refuse up front instead.
 *
 * Uses Resend's HTTP API so there is no SMTP library to add. Set RESEND_API_KEY
 * and EMAIL_FROM (a domain you have verified with Resend) and it starts working
 * with no code change.
 */

export function isEmailConfigured(): boolean {
  return Boolean(config.resendApiKey && config.emailFrom);
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error('Email is not configured. Set RESEND_API_KEY and EMAIL_FROM.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [message.to],
      subject: message.subject,
      text: message.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend rejected the message (${response.status}): ${detail}`);
  }
}

/**
 * The link opens the app straight to the reset screen. `bluebalance://` is
 * registered in Info.plist and AndroidManifest, so it resolves on a device with
 * the app installed.
 */
export function passwordResetMessage(email: string, token: string): EmailMessage {
  const link = `bluebalance://reset?token=${encodeURIComponent(token)}`;

  return {
    to: email,
    subject: 'Reset your Blue Balance password',
    text: [
      'Someone asked to reset the password for this Blue Balance account.',
      '',
      'Open this link on the device with Blue Balance installed:',
      link,
      '',
      'Or paste this code into the app:',
      token,
      '',
      'The code expires in one hour and can only be used once.',
      'If you did not request this, you can ignore this email — nothing has changed.',
    ].join('\n'),
  };
}
