function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { ok: false, error: "仅支持 GET" });
  }

  return json(res, 200, {
    ok: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    table: process.env.SUPABASE_TABLE || "dispatch_records",
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
    hasSupabaseAnonKey: Boolean(process.env.SUPABASE_ANON_KEY)
  });
};
