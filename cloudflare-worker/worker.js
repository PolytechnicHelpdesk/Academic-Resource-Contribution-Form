// Polytechnic Helpdesk status proxy for Cloudflare Workers.
// This reads the published, status-only Google Sheet and keeps the website UI native.

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
      const upstream = await fetch(PUBLIC_STATUS_CSV_URL, {
        headers: { Accept: 'text/csv, text/plain;q=0.9' },
        redirect: 'follow',
        cf: { cacheTtl: 30, cacheEverything: true }
      });
      if (!upstream.ok) throw new Error(`Google service returned ${upstream.status}`);

      const rows = parseCsv_(await upstream.text());
      const headers = rows[0].map((header) => String(header).replace(/^\uFEFF/, '').trim().toLowerCase());
      const receiptColumn = headers.indexOf('receipt no.');
      const statusColumn = headers.indexOf('submission status');
      const titleColumn = headers.indexOf('resource title');
      const nameColumn = headers.indexOf('full name');
      const remarksColumn = headers.indexOf('remarks');
      if (receiptColumn === -1 || statusColumn === -1) throw new Error('The public status sheet has invalid headings.');

      const match = rows.slice(1).find((row) => String(row[receiptColumn] || '').trim().toUpperCase() === receipt);
      return response({
        ok: true,
        found: Boolean(match),
        receiptNumber: match ? String(match[receiptColumn] || '').trim() : '',
        status: match ? String(match[statusColumn] || 'Under Review').trim() || 'Under Review' : 'Under Review',
        resourceTitle: match && titleColumn !== -1 ? String(match[titleColumn] || '').trim() : '',
        contributor: match && nameColumn !== -1 ? String(match[nameColumn] || '').trim() : '',
        remarks: match && remarksColumn !== -1 ? String(match[remarksColumn] || 'Under Review').trim() || 'Under Review' : 'Under Review'
      });
    } catch (error) {
      console.error('Status proxy error:', error.message);
      return response({ ok: false, error: 'The status service is temporarily unavailable.' }, 502);
    }
  }
};

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
      } else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      value = '';
    } else value += character;
  }
  row.push(value);
  if (row.some((cell) => cell !== '')) rows.push(row);
  return rows;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': WEBSITE_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function response(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' }
  });
}
