import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Notification = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
};

// cache() dedupes the query within a single render pass (layout + page both read it).
export const getNotifications = cache(
  async (limit = 5): Promise<Notification[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, body, type, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as Notification[];
  }
);
