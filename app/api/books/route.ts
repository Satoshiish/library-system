// app/api/books/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const category = searchParams.get("category");
    const status = searchParams.get("status");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Start query - include user who added the book
    let query = supabase
      .from("books")
      .select(`
        *,
        added_by_user:users(full_name, email)
      `);

    // Apply search filter
    if (search) {
      query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%,isbn.ilike.%${search}%`);
    }

    // Apply category filter
    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    // Apply status filter
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data: books, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Database error:", error.message);
      return NextResponse.json({ success: false, error: "Failed to fetch books" }, { status: 500 });
    }

    return NextResponse.json({ success: true, books: books || [] });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch books" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const bookData = await request.json();
    
    // Get user ID from the request (you'll need to implement proper auth context)
    // For now, we'll use a header or default to admin user
    const userId = request.headers.get('x-user-id') || await getDefaultAdminId();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Add the user who is creating the book
    const bookWithAddedBy = {
      ...bookData,
      added_by: userId
    };

    const { data, error } = await supabase
      .from("books")
      .insert([bookWithAddedBy])
      .select(`
        *,
        added_by_user:users(full_name, email)
      `)
      .single();

    if (error) {
      console.error("Database error:", error.message);
      return NextResponse.json({ success: false, error: "Failed to create book" }, { status: 500 });
    }

    return NextResponse.json({ success: true, book: data });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ success: false, error: "Failed to create book" }, { status: 500 });
  }
}

// Helper function to get default admin user ID
async function getDefaultAdminId(): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: user, error } = await supabase
    .from("users")
    .select("id")
    .eq("email", "admin@library.com")
    .single();

  if (error || !user) {
    throw new Error("Default admin user not found");
  }

  return user.id;
}