// Demo data — rendered by the pipeline from prisma/schema.prisma. One account per
// role (<role>@example.com, password DEMO_PASSWORD from .env) plus demo@example.com, then every table,
// parents first. Every insert is non-fatal; safe to run again.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const db = new PrismaClient();
const ids: Record<string, Array<string | number>> = {};
const users: Record<string, string | number> = {};
function pick(model: string, i: number): string | number | undefined {
  const list = ids[model] || [];
  return list.length ? list[i % list.length] : undefined;
}
function why(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 200) ?? m;
}

async function main() {
  // DEMO_PASSWORD in .env, random for each project. Unset, nobody can sign in as the demo accounts.
  const demoPassword = process.env.DEMO_PASSWORD || randomUUID();
  if (!process.env.DEMO_PASSWORD) console.log('[seed] demo accounts: DEMO_PASSWORD is not set in .env, so nobody can sign in as them');
  const hashed = await bcrypt.hash(demoPassword, 10);
  try {
    const u = await db.user.upsert({ where: { email: "demo@example.com" }, update: process.env.DEMO_PASSWORD ? { passwordHash: hashed } : {}, create: { id: "00000000-0000-4000-8000-000000000001", email: "demo@example.com", passwordHash: hashed, name: "Demo User", role: "FREELANCE_VIDEO_EDITOR" } });
    if (!users["FREELANCE_VIDEO_EDITOR"]) users["FREELANCE_VIDEO_EDITOR"] = u.id;
    (ids["User"] ??= []).push(u.id);
    console.log('[seed] demo-user: ok demo@example.com');
  } catch (e) {
    console.log('[seed] demo-user: MISSING — ' + why(e));
  }
  try {
    const u = await db.user.upsert({ where: { email: "freelance.video.editor@example.com" }, update: process.env.DEMO_PASSWORD ? { passwordHash: hashed } : {}, create: { email: "freelance.video.editor@example.com", passwordHash: hashed, name: "Demo Freelance Video Editor", role: "FREELANCE_VIDEO_EDITOR" } });
    if (!users["FREELANCE_VIDEO_EDITOR"]) users["FREELANCE_VIDEO_EDITOR"] = u.id;
    (ids["User"] ??= []).push(u.id);
    console.log('[seed] account: ok freelance.video.editor@example.com');
  } catch (e) {
    console.log('[seed] account freelance.video.editor@example.com: ' + why(e));
  }
  try {
    const u = await db.user.upsert({ where: { email: "small.video.editing.business.owner@example.com" }, update: process.env.DEMO_PASSWORD ? { passwordHash: hashed } : {}, create: { email: "small.video.editing.business.owner@example.com", passwordHash: hashed, name: "Demo Small Video Editing Business Owner", role: "SMALL_VIDEO_EDITING_BUSINESS_OWNER" } });
    if (!users["SMALL_VIDEO_EDITING_BUSINESS_OWNER"]) users["SMALL_VIDEO_EDITING_BUSINESS_OWNER"] = u.id;
    (ids["User"] ??= []).push(u.id);
    console.log('[seed] account: ok small.video.editing.business.owner@example.com');
  } catch (e) {
    console.log('[seed] account small.video.editing.business.owner@example.com: ' + why(e));
  }
  try {
    if ((await db.business.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ name: "Pixelhaus Edits", businessType: "FREELANCE", services: ["Video editing", "Color grading", "Motion graphics"], monthlyProjectTarget: 4, workingHoursStart: "09:00", workingHoursEnd: "18:00", currency: "USD", userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 0) }),
        () => ({ name: "Frame & Fold Studio", businessType: "SMALL_BUSINESS", services: ["Brand films", "Documentary editing", "Social cuts"], monthlyProjectTarget: 6, workingHoursStart: "08:30", workingHoursEnd: "17:30", currency: "USD", userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 1) }),
        () => ({ name: "Lena Ortiz Post", businessType: "FREELANCE", services: ["Wedding films", "Reels editing", "Sound mixing"], monthlyProjectTarget: 3, workingHoursStart: "10:00", workingHoursEnd: "17:00", currency: "USD", userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 2) }),
        () => ({ name: "Northwind Cut House", businessType: "SMALL_BUSINESS", services: ["Corporate video", "Subtitling", "Sound design"], monthlyProjectTarget: 8, workingHoursStart: "09:00", workingHoursEnd: "18:00", currency: "USD", userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 3) }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.business.create({ data: row() as never });
          (ids["Business"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] Business row skipped: ' + why(e));
        }
      }
      console.log(`[seed] Business: ${ok}/${rows.length} rows`);
    } else {
      ids["Business"] = (await db.business.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] Business skipped: ' + why(e));
  }
  try {
    if ((await db.task.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ title: "Send color grade to Brightlane", type: "TASK", status: "OPEN", priority: "HIGH", priorityNote: "Blocks their final approval", dueDate: new Date("2025-06-12T00:00:00.000Z"), plannedWeekStart: new Date("2025-06-09T00:00:00.000Z"), completedAt: new Date("2025-05-13T00:00:00.000Z"), projectId: pick("Project", 0), clientId: pick("Client", 0), goalId: pick("Goal", 0), quoteId: pick("Quote", 0), assigneeId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 0), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 0) }),
        () => ({ title: "Follow up on overdue INV-2025-003", type: "FOLLOW_UP", status: "OPEN", priority: "HIGH", priorityNote: "Cashflow depends on this payment", dueDate: new Date("2025-06-10T00:00:00.000Z"), plannedWeekStart: new Date("2025-06-09T00:00:00.000Z"), completedAt: new Date("2025-05-13T00:00:00.000Z"), projectId: pick("Project", 1), clientId: pick("Client", 1), goalId: pick("Goal", 1), quoteId: pick("Quote", 1), assigneeId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 1), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 1) }),
        () => ({ title: "Export social cutdowns for Harbor & Pine", type: "TASK", status: "COMPLETED", priority: "MEDIUM", priorityNote: "", dueDate: new Date("2025-05-14T00:00:00.000Z"), plannedWeekStart: new Date("2025-05-12T00:00:00.000Z"), completedAt: new Date("2025-05-13T00:00:00.000Z"), projectId: pick("Project", 2), clientId: pick("Client", 2), goalId: pick("Goal", 2), quoteId: pick("Quote", 2), assigneeId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 2), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 2) }),
        () => ({ title: "Check in on Kestrel renewal", type: "FOLLOW_UP", status: "OPEN", priority: "LOW", priorityNote: "", dueDate: new Date("2025-06-30T00:00:00.000Z"), plannedWeekStart: new Date("2025-06-16T00:00:00.000Z"), completedAt: new Date("2025-05-19T00:00:00.000Z"), projectId: pick("Project", 3), clientId: pick("Client", 3), goalId: pick("Goal", 3), quoteId: pick("Quote", 3), assigneeId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 3), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 3) }),
        () => ({ title: "Book Marrin wedding shoot crew", type: "TASK", status: "OPEN", priority: "MEDIUM", priorityNote: "Needed before July 1", dueDate: new Date("2025-06-25T00:00:00.000Z"), plannedWeekStart: new Date("2025-06-16T00:00:00.000Z"), completedAt: new Date("2025-05-19T00:00:00.000Z"), projectId: pick("Project", 4), clientId: pick("Client", 4), goalId: pick("Goal", 4), quoteId: pick("Quote", 4), assigneeId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 4), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 4) }),
        () => ({ title: "Renew SSD warranty paperwork", type: "TASK", status: "COMPLETED", priority: "LOW", priorityNote: "", dueDate: new Date("2025-05-20T00:00:00.000Z"), plannedWeekStart: new Date("2025-06-09T00:00:00.000Z"), completedAt: new Date("2025-05-19T00:00:00.000Z"), projectId: pick("Project", 5), clientId: pick("Client", 5), goalId: pick("Goal", 5), quoteId: pick("Quote", 5), assigneeId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 5), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 5) }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.task.create({ data: row() as never });
          (ids["Task"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] Task row skipped: ' + why(e));
        }
      }
      console.log(`[seed] Task: ${ok}/${rows.length} rows`);
    } else {
      ids["Task"] = (await db.task.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] Task skipped: ' + why(e));
  }
  try {
    if ((await db.cashflowForecast.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ horizonDays: 30, projectedInflow: 6000, projectedOutflow: 2100, netCashflow: 3900, baselineBalance: 8400, projectedBalance: 12300, shortfallAmount: 0, generatedAt: new Date("2025-06-08T09:00:00.000Z"), businessId: pick("Business", 0), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 0) }),
        () => ({ horizonDays: 60, projectedInflow: 9800, projectedOutflow: 4300, netCashflow: 5500, baselineBalance: 8400, projectedBalance: 13900, shortfallAmount: 0, generatedAt: new Date("2025-06-08T09:00:00.000Z"), businessId: pick("Business", 1), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 1) }),
        () => ({ horizonDays: 90, projectedInflow: 11200, projectedOutflow: 6900, netCashflow: 4300, baselineBalance: 8400, projectedBalance: 12700, shortfallAmount: 0, generatedAt: new Date("2025-06-08T09:00:00.000Z"), businessId: pick("Business", 2), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 2) }),
        () => ({ horizonDays: 30, projectedInflow: 2400, projectedOutflow: 2650, netCashflow: -250, baselineBalance: 1900, projectedBalance: 1650, shortfallAmount: 1000, generatedAt: new Date("2025-05-15T09:00:00.000Z"), businessId: pick("Business", 3), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 3) }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.cashflowForecast.create({ data: row() as never });
          (ids["CashflowForecast"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] CashflowForecast row skipped: ' + why(e));
        }
      }
      console.log(`[seed] CashflowForecast: ${ok}/${rows.length} rows`);
    } else {
      ids["CashflowForecast"] = (await db.cashflowForecast.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] CashflowForecast skipped: ' + why(e));
  }
  try {
    if ((await db.client.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ name: "Brightlane Films", email: "hello@brightlanefilms.co", phone: "+1 555 0142", address: "210 Mercer St, Austin, TX 78701", status: "ACTIVE", businessId: pick("Business", 0), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 0) }),
        () => ({ name: "Harbor & Pine Coffee", email: "marketing@harborpine.example", phone: "+1 555 0187", address: "48 Dock Road, Portland, OR 97209", status: "ACTIVE", businessId: pick("Business", 1), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 1) }),
        () => ({ name: "Sofia Marrin Photography", email: "sofia@marrinphoto.example", phone: "+1 555 0129", address: "12 Elm Court, Denver, CO 80205", status: "ACTIVE", businessId: pick("Business", 2), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 2) }),
        () => ({ name: "Kestrel Health Partners", email: "media@kestrelhealth.example", phone: "+1 555 0129", address: "900 Commerce Ave, Chicago, IL 60607", status: "INACTIVE", businessId: pick("Business", 3), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 3) }),
        () => ({ name: "Tom Yeung Ventures", email: "tom@yeungventures.example", phone: "+1 555 0173", address: "77 Willow Lane, Nashville, TN 37203", status: "ACTIVE", businessId: pick("Business", 4), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 4) }),
        () => ({ name: "Riverside Yoga Collective", email: "studio@riversideyoga.example", phone: "+1 555 0196", address: "77 Willow Lane, Nashville, TN 37203", status: "INACTIVE", businessId: pick("Business", 5), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 5) }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.client.create({ data: row() as never });
          (ids["Client"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] Client row skipped: ' + why(e));
        }
      }
      console.log(`[seed] Client: ${ok}/${rows.length} rows`);
    } else {
      ids["Client"] = (await db.client.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] Client skipped: ' + why(e));
  }
  try {
    if ((await db.expens.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ description: "Adobe Creative Cloud subscription", amount: 84.99, category: "Software", expenseDate: new Date("2025-06-01T00:00:00.000Z"), projectId: pick("Project", 0), businessId: pick("Business", 0), userId: pick("User", 0) }),
        () => ({ description: "External SSD, 2TB", amount: 129.0, category: "Equipment", expenseDate: new Date("2025-05-18T00:00:00.000Z"), projectId: pick("Project", 1), businessId: pick("Business", 1), userId: pick("User", 1) }),
        () => ({ description: "Coworking day pass", amount: 25.0, category: "Workspace", expenseDate: new Date("2025-05-22T00:00:00.000Z"), projectId: pick("Project", 2), businessId: pick("Business", 2), userId: pick("User", 2) }),
        () => ({ description: "Stock footage license", amount: 149.0, category: "Assets", expenseDate: new Date("2025-06-04T00:00:00.000Z"), projectId: pick("Project", 3), businessId: pick("Business", 3), userId: pick("User", 3) }),
        () => ({ description: "Client lunch, Harbor & Pine kickoff", amount: 62.4, category: "Meals", expenseDate: new Date("2025-04-09T00:00:00.000Z"), projectId: pick("Project", 4), businessId: pick("Business", 4), userId: pick("User", 4) }),
        () => ({ description: "Fast Gmail and Drive storage plan", amount: 9.99, category: "Software", expenseDate: new Date("2025-06-02T00:00:00.000Z"), projectId: pick("Project", 5), businessId: pick("Business", 5), userId: pick("User", 5) }),
        () => ({ description: "Mileage to shoot location", amount: 38.5, category: "Travel", expenseDate: new Date("2025-05-27T00:00:00.000Z"), projectId: pick("Project", 6), businessId: pick("Business", 6), userId: pick("User", 6) }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.expens.create({ data: row() as never });
          (ids["Expens"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] Expens row skipped: ' + why(e));
        }
      }
      console.log(`[seed] Expens: ${ok}/${rows.length} rows`);
    } else {
      ids["Expens"] = (await db.expens.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] Expens skipped: ' + why(e));
  }
  try {
    if ((await db.goal.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ title: "Close 4 projects in Q2", periodStart: new Date("2025-04-01T00:00:00.000Z"), periodEnd: new Date("2025-06-30T00:00:00.000Z"), targetProjectCount: 4, completedCount: 2, status: "ACTIVE", businessId: pick("Business", 0), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 0) }),
        () => ({ title: "Six projects in Q1", periodStart: new Date("2025-01-01T00:00:00.000Z"), periodEnd: new Date("2025-03-31T00:00:00.000Z"), targetProjectCount: 6, completedCount: 6, status: "ACHIEVED", businessId: pick("Business", 1), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 1) }),
        () => ({ title: "Monthly target for April", periodStart: new Date("2025-04-01T00:00:00.000Z"), periodEnd: new Date("2025-04-30T00:00:00.000Z"), targetProjectCount: 3, completedCount: 1, status: "MISSED", businessId: pick("Business", 2), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 2) }),
        () => ({ title: "Land two wedding clients", periodStart: new Date("2025-07-01T00:00:00.000Z"), periodEnd: new Date("2025-09-30T00:00:00.000Z"), targetProjectCount: 2, completedCount: 0, status: "ACTIVE", businessId: pick("Business", 3), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 3) }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.goal.create({ data: row() as never });
          (ids["Goal"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] Goal row skipped: ' + why(e));
        }
      }
      console.log(`[seed] Goal: ${ok}/${rows.length} rows`);
    } else {
      ids["Goal"] = (await db.goal.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] Goal skipped: ' + why(e));
  }
  try {
    if ((await db.healthScore.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ overallScore: 78, projectConsistencyScore: 82, paymentCollectionScore: 65, cashflowStabilityScore: 80, workloadScore: 85, expenseManagementScore: 74, generatedAt: new Date("2025-06-08T09:00:00.000Z"), businessId: pick("Business", 0), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 0), dragFactors: ["Overdue invoice INV-2025-003", "Missed April target"] }),
        () => ({ overallScore: 71, projectConsistencyScore: 68, paymentCollectionScore: 70, cashflowStabilityScore: 72, workloadScore: 74, expenseManagementScore: 69, generatedAt: new Date("2025-05-31T09:00:00.000Z"), businessId: pick("Business", 1), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 1), dragFactors: ["Two projects behind schedule"] }),
        () => ({ overallScore: 84, projectConsistencyScore: 88, paymentCollectionScore: 85, cashflowStabilityScore: 81, workloadScore: 80, expenseManagementScore: 86, generatedAt: new Date("2025-03-31T09:00:00.000Z"), businessId: pick("Business", 2), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 2), dragFactors: ["Irregular project pipeline", "Unlogged expenses"] }),
        () => ({ overallScore: 58, projectConsistencyScore: 52, paymentCollectionScore: 55, cashflowStabilityScore: 60, workloadScore: 66, expenseManagementScore: 48, generatedAt: new Date("2025-02-28T09:00:00.000Z"), businessId: pick("Business", 3), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 3), dragFactors: ["Irregular project pipeline", "Unlogged expenses"] }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.healthScore.create({ data: row() as never });
          (ids["HealthScore"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] HealthScore row skipped: ' + why(e));
        }
      }
      console.log(`[seed] HealthScore: ${ok}/${rows.length} rows`);
    } else {
      ids["HealthScore"] = (await db.healthScore.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] HealthScore skipped: ' + why(e));
  }
  try {
    if ((await db.insight.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ type: "ALERT", title: "Invoice INV-2025-003 is 40 days overdue", body: "$2,750 from Tom Yeung Ventures has not been paid. This is your largest overdue balance.", recommendedAction: "Send the firm reminder today", priority: "HIGH", status: "OPEN", source: "SYSTEM", isAlert: true, isStale: false, dueDate: new Date("2025-06-10T00:00:00.000Z"), periodStart: new Date("2025-04-01T00:00:00.000Z"), periodEnd: new Date("2025-06-30T00:00:00.000Z"), generatedAt: new Date("2025-06-08T09:00:00.000Z"), expiresAt: new Date("2025-06-15T00:00:00.000Z"), dismissedAt: new Date("2025-06-02T12:20:00.000Z"), invoiceId: pick("Invoice", 0), projectId: pick("Project", 0), businessId: pick("Business", 0), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 0) }),
        () => ({ type: "GROWTH_INSIGHT", title: "Wedding work pays above average", body: "Your wedding highlight projects average $2,400, about 40% above your typical reel project. Consider more wedding outreach.", recommendedAction: "Reach out to two past wedding leads", priority: "MEDIUM", status: "OPEN", source: "AI", isAlert: false, isStale: false, dueDate: new Date("2025-06-09T00:00:00.000Z"), periodStart: new Date("2025-04-01T00:00:00.000Z"), periodEnd: new Date("2025-06-30T00:00:00.000Z"), generatedAt: new Date("2025-06-06T10:15:00.000Z"), expiresAt: new Date("2025-07-06T00:00:00.000Z"), dismissedAt: new Date("2025-06-02T12:20:00.000Z"), invoiceId: pick("Invoice", 1), projectId: pick("Project", 1), businessId: pick("Business", 1), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 1) }),
        () => ({ type: "BUSINESS_ADVICE", title: "Raise deposits on new projects", body: "Clients who paid a 50% deposit upfront paid on time 90% of the time. Consider requiring one on projects over $2,000.", recommendedAction: "Update your contract template", priority: "MEDIUM", status: "DONE", source: "AI", isAlert: false, isStale: false, dueDate: new Date("2025-06-09T00:00:00.000Z"), periodStart: new Date("2025-06-09T00:00:00.000Z"), periodEnd: new Date("2025-06-15T00:00:00.000Z"), generatedAt: new Date("2025-05-20T08:30:00.000Z"), expiresAt: new Date("2025-06-09T00:00:00.000Z"), dismissedAt: new Date("2025-06-02T12:20:00.000Z"), invoiceId: pick("Invoice", 2), projectId: pick("Project", 2), businessId: pick("Business", 2), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 2) }),
        () => ({ type: "NEXT_ACTION", title: "Plan next week around deadlines", body: "Brightlane color grade is due soon and two invoices need follow-up. Block mornings for client work.", recommendedAction: "Review this week's plan", priority: "HIGH", status: "OPEN", source: "AI", isAlert: false, isStale: false, dueDate: new Date("2025-06-09T00:00:00.000Z"), periodStart: new Date("2025-06-09T00:00:00.000Z"), periodEnd: new Date("2025-06-15T00:00:00.000Z"), generatedAt: new Date("2025-06-08T07:45:00.000Z"), expiresAt: new Date("2025-06-09T00:00:00.000Z"), dismissedAt: new Date("2025-06-02T12:20:00.000Z"), invoiceId: pick("Invoice", 3), projectId: pick("Project", 3), businessId: pick("Business", 3), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 3) }),
        () => ({ type: "ALERT", title: "Expense spike in May", body: "Software and equipment costs rose 35% above your monthly average.", recommendedAction: "Pitch one new project this week", priority: "LOW", status: "DISMISSED", source: "SYSTEM", isAlert: true, isStale: true, dueDate: new Date("2025-06-30T00:00:00.000Z"), periodStart: new Date("2025-05-01T00:00:00.000Z"), periodEnd: new Date("2025-05-31T00:00:00.000Z"), generatedAt: new Date("2025-06-01T06:00:00.000Z"), expiresAt: new Date("2025-06-05T00:00:00.000Z"), dismissedAt: new Date("2025-06-02T12:20:00.000Z"), invoiceId: pick("Invoice", 4), projectId: pick("Project", 4), businessId: pick("Business", 4), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 4) }),
        () => ({ type: "GROWTH_INSIGHT", title: "Monthly target at risk", body: "You have closed 2 of 4 Q2 projects with 3 weeks left. Current pace suggests 3 total.", recommendedAction: "Pitch one new project this week", priority: "HIGH", status: "OPEN", source: "AI", isAlert: true, isStale: false, dueDate: new Date("2025-06-30T00:00:00.000Z"), periodStart: new Date("2025-04-01T00:00:00.000Z"), periodEnd: new Date("2025-06-30T00:00:00.000Z"), generatedAt: new Date("2025-06-07T16:00:00.000Z"), expiresAt: new Date("2025-06-30T00:00:00.000Z"), dismissedAt: new Date("2025-06-02T12:20:00.000Z"), invoiceId: pick("Invoice", 5), projectId: pick("Project", 5), businessId: pick("Business", 5), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 5) }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.insight.create({ data: row() as never });
          (ids["Insight"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] Insight row skipped: ' + why(e));
        }
      }
      console.log(`[seed] Insight: ${ok}/${rows.length} rows`);
    } else {
      ids["Insight"] = (await db.insight.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] Insight skipped: ' + why(e));
  }
  try {
    if ((await db.quote.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ text: "Cut for the feeling first, then tighten for the story.", author: "Walter Murch", personalSuggestion: "Start Brightlane's cut by rough-timing the emotional beats.", displayDate: new Date("2025-06-08T00:00:00.000Z"), isFavourite: true, businessId: pick("Business", 0), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 0), challengeText: "Finish one rough cut without stopping to polish.", challengeStatus: "ACCEPTED" }),
        () => ({ text: "Every frame is a decision you can make on purpose.", author: "Unknown", personalSuggestion: "Raise your deposit ask on the next wedding inquiry.", displayDate: new Date("2025-06-07T00:00:00.000Z"), isFavourite: false, businessId: pick("Business", 1), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 1), challengeText: "Send one proposal with a 50% deposit.", challengeStatus: "COMPLETED" }),
        () => ({ text: "Pricing is part of the craft, not an apology for it.", author: "Unknown", personalSuggestion: "Raise your deposit ask on the next wedding inquiry.", displayDate: new Date("2025-06-06T00:00:00.000Z"), isFavourite: true, businessId: pick("Business", 2), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 2), challengeText: "Send one proposal with a 50% deposit.", challengeStatus: "COMPLETED" }),
        () => ({ text: "Done beats perfect when the client is waiting.", author: "Ira Glass", personalSuggestion: "Ship the Harbor & Pine reel cutdowns today.", displayDate: new Date("2025-06-05T00:00:00.000Z"), isFavourite: false, businessId: pick("Business", 3), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 3), challengeText: "Deliver one draft before noon.", challengeStatus: "SKIPPED" }),
        () => ({ text: "Your calendar is your strongest creative tool.", author: "Pixelhaus Editing Notes", personalSuggestion: "Block two focus mornings this week.", displayDate: new Date("2025-06-04T00:00:00.000Z"), isFavourite: false, businessId: pick("Business", 4), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 4), challengeText: "Send a clear payment link with each invoice.", challengeStatus: "ACCEPTED" }),
        () => ({ text: "Make it easy for the client to say yes.", author: "Pixelhaus Editing Notes", personalSuggestion: "Start Brightlane's cut by rough-timing the emotional beats.", displayDate: new Date("2025-06-03T00:00:00.000Z"), isFavourite: false, businessId: pick("Business", 5), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 5), challengeText: "Send a clear payment link with each invoice.", challengeStatus: "ACCEPTED" }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.quote.create({ data: row() as never });
          (ids["Quote"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] Quote row skipped: ' + why(e));
        }
      }
      console.log(`[seed] Quote: ${ok}/${rows.length} rows`);
    } else {
      ids["Quote"] = (await db.quote.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] Quote skipped: ' + why(e));
  }
  try {
    if ((await db.recurringBill.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ name: "Adobe Creative Cloud", amount: 84.99, frequency: "MONTHLY", startDate: new Date("2024-01-01T00:00:00.000Z"), endDate: new Date("2025-05-31T00:00:00.000Z"), nextDueDate: new Date("2025-07-01T00:00:00.000Z"), lastPaidAt: new Date("2025-06-01T00:00:00.000Z"), status: "ACTIVE", businessId: pick("Business", 0), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 0) }),
        () => ({ name: "Coworking membership", amount: 220.0, frequency: "MONTHLY", startDate: new Date("2024-09-01T00:00:00.000Z"), endDate: new Date("2025-05-31T00:00:00.000Z"), nextDueDate: new Date("2025-07-01T00:00:00.000Z"), lastPaidAt: new Date("2025-06-01T00:00:00.000Z"), status: "ACTIVE", businessId: pick("Business", 1), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 1) }),
        () => ({ name: "Portfolio website hosting", amount: 180.0, frequency: "YEARLY", startDate: new Date("2023-03-10T00:00:00.000Z"), endDate: new Date("2025-05-31T00:00:00.000Z"), nextDueDate: new Date("2026-03-10T00:00:00.000Z"), lastPaidAt: new Date("2025-03-10T00:00:00.000Z"), status: "ACTIVE", businessId: pick("Business", 2), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 2) }),
        () => ({ name: "Frame.io review seat", amount: 30.0, frequency: "MONTHLY", startDate: new Date("2024-05-01T00:00:00.000Z"), endDate: new Date("2025-05-31T00:00:00.000Z"), nextDueDate: new Date("2025-06-01T00:00:00.000Z"), lastPaidAt: new Date("2025-05-01T00:00:00.000Z"), status: "ENDED", businessId: pick("Business", 3), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 3) }),
        () => ({ name: "Music library subscription", amount: 45.0, frequency: "QUARTERLY", startDate: new Date("2024-07-01T00:00:00.000Z"), endDate: new Date("2025-05-31T00:00:00.000Z"), nextDueDate: new Date("2025-09-01T00:00:00.000Z"), lastPaidAt: new Date("2025-06-01T00:00:00.000Z"), status: "PAUSED", businessId: pick("Business", 4), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 4) }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.recurringBill.create({ data: row() as never });
          (ids["RecurringBill"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] RecurringBill row skipped: ' + why(e));
        }
      }
      console.log(`[seed] RecurringBill: ${ok}/${rows.length} rows`);
    } else {
      ids["RecurringBill"] = (await db.recurringBill.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] RecurringBill skipped: ' + why(e));
  }
  try {
    if ((await db.simulation.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ name: "Brightlane pays 14 days late", scenarioType: "DELAYED_PAYMENT", delayDays: 14, invoiceId: pick("Invoice", 0), projectedPaymentDate: new Date("2025-07-09T00:00:00.000Z"), status: "COMPLETED", businessId: pick("Business", 0), userId: pick("User", 0), projectedBalance: 9100, shortfallAmount: 0 }),
        () => ({ name: "Tom Yeung pays 30 days late", scenarioType: "DELAYED_PAYMENT", delayDays: 30, invoiceId: pick("Invoice", 1), projectedPaymentDate: new Date("2025-07-30T00:00:00.000Z"), status: "COMPLETED", businessId: pick("Business", 1), userId: pick("User", 1), projectedBalance: 7400, shortfallAmount: 0 }),
        () => ({ name: "Skip one wedding booking", scenarioType: "CUSTOM", delayDays: 45, invoiceId: pick("Invoice", 2), projectedPaymentDate: new Date("2025-08-14T00:00:00.000Z"), status: "DRAFT", businessId: pick("Business", 2), userId: pick("User", 2), projectedBalance: 10200, shortfallAmount: 0 }),
        () => ({ name: "Two clients pay 45 days late", scenarioType: "DELAYED_PAYMENT", delayDays: 45, invoiceId: pick("Invoice", 3), projectedPaymentDate: new Date("2025-08-14T00:00:00.000Z"), status: "DRAFT", businessId: pick("Business", 3), userId: pick("User", 3), projectedBalance: 3800, shortfallAmount: 1200 }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.simulation.create({ data: row() as never });
          (ids["Simulation"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] Simulation row skipped: ' + why(e));
        }
      }
      console.log(`[seed] Simulation: ${ok}/${rows.length} rows`);
    } else {
      ids["Simulation"] = (await db.simulation.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] Simulation skipped: ' + why(e));
  }
  try {
    if ((await db.invoice.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ invoiceNumber: "INV-2025-001 #1", clientId: pick("Client", 0), projectId: pick("Project", 0), status: "PAID", issueDate: new Date("2025-04-20T00:00:00.000Z"), dueDate: new Date("2025-05-05T00:00:00.000Z"), amount: 4500, amountPaid: 4500, balanceDue: 0, businessId: pick("Business", 0), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 0) }),
        () => ({ invoiceNumber: "INV-2025-002 #2", clientId: pick("Client", 1), projectId: pick("Project", 1), status: "PARTIALLY_PAID", issueDate: new Date("2025-05-10T00:00:00.000Z"), dueDate: new Date("2025-06-09T00:00:00.000Z"), amount: 6200, amountPaid: 3000, balanceDue: 3200, businessId: pick("Business", 1), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 1) }),
        () => ({ invoiceNumber: "INV-2025-003 #3", clientId: pick("Client", 2), projectId: pick("Project", 2), status: "OVERDUE", issueDate: new Date("2025-04-02T00:00:00.000Z"), dueDate: new Date("2025-04-30T00:00:00.000Z"), amount: 2750, amountPaid: 0, balanceDue: 2750, businessId: pick("Business", 2), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 2) }),
        () => ({ invoiceNumber: "INV-2025-004 #4", clientId: pick("Client", 3), projectId: pick("Project", 3), status: "SENT", issueDate: new Date("2025-06-01T00:00:00.000Z"), dueDate: new Date("2025-06-30T00:00:00.000Z"), amount: 1800, amountPaid: 0, balanceDue: 1800, businessId: pick("Business", 3), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 3) }),
        () => ({ invoiceNumber: "INV-2025-005 #5", clientId: pick("Client", 4), projectId: pick("Project", 4), status: "DRAFT", issueDate: new Date("2025-06-08T00:00:00.000Z"), dueDate: new Date("2025-07-08T00:00:00.000Z"), amount: 3400, amountPaid: 0, balanceDue: 3400, businessId: pick("Business", 4), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 4) }),
        () => ({ invoiceNumber: "INV-2025-006 #6", clientId: pick("Client", 5), projectId: pick("Project", 5), status: "PAID", issueDate: new Date("2025-03-15T00:00:00.000Z"), dueDate: new Date("2025-03-30T00:00:00.000Z"), amount: 950, amountPaid: 950, balanceDue: 0, businessId: pick("Business", 5), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 5) }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.invoice.create({ data: row() as never });
          (ids["Invoice"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] Invoice row skipped: ' + why(e));
        }
      }
      console.log(`[seed] Invoice: ${ok}/${rows.length} rows`);
    } else {
      ids["Invoice"] = (await db.invoice.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] Invoice skipped: ' + why(e));
  }
  try {
    if ((await db.project.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ name: "Brightlane Brand Film", clientId: pick("Client", 0), status: "IN_PROGRESS", startDate: new Date("2025-05-05T00:00:00.000Z"), deadline: new Date("2025-06-30T00:00:00.000Z"), value: 3200, completedAt: new Date("2025-05-12T00:00:00.000Z"), businessId: pick("Business", 0), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 0) }),
        () => ({ name: "Harbor & Pine Reel Series", clientId: pick("Client", 1), status: "COMPLETED", startDate: new Date("2025-04-01T00:00:00.000Z"), deadline: new Date("2025-05-15T00:00:00.000Z"), value: 1800, completedAt: new Date("2025-05-12T00:00:00.000Z"), businessId: pick("Business", 1), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 1) }),
        () => ({ name: "Marrin Wedding Highlights", clientId: pick("Client", 2), status: "PLANNED", startDate: new Date("2025-07-01T00:00:00.000Z"), deadline: new Date("2025-07-25T00:00:00.000Z"), value: 2400, completedAt: new Date("2025-03-26T00:00:00.000Z"), businessId: pick("Business", 2), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 2) }),
        () => ({ name: "Kestrel Onboarding Videos", clientId: pick("Client", 3), status: "CANCELLED", startDate: new Date("2025-03-10T00:00:00.000Z"), deadline: new Date("2025-04-30T00:00:00.000Z"), value: 4100, completedAt: new Date("2025-03-26T00:00:00.000Z"), businessId: pick("Business", 3), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 3) }),
        () => ({ name: "Yeung Investor Update Cut", clientId: pick("Client", 4), status: "IN_PROGRESS", startDate: new Date("2025-06-02T00:00:00.000Z"), deadline: new Date("2025-06-20T00:00:00.000Z"), value: 950, completedAt: new Date("2025-03-26T00:00:00.000Z"), businessId: pick("Business", 4), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 4) }),
        () => ({ name: "Riverside Class Teasers", clientId: pick("Client", 5), status: "COMPLETED", startDate: new Date("2025-03-01T00:00:00.000Z"), deadline: new Date("2025-03-28T00:00:00.000Z"), value: 1250, completedAt: new Date("2025-03-26T00:00:00.000Z"), businessId: pick("Business", 5), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 5) }),
        () => ({ name: "Harbor & Pine Holiday Spot", clientId: pick("Client", 6), status: "PLANNED", startDate: new Date("2025-09-01T00:00:00.000Z"), deadline: new Date("2025-10-15T00:00:00.000Z"), value: 2750, completedAt: new Date("2025-05-12T00:00:00.000Z"), businessId: pick("Business", 6), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 6) }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.project.create({ data: row() as never });
          (ids["Project"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] Project row skipped: ' + why(e));
        }
      }
      console.log(`[seed] Project: ${ok}/${rows.length} rows`);
    } else {
      ids["Project"] = (await db.project.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] Project skipped: ' + why(e));
  }
  try {
    if ((await db.invoiceLineItem.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ invoiceId: pick("Invoice", 0), description: "Brand film edit, 90 sec cut", quantity: 1, unitPrice: 3200, amount: 3200 }),
        () => ({ invoiceId: pick("Invoice", 1), description: "Color grading session", quantity: 4, unitPrice: 150, amount: 600 }),
        () => ({ invoiceId: pick("Invoice", 2), description: "Reel series edits (6 reels)", quantity: 6, unitPrice: 300, amount: 1800 }),
        () => ({ invoiceId: pick("Invoice", 3), description: "Motion title graphics", quantity: 1, unitPrice: 450, amount: 450 }),
        () => ({ invoiceId: pick("Invoice", 4), description: "Investor update rough cut", quantity: 1, unitPrice: 950, amount: 950 }),
        () => ({ invoiceId: pick("Invoice", 5), description: "Sound mix and cleanup", quantity: 2, unitPrice: 275, amount: 550 }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.invoiceLineItem.create({ data: row() as never });
          (ids["InvoiceLineItem"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] InvoiceLineItem row skipped: ' + why(e));
        }
      }
      console.log(`[seed] InvoiceLineItem: ${ok}/${rows.length} rows`);
    } else {
      ids["InvoiceLineItem"] = (await db.invoiceLineItem.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] InvoiceLineItem skipped: ' + why(e));
  }
  try {
    if ((await db.payment.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ invoiceId: pick("Invoice", 0), clientId: pick("Client", 0), amount: 4500, status: "RECEIVED", expectedDate: new Date("2025-05-04T00:00:00.000Z"), receivedAt: new Date("2025-05-03T00:00:00.000Z"), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 0) }),
        () => ({ invoiceId: pick("Invoice", 1), clientId: pick("Client", 1), amount: 3000, status: "RECEIVED", expectedDate: new Date("2025-05-28T00:00:00.000Z"), receivedAt: new Date("2025-05-27T00:00:00.000Z"), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 1) }),
        () => ({ invoiceId: pick("Invoice", 2), clientId: pick("Client", 2), amount: 3200, status: "EXPECTED", expectedDate: new Date("2025-06-25T00:00:00.000Z"), receivedAt: new Date("2025-03-31T00:00:00.000Z"), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 2) }),
        () => ({ invoiceId: pick("Invoice", 3), clientId: pick("Client", 3), amount: 1800, status: "EXPECTED", expectedDate: new Date("2025-07-02T00:00:00.000Z"), receivedAt: new Date("2025-03-31T00:00:00.000Z"), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 3) }),
        () => ({ invoiceId: pick("Invoice", 4), clientId: pick("Client", 4), amount: 950, status: "RECEIVED", expectedDate: new Date("2025-03-29T00:00:00.000Z"), receivedAt: new Date("2025-03-31T00:00:00.000Z"), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 4) }),
        () => ({ invoiceId: pick("Invoice", 5), clientId: pick("Client", 5), amount: 2750, status: "EXPECTED", expectedDate: new Date("2025-06-18T00:00:00.000Z"), receivedAt: new Date("2025-05-03T00:00:00.000Z"), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 5) }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.payment.create({ data: row() as never });
          (ids["Payment"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] Payment row skipped: ' + why(e));
        }
      }
      console.log(`[seed] Payment: ${ok}/${rows.length} rows`);
    } else {
      ids["Payment"] = (await db.payment.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] Payment skipped: ' + why(e));
  }
  try {
    if ((await db.reminder.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ invoiceId: pick("Invoice", 0), clientId: pick("Client", 0), subject: "Quick nudge on invoice INV-2025-002", body: "Hi Brightlane team, just a friendly reminder that the remaining balance of $3,200 is due June 9. Let me know if you need anything.", tone: "FRIENDLY", status: "SENT", isUserEdited: false, editedAt: new Date("2025-06-09T00:00:00.000Z"), approvedAt: new Date("2025-06-05T00:00:00.000Z"), sentAt: new Date("2025-06-05T00:00:00.000Z"), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 0) }),
        () => ({ invoiceId: pick("Invoice", 1), clientId: pick("Client", 1), subject: "Invoice INV-2025-003 is overdue", body: "Hi Tom, invoice INV-2025-003 for $2,750 was due April 30 and is still open. Could you confirm a payment date this week?", tone: "FIRM", status: "APPROVED", isUserEdited: true, editedAt: new Date("2025-06-09T00:00:00.000Z"), approvedAt: new Date("2025-06-09T00:00:00.000Z"), sentAt: new Date("2025-05-31T00:00:00.000Z"), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 1) }),
        () => ({ invoiceId: pick("Invoice", 2), clientId: pick("Client", 2), subject: "Final notice: INV-2025-003", body: "Hello, this is the final reminder for invoice INV-2025-003. Please arrange payment within 7 days to avoid pausing new work.", tone: "FINAL", status: "DRAFT", isUserEdited: false, editedAt: new Date("2025-05-30T00:00:00.000Z"), approvedAt: new Date("2025-05-30T00:00:00.000Z"), sentAt: new Date("2025-05-31T00:00:00.000Z"), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 2) }),
        () => ({ invoiceId: pick("Invoice", 3), clientId: pick("Client", 3), subject: "Checking in on INV-2025-004", body: "Hi Harbor & Pine team, hope the reel series is working for you. Invoice INV-2025-004 is due June 30 when convenient.", tone: "FRIENDLY", status: "DRAFT", isUserEdited: false, editedAt: new Date("2025-05-30T00:00:00.000Z"), approvedAt: new Date("2025-05-30T00:00:00.000Z"), sentAt: new Date("2025-05-31T00:00:00.000Z"), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 3) }),
        () => ({ invoiceId: pick("Invoice", 4), clientId: pick("Client", 4), subject: "Payment reminder for Marrin Studio", body: "Hi Sofia, a quick note that the deposit for the July wedding highlights is due before we lock the edit schedule.", tone: "FRIENDLY", status: "SENT", isUserEdited: true, editedAt: new Date("2025-05-30T00:00:00.000Z"), approvedAt: new Date("2025-05-30T00:00:00.000Z"), sentAt: new Date("2025-05-31T00:00:00.000Z"), userId: users["FREELANCE_VIDEO_EDITOR"] ?? pick("User", 4) }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.reminder.create({ data: row() as never });
          (ids["Reminder"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] Reminder row skipped: ' + why(e));
        }
      }
      console.log(`[seed] Reminder: ${ok}/${rows.length} rows`);
    } else {
      ids["Reminder"] = (await db.reminder.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] Reminder skipped: ' + why(e));
  }
}

main()
  .then(async () => { await db.$disconnect(); })
  .catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(0); });
