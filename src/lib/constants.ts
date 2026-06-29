// Centralized domain constants (seed defaults + UI fallbacks)

export const SERVICES: string[] = [
  "DIA", "L2VPN", "IEPL", "IPLC", "EoSDH", "Layer 1", "Layer 2", "Dark Fiber",
  "DWDM", "CWDM", "Ethernet", "EVPL", "EPL", "Metro Ethernet", "MPLS",
  "MPLS VPN", "L3VPN", "VPLS", "IP Transit", "IP Peering", "Cloud Connect",
  "AWS Direct Connect", "Azure ExpressRoute", "Google Cloud Interconnect",
  "SDWAN", "Managed WAN", "Managed Router", "Managed Firewall", "Managed Switch",
  "Cross Connect", "Colocation", "Last Mile", "Microwave", "Satellite", "VSAT",
  "Internet", "Broadband", "Router", "Firewall", "Managed Services",
  "Monitoring", "Others",
];

export const PARTNERS: string[] = [
  "AT&T", "BT", "Orange", "NTT", "Telecom Egypt", "Telstra", "Vodafone",
  "Tata Communications", "Arelion", "Lumen", "PCCW", "Sparkle", "China Telecom",
  "China Unicom", "China Mobile", "Singtel", "STC", "du", "e&", "Omantel",
  "Ooredoo", "Bharti Airtel", "Zenlayer", "Neutrality", "CMC", "DC Connect",
  "IGNETS", "Netsentia", "CU", "Exa Infrastructure", "Colt", "Cogent", "GTT",
  "Megaport", "Console Connect", "HGC", "KDDI", "SoftBank", "Telefonica",
  "Swisscom", "PLDT", "Globe", "Others",
];

export const RFQ_STATUSES = [
  "NEW", "ASSIGNED", "PENDING", "SUBMITTED", "WON", "LOST", "CANCELLED",
] as const;

export const PENDING_WITH = ["SALES", "PRESALES", "SOURCING"] as const;

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

// Fields Presales may edit. Everything else is read-only for PRESALES role.
export const PRESALES_EDITABLE_FIELDS = [
  "pendingWith",
  "reasonForDelay",
  // comments & attachments handled via their own endpoints
] as const;

// Fields only SALES may edit on an RFQ body
export const SALES_ONLY_FIELDS = [
  "partnerName", "partnerId", "customerName", "customerId",
  "expectedProposalDate", "status", "services", "capacity", "bandwidth",
  "priority", "assignedToId", "aiOfferEnabled", "opportunityNo",
  "protection", "remarks", "specialInstructions", "title", "countries",
  "locations",
] as const;

export const DEFAULT_ORG = { name: "Invexal", slug: "invexal" };
