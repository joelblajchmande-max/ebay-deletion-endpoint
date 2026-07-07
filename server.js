const express = require('express');
const crypto = require('crypto');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// KONFIGURATION
// ============================================================

// ⚠️ SANDBOX (Testumgebung) – auskommentieren wenn Production aktiv
// const CONFIG = {
//   clientId: 'NaorBlaj-Norman-SBX-a283ca9d7-d158dfe0',
//   clientSecret: 'SBX-283ca9d73c29-8c23-4d48-8f0d-6203',
//   ruName: 'Naor_Blajchman-NaorBlaj-Norman-ossrd',
//   redirectUri: 'https://normans-ebay-deletion.onrender.com/callback',
//   authUrl: 'https://auth.sandbox.ebay.com/oauth2/authorize',
//   tokenUrl: 'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
// };

// ✅ PRODUCTION (echter Shop) – deine Keys hier eintragen
const CONFIG = {
  clientId: process.env.EBAY_CLIENT_ID,
  clientSecret: process.env.EBAY_CLIENT_SECRET,
  ruName: 'Naor_Blajchman-NaorBlaj-Norman-gynkic',
  redirectUri: 'https://normans-ebay-deletion.onrender.com/callback',
  authUrl: 'https://auth.ebay.com/oauth2/authorize',
  tokenUrl: 'https://api.ebay.com/identity/v1/oauth2/token',
};

// Alle Scopes die NormanShop braucht
const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
].join(' ');

// Token temporär im Speicher
let storedToken = null;

// ============================================================
// STARTSEITE
// ============================================================
app.get('/', (req, res) => {
  const tokenStatus = storedToken
    ? `<div class="status success">✅ Token vorhanden – verbunden seit ${new Date(storedToken.timestamp).toLocaleString('de-DE')}</div>`
    : `<div class="status error">❌ Kein Token – noch nicht verbunden</div>`;

  res.send(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>NormanShop – eBay OAuth</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 60px auto; padding: 20px; background: #f5f5f5; }
        .card { background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 8px; }
        p { color: #666; margin-bottom: 30px; }
        .btn { display: inline-block; background: #e53238; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold; }
        .btn:hover { background: #c0272d; }
        .status { padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        .token-box { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 16px; margin-top: 20px; word-break: break-all; font-size: 12px; color: #555; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🛒 NormanShop</h1>
        <p>eBay OAuth Verbindung für deine Chrome Extension</p>
        ${tokenStatus}
        <a href="/auth" class="btn">Mit eBay verbinden</a>
        ${storedToken ? `
          <div class="token-box">
            <strong>Access Token:</strong><br>${storedToken.access_token}<br><br>
            <strong>Gültig bis:</strong> ${new Date(storedToken.expires_at).toLocaleString('de-DE')}
          </div>
        ` : ''}
      </div>
    </body>
    </html>
  `);
});

// ============================================================
// /auth – Leitet zum eBay Login weiter
// ============================================================
app.get('/auth', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = `${CONFIG.authUrl}?` + new URLSearchParams({
    client_id: CONFIG.clientId,
    redirect_uri: CONFIG.redirectUri,
    response_type: 'code',
    scope: SCOPES,
    state: state,
    ruName: CONFIG.ruName,
  }).toString();

  console.log(`[OAuth] Weiterleitung zu eBay Login`);
  res.redirect(authUrl);
});

// ============================================================
// /callback – eBay leitet hier nach Login zurück
// ============================================================
app.get('/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    console.error(`[OAuth] Fehler: ${error}`);
    return res.send(`<h2>❌ Fehler beim Login</h2><p>${error_description}</p><a href="/">Zurück</a>`);
  }

  if (!code) {
    return res.send(`<h2>❌ Kein Code erhalten</h2><a href="/">Zurück</a>`);
  }

  try {
    const credentials = Buffer.from(`${CONFIG.clientId}:${CONFIG.clientSecret}`).toString('base64');
    const tokenResponse = await fetch(CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: CONFIG.redirectUri,
      }).toString(),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(`${tokenData.error}: ${tokenData.error_description}`);
    }

    storedToken = {
      ...tokenData,
      timestamp: Date.now(),
      expires_at: Date.now() + (tokenData.expires_in * 1000),
    };

    console.log(`[OAuth] ✅ Token erfolgreich erhalten!`);

    res.send(`
      <!DOCTYPE html>
      <html lang="de">
      <head>
        <meta charset="UTF-8">
        <title>Verbunden!</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 60px auto; padding: 20px; }
          .card { background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .token-box { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 16px; margin-top: 20px; word-break: break-all; font-size: 12px; }
          .btn { display: inline-block; background: #28a745; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px; }
        </style>
        <script>
          window.addEventListener('load', () => {
            const token = ${JSON.stringify(storedToken)};
            if (window.opener) {
              window.opener.postMessage({ type: 'EBAY_TOKEN', token }, '*');
              setTimeout(() => window.close(), 2000);
            }
          });
        </script>
      </head>
      <body>
        <div class="card">
          <h1>✅ Erfolgreich verbunden!</h1>
          <p>eBay Token wurde erfolgreich erhalten.</p>
          <div class="token-box">
            <strong>Access Token:</strong><br>${storedToken.access_token}<br><br>
            <strong>Gültig für:</strong> ${Math.round(tokenData.expires_in / 3600)} Stunden
          </div>
          <a href="/" class="btn">Zur Startseite</a>
        </div>
      </body>
      </html>
    `);

  } catch (err) {
    console.error(`[OAuth] Token-Fehler:`, err.message);
    res.send(`<h2>❌ Token-Fehler</h2><p>${err.message}</p><a href="/">Zurück</a>`);
  }
});

// ============================================================
// /token – Extension holt Token hier ab
// ============================================================
app.get('/token', (req, res) => {
  if (!storedToken) {
    return res.status(404).json({ error: 'Kein Token vorhanden.' });
  }
  if (Date.now() > storedToken.expires_at) {
    return res.status(401).json({ error: 'Token abgelaufen.' });
  }
  res.json({
    access_token: storedToken.access_token,
    expires_at: storedToken.expires_at,
    valid: true,
  });
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
app.listen(PORT, () => {
  console.log(`✅ NormanShop Server läuft auf Port ${PORT}`);
});
