import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { getCompanyAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";

const ALLOWED = ["png", "jpg", "jpeg", "webp", "svg"];
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const auth = await getCompanyAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ message: "اختر صورة" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ message: "الحد الأقصى 2 ميجابايت" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED.includes(ext)) {
    return NextResponse.json({ message: "PNG, JPG, WEBP أو SVG فقط" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const filePath = `${auth.companyId}/${filename}`;

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { error } = await supabase.storage
    .from("logos")
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    return NextResponse.json({ error: "فشل الرفع" }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage
    .from("logos")
    .getPublicUrl(filePath);

  return NextResponse.json({ url: publicUrl });
}
