import { NextResponse } from "next/server";
import { getCurrentViewer } from "@/lib/session";
import { reviewWinnerClaim } from "@/lib/platform";
import { isDemoMode } from "@/lib/env";
import type { ClaimStatus } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getCurrentViewer();
  if (!viewer || viewer.profile.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    if (!isDemoMode()) {
      const { reviewLiveClaim } = await import("@/lib/live-platform");
      await reviewLiveClaim({
        actorId: viewer.profile.id,
        claimId: id,
        status: (body.status as ClaimStatus) ?? "approved",
        note: typeof body.note === "string" ? body.note : undefined,
      });
      return NextResponse.json({ success: true });
    }

    const claim = await reviewWinnerClaim({
      actorId: viewer.profile.id,
      claimId: id,
      status: (body.status as ClaimStatus) ?? "approved",
      note: typeof body.note === "string" ? body.note : undefined,
    });

    return NextResponse.json(claim);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Claim review failed" },
      { status: 400 },
    );
  }
}
