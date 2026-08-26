import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ message: "تم تسجيل الخروج" });
  response.cookies.delete("accessToken");
  response.cookies.delete("refreshToken");
  response.cookies.delete("branchId");
  return response;
}
