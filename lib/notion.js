/**
 * Minimal Notion REST API client + schema-aware conversion between Notion's
 * native property JSON and the flat object shape the frontend expects
 * (the same shape the Cowork/Notion-MCP version used):
 *   - text/title  -> plain string
 *   - select      -> plain string (option name)
 *   - number      -> plain number
 *   - checkbox    -> "__YES__" / "__NO__"
 *   - date        -> "date:<PropName>:start" / "date:<PropName>:end" keys
 *
 * Uses global fetch (available in Vercel's Node 18+ runtime, no dependency needed).
 */

const NOTION_VERSION = "2022-06-28";
const NOTION_API = "https://api.notion.com/v1";

// Schema for the "Freelance Evidencija" database — kept here explicitly so we
// know how to serialize each property back into Notion's API shape.
const SCHEMA = {
  "Klijent/Naziv": "title",
  "HH Firma": "rich_text",
  "Kontakt osoba (HH)": "rich_text",
  "Način dolaska": "select",
  "Izvor": "select",
  "Status": "select",
  "Radni mod": "select",
  "SAP Fokus": "select",
  "Opis posla": "rich_text",
  "Napomene": "rich_text",
  "Fishing (samo sondiranje)": "checkbox",
  "Broj kontakata (pozivi/email)": "number",
  "Budžet klijenta (EUR)": "number",
  "Dogovoreni rate (EUR)": "number",
  "Najavljeno trajanje (mjeseci)": "number",
  "Stvarno trajanje (mjeseci)": "number",
  "Datum prvog kontakta": "date",
  "Datum intervjua": "date",
  "Datum dogovora": "date",
  "Datum realizacije": "date",
  "Najavljeni pocetak (po HH)": "date",
};

function authHeaders() {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN environment varijabla nije postavljena.");
  return {
    "Authorization": "Bearer " + token,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

function getDatabaseId() {
  const id = process.env.NOTION_DATABASE_ID;
  if (!id) throw new Error("NOTION_DATABASE_ID environment varijabla nije postavljena.");
  return id;
}

/** Converts one Notion page object into our flat row shape. */
function pageToFlat(page) {
  const flat = { id: page.id, url: page.url };
  const props = page.properties || {};
  for (const [name, type] of Object.entries(SCHEMA)) {
    const p = props[name];
    if (!p) continue;
    if (type === "title") {
      flat[name] = (p.title || []).map(t => t.plain_text).join("") || "";
    } else if (type === "rich_text") {
      flat[name] = (p.rich_text || []).map(t => t.plain_text).join("") || "";
    } else if (type === "select") {
      flat[name] = (p.select && p.select.name) || "";
    } else if (type === "number") {
      flat[name] = p.number ?? null;
    } else if (type === "checkbox") {
      flat[name] = p.checkbox ? "__YES__" : "__NO__";
    } else if (type === "date") {
      flat["date:" + name + ":start"] = (p.date && p.date.start) || null;
      flat["date:" + name + ":end"] = (p.date && p.date.end) || null;
    }
  }
  return flat;
}

/** Converts our flat row shape (partial or full) into Notion's API "properties" payload. */
function flatToProperties(flat) {
  const properties = {};
  for (const [name, type] of Object.entries(SCHEMA)) {
    if (type === "date") {
      const startKey = "date:" + name + ":start";
      if (!(startKey in flat)) continue;
      const start = flat[startKey];
      properties[name] = start ? { date: { start, end: flat["date:" + name + ":end"] || null } } : { date: null };
      continue;
    }
    if (!(name in flat)) continue;
    const v = flat[name];
    if (type === "title") {
      properties[name] = { title: v ? [{ text: { content: String(v) } }] : [] };
    } else if (type === "rich_text") {
      properties[name] = { rich_text: v ? [{ text: { content: String(v) } }] : [] };
    } else if (type === "select") {
      properties[name] = v ? { select: { name: String(v) } } : { select: null };
    } else if (type === "number") {
      properties[name] = { number: (v === null || v === undefined || v === "") ? null : Number(v) };
    } else if (type === "checkbox") {
      properties[name] = { checkbox: v === "__YES__" };
    }
  }
  return properties;
}

async function notionFetch(path, options) {
  const res = await fetch(NOTION_API + path, {
    ...options,
    headers: { ...authHeaders(), ...(options && options.headers) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && data.message) || ("Notion API error " + res.status);
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Fetches every (non-archived) page in the database, following pagination. */
async function queryAllRows() {
  const dbId = getDatabaseId();
  let rows = [], cursor = undefined;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const data = await notionFetch("/databases/" + dbId + "/query", {
      method: "POST",
      body: JSON.stringify(body),
    });
    rows = rows.concat((data.results || []).map(pageToFlat));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return rows;
}

async function createRow(flat) {
  const dbId = getDatabaseId();
  const data = await notionFetch("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: dbId },
      properties: flatToProperties(flat),
    }),
  });
  return pageToFlat(data);
}

async function updateRow(pageId, flat) {
  const data = await notionFetch("/pages/" + pageId, {
    method: "PATCH",
    body: JSON.stringify({ properties: flatToProperties(flat) }),
  });
  return pageToFlat(data);
}

/** True delete: Notion's real API (unlike the old Cowork MCP wrapper) supports archiving. */
async function archiveRow(pageId) {
  await notionFetch("/pages/" + pageId, {
    method: "PATCH",
    body: JSON.stringify({ archived: true }),
  });
  return { ok: true };
}

module.exports = { queryAllRows, createRow, updateRow, archiveRow, SCHEMA, pageToFlat, flatToProperties };
