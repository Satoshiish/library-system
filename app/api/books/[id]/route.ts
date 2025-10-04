// app/api/books/[id]/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  request: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: book, error } = await supabase
      .from("books")
      .select(`
        *,
        added_by_user:users(full_name, email)
      `)
      .eq("id", params.id)
      .single();

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

export async function PUT(
  request: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    const bookData = await request.json();
    
    // Get user ID from headers for audit tracking (optional for updates)
    const updatedByHeader = request.headers.get('x-user-id');
    const updatedBy = updatedByHeader ? parseInt(updatedByHeader) : null;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Prepare update data with updated_at timestamp
    const updateData = {
      ...bookData,
      updated_at: new Date().toISOString(),
      // Optionally track who last updated the book
      ...(updatedBy && { updated_by: updatedBy })
    };

    const { data, error } = await supabase
      .from("books")
      .update(updateData)
      .eq("id", params.id)
      .select(`
        *,
        added_by_user:users(full_name, email)
      `)
      .single();

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

export async function DELETE(
  request: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    // Optional: Get user ID for audit logging
    const deletedByHeader = request.headers.get('x-user-id');
    const deletedBy = deletedByHeader ? parseInt(deletedByHeader) : null;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Optional: Log the deletion for audit purposes
    if (deletedBy) {
      const { data: book } = await supabase
        .from("books")
        .select("title, author, added_by")
        .eq("id", params.id)
        .single();

      if (book) {
        // You could create an audit log table to track deletions
        await supabase
          .from("audit_logs")
          .insert({
            action: 'DELETE_BOOK',
            table_name: 'books',
            record_id: params.id,
            user_id: deletedBy,
            old_data: book,
            created_at: new Date().toISOString()
          });
      }
    }

    const { error } = await supabase
      .from("books")
      .delete()
      .eq("id", params.id);

    if (error) {
      console.error("Database error:", error.message);
      return NextResponse.json({ success: false, error: "Failed to delete book" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Book deleted successfully" });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete book" }, { status: 500 });
  }
}