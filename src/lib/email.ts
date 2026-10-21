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
 * Modern corporate email shell layout
 */
function wrapEmailTemplate({ title, preheader, content, callToAction }: { title: string; preheader: string; content: string; callToAction?: { label: string; url: string } }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 24px 0; color: #334155; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.15); }
    .header { background: radial-gradient(circle at 10% 20%, #ea580c, #9a3412 80%); padding: 32px 36px; text-align: left; }
    .logo { font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.04em; margin: 0; }
    .logo span { font-size: 11px; font-weight: 700; color: #fed7aa; letter-spacing: 0.25em; text-transform: uppercase; display: block; margin-top: 2px; }
    .header h1 { color: #ffffff; font-size: 20px; font-weight: 800; margin: 16px 0 0; letter-spacing: -0.02em; }
    .body { padding: 36px; line-height: 1.6; font-size: 14px; color: #334155; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin: 20px 0; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
    .badge-orange { background: #fff7ed; color: #ea580c; border: 1px solid #ffedd5; }
    .badge-green { background: #f0fdf4; color: #16a34a; border: 1px solid #dcfce7; }
    .cta-btn { display: inline-block; background: linear-gradient(135deg, #ea580c, #c2410c); color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; margin: 18px 0; box-shadow: 0 4px 12px rgba(234,88,12,0.3); }
    .footer { background: #f1f5f9; padding: 20px 36px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#fff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preheader}
  </div>
  <div class="wrapper">
    <div class="header">
      <div class="logo">BEMS <span>GROUP HOLDINGS</span></div>
      <h1>${title}</h1>
    </div>
    <div class="body">
      ${content}
      ${callToAction ? `<div style="text-align: center; margin-top: 24px;"><a href="${callToAction.url}" class="cta-btn" target="_blank">${callToAction.label}</a></div>` : ''}
    </div>
    <div class="footer">
      <p style="margin: 0 0 6px;">BEMS Group Expenditure & Accountability System</p>
      <p style="margin: 0;">This is an automated enterprise advisory. Please do not reply directly to this email.</p>
    </div>
  </div>
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
    <p>Dear <strong>${params.staffName}</strong>,</p>
    <p>Your official staff registration dossier has been received and securely registered in the BEMS Group enterprise ledger.</p>
    
    <div class="card">
      <span class="badge badge-orange" style="margin-bottom: 10px;">Registration Recorded</span>
      <table style="width:100%; border-collapse: collapse; font-size: 13px; margin-top: 8px;">
        <tr><td style="padding: 5px 0; color: #64748b; width: 40%;">Assigned Staff ID:</td><td style="padding: 5px 0; font-weight: 800; font-family: monospace; font-size: 15px; color: #0f172a;">${params.employeeNumber}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b;">Designation:</td><td style="padding: 5px 0; font-weight: 600;">${params.roleTitle}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b;">Subsidiary:</td><td style="padding: 5px 0; font-weight: 600;">${params.subsidiaryName}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b;">Approval Status:</td><td style="padding: 5px 0; font-weight: 700; color: #d97706;">Pending Review</td></tr>
      </table>
    </div>

    <p style="color: #475569; font-size: 13px;">
      Your profile is currently awaiting final administrative and executive sign-off. As soon as your account is approved, you will receive an activation email with a direct login link to start submitting expenditure requests.
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `[BEMS Group] Staff Registration Dossier Received — ${params.employeeNumber}`,
    eventType: 'STAFF_SIGNUP_RECEIPT',
    html: wrapEmailTemplate({
      title: 'Staff Registration Received',
      preheader: `Your BEMS staff identity ${params.employeeNumber} has been recorded.`,
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
    <p>Dear <strong>${params.staffName}</strong>,</p>
    <p>Great news! Your staff onboarding profile and disbursement banking credentials have been <strong>approved</strong> by executive leadership.</p>
    
    <div class="card" style="border-left: 4px solid #16a34a;">
      <span class="badge badge-green" style="margin-bottom: 10px;">Account Approved & Active</span>
      <table style="width:100%; border-collapse: collapse; font-size: 13px; margin-top: 8px;">
        <tr><td style="padding: 5px 0; color: #64748b; width: 40%;">Official Staff ID:</td><td style="padding: 5px 0; font-weight: 800; font-family: monospace; font-size: 15px; color: #0f172a;">${params.employeeNumber}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b;">Work Email:</td><td style="padding: 5px 0; font-weight: 600;">${params.to}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b;">Role:</td><td style="padding: 5px 0; font-weight: 600;">${params.roleTitle}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b;">Subsidiary:</td><td style="padding: 5px 0; font-weight: 600;">${params.subsidiaryName}</td></tr>
      </table>
    </div>

    <p style="margin-top: 18px;">
      You can now sign in using your registered email and password to access the <strong>Staff Requisition Portal</strong>, create fund requests, track advances, and upload 72-hour evidence deliverables.
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `[BEMS Group] Your Staff Account is Approved — Ready to Sign In`,
    eventType: 'STAFF_LOGIN_READY',
    html: wrapEmailTemplate({
      title: 'Welcome to BEMS Group',
      preheader: `Your account is approved. Sign in with Staff ID: ${params.employeeNumber}.`,
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
    <p>Dear <strong>${params.name}</strong>,</p>
    <p>A new enterprise account has been created for you on the <strong>BEMS Group Financial Management Portal</strong>.</p>
    
    <div class="card" style="border-left: 4px solid #ea580c;">
      <span class="badge badge-orange" style="margin-bottom: 10px;">Corporate Account Provisioned</span>
      <table style="width:100%; border-collapse: collapse; font-size: 13px; margin-top: 8px;">
        <tr><td style="padding: 5px 0; color: #64748b; width: 40%;">Official Staff ID:</td><td style="padding: 5px 0; font-weight: 800; font-family: monospace; font-size: 15px; color: #0f172a;">${params.employeeNumber}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b;">Work Email:</td><td style="padding: 5px 0; font-weight: 600;">${params.to}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b;">Assigned Role:</td><td style="padding: 5px 0; font-weight: 600;">${params.role}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b;">Subsidiary:</td><td style="padding: 5px 0; font-weight: 600;">${params.subsidiaryName}</td></tr>
        ${params.initialPassword ? `<tr><td style="padding: 5px 0; color: #64748b;">Initial Password:</td><td style="padding: 5px 0; font-weight: 700; font-family: monospace; color: #c2410c;">${params.initialPassword}</td></tr>` : ''}
      </table>
    </div>

    <p style="margin-top: 18px;">
      You can now sign in using the button below. Please sign in and update your security settings.
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `[BEMS Group] Your Account has been Provisioned — Access Credentials`,
    eventType: 'ACCOUNT_ONBOARDED_CREDENTIALS',
    html: wrapEmailTemplate({
      title: 'Welcome to BEMS Group',
      preheader: `Your ${params.role} profile is active. Sign in with Staff ID: ${params.employeeNumber}.`,
      content,
      callToAction: {
        label: 'Sign In to BEMS Portal →',
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
    <p>Good day <strong>${params.gmdName}</strong>,</p>
    <p>A new employee onboarding dossier has been registered and is pending executive review:</p>

    <div class="card" style="border-left: 4px solid #ea580c;">
      <span class="badge badge-orange" style="margin-bottom: 10px;">Pending Executive Approval</span>
      <table style="width:100%; border-collapse: collapse; font-size: 13px; margin-top: 8px;">
        <tr><td style="padding: 5px 0; color: #64748b; width: 40%;">Candidate Name:</td><td style="padding: 5px 0; font-weight: 700; color: #0f172a;">${params.staffName}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b;">Staff Identity:</td><td style="padding: 5px 0; font-weight: 800; font-family: monospace; color: #ea580c;">${params.employeeNumber}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b;">Designation / Role:</td><td style="padding: 5px 0; font-weight: 600;">${params.jobTitle}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b;">Subsidiary Placement:</td><td style="padding: 5px 0; font-weight: 600;">${params.subsidiaryName}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b;">Employment Type:</td><td style="padding: 5px 0; font-weight: 600;">${params.employmentType}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b;">Work Station:</td><td style="padding: 5px 0; font-weight: 600;">${params.workLocation}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b;">Disbursement Bank:</td><td style="padding: 5px 0; font-weight: 600;">${params.bankName} (${params.accountNumber})</td></tr>
      </table>
    </div>

    <p style="color: #475569; font-size: 13px;">
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
    <p>Good day <strong>${params.gmdName}</strong>,</p>
    <p>An expenditure requisition has been submitted and requires executive attention:</p>

    <div class="card" style="border-left: 4px solid #ea580c;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
        <span class="badge badge-orange">Pending Review</span>
        <strong style="font-size: 18px; color: #0f172a;">${amountFormatted}</strong>
      </div>
      <table style="width:100%; border-collapse: collapse; font-size: 13px; margin-top: 8px;">
        <tr><td style="padding: 5px 0; color: #64748b; width: 35%;">Request Number:</td><td style="padding: 5px 0; font-weight: 800; font-family: monospace;">${params.requestNumber}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b;">Requester:</td><td style="padding: 5px 0; font-weight: 600;">${params.requesterName}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b;">Subsidiary:</td><td style="padding: 5px 0; font-weight: 600;">${params.subsidiaryName}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b;">Category:</td><td style="padding: 5px 0; font-weight: 600;">${params.category}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b;">Assigned Gate:</td><td style="padding: 5px 0; font-weight: 600; color: #ea580c;">${params.approverRole}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b;">Justification:</td><td style="padding: 5px 0; font-style: italic; color: #334155;">"${params.justification}"</td></tr>
      </table>
    </div>

    <p style="color: #475569; font-size: 13px;">
      Direct executive action can be performed directly via the Executive Command Center.
    </p>
  `;

  return sendEmail({
    to: params.gmdEmail,
    subject: `⚡ [GMD Action Required] Fund Request ${params.requestNumber} (${amountFormatted})`,
    eventType: 'GMD_REQUISITION_ALERT',
    html: wrapEmailTemplate({
      title: 'Expenditure Request Submitted',
      preheader: `Requisition ${params.requestNumber} for ${amountFormatted} submitted by ${params.requesterName}.`,
      content,
      callToAction: {
        label: `Review & Decide ${params.requestNumber} →`,
        url: `${APP_URL}/requests/${params.requestNumber}`,
      },
    }),
  });
}
