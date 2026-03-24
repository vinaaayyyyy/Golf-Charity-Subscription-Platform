import { NextResponse } from "next/server";
import { getCurrentViewer } from "@/lib/session";
import { publishMonthlyDraw } from "@/lib/platform";
import { isDemoMode } from "@/lib/env";
import type { DrawMode, FrequencyBias } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ month: string }> },
) {
  const viewer = await getCurrentViewer();
  if (!viewer || viewer.profile.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { month } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    if (!isDemoMode()) {
      const { publishLiveDraw } = await import("@/lib/live-platform");
      const result = await publishLiveDraw({
        actorId: viewer.profile.id,
        monthKey: month,
        mode: (body.mode as DrawMode) ?? "algorithmic",
        bias: (body.bias as FrequencyBias) ?? "most_frequent",
      });
      return NextResponse.json(result);
    }

    const result = publishMonthlyDraw({
      actorId: viewer.profile.id,
      monthKey: month,
      mode: (body.mode as DrawMode) ?? "algorithmic",
      bias: (body.bias as FrequencyBias) ?? "most_frequent",
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Publish failed" },
      { status: 400 },
    );
  }
}
