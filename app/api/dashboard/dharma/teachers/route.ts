import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getDharmaTeachers } from "@/lib/dashboard-data"

export async function GET() {
  const session = await auth()
  if (!session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const teachers = await getDharmaTeachers()
  // Return only metadata — not the full quotes array (saves bytes)
  const list = teachers.map(({ id, name, tradition, description }) => ({ id, name, tradition, description }))
  return NextResponse.json({ teachers: list })
}
