import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: book, error } = await supabase.from("books").select("*").eq("id", params.id).single();

    if (error || !book) {
      console.error("Database error:", error?.message);
      return NextResponse.json({ success: false, error: "Book not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, book });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch book" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const bookData = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase.from("books").update(bookData).eq("id", params.id).select().single();

    if (error) {
      console.error("Database error:", error.message);
      return NextResponse.json({ success: false, error: "Failed to update book" }, { status: 500 });
    }

    return NextResponse.json({ success: true, book: data });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ success: false, error: "Failed to update book" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.from("books").delete().eq("id", params.id);

    if (error) {
      console.error("Database error:", error.message);
      return NextResponse.json({ success: false, error: "Failed to delete book" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete book" }, { status: 500 });
  }
}
