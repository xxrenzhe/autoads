import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/v5-config";
import { NextRequest, NextResponse } from "next/server";

// Offer服务地址：容器内优先使用服务名，其次回退到本地映射端口
const OFFER_SERVICE_URL = process.env.OFFER_SERVICE_URL
  || (process.env.DOCKERIZED ? 'http://offer:8080' : 'http://localhost:8083');

// --- GET /api/offers ---
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(`${OFFER_SERVICE_URL}/api/v1/offers`, {
      method: "GET",
      headers: {
        // 将用户的认证信息（如JWT或用户ID）转发给后端服务
        // 这是实现多用户数据隔离的关键
        "X-User-Id": session.user.id,
      },
    });

    // 健壮性处理：如果后端服务返回空响应体（例如204 No Content），则直接返回
    if (response.status === 204 || response.headers.get("content-length") === "0") {
        return new NextResponse(null, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error("Failed to proxy GET /offers:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// --- POST /api/offers ---
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const response = await fetch(`${OFFER_SERVICE_URL}/api/v1/offers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": session.user.id,
      },
      body: JSON.stringify(body),
    });

    // 健壮性处理
    if (response.status === 204 || response.headers.get("content-length") === "0") {
        return new NextResponse(null, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error("Failed to proxy POST /offers:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
