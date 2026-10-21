import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  eventType?: string;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bemserp.work';
const SMTP_FROM = process.env.SMTP_FROM || 'BEMS Group Notifications <notifications@bemserp.work>';
const RESEND_FROM = process.env.RESEND_FROM || 'BEMS Group Notifications <notifications@bemserp.work>';

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !apiKey.startsWith('re_')) {
    return null;
  }
  return new Resend(apiKey);
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

/**
 * Universal email sender with automatic Resend, SMTP, and fallback database logging
 */
export async function sendEmail({ to, subject, html, text, eventType = 'GENERAL_NOTIFICATION' }: EmailOptions): Promise<{ success: boolean; simulated?: boolean; messageId?: string; error?: string }> {
  const recipientList = Array.isArray(to) ? to : [to];
  const recipientsStr = recipientList.join(', ');

  // 1. Prioritize Resend if configured
  const resend = getResendClient();
  if (resend) {
    try {
      const response = await resend.emails.send({
        from: RESEND_FROM,
        to: recipientList,
        subject,
        html,
        text: text || subject,
      });

      if (response.error) {
        console.error('Resend API returned error:', response.error);
      } else {
        const messageId = response.data?.id;
        try {
          await prisma.outboundNotification.create({
            data: {
              channel: 'EMAIL',
              recipient: recipientsStr,
              eventType,
              payload: JSON.stringify({ subject, to: recipientList, provider: 'resend' }),
              status: 'SENT',
              externalId: messageId || `resend-${Date.now()}`,
            },
          });
        } catch (dbErr) {
          console.error('Failed to log outbound email notification:', dbErr);
        }

        return { success: true, messageId };
      }
    } catch (err: any) {
      console.error('Resend dispatch exception, attempting fallback:', err);
    }
  }

  // 2. SMTP Transporter fallback

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: SMTP_FROM,
        to: recipients,
        subject,
        html,
        text: text || subject,
      });

      try {
        await prisma.outboundNotification.create({
          data: {
            channel: 'EMAIL',
            recipient: recipients,
            eventType,
            payload: JSON.stringify({ subject, to: recipients }),
            status: 'SENT',
            externalId: info.messageId,
          },
        });
      } catch (dbErr) {
        console.error('Failed to log outbound email notification:', dbErr);
      }

      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('SMTP email dispatch error, falling back to simulated log:', err);
    }
  }

  // Simulation mode (logs to console and records in database)
  console.log(`\n📧 [EMAIL DISPATCHED - ${eventType}] to: ${recipients} | subject: ${subject}`);
  let notifId: string | undefined;
  try {
    const record = await prisma.outboundNotification.create({
      data: {
        channel: 'EMAIL',
        recipient: recipients,
        eventType,
        payload: JSON.stringify({ subject, to: recipients, preview: text || subject }),
        status: 'SENT',
        externalId: `sim-email-${Date.now()}`,
      },
    });
    notifId = record.id;
  } catch (dbErr) {
    console.error('Failed to log simulated email:', dbErr);
  }

  return { success: true, simulated: true, messageId: notifId };
}

/**
 * Helper to fetch all active GMD & System Admin email recipients
 */
export async function getExecutiveRecipients(): Promise<{ email: string; name: string }[]> {
  try {
    const execs = await prisma.employee.findMany({
      where: {
        role: { in: ['GMD', 'SYSTEM_ADMIN'] },
        status: 'ACTIVE',
      },
      select: { workEmail: true, legalName: true },
    });
    return execs.map(e => ({ email: e.workEmail, name: e.legalName }));
  } catch {
    return [{ email: 'gmd@bemsgroup.com', name: 'Group Managing Director' }];
  }
}

/**
 * Modern corporate email shell layout matching official BEMS specification
 */
function wrapEmailTemplate({
  title,
  preheader,
  badge = 'Live System Notification',
  content,
  callToAction,
}: {
  title: string;
  preheader: string;
  badge?: string;
  content: string;
  callToAction?: { label: string; url: string };
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 32px 16px; color: #1e293b;">
  <div style="display:none;font-size:1px;color:#fff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preheader}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
    <!-- Top Accent Bar -->
    <tr>
      <td style="height: 6px; background: #ea580c; font-size: 0; line-height: 0;">&nbsp;</td>
    </tr>
    <tr>
      <td style="padding: 32px 36px 32px;">
        <!-- Brand Header Lockup -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
          <tr>
            <td width="52" style="vertical-align: middle;">
              <img src="https://bemserp.work/bems-mark.png" alt="BEMS Group" width="46" height="46" style="border-radius: 8px; display: block; border: 0;" />
            </td>
            <td style="padding-left: 14px; vertical-align: middle;">
              <h1 style="margin: 0; font-size: 21px; font-weight: 900; letter-spacing: -0.025em; text-transform: uppercase; color: #0f172a; line-height: 1.1;">BEMS GROUP</h1>
              <p style="margin: 3px 0 0; font-size: 8.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #64748b; line-height: 1.1;">FINANCIAL MANAGEMENT &amp; EXPENDITURE ACCOUNTABILITY PORTAL</p>
            </td>
          </tr>
        </table>

        <!-- Status Badge -->
        <div style="margin-bottom: 16px;">
          <span style="display: inline-block; padding: 4px 14px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 9999px; color: #ea580c; font-size: 11.5px; font-weight: 700;">
            ● ${badge}
          </span>
        </div>

        <!-- Main Title -->
        <h2 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 16px; letter-spacing: -0.03em; line-height: 1.25;">${title}</h2>

        <!-- Email Body Content -->
        <div style="color: #334155; font-size: 14px; line-height: 1.6;">
          ${content}
        </div>

        <!-- Call to Action Button -->
        ${callToAction ? `
        <div style="text-align: center; margin: 28px 0 24px;">
          <a href="${callToAction.url}" style="background: #ea580c; color: #ffffff !important; padding: 13px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(234, 88, 12, 0.25);">
            ${callToAction.label}
          </a>
        </div>` : ''}

        <!-- Split Footer -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 28px;">
          <tr>
            <td width="48%" style="vertical-align: middle;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="32" style="vertical-align: middle;">
                    <img src="https://bemserp.work/bems-mark.png" alt="" width="28" height="28" style="border-radius: 6px; display: block; border: 0;" />
                  </td>
                  <td style="padding-left: 8px; vertical-align: middle;">
                    <strong style="display: block; font-size: 12px; font-weight: 900; color: #0f172a; line-height: 1.1;">BEMS GROUP</strong>
                    <span style="display: block; font-size: 6.5px; font-weight: 700; color: #94a3b8; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 2px;">FINANCIAL MANAGEMENT &amp; EXPENDITURE ACCOUNTABILITY</span>
                  </td>
                </tr>
              </table>
            </td>
            <td style="border-left: 1px solid #e2e8f0; padding-left: 16px; vertical-align: middle; font-size: 11px; color: #64748b; line-height: 1.4;">
              Automated live dispatch by<br />BEMS Financial Management System.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Template: Staff Registration Confirmation (Upon signup submission)
 */
export async function sendStaffSignupReceiptEmail(params: {
  to: string;
  staffName: string;
  employeeNumber: string;
  roleTitle: string;
  subsidiaryName: string;
}) {
  const content = `
    <p style="margin: 0 0 16px; color: #334155;">Hello <strong>${params.staffName}</strong>,</p>
    <p style="margin: 0 0 16px; color: #475569;">
      Your official staff registration dossier has been received and securely registered in the <strong>BEMS Group enterprise ledger</strong>.
    </p>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Assigned Staff ID:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 800; font-family: monospace; text-align: right;">${params.employeeNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Corporate Role:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right;">${params.roleTitle}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Subsidiary:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right;">${params.subsidiaryName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Dossier Status:</td>
          <td style="padding: 8px 0; text-align: right;">
            <span style="display: inline-block; padding: 3px 10px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 9999px; color: #b45309; font-size: 11px; font-weight: 700;">
              ● PENDING REVIEW
            </span>
          </td>
        </tr>
      </table>
    </div>

    <p style="margin: 0; color: #475569; font-size: 13px;">
      Your profile is currently awaiting executive verification. You will receive an activation email as soon as your access is approved.
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `[BEMS Group] Staff Registration Dossier Received — ${params.employeeNumber}`,
    eventType: 'STAFF_SIGNUP_RECEIPT',
    html: wrapEmailTemplate({
      title: 'Registration Dossier Received',
      preheader: `Your BEMS staff identity ${params.employeeNumber} has been recorded.`,
      badge: 'Registration Recorded',
      content,
      callToAction: {
        label: 'View Portal Status →',
        url: APP_URL,
      },
    }),
  });
}

/**
 * Template: Staff Account Approved & Ready to Login
 */
export async function sendStaffLoginReadyEmail(params: {
  to: string;
  staffName: string;
  employeeNumber: string;
  roleTitle: string;
  subsidiaryName: string;
}) {
  const content = `
    <p style="margin: 0 0 16px; color: #334155;">Hello <strong>${params.staffName}</strong>,</p>
    <p style="margin: 0 0 16px; color: #475569;">
      Great news! Your staff onboarding profile and disbursement banking credentials have been <strong>approved</strong> by executive leadership.
    </p>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Official Staff ID:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 800; font-family: monospace; font-size: 15px; text-align: right;">${params.employeeNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Work Email:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right;">${params.to}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Corporate Role:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right;">${params.roleTitle}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Subsidiary:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right;">${params.subsidiaryName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Account Status:</td>
          <td style="padding: 8px 0; text-align: right;">
            <span style="display: inline-block; padding: 3px 10px; background: #dcfce7; border: 1px solid #bbf7d0; border-radius: 9999px; color: #15803d; font-size: 11px; font-weight: 700;">
              ● ACTIVE &amp; APPROVED
            </span>
          </td>
        </tr>
      </table>
    </div>

    <p style="margin: 0; color: #475569; font-size: 13.5px;">
      You can now sign in using your registered email and password to access the <strong>Staff Requisition Portal</strong>, create fund requests, track advances, and upload 72-hour evidence deliverables.
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `[BEMS Group] Your Staff Account is Approved — Ready to Sign In`,
    eventType: 'STAFF_LOGIN_READY',
    html: wrapEmailTemplate({
      title: 'Your Account is Approved & Ready',
      preheader: `Your account is approved. Sign in with Staff ID: ${params.employeeNumber}.`,
      badge: 'Account Approved & Active',
      content,
      callToAction: {
        label: 'Sign In to Staff Portal →',
        url: `${APP_URL}/?email=${encodeURIComponent(params.to)}`,
      },
    }),
  });
}

/**
 * Template: Admin Directly Onboards Employee (Welcome with Credentials)
 */
export async function sendStaffOnboardWelcomeEmail(params: {
  to: string;
  name: string;
  employeeNumber: string;
  role: string;
  initialPassword?: string;
  subsidiaryName: string;
}) {
  const content = `
    <p style="margin: 0 0 16px; color: #334155;">Hello <strong>${params.name}</strong>,</p>
    <p style="margin: 0 0 16px; color: #475569;">
      A new enterprise account has been created for you on the <strong>BEMS Group Financial Management Portal</strong>.
    </p>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Official Staff ID:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 800; font-family: monospace; font-size: 15px; text-align: right;">${params.employeeNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Work Email:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right;">${params.to}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Assigned Role:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right;">${params.role}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Subsidiary:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right;">${params.subsidiaryName}</td>
        </tr>
        ${params.initialPassword ? `
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Initial Password:</td>
          <td style="padding: 8px 0; color: #c2410c; font-weight: 700; font-family: monospace; font-size: 14px; text-align: right;">${params.initialPassword}</td>
        </tr>` : ''}
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Account Status:</td>
          <td style="padding: 8px 0; text-align: right;">
            <span style="display: inline-block; padding: 3px 10px; background: #dcfce7; border: 1px solid #bbf7d0; border-radius: 9999px; color: #15803d; font-size: 11px; font-weight: 700;">
              ● ACTIVE &amp; READY
            </span>
          </td>
        </tr>
      </table>
    </div>

    <p style="margin: 0; color: #475569; font-size: 13.5px;">
      You can sign in immediately using the button below. Please update your password upon your first sign in.
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `[BEMS Group] Your Account has been Provisioned — Access Credentials`,
    eventType: 'ACCOUNT_ONBOARDED_CREDENTIALS',
    html: wrapEmailTemplate({
      title: 'Corporate Account Provisioned',
      preheader: `Your ${params.role} profile is active. Sign in with Staff ID: ${params.employeeNumber}.`,
      badge: 'Account Provisioned',
      content,
      callToAction: {
        label: 'Open Management Portal →',
        url: `${APP_URL}/?email=${encodeURIComponent(params.to)}`,
      },
    }),
  });
}

/**
 * Template: GMD Alert for New Staff Registration
 */
export async function sendGmdNewStaffAlert(params: {
  gmdEmail: string;
  gmdName: string;
  staffName: string;
  employeeNumber: string;
  jobTitle: string;
  subsidiaryName: string;
  employmentType: string;
  workLocation: string;
  bankName: string;
  accountNumber: string;
}) {
  const content = `
    <p style="margin: 0 0 16px; color: #334155;">Hello <strong>${params.gmdName}</strong>,</p>
    <p style="margin: 0 0 16px; color: #475569;">
      A new employee onboarding dossier has been registered and is pending executive review:
    </p>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Candidate Name:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 700; text-align: right;">${params.staffName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Staff Identity:</td>
          <td style="padding: 8px 0; color: #ea580c; font-weight: 800; font-family: monospace; text-align: right;">${params.employeeNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Designation / Role:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right;">${params.jobTitle}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Subsidiary:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right;">${params.subsidiaryName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Employment Type:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right;">${params.employmentType}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Station:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right;">${params.workLocation}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Disbursement Bank:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right;">${params.bankName} (${params.accountNumber})</td>
        </tr>
      </table>
    </div>

    <p style="margin: 0; color: #475569; font-size: 13px;">
      Log in to the Executive Command Center to inspect the full statutory record, verify KYC credentials, and approve access.
    </p>
  `;

  return sendEmail({
    to: params.gmdEmail,
    subject: `⚡ [GMD Alert] New Staff Onboarding: ${params.staffName} (${params.employeeNumber})`,
    eventType: 'GMD_NEW_STAFF_ALERT',
    html: wrapEmailTemplate({
      title: 'New Staff Registration Dossier',
      preheader: `Action Required: New staff onboarding dossier for ${params.staffName} awaiting review.`,
      badge: 'Action Required',
      content,
      callToAction: {
        label: 'Review in Executive Center →',
        url: APP_URL,
      },
    }),
  });
}

/**
 * Template: GMD Real-Time Requisition Approval Alert
 */
export async function sendGmdRequisitionAlert(params: {
  gmdEmail: string;
  gmdName: string;
  requestNumber: string;
  requesterName: string;
  subsidiaryName: string;
  category: string;
  amountMinor: number;
  justification: string;
  approverRole: string;
}) {
  const amountFormatted = `₦${(params.amountMinor / 100).toLocaleString('en-NG')}`;

  const content = `
    <p style="margin: 0 0 16px; color: #334155;">Hello <strong>${params.gmdName}</strong>,</p>
    <p style="margin: 0 0 16px; color: #475569;">
      An expenditure requisition has been submitted and requires executive approval:
    </p>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Request Number:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 800; font-family: monospace; text-align: right;">${params.requestNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Amount:</td>
          <td style="padding: 8px 0; color: #ea580c; font-weight: 900; font-size: 16px; text-align: right;">${amountFormatted}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Requester:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right;">${params.requesterName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Subsidiary:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right;">${params.subsidiaryName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Category:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right;">${params.category}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Target Approval Gate:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right;">${params.approverRole}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 500; vertical-align: top;">Justification:</td>
          <td style="padding: 8px 0; font-style: italic; color: #475569; text-align: right; max-width: 280px;">"${params.justification}"</td>
        </tr>
      </table>
    </div>

    <p style="margin: 0; color: #475569; font-size: 13px;">
      Direct executive action can be performed directly via the Executive Command Desk.
    </p>
  `;

  return sendEmail({
    to: params.gmdEmail,
    subject: `⚡ [GMD Action Required] Fund Request ${params.requestNumber} (${amountFormatted})`,
    eventType: 'GMD_REQUISITION_ALERT',
    html: wrapEmailTemplate({
      title: 'Expenditure Request Submitted',
      preheader: `Requisition ${params.requestNumber} for ${amountFormatted} submitted by ${params.requesterName}.`,
      badge: 'Action Required',
      content,
      callToAction: {
        label: `Review & Decide ${params.requestNumber} →`,
        url: `${APP_URL}/requests/${params.requestNumber}`,
      },
    }),
  });
}
