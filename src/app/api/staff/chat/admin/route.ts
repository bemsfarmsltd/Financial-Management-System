import { NextResponse } from 'next/server';
import {
  getAuthenticatedEmployee,
  getHrAuthorizationScope,
  hasAnyRole,
} from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendChatMessageEmail } from '@/lib/email';
import { dispatchNotificationBridge, resolveGmdNotificationTarget } from '@/lib/notifications/bridge';

export const dynamic = 'force-dynamic';

/**
 * Shared channel & role resolution for Helpdesk Chat:
 * - Executive roles (GMD, SUPER_ADMIN, SYSTEM_ADMIN) ALWAYS take precedence over inferred HR capability.
 * - Executives can read and send on either 'GMD' (default) or 'HR' (when explicitly requested via channel='HR').
 * - Scoped HR staff (!isExecutive && hrScope.authorized) can ONLY read and send on 'HR', and ONLY for STAFF in their authorized subsidiaryIds.
 * - Regular STAFF can read and send on their own thread on either 'GMD' or 'HR'.
 */
async function resolveChatContext(actor: NonNullable<Awaited<ReturnType<typeof getAuthenticatedEmployee>>>, rawChannel?: string | null) {
  const isGmd = actor.role === 'GMD';
  const isSuperAdmin = actor.role === 'SYSTEM_ADMIN' || actor.role === 'SUPER_ADMIN';
  const isExecutive = isGmd || isSuperAdmin;
  const hrScope = await getHrAuthorizationScope(actor);
  const isHrOnly = !isExecutive && hrScope.authorized;
  const isAdmin = isExecutive || isHrOnly;

  const requestedChannel = (rawChannel || '').trim().toUpperCase();

  if (isHrOnly && requestedChannel === 'GMD') {
    return {
      error: 'Access denied: The GMD Executive channel is strictly confidential and inaccessible to HR.',
      statusCode: 403,
    } as const;
  }

  let effectiveChannel: 'GMD' | 'HR' = 'GMD';
  let senderRole: 'GMD' | 'SYSTEM_ADMIN' | 'HR' | 'STAFF' = 'STAFF';

  if (isExecutive) {
    effectiveChannel = requestedChannel === 'HR' ? 'HR' : 'GMD';
    senderRole = isGmd ? 'GMD' : 'SYSTEM_ADMIN';
  } else if (isHrOnly) {
    effectiveChannel = 'HR';
    senderRole = 'HR';
  } else {
    effectiveChannel = requestedChannel === 'HR' ? 'HR' : 'GMD';
    senderRole = 'STAFF';
  }

  return {
    error: null,
    isExecutive,
    isHrOnly,
    isAdmin,
    hrScope,
    effectiveChannel,
    senderRole,
  } as const;
}

export async function GET(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);

    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedEmployeeId = searchParams.get('employeeId');
    const channelParam = searchParams.get('channel');

    const ctx = await resolveChatContext(actor, channelParam);
    if (ctx.error) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.statusCode });
    }

    const { isExecutive, isHrOnly, isAdmin, hrScope, effectiveChannel } = ctx;

    // Scenario A: Admin viewing thread list for their designated channel
    if (isAdmin && !requestedEmployeeId) {
      const whereClause: any = {
        channel: effectiveChannel,
      };

      // Scope HR thread list strictly to STAFF in their authorized subsidiaries
      if (isHrOnly && !hrScope.isGlobal) {
        whereClause.employee = {
          role: 'STAFF',
          assignments: {
            some: {
              subsidiaryId: { in: hrScope.subsidiaryIds },
              status: 'ACTIVE',
            },
          },
        };
      }

      const recentMessages = await prisma.staffAdminMessage.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              legalName: true,
              employeeNumber: true,
              workEmail: true,
              avatarUrl: true,
              assignments: {
                where: { status: 'ACTIVE' },
                select: { isPrimary: true, subsidiaryId: true, subsidiary: { select: { legalName: true, code: true } } },
              },
            },
          },
        },
        take: 500,
      });

      const threadMap = new Map<
        string,
        {
          employee: any;
          lastMessage: any;
          unreadCount: number;
          channel: string;
        }
      >();

      for (const msg of recentMessages) {
        if (!threadMap.has(msg.employeeId)) {
          threadMap.set(msg.employeeId, {
            employee: msg.employee,
            lastMessage: msg,
            unreadCount: msg.isReadByAdmin ? 0 : 1,
            channel: effectiveChannel,
          });
        } else {
          const item = threadMap.get(msg.employeeId)!;
          if (!msg.isReadByAdmin) {
            item.unreadCount += 1;
          }
        }
      }

      const response = NextResponse.json({
        success: true,
        isAdmin: true,
        channel: effectiveChannel,
        threads: Array.from(threadMap.values()),
      });
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      return response;
    }

    // Scenario B: Specific conversation thread
    // Non-admins cannot read another employee's thread
    if (!isAdmin && requestedEmployeeId && requestedEmployeeId !== actor.id) {
      return NextResponse.json({ error: 'Forbidden: You can only view your own helpdesk conversation.' }, { status: 403 });
    }

    const targetEmployeeId = isAdmin && requestedEmployeeId ? requestedEmployeeId : actor.id;

    const targetEmployee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      select: {
        id: true,
        role: true,
        legalName: true,
        employeeNumber: true,
        workEmail: true,
        avatarUrl: true,
        assignments: {
          where: { status: 'ACTIVE' },
          select: { isPrimary: true, subsidiaryId: true, subsidiary: { select: { legalName: true, code: true } } },
        },
      },
    });

    if (!targetEmployee) {
      return NextResponse.json({ error: 'Target employee not found.' }, { status: 404 });
    }

    // If HR-only admin is accessing a specific employee's thread, enforce STAFF role and subsidiary scope
    if (isHrOnly && targetEmployeeId !== actor.id) {
      if (targetEmployee.role !== 'STAFF') {
        return NextResponse.json({ error: 'Forbidden: HR cannot access executive helpdesk threads.' }, { status: 403 });
      }
      if (!hrScope.isGlobal) {
        const empSubIds = targetEmployee.assignments.map((a) => a.subsidiaryId);
        const inScope = empSubIds.some((id) => hrScope.subsidiaryIds.includes(id));
        if (!inScope) {
          return NextResponse.json(
            { error: 'Forbidden: Employee is outside your authorized HR subsidiary scope.' },
            { status: 403 }
          );
        }
      }
    }

    const messages = await prisma.staffAdminMessage.findMany({
      where: {
        employeeId: targetEmployeeId,
        channel: effectiveChannel,
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    // Mark messages as read based on whether caller is reading as Admin or Staff owner
    const readingAsAdmin = isAdmin && targetEmployeeId !== actor.id;
    if (readingAsAdmin || (isExecutive && requestedEmployeeId === actor.id)) {
      await prisma.staffAdminMessage.updateMany({
        where: {
          employeeId: targetEmployeeId,
          channel: effectiveChannel,
          isReadByAdmin: false,
        },
        data: { isReadByAdmin: true },
      });
    } else {
      await prisma.staffAdminMessage.updateMany({
        where: {
          employeeId: targetEmployeeId,
          channel: effectiveChannel,
          isReadByStaff: false,
        },
        data: { isReadByStaff: true },
      });
    }

    const response = NextResponse.json({
      success: true,
      channel: effectiveChannel,
      employee: targetEmployee,
      messages,
    });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return response;
  } catch (error) {
    console.error('Error fetching staff-admin chat:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);

    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const body = await req.json();
    const messageText = typeof body.message === 'string' ? body.message.trim() : '';

    if (!messageText) {
      return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 });
    }

    const ctx = await resolveChatContext(actor, body.channel);
    if (ctx.error) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.statusCode });
    }

    const { isHrOnly, isAdmin, hrScope, effectiveChannel: targetChannel, senderRole } = ctx;

    if (!isAdmin && body.employeeId && body.employeeId !== actor.id) {
      return NextResponse.json({ error: 'Forbidden: You can only send messages in your own helpdesk thread.' }, { status: 403 });
    }

    const targetEmployeeId = isAdmin && body.employeeId ? body.employeeId : actor.id;
    const sendingAsAdmin = isAdmin && Boolean(body.employeeId) && (body.employeeId !== actor.id || hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN']));

    const employee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      select: {
        id: true,
        role: true,
        legalName: true,
        workEmail: true,
        assignments: {
          where: { status: 'ACTIVE' },
          select: { subsidiaryId: true },
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Target employee not found.' }, { status: 404 });
    }

    // Enforce HR target role & subsidiary scope
    if (isHrOnly && targetEmployeeId !== actor.id) {
      if (employee.role !== 'STAFF') {
        return NextResponse.json({ error: 'Forbidden: HR cannot message executive accounts on the helpdesk.' }, { status: 403 });
      }
      if (!hrScope.isGlobal) {
        const empSubIds = employee.assignments.map((a) => a.subsidiaryId);
        const inScope = empSubIds.some((id) => hrScope.subsidiaryIds.includes(id));
        if (!inScope) {
          return NextResponse.json(
            { error: 'Forbidden: Target employee is outside your authorized HR subsidiary scope.' },
            { status: 403 }
          );
        }
      }
    }

    const effectiveSenderRole = sendingAsAdmin ? senderRole : 'STAFF';

    const newMessage = await prisma.staffAdminMessage.create({
      data: {
        employeeId: targetEmployeeId,
        channel: targetChannel,
        senderRole: effectiveSenderRole,
        senderId: actor.id,
        senderName: actor.legalName,
        message: messageText,
        attachmentUrl: body.attachmentUrl || null,
        attachmentName: body.attachmentName || null,
        isReadByStaff: !sendingAsAdmin,
        isReadByAdmin: sendingAsAdmin,
      },
    });

    // Pipeline-Aware Notification & Email Dispatch:
    if (sendingAsAdmin) {
      const channelLabel = targetChannel === 'GMD' ? 'Executive Desk (GMD)' : 'HR Operations Desk';
      await prisma.systemNotification.create({
        data: {
          employeeId: targetEmployeeId,
          kind: 'CHAT',
          title: `New message from ${actor.legalName} (${channelLabel})`,
          body: messageText.length > 100 ? `${messageText.slice(0, 100)}...` : messageText,
          linkUrl: targetChannel === 'GMD' ? '/helpdesk?channel=GMD' : '/helpdesk?channel=HR',
        },
      });

      if (employee.workEmail) {
        sendChatMessageEmail({
          to: employee.workEmail,
          recipientName: employee.legalName,
          senderName: actor.legalName,
          senderRole: effectiveSenderRole,
          messageText,
          attachmentName: body.attachmentName || null,
          contextTitle: `BEMS ${channelLabel}`,
          actionUrl: `https://bemserp.work/helpdesk?channel=${targetChannel}`,
        }).catch((err) => console.error('Failed to email staff on admin message:', err));
      }
    } else {
      // Message sent by Staff: Route STRICTLY according to targetChannel and subsidiary scope
      if (targetChannel === 'GMD') {
        const gmds = await prisma.employee.findMany({
          where: {
            role: 'GMD',
            status: 'ACTIVE',
            approvalStatus: 'APPROVED',
          },
          select: { id: true, legalName: true, workEmail: true },
        });

        if (gmds.length > 0) {
          await prisma.systemNotification.createMany({
            data: gmds.map((adm) => ({
              employeeId: adm.id,
              kind: 'CHAT',
              title: `Direct Executive Message from ${actor.legalName}`,
              body: messageText.length > 100 ? `${messageText.slice(0, 100)}...` : messageText,
              linkUrl: `/helpdesk?employeeId=${targetEmployeeId}&channel=GMD`,
            })),
          });

          for (let i = 0; i < gmds.length; i++) {
            const adm = gmds[i];
            if (adm.workEmail) {
              if (i > 0) await new Promise((r) => setTimeout(r, 600));
              await sendChatMessageEmail({
                to: adm.workEmail,
                recipientName: adm.legalName,
                senderName: actor.legalName,
                senderRole: 'STAFF',
                messageText,
                attachmentName: body.attachmentName || null,
                contextTitle: `Staff Direct Line: ${actor.legalName}`,
                actionUrl: `https://bemserp.work/helpdesk?employeeId=${targetEmployeeId}&channel=GMD`,
              }).catch((err) => console.error(`Failed to email GMD ${adm.workEmail}:`, err));
            }
          }
        }

        // Real-time WhatsApp alert to GMD on incoming staff message
        resolveGmdNotificationTarget()
          .then((gmdTarget) => {
            if (!gmdTarget.phone) return;
            const snippet = messageText.length > 160 ? `${messageText.slice(0, 160)}...` : messageText;
            return dispatchNotificationBridge({
              channel: 'WHATSAPP',
              recipient: gmdTarget.phone,
              eventType: 'STAFF_MESSAGE',
              title: `New Staff Message from ${actor.legalName}`,
              summary: `"${snippet}"\n\n🔗 Reply in BEMS Helpdesk: https://bemserp.work/helpdesk?employeeId=${targetEmployeeId}&channel=GMD`,
              correlationId: `staff_msg_${newMessage.id}`,
              metadata: {
                employeeId: targetEmployeeId,
                senderName: actor.legalName,
                rawText: `💬 *BEMS Staff Message*\nFrom: *${actor.legalName}*\n\n"${snippet}"\n\n🔗 Reply: https://bemserp.work/helpdesk?employeeId=${targetEmployeeId}&channel=GMD`,
              },
            });
          })
          .catch((err) => console.error('Failed to dispatch WhatsApp staff message alert:', err));
      } else {
        // Route to HR-authorized personnel in the employee's subsidiary
        const empSubIds = employee.assignments.map((a) => a.subsidiaryId);
        const hrCandidates = await prisma.employee.findMany({
          where: {
            role: 'STAFF',
            status: 'ACTIVE',
            approvalStatus: 'APPROVED',
            assignments: {
              some: {
                status: 'ACTIVE',
                department: { code: { in: ['HR', 'HUMAN_RESOURCES', 'PEOPLE_OPS'] } },
                ...(empSubIds.length > 0 ? { subsidiaryId: { in: empSubIds } } : {}),
              },
            },
          },
          select: { id: true, legalName: true, workEmail: true },
        });

        if (hrCandidates.length > 0) {
          await prisma.systemNotification.createMany({
            data: hrCandidates.map((hr) => ({
              employeeId: hr.id,
              kind: 'CHAT',
              title: `HR Helpdesk Inquiry from ${actor.legalName}`,
              body: messageText.length > 100 ? `${messageText.slice(0, 100)}...` : messageText,
              linkUrl: `/hr?employeeId=${targetEmployeeId}&tab=CHAT`,
            })),
          });

          for (let i = 0; i < hrCandidates.length; i++) {
            const hr = hrCandidates[i];
            if (hr.workEmail) {
              if (i > 0) await new Promise((r) => setTimeout(r, 600));
              await sendChatMessageEmail({
                to: hr.workEmail,
                recipientName: hr.legalName,
                senderName: actor.legalName,
                senderRole: 'STAFF',
                messageText,
                attachmentName: body.attachmentName || null,
                contextTitle: `HR Operations Helpdesk: ${actor.legalName}`,
                actionUrl: `https://bemserp.work/hr?employeeId=${targetEmployeeId}&tab=CHAT`,
              }).catch((err) => console.error(`Failed to email HR ${hr.workEmail}:`, err));
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      channel: targetChannel,
      message: newMessage,
    });
  } catch (error) {
    console.error('Error posting staff-admin message:', error);
    return NextResponse.json({ error: 'Failed to send message.' }, { status: 500 });
  }
}
