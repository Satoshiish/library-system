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

    // Start query
    let query = supabase.from("books").select("*");

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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase.from("books").insert([bookData]).select().single();

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
