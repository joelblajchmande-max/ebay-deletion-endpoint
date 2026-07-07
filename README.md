# NormanShop – eBay Deletion Endpoint

## Dein Verification Token (in eBay Developer eintragen):
```
NormanShopDE-EbayDeletion-2024-SecureXYZ99
```

## Setup-Schritte

### 1. GitHub
- Diesen Ordner als neues Repository hochladen
- Name: `ebay-deletion-endpoint`

### 2. Render.com
- New Web Service → GitHub Repo verbinden
- Build Command: `npm install`
- Start Command: `node server.js`
- Free Plan wählen

### 3. Nach dem Deploy
- Du bekommst eine URL: `https://DEIN-NAME.onrender.com`
- In `server.js` die ENDPOINT_URL aktualisieren:
  `https://DEIN-NAME.onrender.com/ebay-deletion`
- Erneut committen → Render deployed automatisch neu

### 4. eBay Developer eintragen
- Endpoint: `https://DEIN-NAME.onrender.com/ebay-deletion`
- Verification Token: `NormanShopDE-EbayDeletion-2024-SecureXYZ99`
- "Send Test Notification" klicken → muss grün werden
