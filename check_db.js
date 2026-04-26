const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from("custom_simulations")
    .select("*")
    .eq("id", "d3d39232-f10d-4556-987f-cb268245c292")
    .single();
    
  if (error) console.error("Error:", error);
  else {
    console.log("Status:", data.status);
    console.log("Result:", JSON.stringify(data.result, null, 2));
    console.log("Primary Probability:", data.primary_probability);
  }
}
run();
