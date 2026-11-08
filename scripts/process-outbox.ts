import { processDeliveryOutbox } from '../src/lib/services/delivery-outbox';
import { prisma } from '../src/lib/prisma';
processDeliveryOutbox(undefined, 100).then(result => console.log(JSON.stringify(result))).finally(() => prisma.$disconnect()).catch(() => { process.exitCode = 1; });
