import type { ActivityKind, Contact, Estimate, EstimateOption, Invoice, Job, LineItem, MarketingClient, Payment, PaymentMethod, Technician } from "@/lib/types";
import { addDays, dayDiff, localDate, localStamp, minutesOf, stampAt, totals } from "@/lib/field";

/*
 * Synthetic field service: a crew per home-services client, three weeks of
 * jobs either side of today, the estimates that led to them, and the
 * invoices and payments that followed. Seeded per client so the numbers are
 * stable across requests. Demo data.
 */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;

type Item = [name: string, dollars: number];
type Use = [itemIndex: number, qty: number];
interface Trade {
  book: Item[];
  /** Day-to-day jobs: title, items, minutes. */
  jobs: [string, Use[], number][];
  /** Larger work sold on good / better / best estimates: title, base, better adds, best adds, minutes. */
  sells: [string, Use[], Use[], Use[], number][];
  roles: [string, string];
}

/** Price books by industry. Only clients whose industry is listed run field service. */
export const trades: Record<string, Trade> = {
  Roofing: {
    book: [["Roof inspection", 189], ["Shingle repair, per square", 425], ["Tear-off and replace, per square", 640], ["Seamless gutter, per ft", 14], ["Ridge vent", 520], ["Storm tarp", 350], ["Ice and water shield, per roll", 95], ["Skylight reflash", 680]],
    jobs: [["Roof inspection", [[0, 1]], 60], ["Shingle repair", [[1, 2]], 180], ["Storm tarp and inspection", [[5, 1], [0, 1]], 120], ["Skylight leak", [[7, 1]], 150], ["Gutter run replacement", [[3, 60]], 180]],
    sells: [["Roof replacement", [[2, 24]], [[6, 6]], [[4, 1], [3, 140]], 480], ["Storm damage repair", [[1, 6]], [[6, 3]], [[4, 1]], 300]],
    roles: ["Crew lead", "Roofer"],
  },
  HVAC: {
    book: [["Diagnostic visit", 129], ["AC tune-up", 149], ["Capacitor", 245], ["Refrigerant, per lb", 95], ["Furnace repair", 420], ["16 SEER heat pump, installed", 9800], ["Smart thermostat, installed", 389], ["Duct cleaning", 450], ["10-year labor warranty", 1200]],
    jobs: [["AC not cooling", [[0, 1], [2, 1]], 90], ["AC tune-up", [[1, 1]], 60], ["Refrigerant recharge", [[0, 1], [3, 3]], 90], ["Furnace repair", [[0, 1], [4, 1]], 120], ["Thermostat install", [[6, 1]], 60], ["Duct cleaning", [[7, 1]], 180]],
    sells: [["Heat pump replacement", [[5, 1]], [[6, 1]], [[8, 1], [7, 1]], 480], ["System tune and repair", [[1, 1], [2, 1]], [[3, 2]], [[6, 1]], 120]],
    roles: ["Lead tech", "HVAC tech"],
  },
  Plumbing: {
    book: [["Service call", 99], ["Drain clearing", 225], ["50 gal water heater, installed", 2150], ["Tankless water heater, installed", 4200], ["Leak repair", 310], ["Toilet replacement", 480], ["Camera inspection", 275], ["Repipe, per fixture", 650], ["Expansion tank", 260]],
    jobs: [["Kitchen drain clog", [[0, 1], [1, 1]], 60], ["Leak under slab", [[0, 1], [4, 1], [6, 1]], 120], ["Toilet replacement", [[5, 1]], 90], ["Camera inspection", [[6, 1]], 60], ["Water heater flush", [[0, 1]], 45]],
    sells: [["Water heater replacement", [[2, 1]], [[8, 1]], [[3, 1]], 240], ["Repipe", [[7, 6]], [[7, 3]], [[6, 1]], 600]],
    roles: ["Master plumber", "Plumber"],
  },
  Solar: {
    book: [["Site assessment", 250], ["400W panel, installed", 780], ["String inverter", 2400], ["Battery, 13.5 kWh", 11500], ["Panel cleaning", 189], ["Monitoring setup", 350], ["Permits and interconnection", 1200], ["Critter guard, per ft", 9]],
    jobs: [["Site assessment", [[0, 1]], 90], ["Panel cleaning", [[4, 1]], 90], ["Monitoring setup", [[5, 1]], 60], ["Critter guard install", [[7, 80]], 150], ["Inverter fault", [[0, 1]], 120]],
    sells: [["Solar install, 7.2 kW", [[1, 18], [2, 1], [6, 1]], [[5, 1], [7, 90]], [[3, 1]], 600], ["Battery backup", [[3, 1]], [[5, 1]], [[6, 1]], 300]],
    roles: ["Install lead", "Installer"],
  },
  "Garage doors": {
    book: [["Tune-up", 119], ["Spring replacement, pair", 349], ["Opener, installed", 640], ["Cable repair", 189], ["Insulated door 16x7, installed", 2350], ["Panel replacement", 520], ["Keypad", 89]],
    jobs: [["Broken spring", [[1, 1]], 60], ["Door off track", [[3, 1], [0, 1]], 75], ["Opener install", [[2, 1]], 120], ["Tune-up", [[0, 1]], 45], ["Panel replacement", [[5, 1]], 90]],
    sells: [["New garage door", [[4, 1]], [[2, 1]], [[6, 1], [0, 1]], 300]],
    roles: ["Senior tech", "Door tech"],
  },
  Pools: {
    book: [["Weekly service, month", 180], ["Variable speed pump, installed", 1450], ["Heater, installed", 3800], ["Acid wash", 550], ["Resurfacing", 12500], ["Filter clean", 145], ["LED light, installed", 890]],
    jobs: [["Weekly service", [[0, 1]], 45], ["Filter clean", [[5, 1]], 60], ["Green pool, acid wash", [[3, 1]], 240], ["Pump not priming", [[5, 1]], 90], ["Light replacement", [[6, 1]], 120]],
    sells: [["Pool resurfacing", [[4, 1]], [[6, 1]], [[1, 1]], 600], ["Equipment upgrade", [[1, 1]], [[2, 1]], [[6, 1]], 300]],
    roles: ["Service lead", "Pool tech"],
  },
  Landscaping: {
    book: [["Maintenance visit", 75], ["Spring cleanup", 420], ["Mulch, per yard", 68], ["Paver patio, per sq ft", 22], ["Irrigation repair", 240], ["Tree trimming", 650], ["Sod, per sq ft", 2.4]],
    jobs: [["Maintenance visit", [[0, 1]], 60], ["Seasonal cleanup", [[1, 1]], 240], ["Mulch beds", [[2, 8]], 180], ["Sprinkler repair", [[4, 1]], 90], ["Tree trimming", [[5, 1]], 240]],
    sells: [["Backyard patio", [[3, 320]], [[2, 6]], [[6, 400]], 600], ["Front yard refresh", [[6, 600]], [[2, 10]], [[4, 1]], 480]],
    roles: ["Crew lead", "Landscaper"],
  },
  Moving: {
    book: [["Three movers, per hour", 189], ["Truck and fuel", 220], ["Packing materials", 145], ["Piano move", 450], ["Storage, month", 199], ["Full packing service", 680]],
    jobs: [["Apartment move", [[0, 4], [1, 1]], 240], ["House move", [[0, 7], [1, 1], [2, 1]], 420], ["Piano move", [[3, 1]], 120], ["Packing day", [[5, 1], [2, 1]], 300]],
    sells: [["Full house move", [[0, 8], [1, 1]], [[2, 1]], [[5, 1], [4, 1]], 480]],
    roles: ["Lead mover", "Mover"],
  },
  Fencing: {
    book: [["Cedar fence, per ft", 42], ["Vinyl fence, per ft", 58], ["Gate, installed", 650], ["Post replacement", 120], ["Fence repair", 280], ["Stain and seal, per ft", 6], ["Old fence removal, per ft", 8]],
    jobs: [["Fence repair", [[4, 1]], 120], ["Post replacement", [[3, 3]], 180], ["Gate install", [[2, 1]], 180], ["Stain and seal", [[5, 120]], 300]],
    sells: [["New backyard fence", [[0, 160]], [[2, 1], [6, 160]], [[5, 160]], 600], ["Vinyl privacy fence", [[1, 140]], [[2, 1]], [[6, 140]], 600]],
    roles: ["Crew lead", "Installer"],
  },
};

const taxByCity: Record<string, number> = {
  "Denver, CO": 881, "San Diego, CA": 775, "Tampa, FL": 750, "Phoenix, AZ": 860, "Pittsburgh, PA": 700,
  "Orlando, FL": 650, "Portland, OR": 0, "Sacramento, CA": 875, "Nashville, TN": 925, "Austin, TX": 825,
};
export function taxRateFor(location: string) {
  return taxByCity[location] ?? 700;
}

const crewFirst = ["Marco", "Dee", "Tyler", "Rosa", "Jamal", "Kenji", "Lena", "Hector", "Bri", "Cole", "Ana", "Wes", "Nina", "Theo", "Gabe", "Ruth"];
const crewLast = ["Alvarez", "Brennan", "Cho", "Diaz", "Ekwueme", "Ford", "Gill", "Holt", "Ivanov", "Jensen", "Kaur", "Lowe"];
const streets = ["Maple", "Oak", "Cedar", "Pine", "Elm", "Willow", "Aspen", "Birch", "Lakeview", "Hillcrest", "Sunset", "Ridge", "Meadow", "Juniper"];
const suffixes = ["St", "Ave", "Dr", "Ln", "Ct", "Way", "Blvd"];
const tones: Technician["tone"][] = ["teal", "orange", "violet", "ink"];

export interface FieldSeed {
  technicians: Technician[];
  jobs: Job[];
  estimates: Estimate[];
  invoices: Invoice[];
  activities: { contactId: string; kind: ActivityKind; title: string; body?: string; by?: string; amountCents?: number; at: string }[];
}

export interface Counters {
  job: number;
  estimate: number;
  invoice: number;
}

/** Offset of a zone's wall clock from UTC at `now`, in ms. */
export function zoneOffset(now: Date, timeZone: string) {
  return Date.parse(`${localStamp(now, timeZone)}:00Z`) - Math.floor(now.getTime() / 60000) * 60000;
}

export function stampToIso(stamp: string, offset: number) {
  return new Date(Date.parse(`${stamp}:00Z`) - offset).toISOString();
}

export function demoFieldFor(c: MarketingClient, contacts: Contact[], now: Date, n: Counters): FieldSeed {
  const trade = trades[c.industry];
  const out: FieldSeed = { technicians: [], jobs: [], estimates: [], invoices: [], activities: [] };
  if (!trade || contacts.length === 0) return out;
  const acc = c.account.id;
  const r = rng([...acc].reduce((a, ch) => a + ch.charCodeAt(0), 0) * 104729);
  const today = localDate(now, c.timeZone);
  const nowStamp = localStamp(now, c.timeZone);
  const nowMin = minutesOf(nowStamp);
  const offset = zoneOffset(now, c.timeZone);
  const iso = (stamp: string) => stampToIso(stamp, offset);
  const isPast = (stamp: string) => stamp <= nowStamp;
  const tax = taxRateFor(c.location);
  const office = c.assignees[0]?.name ?? "Office";

  // Crew
  const crewSize = 3 + Math.floor(r() * 2);
  const usedNames = new Set<string>();
  for (let i = 0; i < crewSize; i++) {
    let name = "";
    do name = `${pick(r, crewFirst)} ${pick(r, crewLast)}`;
    while (usedNames.has(name));
    usedNames.add(name);
    out.technicians.push({
      id: `${acc}-tech${i + 1}`,
      accountId: acc,
      name,
      initials: name.split(" ").map((p) => p[0]).join(""),
      tone: tones[i % tones.length]!,
      role: i === 0 ? trade.roles[0] : trade.roles[1],
      phone: `(${300 + Math.floor(r() * 600)}) 555-0${100 + Math.floor(r() * 900)}`,
    });
  }

  const customers = contacts.filter((ct) => ct.stageId !== "lost" && ct.stageId !== "new");
  const pool = customers.length ? customers : contacts;
  const address = (ct: Contact) => `${100 + Math.floor(r() * 9800)} ${pick(r, streets)} ${pick(r, suffixes)}, ${ct.city ?? c.location}`;
  const items = (uses: Use[]): LineItem[] =>
    uses.map(([i, q], k) => {
      const [name, dollars] = trade.book[i]!;
      return { id: `li${k}-${Math.floor(r() * 1e9).toString(36)}`, name, quantity: q, unitCents: Math.round(dollars * 100) };
    });
  const fullName = (ct: Contact) => `${ct.firstName} ${ct.lastName}`;

  const pushJob = (job: Omit<Job, "id" | "number">) => {
    const j: Job = { ...job, id: `${acc}-j${out.jobs.length + 1}`, number: `J-${n.job++}` };
    out.jobs.push(j);
    return j;
  };

  // Estimates first; approved ones become jobs on the board.
  const estimateCount = 7 + Math.floor(r() * 6);
  for (let i = 0; i < estimateCount; i++) {
    const ct = pick(r, pool);
    const [title, base, plus, best, minutes] = pick(r, trade.sells);
    const multi = r() < 0.75;
    const options: EstimateOption[] = multi
      ? [
          { id: "good", name: "Good", lineItems: items(base) },
          { id: "better", name: "Better", lineItems: items([...base, ...plus]) },
          { id: "best", name: "Best", lineItems: items([...base, ...plus, ...best]) },
        ]
      : [{ id: "only", name: "Estimate", lineItems: items(base) }];
    const createdDay = addDays(today, -Math.floor(Math.pow(r(), 1.3) * 40));
    const createdStamp = stampAt(createdDay, (8 + Math.floor(r() * 9)) * 60);
    if (!isPast(createdStamp)) continue;
    const age = dayDiff(today, createdDay);
    const e: Estimate = {
      id: `${acc}-e${i + 1}`,
      number: `E-${n.estimate++}`,
      accountId: acc,
      contactId: ct.id,
      title,
      address: address(ct),
      status: "draft",
      options,
      taxRateBps: tax,
      message: multi ? "Three options below. Better is what we recommend for most homes like yours." : undefined,
      createdAt: iso(createdStamp),
      expiresOn: addDays(createdDay, 30),
    };
    const roll = r();
    if (age <= 1 && roll < 0.5) {
      // still a draft
    } else {
      e.status = "sent";
      const sentStamp = stampAt(addDays(createdDay, age > 0 ? 1 : 0), 8 * 60 + Math.floor(r() * 540));
      e.sentAt = iso(isPast(sentStamp) ? sentStamp : createdStamp);
      out.activities.push({ contactId: ct.id, kind: "estimate", title: `Estimate ${e.number} sent`, body: title, by: office, at: e.sentAt });
      if (age >= 3 && roll < 0.62) {
        e.status = "approved";
        e.approvedOptionId = multi ? (r() < 0.6 ? "better" : r() < 0.5 ? "best" : "good") : "only";
        const decided = addDays(createdDay, 2 + Math.floor(r() * Math.min(6, age - 2)));
        e.decidedAt = iso(stampAt(decided, 11 * 60 + Math.floor(r() * 300)));
        const opt = options.find((o) => o.id === e.approvedOptionId)!;
        const value = totals(opt.lineItems, tax).total;
        out.activities.push({ contactId: ct.id, kind: "estimate", title: `Estimate ${e.number} approved`, body: multi ? `${opt.name} option` : undefined, by: fullName(ct), amountCents: value, at: e.decidedAt });
        if (r() < 0.75) {
          // Converted into a job: scheduled in the next fortnight, or waiting for a slot.
          const scheduled = r() < 0.88;
          const day = addDays(today, 1 + Math.floor(r() * 12));
          const job = pushJob({
            accountId: acc,
            contactId: ct.id,
            title,
            address: e.address,
            status: scheduled ? "scheduled" : "unscheduled",
            technicianIds: scheduled ? [out.technicians[0]!.id, out.technicians[1 + Math.floor(r() * (crewSize - 1))]!.id] : [],
            start: scheduled ? stampAt(day, 8 * 60) : undefined,
            durationMin: minutes,
            lineItems: structuredClone(opt.lineItems),
            estimateId: e.id,
            createdAt: e.decidedAt,
          });
          e.jobId = job.id;
          out.activities.push({ contactId: ct.id, kind: "job", title: `Job ${job.number} created from ${e.number}`, body: title, by: office, at: e.decidedAt });
        }
      } else if (age >= 5 && roll < 0.78) {
        e.status = "declined";
        e.decidedAt = iso(stampAt(addDays(createdDay, 4), 15 * 60));
        out.activities.push({ contactId: ct.id, kind: "estimate", title: `Estimate ${e.number} declined`, body: pick(r, ["Going with another quote.", "Holding off until next season.", "Insurance did not cover it."]), by: fullName(ct), at: e.decidedAt });
      }
    }
    out.estimates.push(e);
  }

  // Day-to-day jobs, five weeks back and one forward, skipping Sundays.
  for (let d = -35; d <= 6; d++) {
    const day = addDays(today, d);
    if (new Date(`${day}T12:00:00Z`).getUTCDay() === 0) continue;
    for (const tech of out.technicians) {
      let cursor = 8 * 60 + (r() < 0.5 ? 0 : 30);
      const slots = d > 2 || d < -14 ? Math.floor(r() * 2) : 1 + Math.floor(r() * 2.6);
      for (let s = 0; s < slots; s++) {
        const [title, uses, minutes] = pick(r, trade.jobs);
        if (cursor + minutes > 18 * 60) break;
        const ct = pick(r, pool);
        const start = stampAt(day, cursor);
        const end = cursor + minutes;
        const created = stampAt(addDays(day, -(1 + Math.floor(r() * 5))), (8 + Math.floor(r() * 9)) * 60);
        let status: Job["status"] = "scheduled";
        if (d < 0) status = r() < 0.05 ? "canceled" : "completed";
        else if (d === 0) status = end <= nowMin ? "completed" : cursor <= nowMin ? "in_progress" : cursor - 45 <= nowMin ? "en_route" : "scheduled";
        const job = pushJob({
          accountId: acc,
          contactId: ct.id,
          title,
          address: address(ct),
          status,
          technicianIds: [tech.id],
          start,
          durationMin: minutes,
          lineItems: items(uses),
          notes: r() < 0.3 ? pick(r, ["Gate code 4412. Dog in the yard, friendly.", "Customer works from home, call on arrival.", "Park on the street, shared driveway.", "Second visit, bring the replacement part."]) : undefined,
          createdAt: iso(isPast(created) ? created : nowStamp),
          completedAt: status === "completed" ? iso(stampAt(day, end)) : undefined,
        });
        out.activities.push({ contactId: ct.id, kind: "job", title: `Job ${job.number} scheduled`, body: `${title} with ${tech.name}`, by: office, at: job.createdAt });
        if (status === "completed") out.activities.push({ contactId: ct.id, kind: "job", title: `Job ${job.number} completed`, body: title, by: tech.name, at: job.completedAt! });
        cursor = end + 30 + (r() < 0.4 ? 30 : 0);
      }
    }
  }

  // A few jobs waiting for a slot.
  const waiting = 1 + Math.floor(r() * 2);
  for (let i = 0; i < waiting; i++) {
    const [title, uses, minutes] = pick(r, trade.jobs);
    const ct = pick(r, pool);
    const created = stampAt(addDays(today, -Math.floor(r() * 3)), Math.min(nowMin, (8 + Math.floor(r() * 9)) * 60));
    const job = pushJob({ accountId: acc, contactId: ct.id, title, address: address(ct), status: "unscheduled", technicianIds: [], durationMin: minutes, lineItems: items(uses), createdAt: iso(created) });
    out.activities.push({ contactId: ct.id, kind: "job", title: `Job ${job.number} requested`, body: title, by: "System", at: job.createdAt });
  }

  // Invoices for finished work.
  const methods: PaymentMethod[] = ["card", "card", "card", "card", "ach", "ach", "check", "check", "cash"];
  for (const job of out.jobs) {
    if (job.status !== "completed" || !job.start || r() < 0.08) continue;
    const day = job.start.slice(0, 10);
    const age = dayDiff(today, day);
    const ct = contacts.find((x) => x.id === job.contactId)!;
    const inv: Invoice = {
      id: `${acc}-i${out.invoices.length + 1}`,
      number: `INV-${n.invoice++}`,
      accountId: acc,
      contactId: job.contactId,
      jobId: job.id,
      estimateId: job.estimateId,
      title: job.title,
      lineItems: structuredClone(job.lineItems),
      taxRateBps: tax,
      status: "draft",
      issuedOn: day,
      dueOn: addDays(day, 15),
      payments: [],
      createdAt: job.completedAt!,
    };
    job.invoiceId = inv.id;
    const total = totals(inv.lineItems, tax).total;
    const roll = r();
    const pay = (amount: number, afterDays: number, method = pick(r, methods)) => {
      const stamp = stampAt(addDays(day, afterDays), Math.min(17 * 60, minutesOf(job.start!) + job.durationMin + 20));
      const at = iso(isPast(stamp) ? stamp : nowStamp);
      const p: Payment = { id: `${inv.id}-p${inv.payments.length + 1}`, invoiceId: inv.id, amountCents: amount, method, at, reference: method === "card" || method === "ach" ? `pi_demo_${Math.floor(r() * 1e12).toString(36)}` : method === "check" ? `Check ${1000 + Math.floor(r() * 8000)}` : undefined };
      inv.payments.push(p);
      out.activities.push({ contactId: ct.id, kind: "payment", title: `Payment on ${inv.number}`, body: method === "card" ? "Card" : method === "ach" ? "Bank transfer" : method === "check" ? "Check" : "Cash", by: "System", amountCents: amount, at });
    };
    const send = () => {
      inv.status = "sent";
      inv.sentAt = job.completedAt;
      out.activities.push({ contactId: ct.id, kind: "invoice", title: `Invoice ${inv.number} sent`, body: job.title, by: office, amountCents: total, at: inv.sentAt! });
    };
    if (age === 0) {
      if (roll < 0.7) {
        send();
        pay(total, 0, "card");
        inv.status = "paid";
      } // else left as a draft for the office to send
    } else if (age <= 10) {
      if (age <= 3 && roll < 0.05) {
        // draft
      } else {
        send();
        if (roll < 0.62) {
          const after = Math.min(age, Math.floor(r() * 4));
          pay(total, after);
          inv.status = "paid";
        } else if (roll < 0.74) pay(Math.round(total * 0.5), Math.min(age, 1));
      }
    } else {
      send();
      if (roll < 0.86) {
        pay(total, Math.floor(r() * 9));
        inv.status = "paid";
      } else if (roll < 0.92) pay(Math.round(total * 0.4), 2);
      // the rest run overdue
    }
    out.invoices.push(inv);
  }
  return out;
}
