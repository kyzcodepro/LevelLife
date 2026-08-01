import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityTypes, logs } from "@/db/schema";
import { apiUser } from "@/lib/session";
import { createLog } from "@/lib/logService";

const createLogSchema = z.object({
  activityTypeId: z.uuid(),
  occurredAt: z.coerce.date().optional(),
  durationMin: z.number().int().min(1).max(24 * 60).nullish(),
  intensity: z.number().min(0.5).max(2).nullish(),
  quality: z.number().min(0.8).max(1.3).nullish(),
  mood: z.number().int().min(1).max(5).nullish(),
  note: z.string().max(4000).nullish(),
  tags: z.array(z.string().max(40)).max(10).nullish(),
  mediaUrls: z.array(z.string().max(500)).max(4).nullish(),
});

/** POST /api/logs — crée un log, calcule et renvoie l'XP + level-up éventuel. */
export async function POST(req: NextRequest) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const parsed = createLogSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Requête invalide", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await createLog(db, user, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    const status = message.includes("introuvable") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * GET /api/logs?cursor&attribute&q&limit — timeline paginée par curseur
 * (occurred_at desc, id en départage).
 */
export async function GET(req: NextRequest) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const limit = Math.min(50, Math.max(1, Number(params.get("limit") ?? 20)));
  const attribute = params.get("attribute");
  const q = params.get("q");
  const cursor = params.get("cursor"); // ISO date du dernier occurred_at vu

  const conditions = [eq(logs.userId, user.id)];
  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      conditions.push(lt(logs.occurredAt, cursorDate));
    }
  }
  if (attribute) {
    conditions.push(
      or(
        eq(activityTypes.attributeCode, attribute),
        eq(activityTypes.secondaryAttributeCode, attribute),
      )!,
    );
  }
  if (q) {
    conditions.push(
      or(ilike(logs.note, `%${q}%`), ilike(activityTypes.label, `%${q}%`))!,
    );
  }

  const rows = await db
    .select({
      log: logs,
      type: {
        id: activityTypes.id,
        code: activityTypes.code,
        label: activityTypes.label,
        attributeCode: activityTypes.attributeCode,
        secondaryAttributeCode: activityTypes.secondaryAttributeCode,
        icon: activityTypes.icon,
      },
      xpTotal: sql<number>`coalesce((select sum(amount)::int from xp_events where xp_events.log_id = ${logs.id}), 0)`,
    })
    .from(logs)
    .innerJoin(activityTypes, eq(logs.activityTypeId, activityTypes.id))
    .where(and(...conditions))
    .orderBy(desc(logs.occurredAt), desc(logs.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const nextCursor = hasMore
    ? page[page.length - 1].log.occurredAt.toISOString()
    : null;

  return NextResponse.json({ items: page, nextCursor });
}
