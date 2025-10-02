import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Check credentials against the users table
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, full_name, role, password, is_active")
      .eq("email", email)
      .single();

    if (error) {
      console.error("Error fetching user:", error.message);
      return NextResponse.json({ success: false, error: "Authentication failed" }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    if (!user.is_active) {
      return NextResponse.json({ success: false, error: "User is inactive" }, { status: 403 });
    }

    if (user.password !== password) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    // Return user info without password
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.full_name,
      },
    });

  } catch (error) {
    console.error("Authentication error:", error);
    return NextResponse.json({ success: false, error: "Authentication failed" }, { status: 500 });
  }
}
