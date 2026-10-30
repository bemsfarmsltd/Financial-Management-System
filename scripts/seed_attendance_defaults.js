const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding attendance stations, policies, and schedules into PostgreSQL...');

  const orgs = await prisma.organization.findMany();
  if (orgs.length === 0) {
    console.log('No organizations found.');
    return;
  }

  const hqOrg = orgs.find(o => o.code.includes('HQ') || o.code.includes('GROUP')) || orgs[0];

  // 1. Seed or Upsert Policies
  for (const org of orgs) {
    await prisma.attendancePolicy.upsert({
      where: { organizationId: org.id },
      update: {
        resumptionTime: '08:00',
        closingTime: '17:00',
        gracePeriodMinutes: 15,
        latenessDeductionPercent: 5.0,
        absenceDeductionPercent: 100.0,
      },
      create: {
        organizationId: org.id,
        resumptionTime: '08:00',
        closingTime: '17:00',
        gracePeriodMinutes: 15,
        latenessDeductionPercent: 5.0,
        absenceDeductionPercent: 100.0,
        requireGeofence: true,
        requireQrScan: true,
      },
    });
  }

  // 2. Seed Default Stations
  const stations = [
    {
      organizationId: hqOrg.id,
      name: 'Lagos Corporate HQ - Reception Kiosk',
      code: 'LAGOS-HQ-K1',
      latitude: 6.4281, // Victoria Island, Lagos
      longitude: 3.4219,
      radiusMeters: 150,
      activeSecret: crypto.randomBytes(32).toString('hex'),
      status: 'ACTIVE',
    },
    {
      organizationId: hqOrg.id,
      name: 'Benin Regional Operations & Logistics Hub',
      code: 'BENIN-OPS-K1',
      latitude: 6.3350, // Benin City
      longitude: 5.6037,
      radiusMeters: 200,
      activeSecret: crypto.randomBytes(32).toString('hex'),
      status: 'ACTIVE',
    },
    {
      organizationId: hqOrg.id,
      name: 'Abuja Regional Liaison Office Kiosk',
      code: 'ABUJA-OFFICE-K1',
      latitude: 9.0765, // Abuja CBD
      longitude: 7.3986,
      radiusMeters: 150,
      activeSecret: crypto.randomBytes(32).toString('hex'),
      status: 'ACTIVE',
    },
  ];

  for (const st of stations) {
    await prisma.attendanceStation.upsert({
      where: { code: st.code },
      update: {
        name: st.name,
        latitude: st.latitude,
        longitude: st.longitude,
        radiusMeters: st.radiusMeters,
      },
      create: st,
    });
  }

  // 3. Ensure All Employees have a Work Schedule (Sunday & Saturday off by default)
  const employees = await prisma.employee.findMany();
  console.log(`Found ${employees.length} employees to configure work schedules...`);

  for (const emp of employees) {
    await prisma.staffWorkSchedule.upsert({
      where: { employeeId: emp.id },
      update: {},
      create: {
        employeeId: emp.id,
        weeklyOffDays: '0,6', // Sunday (0) and Saturday (6) off
        customShiftIn: '08:00',
        customShiftOut: '17:00',
        isExempt: false,
      },
    });
  }

  console.log('✅ Attendance stations, policies, and employee schedules initialized successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding attendance defaults:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
