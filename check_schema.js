const { createClient } = require("@supabase/supabase-js")

async function checkSchema() {
  const url = "https://hyqdqshjysxthitqitqu.supabase.co"
  const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5cWRxc2hqeXN4dGhpdHFpdHF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwNzQ4MzMsImV4cCI6MjA1NzY1MDgzM30.6Z4Z4Z4Z4Z4Z4Z4Z4Z4Z4Z4Z4Z4Z4Z4Z4Z4Z4Z4Z4Z4" // This is a mock key, I'll use the real one from .env.local

  // Wait, I should just read .env.local and parse it manually.
  const fs = require('fs');
  const env = fs.readFileSync('.env.local', 'utf8');
  const supaUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1];
  const supaKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1];

  if (!supaUrl || !supaKey) {
    console.error("Missing Supabase credentials");
    return;
  }

  const supabase = createClient(supaUrl.trim(), supaKey.trim());
  const { data, error } = await supabase.from("trending_topics").select("*").limit(1);

  if (error) {
    console.error("Error fetching data:", error);
  } else if (data && data.length > 0) {
    console.log("Columns found:", Object.keys(data[0]));
  } else {
    console.log("No data found in trending_topics");
  }
}

checkSchema()
