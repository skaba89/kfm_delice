// prisma/production-setup.ts - Idempotent prod setup (no demo data)
// Creates: 1 platform admin + 1 restaurant + 1 restaurant admin
// Usage: bunx tsx prisma/production-setup.ts [--non-interactive]
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import * as readline from "readline";

const prisma = new PrismaClient();
const NON_INTERACTIVE = process.argv.includes("--non-interactive");

function prompt(rl: readline.ReadLine, q: string, def?: string): Promise<string> {
  return new Promise((resolve) => {
    const suffix = def ? ` [${def}]` : "";
    rl.question(`${q}${suffix}: `, (a) => resolve(a.trim() || def || ""));
  });
}
function promptPassword(rl: readline.ReadLine, q: string): Promise<string> {
  return new Promise((resolve) => rl.question(`${q}: `, (a) => resolve(a.trim())));
}
function envOrPrompt(rl: readline.ReadLine, envVar: string, q: string, def?: string): Promise<string> {
  const v = process.env[envVar];
  if (v) { console.log(`  Using ${envVar} from env`); return Promise.resolve(v); }
  if (NON_INTERACTIVE) throw new Error(`${envVar} required in non-interactive mode`);
  return prompt(rl, q, def);
}
function validateEmail(e: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function validatePassword(p: string): { ok: boolean; reason?: string } {
  if (p.length < 8) return { ok: false, reason: "min 8 chars" };
  return { ok: true };
}
function validateSlug(s: string): boolean { return /^[a-z0-9-]+$/.test(s); }

async function main() {
  console.log("\n+ KFM Delice - Production Setup +\n");
  const rl = NON_INTERACTIVE ? null : readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("--- Step 1/3: Platform Admin ---");
  const platformEmail = await envOrPrompt(rl!, "PLATFORM_ADMIN_EMAIL", "  Email");
  if (!validateEmail(platformEmail)) throw new Error(`Invalid email: ${platformEmail}`);
  const existingPlatform = await prisma.platformAdmin.findUnique({ where: { email: platformEmail } });
  if (existingPlatform) {
    console.log("  Platform admin exists - skipping (idempotent)");
  } else {
    let pw = process.env.PLATFORM_ADMIN_PASSWORD || "";
    if (!pw && !NON_INTERACTIVE) pw = await promptPassword(rl!, "  Password (min 8 chars)");
    const check = validatePassword(pw);
    if (!check.ok) throw new Error(`Invalid password: ${check.reason}`);
    const name = await envOrPrompt(rl!, "PLATFORM_ADMIN_NAME", "  Name", "Super Admin");
    await prisma.platformAdmin.create({
      data: { email: platformEmail, password: await hash(pw, 10), name, role: "super_admin", status: "active" },
    });
    console.log(`  Created platform admin: ${platformEmail}`);
  }

  console.log("\n--- Step 2/3: Restaurant ---");
  const rName = await envOrPrompt(rl!, "RESTAURANT_NAME", "  Restaurant name");
  let slug = process.env.RESTAURANT_SLUG || "";
  if (!slug && !NON_INTERACTIVE) {
    slug = await prompt(rl!, "  Slug", rName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  }
  if (!validateSlug(slug)) throw new Error(`Invalid slug: ${slug}`);
  const existingR = await prisma.restaurant.findUnique({ where: { slug } });
  let restaurantId: string;
  if (existingR) {
    console.log("  Restaurant exists - skipping (idempotent)");
    restaurantId = existingR.id;
  } else {
    const rEmail = await envOrPrompt(rl!, "RESTAURANT_EMAIL", "  Email");
    if (!validateEmail(rEmail)) throw new Error(`Invalid email: ${rEmail}`);
    const rPhone = await envOrPrompt(rl!, "RESTAURANT_PHONE", "  Phone", "+224 600 00 00 00");
    const rAddr = await envOrPrompt(rl!, "RESTAURANT_ADDRESS", "  Address", "Conakry, Guinea");
    const ownerName = await envOrPrompt(rl!, "RESTAURANT_OWNER_NAME", "  Owner name", "Owner");
    const ownerEmail = await envOrPrompt(rl!, "RESTAURANT_OWNER_EMAIL", "  Owner email", rEmail);
    const r = await prisma.restaurant.create({
      data: {
        name: rName, slug, tagline: "", description: "",
        phone: rPhone, whatsapp: rPhone, email: rEmail, address: rAddr,
        hours: "Lun-Dim : 11h00 - 23h00", rating: 0, tables: 20,
        deliveryFee: 5000, minDelivery: 15000,
        deliveryZones: "Kaloum:Dixinn:Matam:Matoto",
        plan: "pro", status: "active", currency: "GNF", locale: "fr",
        ownerEmail, ownerName, ownerPhone: rPhone,
      },
    });
    restaurantId = r.id;
    console.log(`  Created restaurant: ${rName} (${slug})`);
    await prisma.restaurantConfig.create({
      data: {
        restaurantId, heroImage: "",
        primaryColor: "#ea580c", accentColor: "#f97316",
        menuCategories: JSON.stringify([
          { id: "entrees", name: "Entrees" },
          { id: "plats", name: "Plats Principaux" },
          { id: "desserts", name: "Desserts" },
          { id: "boissons", name: "Boissons" },
        ]),
        features: JSON.stringify(["delivery", "takeaway", "dinein", "reservations", "loyalty"]),
        openingHours: JSON.stringify({
          mon: { open: "11:00", close: "23:00" }, tue: { open: "11:00", close: "23:00" },
          wed: { open: "11:00", close: "23:00" }, thu: { open: "11:00", close: "23:00" },
          fri: { open: "11:00", close: "23:00" }, sat: { open: "11:00", close: "23:00" },
          sun: { open: "11:00", close: "23:00" },
        }),
      },
    });
    console.log("  Created restaurant config");
  }

  console.log("\n--- Step 3/3: Restaurant Admin ---");
  const aEmail = await envOrPrompt(rl!, "RESTAURANT_ADMIN_EMAIL", "  Admin email");
  if (!validateEmail(aEmail)) throw new Error(`Invalid email: ${aEmail}`);
  const existingA = await prisma.admin.findUnique({ where: { email: aEmail } });
  if (existingA) {
    console.log("  Restaurant admin exists - skipping (idempotent)");
  } else {
    let pw = process.env.RESTAURANT_ADMIN_PASSWORD || "";
    if (!pw && !NON_INTERACTIVE) pw = await promptPassword(rl!, "  Password (min 8 chars)");
    const check = validatePassword(pw);
    if (!check.ok) throw new Error(`Invalid password: ${check.reason}`);
    const name = await envOrPrompt(rl!, "RESTAURANT_ADMIN_NAME", "  Name", "Manager");
    await prisma.admin.create({
      data: { email: aEmail, password: await hash(pw, 10), name, role: "admin", status: "active", restaurantId },
    });
    console.log(`  Created restaurant admin: ${aEmail}`);
  }

  console.log("\n+ Production setup complete +");
  console.log(`|  Platform admin:  ${platformEmail}`);
  console.log(`|  Restaurant:      ${rName} (${slug})`);
  console.log(`|  Restaurant admin:${aEmail}`);
  console.log("+\n");
  if (!NON_INTERACTIVE) rl!.close();
}

main()
  .catch((err) => { console.error("\nSetup failed:", err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
