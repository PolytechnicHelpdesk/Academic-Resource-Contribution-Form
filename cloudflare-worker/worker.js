// Polytechnic Helpdesk status proxy for Cloudflare Workers.
// Deploy this file as a Worker, then paste its /status URL into script.js.

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwO7q8KLic-EulBQkrgOt_df4gIwPJ_syE5ISFYtaWWKONLxzfc_Uo6ALCA69bBeJ7o/exec';
const WEBSITE_ORIGIN = 'https://iichelpdesk.github.io';

export default {
  async fetch(request) {
    const requestUrl = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
    if (requestUrl.pathname !== '/status') return response({ ok: false, error: 'Not found.' }, 404);
    if (request.method !== 'GET') return response({ ok: false, error: 'Method not allowed.' }, 405);

    const receipt = String(requestUrl.searchParams.get('receipt') || '').trim().toUpperCase();
    if (!receipt) return response({ ok: false, error: 'A receipt number is required.' }, 400);

    try {
      const upstreamUrl = new URL(APPS_SCRIPT_URL);
      upstreamUrl.searchParams.set('receipt', receipt);
      upstreamUrl.searchParams.set('source', 'status-worker');

      const upstream = await fetch(upstreamUrl.toString(), {
        headers: { Accept: 'application/json' },
        redirect: 'follow'
      });
      if (!upstream.ok) throw new Error(`Google service returned ${upstream.status}`);

      const data = await upstream.json();
      return response({
        ok: true,
        found: Boolean(data.found),
        receiptNumber: data.receiptNumber || '',
        status: data.status || 'Under Review',
        resourceTitle: data.resourceTitle || ''
      });
    } catch (error) {
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

function response(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' }
  });
}
