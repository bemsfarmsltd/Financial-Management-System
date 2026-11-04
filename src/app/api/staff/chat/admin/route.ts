import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, isHrAuthorizedEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendChatMessageEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);

    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedEmployeeId = searchParams.get('employeeId');
    const channelParam = (searchParams.get('channel') || '').toUpperCase();

    const isHr = await isHrAuthorizedEmployee(actor);
    const isGmd = actor.role === 'GMD';
    const isSuperAdmin = actor.role === 'SYSTEM_ADMIN' || actor.role === 'SUPER_ADMIN';
    const isAdmin = isGmd || isSuperAdmin || isHr;

    // Strict Pipeline Security Enforcement:
    // 1. HR can NEVER access the GMD executive channel under any circumstances.
    if (isHr && channelParam === 'GMD') {
      return NextResponse.json(
        { error: 'Access denied: The GMD Executive channel is strictly confidential and inaccessible to HR.' },
        { status: 403 }
      );
    }

    // Determine effective channel
    let effectiveChannel = 'GMD';
    if (isHr) {
      effectiveChannel = 'HR';
    } else if (channelParam === 'HR') {
      effectiveChannel = 'HR';
    } else {
      effectiveChannel = 'GMD';
    }

    // Scenario A: Admin viewing thread list for their designated channel
    if (isAdmin && !requestedEmployeeId) {
      // Fetch messages strictly matching this channel
      const recentMessages = await prisma.staffAdminMessage.findMany({
        where: { channel: effectiveChannel },
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              legalName: true,
              employeeNumber: true,
              workEmail: true,
              avatarUrl: true,
              assignments: { select: { isPrimary: true, subsidiary: { select: { legalName: true, code: true } } } },
            },
          },
        },
        take: 500,
      });

      const threadMap = new Map<string, {
        employee: any;
        lastMessage: any;
        unreadCount: number;
        channel: string;
      }>();

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
    const targetEmployeeId = isAdmin && requestedEmployeeId ? requestedEmployeeId : actor.id;

    const messages = await prisma.staffAdminMessage.findMany({
      where: {
        employeeId: targetEmployeeId,
        channel: effectiveChannel,
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    // Mark messages as read based on who is reading
    if (isAdmin) {
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

    const targetEmployee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      select: {
        id: true,
        legalName: true,
        employeeNumber: true,
        workEmail: true,
        avatarUrl: true,
        assignments: { select: { isPrimary: true, subsidiary: { select: { legalName: true, code: true } } } },
      },
    });

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

    const isHr = await isHrAuthorizedEmployee(actor);
    const isGmd = actor.role === 'GMD';
    const isSuperAdmin = actor.role === 'SYSTEM_ADMIN' || actor.role === 'SUPER_ADMIN';
    const isAdmin = isGmd || isSuperAdmin || isHr;

    // Strict Pipeline Validation:
    // HR is restricted to HR channel only
    if (isHr && body.channel === 'GMD') {
      return NextResponse.json(
        { error: 'Forbidden: HR accounts cannot send messages on the GMD Executive channel.' },
        { status: 403 }
      );
    }

    let targetChannel = 'GMD';
    let senderRole = 'STAFF';

    if (isHr) {
      targetChannel = 'HR';
      senderRole = 'HR';
    } else if (isGmd) {
      targetChannel = 'GMD';
      senderRole = 'GMD';
    } else if (isSuperAdmin) {
      targetChannel = body.channel === 'HR' ? 'HR' : 'GMD';
      senderRole = 'SYSTEM_ADMIN';
    } else {
      // Staff sender: Can address GMD or HR
      targetChannel = body.channel === 'HR' ? 'HR' : 'GMD';
      senderRole = 'STAFF';
    }

    const targetEmployeeId = isAdmin && body.employeeId ? body.employeeId : actor.id;

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      select: { id: true, legalName: true, workEmail: true },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Target employee not found.' }, { status: 404 });
    }

    const newMessage = await prisma.staffAdminMessage.create({
      data: {
        employeeId: targetEmployeeId,
        channel: targetChannel,
        senderRole,
        senderId: actor.id,
        senderName: actor.legalName,
        message: messageText,
        attachmentUrl: body.attachmentUrl || null,
        attachmentName: body.attachmentName || null,
        isReadByStaff: !isAdmin, // if staff sent it, staff already read it
        isReadByAdmin: isAdmin,  // if admin sent it, admin already read it
      },
    });

    // Pipeline-Aware Notification & Email Dispatch:
    if (isAdmin) {
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
          senderRole: actor.role,
          messageText,
          attachmentName: body.attachmentName || null,
          contextTitle: `BEMS ${channelLabel}`,
          actionUrl: `https://bemserp.work/helpdesk?channel=${targetChannel}`,
        }).catch((err) => console.error('Failed to email staff on admin message:', err));
      }
    } else {
      // Message sent by Staff: Route STRICTLY according to targetChannel
      if (targetChannel === 'GMD') {
        // Route EXCLUSIVELY to GMD - Never to HR!
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
      } else {
        // Route EXCLUSIVELY to HR - Never to GMD!
        const hrPersonnel = await prisma.employee.findMany({
          where: {
            role: 'HR',
            status: 'ACTIVE',
            approvalStatus: 'APPROVED',
          },
          select: { id: true, legalName: true, workEmail: true },
        });

        if (hrPersonnel.length > 0) {
          await prisma.systemNotification.createMany({
            data: hrPersonnel.map((hr) => ({
              employeeId: hr.id,
              kind: 'CHAT',
              title: `HR Helpdesk Inquiry from ${actor.legalName}`,
              body: messageText.length > 100 ? `${messageText.slice(0, 100)}...` : messageText,
              linkUrl: `/hr?employeeId=${targetEmployeeId}&tab=CHAT`,
            })),
          });

          for (let i = 0; i < hrPersonnel.length; i++) {
            const hr = hrPersonnel[i];
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
