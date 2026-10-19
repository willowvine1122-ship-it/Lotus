import { stamp } from "@/lib/ids";
import { randomBytes } from "node:crypto";
import type { Campaign, DonationElement, DonationElementConfig, DonationElementType, ElementDay, FundraisingClient } from "@/lib/types";
import { defaultConfig } from "@/lib/elements";
import { defineModule } from "@/lib/server/workspace";
import { accountFundraising, findCampaign, fundraisingClients, type AccountFundraising } from "./donors";

/*
 * Donation elements, saved per agency in the "elements" module. An
 * element's gifts are real gifts in the donor CRM, credited when a donor
 * gives through the element's checkout; views and checkout opens are
 * reported by the install script on the client's site.
 */

interface ElementStore {
  elements: DonationElement[];
  days: Record<string, ElementDay[]>;
  /** donation id -> element id */
  credit: Record<string, string>;
}

const elementsModule = defineModule<ElementStore>({
  key: "elements",
  init: () => ({ elements: [], days: {}, credit: {} }),
  publicKeys: (s) => s.elements.map((e) => `element:${e.id}`),
});
const DAY = 86_400_000;
const WINDOW = 30;

const uid = () => `el-${stamp()}-${randomBytes(3).toString("hex")}`;

function store(_now: Date): ElementStore {
  return elementsModule.get();
}

function emptyDays(now: Date): ElementDay[] {
  return Array.from({ length: WINDOW }, (_, i) => ({ date: new Date(now.getTime() - (WINDOW - 1 - i) * DAY).toISOString().slice(0, 10), views: 0, opens: 0, gifts: 0, raisedCents: 0 }));
}

/* ------------------------------- reads ------------------------------ */

export function listElements(now: Date): DonationElement[] {
  return store(now).elements;
}

export function findElement(now: Date, id: string): DonationElement | undefined {
  return store(now).elements.find((e) => e.id === id);
}

export function elementDays(now: Date, id: string): ElementDay[] {
  return store(now).days[id] ?? emptyDays(now);
}

/** Which element brought in a gift, if any. */
export function creditedElement(now: Date, donationId: string): string | undefined {
  return store(now).credit[donationId];
}

export function clientForAccount(now: Date, accountId: string): FundraisingClient | undefined {
  return fundraisingClients(now).find((c) => c.account.id === accountId);
}

export function campaignFor(now: Date, e: Pick<DonationElement, "accountId" | "campaignId">): { campaign: Campaign; client: FundraisingClient; data: AccountFundraising } | null {
  const client = clientForAccount(now, e.accountId);
  if (!client) return null;
  const data = accountFundraising(now, client);
  const campaign = data.campaigns.find((c) => c.id === e.campaignId) ?? data.campaigns[0];
  return campaign ? { campaign, client, data } : null;
}

/** Gifts credited to an element, newest first. */
export function elementGifts(now: Date, id: string, limit = 6) {
  const s = store(now);
  const e = s.elements.find((x) => x.id === id);
  if (!e) return [];
  const found = campaignFor(now, e);
  if (!found) return [];
  const { data } = found;
  return data.donations
    .filter((d) => s.credit[d.id] === id && d.status === "succeeded")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((d) => {
      const donor = data.donors.find((x) => x.id === d.donorId);
      return {
        id: d.id,
        donorId: d.donorId,
        name: donor ? `${donor.contact.firstName} ${donor.contact.lastName}`.trim() : "Donor",
        amountCents: d.amountCents,
        monthly: d.frequency === "monthly",
        at: d.createdAt,
      };
    });
}

/* ------------------------------ writes ------------------------------ */

export function createElement(now: Date, input: { accountId: string; campaignId: string; type: DonationElementType; name: string }): DonationElement | null {
  const s = store(now);
  const found = campaignFor(now, input);
  if (!found) return null;
  const at = now.toISOString();
  const e: DonationElement = {
    id: uid(),
    accountId: input.accountId,
    campaignId: found.campaign.id,
    type: input.type,
    name: input.name,
    status: "live",
    config: defaultConfig(input.type, found.campaign),
    createdAt: at,
    updatedAt: at,
  };
  s.elements.unshift(e);
  s.days[e.id] = emptyDays(now);
  return e;
}

export function saveElement(now: Date, id: string, patch: { name: string; campaignId: string; config: DonationElementConfig }): DonationElement | null {
  const s = store(now);
  const e = s.elements.find((x) => x.id === id);
  if (!e) return null;
  const campaign = campaignFor(now, { accountId: e.accountId, campaignId: patch.campaignId });
  Object.assign(e, { name: patch.name, campaignId: campaign?.campaign.id ?? e.campaignId, config: patch.config, updatedAt: now.toISOString() });
  return e;
}

export function setElementStatus(now: Date, id: string, status: DonationElement["status"]) {
  const s = store(now);
  const e = s.elements.find((x) => x.id === id);
  if (!e) return null;
  e.status = status;
  e.updatedAt = now.toISOString();
  return e;
}

export function duplicateElement(now: Date, id: string): DonationElement | null {
  const s = store(now);
  const e = s.elements.find((x) => x.id === id);
  if (!e) return null;
  const at = now.toISOString();
  const copy: DonationElement = { ...structuredClone(e), id: uid(), name: `${e.name} (copy)`, status: "paused", createdAt: at, updatedAt: at };
  s.elements.unshift(copy);
  s.days[copy.id] = emptyDays(now);
  return copy;
}

export function deleteElement(now: Date, id: string) {
  const s = store(now);
  s.elements = s.elements.filter((e) => e.id !== id);
  delete s.days[id];
  for (const [d, el] of Object.entries(s.credit)) if (el === id) delete s.credit[d];
}

/** A view or a checkout open reported by an element on a live page. */
export function trackElement(now: Date, id: string, kind: "view" | "open") {
  const s = store(now);
  if (!s.elements.some((e) => e.id === id)) return;
  const day = today(s, now, id);
  if (kind === "view") day.views += 1;
  else day.opens += 1;
}

/** Credit a gift made through an element's checkout. */
export function creditGift(now: Date, id: string, donationId: string, amountCents: number) {
  const s = store(now);
  if (!s.elements.some((e) => e.id === id)) return;
  s.credit[donationId] = id;
  const day = today(s, now, id);
  day.gifts += 1;
  day.raisedCents += amountCents;
  day.opens = Math.max(day.opens, day.gifts);
  day.views = Math.max(day.views, day.opens);
}

function today(s: ElementStore, now: Date, id: string) {
  const key = now.toISOString().slice(0, 10);
  const days = (s.days[id] ??= emptyDays(now));
  let d = days.find((x) => x.date === key);
  if (!d) {
    d = { date: key, views: 0, opens: 0, gifts: 0, raisedCents: 0 };
    days.push(d);
    if (days.length > WINDOW) days.shift();
  }
  return d;
}

/** Used by the public pages to find an element's campaign by slug when one is passed. */
export function campaignBySlug(now: Date, slug: string) {
  return findCampaign(now, slug);
}
