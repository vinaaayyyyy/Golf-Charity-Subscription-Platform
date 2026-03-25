import { NextResponse } from "next/server";
import { env, isDemoMode } from "@/lib/env";
import { getCurrentViewer } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request) {
  const viewer = await getCurrentViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const drawResultId = formData.get("drawResultId");
  const file = formData.get("proof");

  if (typeof drawResultId !== "string" || !drawResultId) {
    return NextResponse.json({ error: "Missing drawResultId" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Invalid file type. Use JPG, PNG, WebP or PDF." }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large. Maximum 5 MB." }, { status: 400 });
  }

  // Demo mode: accept and record with a placeholder path
  if (isDemoMode()) {
    return NextResponse.json({ proofPath: `demo://${file.name}` });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", env.siteUrl));
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${user.id}/${drawResultId}/proof.${ext}`;

  const { error } = await supabase.storage
    .from("winner-proofs")
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    console.error("Proof upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  return NextResponse.json({ proofPath: path });
}
