/*
 * Typical price books and good/better/best estimates by trade, loaded into a
 * field-service client's price book on request (see loadStarterKit), and
 * sales tax by city.
 */

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

export interface Counters {
  job: number;
  estimate: number;
  invoice: number;
}
