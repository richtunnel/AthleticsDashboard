import { NextResponse } from "next/server";

export class ApiResponse {
  static success(data: any, status = 200) {
    return NextResponse.json({ success: true, data }, { status });
  }

  static error(message: string, status = 400) {
    return NextResponse.json({ success: false, error: message }, { status });
  }

  static forbidden() {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  static unauthorized() {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  static notFound(message = "Resource not found") {
    return NextResponse.json({ success: false, error: message }, { status: 404 });
  }
}
