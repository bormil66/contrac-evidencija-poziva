# Freelance Ledger — web verzija

Ovo je samostalna (standalone) verzija Freelance Evidencija dashboarda koji si prije koristio kao Cowork Live Artifact. Isti dizajn, ista statistika, isti Notion podaci — ali sad kao pravi website na internetu, koji radi bez Cowork-a.

## Šta je unutra

- `index.html` — frontend (identičan dizajn: Gantt, KPI kartice, bench traka, grafovi, register tablica, detalj panel).
- `api/rows.js` — GET (učitaj sve upite), POST (napravi novi upit).
- `api/rows/[id].js` — PATCH (izmijeni upit), DELETE (arhiviraj upit u Notion-u — ovo je pravi delete, za razliku od Cowork verzije).
- `api/config.js` — javlja frontend-u da li je AI unos uključen.
- `api/ai-extract.js` — AI parsiranje zalijepljenog emaila (DeepSeek ili Claude, zavisno šta postaviš).
- `lib/notion.js` — direktna veza sa pravim Notion REST API-jem (bez Cowork MCP posrednika, pa nema ni starog "usage limit" problema).

## Korak 1 — Notion integracija (token)

1. Idi na [notion.so/my-integrations](https://www.notion.so/my-integrations) i napravi novu internal integraciju (npr. "Freelance Ledger Web").
2. Kopiraj njen **Internal Integration Token** (počinje sa `secret_...`) — to ide u `NOTION_TOKEN`.
3. Otvori svoju "Freelance Evidencija" bazu u Notion-u, klikni "..." (gore desno) → **Connections** → dodaj integraciju koju si upravo napravio. Bez ovog koraka API neće vidjeti bazu.
4. `NOTION_DATABASE_ID` je već popunjen u `.env.example` (`277ba29b-0656-41cd-8c22-1dafdb2dd8e5`) — to je ID tvoje postojeće baze (uzet direktno iz njenog Notion URL-a), ne treba ga mijenjati osim ako praviš novu bazu.

## Korak 2 — (opciono) AI unos emaila

Ako želiš "Email intake (AI)" sekciju da radi:

- **DeepSeek (preporučeno, jeftinije)** — napravi nalog na [platform.deepseek.com](https://platform.deepseek.com), generiši API ključ, stavi ga u `DEEPSEEK_API_KEY`.
- **ili Claude** — API ključ sa [console.anthropic.com](https://console.anthropic.com), stavi ga u `ANTHROPIC_API_KEY`.

Ako oba ostanu prazna, ta sekcija se automatski sakriva — ostatak dashboarda radi normalno, samo bez AI parsiranja (ručno dodaješ/uređuješ upite kroz register tablicu).

## Korak 3 — GitHub

1. Napravi novi (po mogućnosti privatni) repozitorijum na svom GitHub nalogu.
2. Ubaci sve fajlove iz ovog foldera u taj repo (upload kroz GitHub web sučelje, ili `git init && git add . && git commit -m "init" && git push`, ili otvori folder u VS Code i uradi isto odatle).
3. **Ne commituj `.env` fajl** ako ga praviš lokalno za testiranje — `.gitignore` ga već isključuje.

## Korak 4 — Vercel

1. Na [vercel.com](https://vercel.com) klikni **Add New → Project** i izaberi taj GitHub repo (Vercel ga automatski prepozna, framework preset nije ni potreban — "Other" je u redu).
2. Prije prvog deploy-a (ili poslije, pa redeploy) idi u **Settings → Environment Variables** i dodaj:
   - `NOTION_TOKEN`
   - `NOTION_DATABASE_ID`
   - `DEEPSEEK_API_KEY` i/ili `ANTHROPIC_API_KEY` (ako želiš AI unos)
3. Klikni **Deploy**. Za par sekundi dobiješ javni link, npr. `freelance-evidencija-web.vercel.app`.
4. Ubuduće, svaki `git push` na glavnu granu automatski pokreće novi deploy.

## Lokalno testiranje (opciono, prije nego što push-uješ)

Ako imaš Vercel CLI (`npm i -g vercel`):

```
vercel dev
```

Ovo pokreće i frontend i `/api` rute lokalno na `localhost:3000`, čitajući env varijable iz `.env` fajla u ovom folderu (kopiraj `.env.example` u `.env` i popuni ga).

## Razlike u odnosu na Cowork verziju

- **Nema više "local-first + ručni Sync"** — svaka izmjena se odmah upisuje u Notion (ista logika, samo bez potrebe za posebnim Sync dugmetom, jer pravi Notion API nema onaj stari "Query Data Source" limit koji je imao Cowork-ov MCP konektor).
- **Pravo brisanje** — dugme "Delete inquiry" sada stvarno arhivira stranicu u Notion-u (`archived: true`), što Cowork-ov MCP alat nije podržavao.
- **AI unos** ide preko DeepSeek-a ili Claude-a direktno (tvoj vlastiti API ključ), umjesto kroz Cowork-ov `askClaude`.
- Dizajn, statistika i sva polja su identični.
