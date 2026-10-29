import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendChatMessageEmail } from '@/lib/email';

export async function GET(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);

    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedEmployeeId = searchParams.get('employeeId');
    const isAdmin = actor.role === 'GMD' || actor.role === 'SYSTEM_ADMIN' || actor.role === 'FINANCE_MANAGER';

    // Scenario A: Admin viewing a thread list of all employees
    if (isAdmin && !requestedEmployeeId) {
      // Group recent messages by employee
      const recentMessages = await prisma.staffAdminMessage.findMany({
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
      }>();

      for (const msg of recentMessages) {
        if (!threadMap.has(msg.employeeId)) {
          threadMap.set(msg.employeeId, {
            employee: msg.employee,
            lastMessage: msg,
            unreadCount: msg.isReadByAdmin ? 0 : 1,
          });
        } else {
          const item = threadMap.get(msg.employeeId)!;
          if (!msg.isReadByAdmin) {
            item.unreadCount += 1;
          }
        }
      }

      return NextResponse.json({
        success: true,
        isAdmin: true,
        threads: Array.from(threadMap.values()),
      });
    }

    // Scenario B: Specific conversation thread
    const targetEmployeeId = isAdmin && requestedEmployeeId ? requestedEmployeeId : actor.id;

    const messages = await prisma.staffAdminMessage.findMany({
      where: { employeeId: targetEmployeeId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    // Mark messages as read based on who is reading
    if (isAdmin) {
      await prisma.staffAdminMessage.updateMany({
        where: {
          employeeId: targetEmployeeId,
          isReadByAdmin: false,
        },
        data: { isReadByAdmin: true },
      });
    } else {
      await prisma.staffAdminMessage.updateMany({
        where: {
          employeeId: targetEmployeeId,
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

    return NextResponse.json({
      success: true,
      employee: targetEmployee,
      messages,
    });
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

    const isAdmin = actor.role === 'GMD' || actor.role === 'SYSTEM_ADMIN' || actor.role === 'FINANCE_MANAGER';
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
        senderRole: isAdmin ? actor.role : 'STAFF',
        senderId: actor.id,
        senderName: actor.legalName,
        message: messageText,
        attachmentUrl: body.attachmentUrl || null,
        attachmentName: body.attachmentName || null,
        isReadByStaff: !isAdmin, // if staff sent it, staff already read it
        isReadByAdmin: isAdmin,  // if admin sent it, admin already read it
      },
    });

    // Notify the other party via SystemNotification and direct email
    if (isAdmin) {
      await prisma.systemNotification.create({
        data: {
          employeeId: targetEmployeeId,
          kind: 'CHAT',
          title: `New message from ${actor.legalName} (Admin)`,
          body: messageText.length > 100 ? `${messageText.slice(0, 100)}...` : messageText,
          linkUrl: '/helpdesk',
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
          contextTitle: 'Corporate Helpdesk & Inquiries',
          actionUrl: 'https://bemserp.work/helpdesk',
        }).catch((err) => console.error('Failed to email staff on admin message:', err));
      }
    } else {
      // Find active admins to notify
      const admins = await prisma.employee.findMany({
        where: {
          role: { in: ['GMD', 'SYSTEM_ADMIN', 'FINANCE_MANAGER'] },
          status: 'ACTIVE',
          approvalStatus: 'APPROVED',
        },
        select: { id: true, legalName: true, workEmail: true },
      });

      if (admins.length > 0) {
        await prisma.systemNotification.createMany({
          data: admins.map((adm) => ({
            employeeId: adm.id,
            kind: 'CHAT',
            title: `Staff message from ${actor.legalName}`,
            body: messageText.length > 100 ? `${messageText.slice(0, 100)}...` : messageText,
            linkUrl: `/helpdesk?employeeId=${targetEmployeeId}`,
          })),
        });

        for (const adm of admins) {
          if (adm.workEmail) {
            sendChatMessageEmail({
              to: adm.workEmail,
              recipientName: adm.legalName,
              senderName: actor.legalName,
              senderRole: 'STAFF',
              messageText,
              attachmentName: body.attachmentName || null,
              contextTitle: `Staff Helpdesk Inquiry: ${actor.legalName}`,
              actionUrl: `https://bemserp.work/helpdesk?employeeId=${targetEmployeeId}`,
            }).catch((err) => console.error(`Failed to email admin ${adm.workEmail}:`, err));
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: newMessage,
    });
  } catch (error) {
    console.error('Error posting staff-admin message:', error);
    return NextResponse.json({ error: 'Failed to send message.' }, { status: 500 });
  }
}
