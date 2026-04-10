import { createClient } from "@supabase/supabase-js";

async function main() {
  const clerkSecret = process.env.CLERK_SECRET_KEY;
  const res = await fetch("https://api.clerk.com/v1/users?email_address=bicagold@gmail.com", {
    headers: {
      "Authorization": `Bearer ${clerkSecret}`
    }
  });
  const users = await res.json();
  
  if (!users || users.length === 0) {
    console.log("No user found in Clerk with bicagold@gmail.com");
    return;
  }
  const userId = users[0].id;
  console.log(`Clerk ID: ${userId}`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: store, error: errStore } = await supabase
    .from("stores")
    .select("*")
    .eq("clerk_user_id", userId)
    .single();

  if (errStore || !store) {
    console.error("Store query failed:", errStore);
    return;
  }
  
  console.log("\nStore:");
  console.log(store);

  // Consultar a view de dashboard para créditos
  const { data: dashboard, error: errDash } = await supabase
    .from("v_store_dashboard")
    .select("*")
    .eq("store_id", store.id)
    .single();
    
    
  console.log("\nStore Dashboard / Credits Info:");
  console.log(dashboard || errDash);
  
  // Credits in store directly
  const { data: creditsStore } = await supabase
    .from("stores")
    .select("credit_campaigns, credit_models, credit_regenerations")
    .eq("id", store.id)
    .single();
    
  console.log("\nAvulso Credits:");
  console.log(creditsStore);
  
}

main().catch(console.error);
