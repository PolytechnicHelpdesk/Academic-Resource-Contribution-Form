// Polytechnic Helpdesk status proxy for Cloudflare Workers.
// Deploy this file as a Worker, then paste its /status URL into script.js.

// Paste the CSV link from the published "Public Status" Google Sheet here.
// It must end in output=csv. This sheet contains only receipt numbers/statuses.
const PUBLIC_STATUS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQvens0wZEWwu64QCiueQsQkhYl4AmPz6MVUYoHInQ0eWT6cdgqMMst85KBF2FE8dG5wO9qXjahW5H0/pub?gid=1946449221&single=true&output=csv';
const WEBSITE_ORIGIN = 'https://polytechnichelpdesk.github.io';

export default {
  async fetch(request) {
    const requestUrl = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
    if (requestUrl.pathname !== '/status') return response({ ok: false, error: 'Not found.' }, 404);
    if (request.method !== 'GET') return response({ ok: false, error: 'Method not allowed.' }, 405);

    const receipt = String(requestUrl.searchParams.get('receipt') || '').trim().toUpperCase();
    if (!receipt) return response({ ok: false, error: 'A receipt number is required.' }, 400);

    try {
      if (PUBLIC_STATUS_CSV_URL.startsWith('PASTE_')) {
        throw new Error('The public status CSV URL has not been configured.');
      }
      const upstream = await fetch(PUBLIC_STATUS_CSV_URL, {
        headers: { Accept: 'text/csv, text/plain;q=0.9' },
        redirect: 'follow',
        cf: { cacheTtl: 30, cacheEverything: true }
      });
      if (!upstream.ok) throw new Error(`Google service returned ${upstream.status}`);

      const raw = await upstream.text();
      const rows = parseCsv_(raw);
      const match = rows.slice(1).find((row) => String(row[0] || '').trim().toUpperCase() === receipt);
      return response({
        ok: true,
        found: Boolean(match),
        receiptNumber: match ? String(match[0] || '').trim() : '',
        status: match ? String(match[1] || 'Under Review').trim() || 'Under Review' : 'Under Review',
        resourceTitle: ''
      });
    } catch (error) {
      console.error('Status proxy error:', error.message);
      return response({ ok: false, error: 'The status service is temporarily unavailable.' }, 502);
    }
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': WEBSITE_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

// Supports normal CSV quoting, including commas inside quoted values.
function parseCsv_(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  row.push(value);
  if (row.some((cell) => cell !== '')) rows.push(row);
  return rows;
}

function response(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' }
  });
}
