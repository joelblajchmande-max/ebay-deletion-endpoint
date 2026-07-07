const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

// ============================================================
// DEINE KONFIGURATION – hier nichts ändern nötig
// Den VERIFICATION_TOKEN trägst du 1:1 in eBay Developer ein
// ============================================================
const VERIFICATION_TOKEN = 'NormanShopDE-EbayDeletion-2024-SecureXYZ99';

// Diese URL bekommst du NACH dem Render-Deploy – dann hier eintragen
// Format: https://DEIN-APP-NAME.onrender.com/ebay-deletion
const ENDPOINT_URL = process.env.ENDPOINT_URL || 'https://PLACEHOLDER.onrender.com/ebay-deletion';

// ============================================================
// GET – eBay verifiziert den Endpoint (Challenge-Response)
// ============================================================
app.get('/ebay-deletion', (req, res) => {
  const challengeCode = req.query.challenge_code;

  if (challengeCode) {
    console.log(`[eBay] Challenge erhalten: ${challengeCode}`);

    const hash = crypto
      .createHash('sha256')
      .update(challengeCode + VERIFICATION_TOKEN + ENDPOINT_URL)
      .digest('hex');

    console.log(`[eBay] Challenge Response gesendet: ${hash}`);
    return res.json({ challengeResponse: hash });
  }

  res.send('NormanShop eBay Deletion Endpoint – aktiv');
});

// ============================================================
// POST – eBay meldet eine Account-Löschung
// ============================================================
app.post('/ebay-deletion', (req, res) => {
  console.log('[eBay] Account Deletion Notification erhalten:', JSON.stringify(req.body, null, 2));
  // Für Dropshipping-Zwecke: einfach 200 zurückgeben, keine Aktion nötig
  res.status(200).json({ status: 'received' });
});

// ============================================================
// Health Check – zeigt ob der Server läuft
// ============================================================
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    service: 'NormanShop eBay Deletion Endpoint',
    endpoint: '/ebay-deletion'
  });
});

// ============================================================
// Server starten
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ NormanShop Endpoint läuft auf Port ${PORT}`);
  console.log(`📌 Endpoint URL: ${ENDPOINT_URL}`);
  console.log(`🔑 Verification Token: ${VERIFICATION_TOKEN}`);
});
