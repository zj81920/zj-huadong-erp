import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "未登录", data: null },
        { status: 401 }
      );
    }

    return NextResponse.json({ data: user });
  } catch (error) {
    console.error("获取当前用户失败:", error);
    return NextResponse.json({ error: "获取当前用户失败" }, { status: 500 });
  }
}
