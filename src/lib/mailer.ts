// Email for this app — rendered by the pipeline. No email service was chosen, so
// nothing is sent. In development (the IDE preview runs `next dev`) the message and
// its link are logged and handed back as `devLink`, so the flow can be tried end to
// end. In production nothing is sent and the link is never returned or logged:
// connect an email service to send it. Never serve production with `next dev`.
export interface MailResult {
  sent: boolean;
  configured: boolean;
  devLink?: string;
}

export async function sendEmail(msg: { to: string; subject: string; text: string; link?: string }): Promise<MailResult> {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[mailer] email is not set up for this app; would send "${msg.subject}" to ${msg.to}`
      + (msg.link ? ` with the link ${msg.link}` : ''));
    return { sent: false, configured: false, ...(msg.link ? { devLink: msg.link } : {}) };
  }
  console.warn('[mailer] email is not set up for this app; nothing was sent');
  return { sent: false, configured: false };
}
