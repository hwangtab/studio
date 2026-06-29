import type { NextApiRequest, NextApiResponse } from 'next';

import { buildContactEmailBody, buildContactEmailHtml } from '../../../lib/contact/emailContent';
import { isAllowedContactRequestOrigin } from '../../../lib/contact/origin';
import {
  isHoneypotSubmission,
  isTooFast,
  validateAndSanitizeContactPayload,
} from '../../../lib/contact/payload';
import { checkContactRateLimit, CONTACT_RATE_LIMIT_ERROR } from '../../../lib/contact/rateLimit';
import { sendEmail } from '../../../lib/email/resend';

const CONTACT_TO = 'hwangtab@gmail.com';
const SUCCESS_RESPONSE = { success: true, message: 'Message sent successfully' };

const getRequestPayload = (req: NextApiRequest, res: NextApiResponse): Record<string, unknown> | null => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ message: 'Method not allowed' });
    return null;
  }

  const contentType = req.headers['content-type'];
  if (contentType && !String(contentType).toLowerCase().includes('application/json')) {
    res.status(415).json({ message: 'Content-Type must be application/json' });
    return null;
  }

  if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
    res.status(400).json({ message: 'Invalid request body' });
    return null;
  }

  return req.body as Record<string, unknown>;
};

const enforceRateLimit = async (req: NextApiRequest, res: NextApiResponse): Promise<boolean> => {
  try {
    await checkContactRateLimit(req);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && error.message === CONTACT_RATE_LIMIT_ERROR.exceeded) {
      res.status(429).json({ message: 'Too many requests. Please try again later.' });
      return false;
    }
    if (error instanceof Error && error.message === CONTACT_RATE_LIMIT_ERROR.unavailable) {
      res.status(503).json({ message: 'Service temporarily unavailable. Please try again later.' });
      return false;
    }
    console.error('[API Route Error] Rate limit check failed:', error);
    res.status(500).json({ message: 'Internal server error' });
    return false;
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin');

  const payload = getRequestPayload(req, res);
  if (!payload) {
    return;
  }

  if (isHoneypotSubmission(payload.company) || isTooFast(payload._formLoadTime)) {
    return res.status(200).json(SUCCESS_RESPONSE);
  }

  if (!isAllowedContactRequestOrigin(req)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  if (!(await enforceRateLimit(req, res))) {
    return;
  }

  const { validationError, sanitized } = validateAndSanitizeContactPayload(payload);
  if (validationError) {
    return res.status(400).json({
      message: validationError.message,
      field: validationError.field,
      code: validationError.code,
    });
  }

  if (!sanitized) {
    return res.status(500).json({ message: 'Internal server error' });
  }

  const emailBody = buildContactEmailBody(sanitized);
  const result = await sendEmail({
    to: CONTACT_TO,
    subject: `[Studio NOL] 새 문의 — ${sanitized.name}`,
    html: buildContactEmailHtml(sanitized),
    text: emailBody,
    replyTo: sanitized.email,
  });

  if (result.errorCode === 'RESEND_API_KEY_MISSING') {
    console.error('[API Error] Missing Resend configuration');
    return res.status(500).json({ message: 'Server configuration error' });
  }

  if (result.errorCode === 'TIMEOUT') {
    return res.status(504).json({ message: 'Email service timeout. Please try again later.' });
  }

  if (result.errorCode === 'NETWORK_ERROR') {
    console.error('[API Route Error] Resend network error:', result.errorDetail);
    return res.status(500).json({ message: 'Internal server error' });
  }

  if (!result.ok) {
    console.error('[Resend Error]', { status: result.status, detail: result.errorDetail });
    return res.status(502).json({ message: 'Failed to send message. Please try again later.' });
  }

  return res.status(200).json(SUCCESS_RESPONSE);
}
