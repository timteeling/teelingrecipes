import { env } from './env';

/**
 * Minimal Resend client over fetch — avoids a dependency for the one call
 * this app makes.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    throw new Error('sendEmail called with no email sender configured');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend rejected the message (${res.status}): ${body}`);
  }
}

export function magicLinkEmail(url: string): { html: string; text: string } {
  const text = [
    'Sign in to Teeling Family Recipes',
    '',
    url,
    '',
    'This link expires in 15 minutes and can only be used once.',
    "If you didn't request it, you can ignore this email.",
  ].join('\n');

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f9f9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#555">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:6px;padding:32px">
    <h1 style="margin:0 0 16px;font-size:20px;color:#333">Teeling Family Recipes</h1>
    <p style="margin:0 0 24px;line-height:1.5">Click below to sign in.</p>
    <p style="margin:0 0 24px">
      <a href="${url}" style="display:inline-block;background:#009688;color:#fff;text-decoration:none;padding:12px 20px;border-radius:4px;font-weight:700">Sign in</a>
    </p>
    <p style="margin:0;font-size:13px;color:#999;line-height:1.5">
      This link expires in 15 minutes and can only be used once.<br>
      If you didn't request it, you can ignore this email.
    </p>
  </div>
</body></html>`;

  return { html, text };
}
