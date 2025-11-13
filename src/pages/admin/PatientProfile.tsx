// src/pages/admin/PatientProfile.tsx
import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function PatientProfile() {
  const { id: viewedUserId } = useParams<{ id: string }>();
  const loggedOnce = useRef(false);

  useEffect(() => {
    (async () => {
      if (!viewedUserId || loggedOnce.current) return;

      const { data: { session } } = await supabase.auth.getSession();
      const adminId = session?.user?.id;
      if (!adminId) return; // not signed in → nothing to log

      // Write the audit row
      await supabase.from("admin_profile_view_logs").insert({
        admin_id: adminId,
        user_id: viewedUserId,
        // viewed_at defaults to now()
      }).match(() => {}); // Ignore logging errors

      loggedOnce.current = true; // prevent duplicate logs on re-renders
    })();
  }, [viewedUserId]);

  // ...render the patient profile UI...
  return <div>/* Patient profile for {viewedUserId} */</div>;
}
