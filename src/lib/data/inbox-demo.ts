import type { Channel, Contact, ContactSource, Conversation, InboxMessage } from "@/lib/types";

/*
 * Synthetic inbox: leads and donors writing in to the agency's clients over
 * SMS, email, WhatsApp and Facebook, with the team's replies and internal
 * notes. Times are relative to now so the inbox always looks live. All of
 * this is labelled demo data in the UI.
 */

type Line =
  | [minutesAgo: number, channel: Channel, direction: "in" | "out", body: string, extra?: { subject?: string; by?: string; status?: InboxMessage["status"] }]
  | [minutesAgo: number, "note", by: string, body: string];

interface Spec {
  id: string;
  accountId: string;
  contact: {
    first: string;
    last: string;
    phone?: string;
    email?: string;
    city?: string;
    source: ContactSource;
    tags?: string[];
    valueCents?: number;
    recurring?: boolean;
    noSms?: boolean;
    createdDaysAgo: number;
  };
  assignee?: string;
  status?: "open" | "closed";
  unread?: number;
  lines: Line[];
}

const specs: Spec[] = [
  {
    id: "cv-1",
    accountId: "acc-2",
    contact: { first: "Dana", last: "Whitfield", phone: "(303) 555-0148", email: "dana.whitfield@gmail.com", city: "Lakewood, CO", source: "meta", tags: ["Storm damage", "Insurance claim"], valueCents: 1_240_000, createdDaysAgo: 2 },
    assignee: "Mahad",
    unread: 2,
    lines: [
      [2890, "sms", "in", "Hi, I filled out the form about hail damage. Can someone come look at the roof this week?"],
      [2884, "sms", "out", "Hi Dana, this is Summit Roofing. Thanks for reaching out. We have Thursday 10am or Friday 2pm for a free inspection. Which works?", { by: "Mahad", status: "delivered" }],
      [2870, "sms", "in", "Thursday 10 works"],
      [2866, "sms", "out", "Booked. Our inspector Luis will text when he's on the way.", { by: "Mahad", status: "delivered" }],
      [1500, "note", "Mahad", "Insurance is State Farm. Adjuster visit not scheduled yet; offered to meet the adjuster on site."],
      [38, "sms", "in", "Luis just left. He said the adjuster needs photos of the north slope too, can you send those?"],
      [36, "sms", "in", "Also is there any way to move the install before the 20th? We have family coming."],
    ],
  },
  {
    id: "cv-2",
    accountId: "acc-1",
    contact: { first: "Priya", last: "Raman", phone: "(512) 555-0193", email: "priya.raman@outlook.com", city: "Round Rock, TX", source: "google", tags: ["Implants"], valueCents: 480_000, createdDaysAgo: 6 },
    assignee: "Afza",
    unread: 1,
    lines: [
      [8600, "email", "in", "Hello,\n\nI saw the implants offer on Google. Does the $2,400 price include the crown, and do you take Delta Dental PPO?\n\nThanks,\nPriya", { subject: "Question about the implants offer" }],
      [8540, "email", "out", "Hi Priya,\n\nYes, the $2,400 includes the implant, abutment and crown. We are in network with Delta Dental PPO, and most plans cover part of the crown.\n\nWould you like a free consult? We have openings next Tuesday and Wednesday.\n\nBrightside Dental", { subject: "Re: Question about the implants offer", by: "Afza", status: "read" }],
      [8420, "email", "in", "Tuesday afternoon would be great.", { subject: "Re: Question about the implants offer" }],
      [8400, "sms", "out", "Hi Priya, you're booked for Tue 3:30pm at Brightside Dental, 2100 S Lamar. Reply C to confirm.", { by: "Afza", status: "delivered" }],
      [8390, "sms", "in", "C"],
      [52, "sms", "in", "Running about 10 minutes late, sorry!"],
    ],
  },
  {
    id: "cv-3",
    accountId: "acc-3",
    contact: { first: "Margaret", last: "O'Neill", email: "moneill@bostonlaw.com", city: "Brookline, MA", source: "donation-page", tags: ["Major donor", "Monthly"], valueCents: 250_000, recurring: true, createdDaysAgo: 400 },
    assignee: "Sara",
    unread: 1,
    lines: [
      [20200, "email", "out", "Dear Margaret,\n\nThank you for your gift to the winter shelter campaign. Your receipt is attached.\n\nWith gratitude,\nHope Harbor Foundation", { subject: "Thank you for your gift", by: "Sara", status: "read" }],
      [95, "email", "in", "Hi Sara,\n\nI'd like to increase my monthly gift from $150 to $250 starting next month, and I need a combined receipt for this year for my accountant. Can you help with both?\n\nBest,\nMargaret", { subject: "Changing my monthly gift" }],
    ],
  },
  {
    id: "cv-4",
    accountId: "acc-7",
    contact: { first: "Luis", last: "Ortega", phone: "(602) 555-0177", city: "Mesa, AZ", source: "meta", tags: ["Rebate push"], valueCents: 2_600_000, createdDaysAgo: 1 },
    unread: 3,
    lines: [
      [130, "whatsapp", "in", "Hola, I saw your ad about the solar rebate. Is it still available?"],
      [128, "whatsapp", "in", "My electric bill is about $340 a month in summer"],
      [126, "whatsapp", "in", "Do you do the paperwork for the federal credit?"],
    ],
  },
  {
    id: "cv-5",
    accountId: "acc-10",
    contact: { first: "Kevin", last: "Brandt", phone: "(407) 555-0124", email: "kbrandt@me.com", city: "Winter Park, FL", source: "website", tags: ["Pool build"], valueCents: 5_800_000, createdDaysAgo: 12 },
    assignee: "Mahad",
    lines: [
      [4300, "sms", "in", "Got the quote, thanks. Can you do the spa spillover for under 60?"],
      [4280, "sms", "out", "Let me check with our designer and get back to you today.", { by: "Mahad", status: "delivered" }],
      [3900, "note", "Mahad", "Designer says $61.5K is the floor with spillover. Offer travertine upgrade at no charge instead of cutting price."],
      [3880, "sms", "out", "Kevin, we can't get below $61.5K with the spillover, but we'll include the travertine deck upgrade at no charge. Want me to send the revised contract?", { by: "Mahad", status: "delivered" }],
      [180, "sms", "in", "Yes send it over. My wife wants to see the 3D render again too."],
      [174, "sms", "out", "Sending both now.", { by: "Mahad", status: "delivered" }],
    ],
  },
  {
    id: "cv-6",
    accountId: "acc-4",
    contact: { first: "Jordan", last: "Lee", city: "St. Paul, MN", source: "meta", tags: ["Adoption inquiry"], createdDaysAgo: 0, noSms: true },
    unread: 1,
    lines: [[240, "facebook", "in", "Hi! Is Biscuit the beagle still available for adoption? We have a fenced yard and another dog."]],
  },
  {
    id: "cv-7",
    accountId: "acc-5",
    contact: { first: "Tom", last: "Haskins", phone: "(619) 555-0109", city: "Chula Vista, CA", source: "google", tags: ["AC repair"], valueCents: 76_000, createdDaysAgo: 0 },
    assignee: "Sara",
    lines: [
      [300, "sms", "in", "AC is blowing warm air and the outside unit is buzzing. Can someone come today?"],
      [296, "sms", "out", "Hi Tom, Air Pro HVAC here. A tech can be there between 2 and 4pm today. Diagnostic is $89, waived if you go ahead with the repair. Book it?", { by: "Sara", status: "delivered" }],
      [290, "sms", "in", "Yes please"],
      [289, "sms", "out", "Done. Mike will text 30 minutes before he arrives.", { by: "Sara", status: "delivered" }],
    ],
  },
  {
    id: "cv-8",
    accountId: "acc-16",
    contact: { first: "Aisha", last: "Bello", email: "aisha.bello@yahoo.com", city: "Tacoma, WA", source: "donation-page", tags: ["First gift"], valueCents: 5_000, createdDaysAgo: 1 },
    unread: 1,
    lines: [[420, "email", "in", "Hi, I donated $50 last night but I never got a receipt email. Could you resend it? I want to use my employer's match.\n\nAisha", { subject: "Missing receipt" }]],
  },
  {
    id: "cv-9",
    accountId: "acc-6",
    contact: { first: "Greg", last: "Pollard", phone: "(813) 555-0161", city: "Brandon, FL", source: "referral", tags: ["Water heater"], valueCents: 210_000, createdDaysAgo: 30 },
    assignee: "Mahad",
    status: "closed",
    lines: [
      [11800, "sms", "in", "Water heater is leaking from the bottom, how soon can you come?"],
      [11790, "sms", "out", "Tomorrow 8am works. We'll bring a 50 gal replacement in case.", { by: "Mahad", status: "delivered" }],
      [10300, "sms", "in", "All done and working great. Thanks guys"],
      [10290, "sms", "out", "Glad to hear it, Greg. If you have a minute, a Google review helps us a lot: g.page/harbor-plumbing", { by: "Mahad", status: "delivered" }],
    ],
  },
  {
    id: "cv-10",
    accountId: "acc-8",
    contact: { first: "Rachel", last: "Kim", phone: "(614) 555-0132", email: "rachel.kim@gmail.com", city: "Dublin, OH", source: "meta", tags: ["Back to school", "Invisalign"], valueCents: 520_000, createdDaysAgo: 4 },
    assignee: "Sara",
    lines: [
      [5800, "facebook", "in", "Do you offer payment plans for Invisalign? My daughter is 13."],
      [5760, "facebook", "out", "We do! Plans start at $189/month with $0 down. Would you like to book a free consult for her?", { by: "Sara", status: "read" }],
      [5700, "facebook", "in", "Yes, after school if possible"],
      [5690, "sms", "out", "Hi Rachel, Maple Lane Orthodontics here. We have Thu 4:15pm for the free Invisalign consult. Reply YES to book.", { by: "Sara", status: "failed" }],
      [5600, "note", "Sara", "SMS bounced, number may be a landline. Followed up on Messenger instead."],
      [5598, "facebook", "out", "Hi Rachel, I tried to text you. We have Thursday 4:15pm for the consult, does that work?", { by: "Sara", status: "read" }],
      [5500, "facebook", "in", "Perfect, see you then"],
    ],
  },
  {
    id: "cv-11",
    accountId: "acc-17",
    contact: { first: "Daniel", last: "Tremblay", phone: "(416) 555-0187", email: "dtremblay@rogers.com", city: "Toronto, ON", source: "donation-page", tags: ["Monthly"], valueCents: 36_000, recurring: true, createdDaysAgo: 220 },
    assignee: "Afza",
    unread: 1,
    lines: [
      [1300, "whatsapp", "out", "Hi Daniel, it's Shelter First. Your monthly card ending 4417 was declined this morning. Could you update it here: give.shelterfirst.ca/update", { by: "Afza", status: "read" }],
      [610, "whatsapp", "in", "Thanks for the heads up. Updated it just now, new card ends 9021."],
    ],
  },
  {
    id: "cv-12",
    accountId: "acc-14",
    contact: { first: "Beth", last: "Carver", phone: "(615) 555-0155", email: "bcarver@gmail.com", city: "Franklin, TN", source: "google", tags: ["Privacy fence"], valueCents: 860_000, createdDaysAgo: 3 },
    unread: 1,
    lines: [
      [3600, "email", "in", "We need about 180 feet of 6ft cedar privacy fence. Can you send a ballpark price and your next opening?", { subject: "Fence quote" }],
      [3400, "email", "out", "Hi Beth,\n\nFor 180ft of 6ft cedar with two gates, the ballpark is $8,200 to $8,900 installed. Our next install opening is the week of the 26th. Can we stop by to measure?\n\nIronclad Fencing", { subject: "Re: Fence quote", by: "Mahad", status: "sent" }],
      [700, "email", "in", "That works. Any day after 3pm is fine, gate code is 4410.", { subject: "Re: Fence quote" }],
    ],
  },
  {
    id: "cv-13",
    accountId: "acc-12",
    contact: { first: "Sam", last: "Patel", phone: "(916) 555-0119", city: "Elk Grove, CA", source: "website", tags: ["Local move"], valueCents: 180_000, createdDaysAgo: 8 },
    assignee: "Afza",
    lines: [
      [9800, "sms", "in", "Need a quote for a 3 bedroom move on the 24th, about 12 miles"],
      [9780, "sms", "out", "Hi Sam, Redwood Movers. For a 3BR local move that's usually 6 to 7 hours with a 4-person crew, about $1,650 to $1,900. Want us to hold the 24th?", { by: "Afza", status: "delivered" }],
      [9600, "sms", "in", "Yes please hold it"],
      [1450, "sms", "out", "Reminder: your move is confirmed for Thu the 24th, crew arrives 8am. Reply if anything changes.", { by: "Afza", status: "delivered" }],
    ],
  },
  {
    id: "cv-14",
    accountId: "acc-15",
    contact: { first: "Thomas", last: "Nguyen", email: "tnguyen@nguyenfamilyfund.org", city: "Evanston, IL", source: "referral", tags: ["Foundation", "Major donor"], valueCents: 2_500_000, createdDaysAgo: 60 },
    assignee: "Sara",
    lines: [
      [7300, "email", "in", "Hi team,\n\nOur family foundation board approved a $25,000 grant for the spring scholarship cohort. Who should I send the grant agreement to?\n\nThomas", { subject: "Spring cohort grant" }],
      [7200, "note", "Sara", "Huge. Loop in Director Andrea before replying; she signs grant agreements."],
      [7100, "email", "out", "Thomas,\n\nThis is wonderful news, thank you. Please send the agreement to Andrea Brooks, our executive director, at andrea@brightfutures.org. I've copied her here.\n\nSara", { subject: "Re: Spring cohort grant", by: "Sara", status: "read" }],
    ],
  },
  {
    id: "cv-15",
    accountId: "acc-13",
    contact: { first: "Megan", last: "Fox", phone: "(608) 555-0140", city: "Middleton, WI", source: "meta", tags: ["New patient"], valueCents: 24_000, createdDaysAgo: 0 },
    unread: 2,
    lines: [
      [560, "facebook", "in", "Are you taking new patients? I have two cats who need their yearly shots."],
      [555, "facebook", "in", "Saturday would be ideal if you're open"],
    ],
  },
  {
    id: "cv-16",
    accountId: "acc-11",
    contact: { first: "Chris", last: "Dunn", phone: "(503) 555-0171", email: "chris.dunn@hey.com", city: "Beaverton, OR", source: "google", tags: ["Maintenance plan"], valueCents: 320_000, createdDaysAgo: 40 },
    assignee: "Mahad",
    status: "closed",
    lines: [
      [16000, "email", "in", "Can we pause the biweekly mowing for the winter months?", { subject: "Pause service" }],
      [15800, "email", "out", "Hi Chris, done. Mowing pauses Nov 1 and resumes Mar 15. Leaf cleanup stays on the schedule.", { subject: "Re: Pause service", by: "Mahad", status: "read" }],
    ],
  },
  {
    id: "cv-17",
    accountId: "acc-9",
    contact: { first: "Ana", last: "Morales", phone: "(412) 555-0126", city: "Mt. Lebanon, PA", source: "meta", tags: ["Spring repair"], valueCents: 34_000, createdDaysAgo: 1 },
    unread: 1,
    lines: [[880, "whatsapp", "in", "Garage door spring snapped this morning and the door won't open. My car is stuck inside. How fast can you come?"]],
  },
  {
    id: "cv-18",
    accountId: "acc-18",
    contact: { first: "Pastor", last: "Williams", phone: "(404) 555-0152", email: "office@gracechapelatl.org", city: "Decatur, GA", source: "referral", tags: ["Volunteer group"], createdDaysAgo: 15 },
    assignee: "Afza",
    lines: [
      [2600, "email", "in", "We'd like to bring 20 volunteers from our youth group on the 31st for the food drive. Is there room?", { subject: "Youth group volunteers" }],
      [2500, "email", "out", "Pastor Williams,\n\nWe'd love to have them. The 31st 9am to noon shift has room for 25. I'll send the waiver link for parents.\n\nOpen Hands Food Bank", { subject: "Re: Youth group volunteers", by: "Afza", status: "read" }],
      [1600, "email", "in", "Wonderful, thank you. Waivers are all signed.", { subject: "Re: Youth group volunteers" }],
    ],
  },
  {
    id: "cv-19",
    accountId: "acc-2",
    contact: { first: "Robert", last: "Haines", phone: "(720) 555-0198", city: "Aurora, CO", source: "meta", tags: ["Storm damage"], valueCents: 980_000, createdDaysAgo: 0 },
    unread: 1,
    lines: [[66, "sms", "in", "Saw your ad, got hail damage on the garage roof and a couple of gutters. Do you do free estimates in Aurora?"]],
  },
  {
    id: "cv-20",
    accountId: "acc-1",
    contact: { first: "Helen", last: "Marsh", phone: "(512) 555-0110", email: "hmarsh@icloud.com", city: "Austin, TX", source: "website", tags: ["Cleaning"], valueCents: 32_000, createdDaysAgo: 90 },
    assignee: "Afza",
    lines: [
      [1900, "sms", "out", "Hi Helen, it's been 6 months since your last cleaning at Brightside Dental. Book online here: brightside.dental/book", { by: "Afza", status: "delivered" }],
      [1720, "sms", "in", "Booked for the 19th, thanks for the reminder"],
      [1715, "sms", "out", "See you then!", { by: "Afza", status: "delivered" }],
    ],
  },
];

function minutesAgo(now: Date, m: number) {
  return new Date(now.getTime() - m * 60_000).toISOString();
}

export function demoInbox(now: Date): { contacts: Contact[]; conversations: Conversation[] } {
  const contacts: Contact[] = [];
  const conversations: Conversation[] = [];
  for (const s of specs) {
    const c = s.contact;
    const contactId = `${s.id}-contact`;
    const messages: InboxMessage[] = s.lines.map((line, i) => {
      const id = `${s.id}-m${i + 1}`;
      if (line[1] === "note") {
        return { id, conversationId: s.id, channel: "sms", direction: "outbound", kind: "note", body: line[3], authorName: line[2], sentAt: minutesAgo(now, line[0]) };
      }
      const [m, channel, dir, body, extra] = line;
      return {
        id,
        conversationId: s.id,
        channel,
        direction: dir === "in" ? "inbound" : "outbound",
        kind: "message",
        subject: extra?.subject,
        body,
        authorName: extra?.by,
        status: extra?.status,
        sentAt: minutesAgo(now, m),
      };
    });
    // A note borrows the channel of the message before it so the thread reads in place.
    messages.forEach((msg, i) => {
      if (msg.kind === "note" && i > 0) msg.channel = messages[i - 1].channel;
    });
    contacts.push({
      id: contactId,
      accountId: s.accountId,
      firstName: c.first,
      lastName: c.last,
      email: c.email,
      phone: c.phone,
      city: c.city,
      tags: c.tags ?? [],
      source: c.source,
      stageId: "new",
      ownerName: s.assignee,
      valueCents: c.valueCents ?? 0,
      recurring: c.recurring,
      doNotContact: { email: false, sms: c.noSms ?? false, call: false },
      createdAt: new Date(now.getTime() - c.createdDaysAgo * 86_400_000 - 3_600_000).toISOString(),
      lastActivityAt: messages[messages.length - 1].sentAt,
    });
    conversations.push({
      id: s.id,
      accountId: s.accountId,
      contactId,
      assigneeName: s.assignee,
      status: s.status ?? "open",
      unread: s.unread ?? 0,
      messages,
    });
  }
  return { contacts, conversations };
}
