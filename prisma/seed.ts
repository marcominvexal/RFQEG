import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { SERVICES, PARTNERS, DEFAULT_ORG } from "../src/lib/constants";
import { blobEnabled, DB_PATH } from "../src/lib/blob-storage";
import { del } from "@vercel/blob";
import { _resetForTests } from "../src/lib/jsondb";

export async function runSeed(options: { reset?: boolean } = {}) {
  if (options.reset) {
    const file = path.resolve(process.cwd(), process.env.DB_FILE || "database.json");
    if (fs.existsSync(file)) {
      fs.rmSync(file);
      console.log(`Reset: removed ${file}`);
    }
    if (blobEnabled()) {
      await del(DB_PATH).catch(() => {});
    }
    _resetForTests();
  }
  console.log("Seeding…");

  const org = await prisma.organization.upsert({
    where: { slug: DEFAULT_ORG.slug },
    update: {},
    create: { name: DEFAULT_ORG.name, slug: DEFAULT_ORG.slug },
  });

  // --- Users (two portals only) ---
  const salesPass = await bcrypt.hash("sales123", 10);
  const presalesPass = await bcrypt.hash("presales123", 10);

  const sales = await prisma.user.upsert({
    where: { email: "sales@invexal.com" },
    update: {},
    create: {
      organizationId: org.id,
      email: "sales@invexal.com",
      name: "Sales Admin",
      passwordHash: salesPass,
      role: "SALES",
    },
  });

  await prisma.user.upsert({
    where: { email: "presales@invexal.com" },
    update: {},
    create: {
      organizationId: org.id,
      email: "presales@invexal.com",
      name: "Presales / Sourcing",
      passwordHash: presalesPass,
      role: "PRESALES",
    },
  });
  const presales = await prisma.user.findUnique({ where: { email: "presales@invexal.com" } });

  // --- Services ---
  for (const name of SERVICES) {
    await prisma.service.upsert({
      where: { organizationId_name: { organizationId: org.id, name } },
      update: {},
      create: { organizationId: org.id, name },
    });
  }

  // --- Partners ---
  for (const name of PARTNERS) {
    await prisma.partner.upsert({
      where: { organizationId_name: { organizationId: org.id, name } },
      update: {},
      create: { organizationId: org.id, name },
    });
  }

  // --- Customers ---
  const customers = ["DHL", "Maersk", "HSBC", "Unilever", "Etisalat", "Saudi Aramco"];
  for (const name of customers) {
    await prisma.customer.upsert({
      where: { organizationId_name: { organizationId: org.id, name } },
      update: {},
      create: { organizationId: org.id, name },
    });
  }

  // --- Suppliers (carrier database for the AI engine) ---
  const suppliers = [
    { name: "BT Wholesale", country: "United Kingdom", coverage: "Global IP & Ethernet, strong EMEA last-mile", countries: ["United Kingdom", "Pakistan", "UAE"], services: ["DIA", "IP Transit", "L2VPN"], leadTimeDays: 42, reliabilityScore: 88, performanceScore: 85, responseTimeHours: 12, preferredContact: "wholesale@bt.com" },
    { name: "Orange International", country: "France", coverage: "EMEA & Africa MPLS / IPLC backbone", countries: ["France", "UAE", "Egypt"], services: ["L2VPN", "IEPL", "IPLC"], leadTimeDays: 56, reliabilityScore: 90, performanceScore: 87, responseTimeHours: 18, preferredContact: "intl@orange.com" },
    { name: "Lumen", country: "United States", coverage: "Tier-1 global IP backbone, APAC & Americas", countries: ["Singapore", "United States"], services: ["IP Transit", "DIA", "DWDM"], leadTimeDays: 28, reliabilityScore: 92, performanceScore: 90, responseTimeHours: 8, preferredContact: "carrier@lumen.com" },
    { name: "Telecom Egypt", country: "Egypt", coverage: "Subsea hub Egypt, Med routes", countries: ["Egypt", "France"], services: ["DWDM", "Dark Fiber", "IPLC"], leadTimeDays: 70, reliabilityScore: 80, performanceScore: 78, responseTimeHours: 24, preferredContact: "wholesale@te.eg" },
  ];
  for (const s of suppliers) {
    await prisma.supplier.upsert({
      where: { organizationId_name: { organizationId: org.id, name: s.name } },
      update: {},
      create: { organizationId: org.id, ...s },
    });
  }

  // --- Enrich a few partners + add contacts ---
  const btPartner = await prisma.partner.update({
    where: { organizationId_name: { organizationId: org.id, name: "BT" } },
    data: { country: "United Kingdom", services: ["DIA", "IP Transit", "L2VPN"], email: "accounts@bt.com", accountManager: "James Carter", preferredSupplier: true },
  }).catch(() => null);
  if (btPartner) {
    await prisma.partnerContact.create({
      data: { partnerId: btPartner.id, name: "James Carter", role: "Account Manager", email: "james.carter@bt.com", phone: "+44 20 7000 1000" },
    }).catch(() => {});
  }
  await prisma.partner.update({
    where: { organizationId_name: { organizationId: org.id, name: "Lumen" } },
    data: { country: "United States", services: ["IP Transit", "DIA"], email: "carrier@lumen.com", accountManager: "Priya Nair" },
  }).catch(() => null);

  // --- Settings ---
  await prisma.setting.upsert({
    where: { organizationId_key: { organizationId: org.id, key: "aiOfferActivationHours" } },
    update: { value: 24 },
    create: { organizationId: org.id, key: "aiOfferActivationHours", value: 24 },
  });

  // --- Sample RFQs ---
  const now = new Date();
  const days = (n: number) => new Date(now.getTime() + n * 86400000);

  const samples = [
    {
      rfqNumber: "RFQ-2026-0001",
      title: "RE: EG Solution Request | MPPL791023 | BT | DHL | DIA",
      partnerName: "BT", customerName: "DHL",
      services: ["DIA"], capacity: "100 Mbps",
      locations: ["Karachi", "Lahore"], countries: ["Pakistan"],
      opportunityNo: "MPPL791023",
      status: "PENDING", pendingWith: "PRESALES",
      priority: "HIGH",
      expectedProposalDate: days(3),
    },
    {
      rfqNumber: "RFQ-2026-0002",
      title: "Solution Request | Orange | Maersk | L2VPN Dubai-London",
      partnerName: "Orange", customerName: "Maersk",
      services: ["L2VPN", "IEPL"], capacity: "1 Gbps",
      locations: ["Dubai", "London"], countries: ["UAE", "United Kingdom"],
      opportunityNo: "OPP-55120",
      status: "ASSIGNED", pendingWith: "SOURCING",
      priority: "CRITICAL",
      expectedProposalDate: days(1),
    },
    {
      rfqNumber: "RFQ-2026-0003",
      title: "Solution Request | Lumen | HSBC | IP Transit",
      partnerName: "Lumen", customerName: "HSBC",
      services: ["IP Transit"], capacity: "10 Gbps",
      locations: ["Singapore"], countries: ["Singapore"],
      opportunityNo: "OPP-77301",
      status: "NEW", pendingWith: "SALES",
      priority: "MEDIUM",
      expectedProposalDate: days(6),
    },
    {
      rfqNumber: "RFQ-2026-0004",
      title: "Solution Request | Telecom Egypt | Unilever | DWDM",
      partnerName: "Telecom Egypt", customerName: "Unilever",
      services: ["DWDM", "Dark Fiber"], capacity: "100 Gbps",
      locations: ["Cairo", "Marseille"], countries: ["Egypt", "France"],
      opportunityNo: "OPP-99012",
      status: "WON", pendingWith: "SALES",
      priority: "HIGH",
      expectedProposalDate: days(-5),
    },
  ];

  for (const s of samples) {
    const partner = await prisma.partner.findUnique({
      where: { organizationId_name: { organizationId: org.id, name: s.partnerName } },
    });
    const customer = await prisma.customer.findUnique({
      where: { organizationId_name: { organizationId: org.id, name: s.customerName } },
    });
    const deadline = s.expectedProposalDate
      ? new Date(s.expectedProposalDate.getTime() - 86400000)
      : null;

    const rfq = await prisma.rfq.upsert({
      where: { organizationId_rfqNumber: { organizationId: org.id, rfqNumber: s.rfqNumber } },
      update: {},
      create: {
        organizationId: org.id,
        rfqNumber: s.rfqNumber,
        title: s.title,
        partnerId: partner?.id,
        customerId: customer?.id,
        partnerName: s.partnerName,
        customerName: s.customerName,
        services: s.services,
        capacity: s.capacity,
        locations: s.locations,
        countries: s.countries,
        opportunityNo: s.opportunityNo,
        status: s.status,
        pendingWith: s.pendingWith,
        priority: s.priority,
        expectedProposalDate: s.expectedProposalDate,
        deadline,
        salesDelayMins: Math.floor(Math.random() * 600),
        presalesDelayMins: Math.floor(Math.random() * 1200),
        sourcingDelayMins: Math.floor(Math.random() * 900),
      },
    });

    await prisma.activity.create({
      data: {
        rfqId: rfq.id, actorId: sales.id, type: "CREATED",
        message: "RFQ created (seed)",
      },
    });
    await prisma.delayHistory.create({
      data: { rfqId: rfq.id, pendingWith: s.pendingWith, startedAt: now },
    });
  }

  // --- Demo email thread + comments for workflow verification ---
  const rfq1 = await prisma.rfq.findFirst({ where: { organizationId: org.id, rfqNumber: "RFQ-2026-0001" } });
  const rfq2 = await prisma.rfq.findFirst({ where: { organizationId: org.id, rfqNumber: "RFQ-2026-0002" } });
  if (rfq1) {
    await prisma.rfq.update({
      where: { id: rfq1.id },
      data: {
        gmailMessageId: "seed-msg-0001",
        gmailThreadId: "seed-thread-0001",
        aiOfferEnabled: true,
      },
    });
    const threadExists = await prisma.emailThread.findFirst({ where: { rfqId: rfq1.id } });
    if (!threadExists) {
      await prisma.emailThread.createMany({
        data: [
          {
            rfqId: rfq1.id,
            gmailMessageId: "seed-msg-0001-in",
            direction: "INBOUND",
            fromAddr: "partner@bt.com",
            toAddr: "sales@invexal.com",
            subject: "RE: EG Solution Request | MPPL791023 | BT | DHL | DIA",
            body: "Dear Team,\n\nPlease provide a budgetary quote for 100 Mbps DIA in Karachi and Lahore for DHL.\nProtection: protected.\nDeadline: end of week.\n\nRegards,\nBT Partner Team",
            snippet: "Please provide a budgetary quote for 100 Mbps DIA...",
            internalDate: days(-2),
          },
          {
            rfqId: rfq1.id,
            gmailMessageId: "seed-msg-0001-out",
            direction: "OUTBOUND",
            fromAddr: "sales@invexal.com",
            toAddr: "partner@bt.com",
            subject: "RE: EG Solution Request | MPPL791023 | BT | DHL | DIA",
            body: "Thanks — received. Presales is reviewing feasibility and will revert with a budgetary offer shortly.",
            snippet: "Thanks — received. Presales is reviewing...",
            internalDate: days(-1),
          },
        ],
      });
    }
    const commentExists = await prisma.comment.findFirst({ where: { rfqId: rfq1.id } });
    if (!commentExists) {
      await prisma.comment.createMany({
        data: [
          { rfqId: rfq1.id, authorId: sales.id, type: "INTERNAL", body: "Customer needs protected DIA with 99.9% SLA." },
          ...(presales ? [{ rfqId: rfq1.id, authorId: presales.id, type: "SUPPLIER", body: "Requested last-mile pricing from two local suppliers." }] : []),
        ],
      });
    }
  }
  if (rfq2) {
    await prisma.rfq.update({
      where: { id: rfq2.id },
      data: { aiOfferEnabled: true },
    });
  }

  // --- Historical quotations (AI learning) ---
  await prisma.quotation.createMany({
    data: [
      { organizationId: org.id, customerName: "DHL", partnerName: "BT", service: "DIA", services: ["DIA"], supplierName: "BT", country: "Pakistan", countries: ["Pakistan"], capacity: "100 Mbps", technology: "Fiber", finalPrice: 1450 as any, currency: "USD", deliveryWeeks: 6, leadTimeDays: 42, outcome: "WON" },
      { organizationId: org.id, customerName: "Maersk", partnerName: "Orange", service: "L2VPN", services: ["L2VPN"], supplierName: "Orange", country: "UAE", countries: ["UAE"], capacity: "1 Gbps", technology: "MPLS", finalPrice: 3200 as any, currency: "USD", deliveryWeeks: 8, leadTimeDays: 56, outcome: "WON" },
      { organizationId: org.id, customerName: "HSBC", partnerName: "Lumen", service: "IP Transit", services: ["IP Transit"], supplierName: "Lumen", country: "Singapore", countries: ["Singapore"], capacity: "10 Gbps", technology: "IP", finalPrice: 5400 as any, currency: "USD", deliveryWeeks: 4, leadTimeDays: 28, outcome: "LOST" },
    ],
  });

  console.log("Seed complete.");
  console.log("Logins:");
  console.log("  Sales    -> sales@invexal.com / sales123");
  console.log("  Presales -> presales@invexal.com / presales123");
}

if (process.argv[1]?.includes("seed")) {
  runSeed({ reset: process.argv.includes("--reset") })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
