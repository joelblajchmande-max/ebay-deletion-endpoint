const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const TOKEN_FILE = path.join('/tmp', 'ebay_token.json');

function saveToken(token) {
  try { fs.writeFileSync(TOKEN_FILE, JSON.stringify(token)); } catch (e) {}
}

function loadToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      if (data && Date.now() < data.expires_at) return data;
    }
  } catch (e) {}
  return null;
}

const CONFIG = {
  clientId: process.env.EBAY_CLIENT_ID,
  clientSecret: process.env.EBAY_CLIENT_SECRET,
  ruName: 'Naor_Blajchman-NaorBlaj-Norman-gynkic',
  redirectUri: 'https://normans-ebay-deletion.onrender.com/callback',
  authUrl: 'https://auth.ebay.com/oauth2/authorize',
  tokenUrl: 'https://api.ebay.com/identity/v1/oauth2/token',
};

const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
].join(' ');

let storedToken = loadToken();

// ============================================================
// STARTSEITE
// ============================================================
app.get('/', (req, res) => {
  const tokenStatus = storedToken
    ? `<div class="status success">✅ Token vorhanden – verbunden seit ${new Date(storedToken.timestamp).toLocaleString('de-DE')}</div>`
    : `<div class="status error">❌ Kein Token – noch nicht verbunden</div>`;

  res.send(`<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>NormanShop</title>
    <style>body{font-family:Arial,sans-serif;max-width:600px;margin:60px auto;padding:20px;background:#f5f5f5}.card{background:white;border-radius:12px;padding:40px;box-shadow:0 2px 10px rgba(0,0,0,.1)}h1{color:#333;margin-bottom:8px}p{color:#666;margin-bottom:30px}.btn{display:inline-block;background:#e53238;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:bold}.status{padding:12px 16px;border-radius:8px;margin-bottom:20px;font-size:14px}.success{background:#d4edda;color:#155724}.error{background:#f8d7da;color:#721c24}.token-box{background:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;padding:16px;margin-top:20px;word-break:break-all;font-size:12px;color:#555}</style>
    </head><body><div class="card"><h1>🛒 NormanShop</h1><p>eBay OAuth Verbindung für deine Chrome Extension</p>
    ${tokenStatus}<a href="/auth" class="btn">Mit eBay verbinden</a>
    ${storedToken ? `<a href="/revoke" class="btn" style="background:#888;margin-left:12px;">🗑️ Token widerrufen</a>
    <div class="token-box"><strong>Gültig bis:</strong> ${new Date(storedToken.expires_at).toLocaleString('de-DE')}</div>` : ''}
    </div></body></html>`);
});

// ============================================================
// /auth
// ============================================================
app.get('/auth', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = `${CONFIG.authUrl}?` + new URLSearchParams({
    client_id: CONFIG.clientId,
    redirect_uri: CONFIG.redirectUri,
    response_type: 'code',
    scope: SCOPES,
    state,
  }).toString() + `&redirect_uri=${encodeURIComponent(CONFIG.ruName)}`;
  res.redirect(authUrl);
});

// ============================================================
// /callback
// ============================================================
app.get('/callback', async (req, res) => {
  const { code, error, error_description } = req.query;
  if (error) return res.send(`<h2>❌ ${error}</h2><p>${error_description}</p><a href="/">Zurück</a>`);
  if (!code) return res.send(`<h2>❌ Kein Code</h2><a href="/">Zurück</a>`);

  try {
    const credentials = Buffer.from(`${CONFIG.clientId}:${CONFIG.clientSecret}`).toString('base64');
    const tokenResponse = await fetch(CONFIG.tokenUrl, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: CONFIG.redirectUri }).toString(),
    });
    const tokenData = await tokenResponse.json();
    if (tokenData.error) throw new Error(`${tokenData.error}: ${tokenData.error_description}`);

    storedToken = { ...tokenData, timestamp: Date.now(), expires_at: Date.now() + (tokenData.expires_in * 1000) };
    saveToken(storedToken);

    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Verbunden!</title>
      <script>window.addEventListener('load',()=>{if(window.opener){window.opener.postMessage({type:'EBAY_TOKEN',token:${JSON.stringify(storedToken)}},'*');setTimeout(()=>window.close(),2000);}});</script>
      </head><body><h1>✅ Erfolgreich verbunden!</h1><p>eBay Token wurde erfolgreich erhalten.</p><a href="/">Zur Startseite</a></body></html>`);
  } catch (err) {
    res.send(`<h2>❌ Token-Fehler</h2><p>${err.message}</p><a href="/">Zurück</a>`);
  }
});

// ============================================================
// /token
// ============================================================
app.get('/token', (req, res) => {
  if (!storedToken) return res.status(404).json({ error: 'Kein Token vorhanden.' });
  if (Date.now() > storedToken.expires_at) return res.status(401).json({ error: 'Token abgelaufen.' });
  res.json({ access_token: storedToken.access_token, expires_at: storedToken.expires_at, valid: true });
});

// ============================================================
// /listings – Trading API (echte aktive Listings)
// ============================================================
app.get('/listings', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  if (!storedToken) return res.status(404).json({ error: 'Kein Token vorhanden.' });
  if (Date.now() > storedToken.expires_at) return res.status(401).json({ error: 'Token abgelaufen.' });

  const limit = Math.min(parseInt(req.query.limit) || 100, 200);
  const page = parseInt(req.query.page) || 1;

  try {
    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
      <GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
        <ActiveList>
          <Include>true</Include>
          <Pagination>
            <EntriesPerPage>${limit}</EntriesPerPage>
            <PageNumber>${page}</PageNumber>
          </Pagination>
        </ActiveList>
      </GetMyeBaySellingRequest>`;

    const tradingRes = await fetch('https://api.ebay.com/ws/api.dll', {
      method: 'POST',
      headers: {
        'X-EBAY-API-SITEID': '77',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling',
        'X-EBAY-API-IAF-TOKEN': storedToken.access_token,
        'Content-Type': 'text/xml',
      },
      body: xmlBody,
    });

    const xmlText = await tradingRes.text();

    // Mit xml2js parsen – kein Regex-Problem mit Encoding
    const parsed = await xml2js.parseStringPromise(xmlText, { explicitArray: false, ignoreAttrs: false });
    const response = parsed?.GetMyeBaySellingResponse;

    if (response?.Ack === 'Failure') {
      const errMsg = response?.Errors?.LongMessage || 'Unbekannter Fehler';
      throw new Error(`eBay Fehler: ${errMsg}`);
    }

    const activeList = response?.ActiveList;
    const pagination = activeList?.PaginationResult;
    const totalEntries = parseInt(pagination?.TotalNumberOfEntries || '0');
    const totalPages = parseInt(pagination?.TotalNumberOfPages || '1');

    let items = activeList?.ItemArray?.Item || [];
    if (!Array.isArray(items)) items = [items];

    const listings = items.map(item => {
      const price = item.BuyItNowPrice?._ || item.BuyItNowPrice ||
                    item.SellingStatus?.CurrentPrice?._ || item.SellingStatus?.CurrentPrice || '–';
      return {
        itemId: item.ItemID,
        title: item.Title,
        sku: item.SKU,
        price,
        quantity: item.QuantityAvailable || '0',
        timeLeft: item.TimeLeft,
        imageUrl: item.PictureDetails?.GalleryURL,
        watchCount: item.WatchCount || '0',
        url: `https://www.ebay.de/itm/${item.ItemID}`,
      };
    });

    console.log(`[Listings] ${listings.length} von ${totalEntries} Listings (Seite ${page}/${totalPages})`);
    res.json({ total: totalEntries, totalPages, page, shown: listings.length, listings });

  } catch (err) {
    console.error('[Listings] Fehler:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// /revoke
// ============================================================
app.get('/revoke', (req, res) => {
  storedToken = null;
  try { fs.unlinkSync(TOKEN_FILE); } catch (e) {}
  res.redirect('/');
});

// ============================================================
// eBay DELETION ENDPOINT
// ============================================================
const VERIFICATION_TOKEN = 'NormanShopDE-EbayDeletion-2024-SecureXYZ99';
const ENDPOINT_URL = process.env.ENDPOINT_URL || 'https://normans-ebay-deletion.onrender.com/ebay-deletion';

app.get('/ebay-deletion', (req, res) => {
  const challengeCode = req.query.challenge_code;
  if (challengeCode) {
    const hash = crypto.createHash('sha256').update(challengeCode + VERIFICATION_TOKEN + ENDPOINT_URL).digest('hex');
    return res.json({ challengeResponse: hash });
  }
  res.send('NormanShop eBay Deletion Endpoint – aktiv');
});

app.post('/ebay-deletion', (req, res) => {
  console.log('[eBay] Deletion Notification:', JSON.stringify(req.body, null, 2));
  res.status(200).json({ status: 'received' });
});

// ============================================================
// SERVER STARTEN
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ NormanShop Server läuft auf Port ${PORT}`));
