/**
 * Supabase data access layer.
 *
 * Mirrors the function signatures of lib/notion.js so api/rows.js can switch
 * over with a single import change, with one difference: every function takes
 * the caller's access token (JWT) as its first argument. That token is what
 * Row Level Security uses to decide which rows the caller may see or touch.
 *
 * Unlike the Notion version there is no pageToFlat / flatToProperties pair —
 * Postgres already returns flat rows, so the conversion layer disappears.
 */

const { createClient } = require("@supabase/supabase-js");

const TABLE = "opportunities";

/**
 * Columns a client is allowed to write. Anything not listed here is silently
 * dropped — this is what stops a caller from setting user_id, id, created_at
 * or archived by hand. user_id fills itself from the column default auth.uid().
 */
const WRITABLE_FIELDS = [
  "client_name",
  "hh_company",
  "hh_contact_person",
  "role_description",
  "focus_area",
  "notes",
  "status",
  "source",
  "channel",
  "work_mode",
  "is_fishing",
  "contact_count",
  "client_budget_eur",
  "agreed_rate_eur",
  "promised_duration_months",
  "actual_duration_months",
  "first_contact_at",
  "interview_at",
  "agreed_at",
  "delivered_at",
  "promised_start_date",
  "source_raw_text",
];

/** Numeric columns — empty strings from form inputs must become null, not 0. */
const NUMERIC_FIELDS = new Set([
  "contact_count",
  "client_budget_eur",
  "agreed_rate_eur",
  "promised_duration_months",
  "actual_duration_months",
]);

/** Date columns — empty strings would be rejected by Postgres, so send null. */
const DATE_FIELDS = new Set([
  "first_contact_at",
  "interview_at",
  "agreed_at",
  "delivered_at",
  "promised_start_date",
]);

/**
 * Builds a client scoped to one user. The publishable key identifies the
 * project; the token identifies the person. Without a token every query runs
 * as anon and RLS returns nothing.
 */
function getClient(accessToken) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url) throw new Error("SUPABASE_URL environment varijabla nije postavljena.");
  if (!key) throw new Error("SUPABASE_PUBLISHABLE_KEY environment varijabla nije postavljena.");
  if (!accessToken) {
    const err = new Error("Niste prijavljeni.");
    err.status = 401;
    throw err;
  }

  return createClient(url, key, {
    global: { headers: { Authorization: "Bearer " + accessToken } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Keeps only writable fields and normalises empty values to null. */
function sanitize(flat) {
  const out = {};
  for (const field of WRITABLE_FIELDS) {
    if (!(field in flat)) continue;
    let v = flat[field];

    if (v === "" || v === undefined) v = null;

    if (v !== null && NUMERIC_FIELDS.has(field)) {
      const n = Number(v);
      v = Number.isNaN(n) ? null : n;
    }

    if (v !== null && DATE_FIELDS.has(field)) {
      v = String(v).slice(0, 10); // trims any time component to a plain date
    }

    if (field === "is_fishing") {
      v = v === true || v === "true" || v === "__YES__";
    }

    out[field] = v;
  }
  return out;
}

/** Wraps a Supabase error so api/rows.js can keep using err.status. */
function fail(error, fallbackStatus) {
  const err = new Error(error.message || "Supabase error");
  err.status = error.status || fallbackStatus || 500;
  throw err;
}

/** Every non-archived row visible to this user, newest first. */
async function queryAllRows(accessToken) {
  const db = getClient(accessToken);
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .eq("archived", false)
    .order("created_at", { ascending: false });

  if (error) fail(error);
  return data || [];
}

async function createRow(accessToken, flat) {
  const db = getClient(accessToken);
  const { data, error } = await db
    .from(TABLE)
    .insert(sanitize(flat))
    .select()
    .single();

  if (error) fail(error, 400);
  return data;
}

async function updateRow(accessToken, id, flat) {
  const db = getClient(accessToken);
  const { data, error } = await db
    .from(TABLE)
    .update(sanitize(flat))
    .eq("id", id)
    .select()
    .single();

  if (error) fail(error, 400);
  if (!data) {
    const err = new Error("Zapis nije pronađen.");
    err.status = 404;
    throw err;
  }
  return data;
}

/** Soft delete, matching the archive behaviour of the Notion version. */
async function archiveRow(accessToken, id) {
  const db = getClient(accessToken);
  const { error } = await db
    .from(TABLE)
    .update({ archived: true })
    .eq("id", id);

  if (error) fail(error, 400);
  return { ok: true };
}

module.exports = {
  queryAllRows,
  createRow,
  updateRow,
  archiveRow,
  WRITABLE_FIELDS,
  sanitize,
};
