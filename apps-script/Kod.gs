/**
 * Denní scrape Heureky přímo z Google Apps Scriptu.
 *
 * Proč tudy: Heureka je za Cloudflare, který blokuje datacentrové IP.
 * GitHub Actions ani Vercel neprojdou (0 z 20 obchodů, HTTP 403), zatímco
 * ze sítě kanceláře projde 20 z 20. Apps Script běží na Google
 * infrastruktuře a má vlastní časovač, takže nepotřebuje ani zapnutý
 * počítač, ani server, ani service account — do tabulky píše přímo.
 *
 * INSTALACE
 *   1. V tabulce: Rozšíření → Apps Script
 *   2. Obsah souboru Kod.gs přepiš tímhle, ulož (Ctrl+S)
 *   3. Nahoře vyber funkci `test1Obchod` a dej Spustit.
 *      Poprvé si Google řekne o oprávnění — povol.
 *      V logu (Ctrl+Enter) musí být HTTP 200 a nějaké procento.
 *   4. Když test projde, spusť `nastavDennitrigger` — od té chvíle
 *      to jede každý den samo mezi 6:00 a 7:00.
 *
 * Ruční spuštění celého scrapu kdykoli: funkce `scrapeVsechny`.
 */

var UA = 'MAIRA-HeurekaMonitor/1.0 (+https://mairateam.com; kontakt: ondrej.wicherek@mairateam.com)';
var LIST_KLIENTI = 'Clients';
var LIST_ZAZNAMY = 'Snapshots';
var PAUZA_MS = 1500;

/** Rychlé ověření, že Heureka Apps Script vůbec pustí. Spusť jako první. */
function test1Obchod() {
  var odpoved = stahni('https://obchody.heureka.cz/notino-cz/');
  Logger.log('HTTP ' + odpoved.kod);

  if (odpoved.kod !== 200) {
    Logger.log('Heureka Apps Script nepustila. Tudy cesta nevede.');
    return;
  }

  var data = rozeber(odpoved.telo);
  Logger.log('nazev: ' + data.nazev);
  Logger.log('procenta: ' + data.procenta);
  Logger.log('certifikat: ' + data.certifikat);
  Logger.log('recenzi: ' + data.recenzi);
  Logger.log('--- funguje, muzes spustit nastavDennitrigger ---');
}

/** Projde všechny aktivní klienty a zapíše jeden řádek na obchod a den. */
function scrapeVsechny() {
  var sesit = SpreadsheetApp.getActiveSpreadsheet();
  var klienti = nactiKlienty(sesit);
  var dnes = Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyy-MM-dd');
  var razitko = new Date().toISOString();

  var zaznamy = [];
  var ok = 0;
  var chyb = 0;

  for (var i = 0; i < klienti.length; i++) {
    var klient = klienti[i];
    if (i > 0) Utilities.sleep(PAUZA_MS);

    var zaznam = {
      date: dnes,
      clientId: klient.id,
      clientName: klient.nazev,
      market: klient.trh,
      percentage: '',
      certificate: 'none',
      rating: '',
      reviewCount: '',
      scrapedAt: razitko,
      error: ''
    };

    try {
      var odpoved = stahniSOpakovanim(klient.url);
      if (odpoved.kod !== 200) throw new Error('HTTP ' + odpoved.kod);

      var data = rozeber(odpoved.telo);
      if (data.procenta === null) throw new Error('procento se nenaslo');

      zaznam.clientName = data.nazev || klient.nazev;
      zaznam.percentage = data.procenta;
      zaznam.certificate = data.certifikat;
      zaznam.rating = data.hodnoceni === null ? '' : data.hodnoceni;
      zaznam.reviewCount = data.recenzi === null ? '' : data.recenzi;
      ok++;
    } catch (chyba) {
      zaznam.error = String(chyba.message || chyba);
      chyb++;
    }

    zaznamy.push(zaznam);
  }

  zapis(sesit, zaznamy);
  Logger.log('Hotovo — nacteno ' + ok + ', selhalo ' + chyb + '.');
}

/** Nastaví denní spouštění mezi 6:00 a 7:00. Staré triggery napřed smaže. */
function nastavDennitrigger() {
  var stare = ScriptApp.getProjectTriggers();
  for (var i = 0; i < stare.length; i++) {
    if (stare[i].getHandlerFunction() === 'scrapeVsechny') ScriptApp.deleteTrigger(stare[i]);
  }

  ScriptApp.newTrigger('scrapeVsechny').timeBased().atHour(6).everyDays(1).create();
  Logger.log('Trigger nastaven — scrapeVsechny pobezi kazdy den mezi 6:00 a 7:00.');
}

// --- pomocne funkce -------------------------------------------------------

function stahni(url) {
  var odpoved = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'User-Agent': UA, 'Accept-Language': 'cs-CZ,cs;q=0.9' },
    followRedirects: true,
    muteHttpExceptions: true,
    validateHttpsCertificates: true
  });
  return { kod: odpoved.getResponseCode(), telo: odpoved.getContentText() };
}

/** Heureka pri rychlejsim sledu obcas odmitne — zkusime to jeste dvakrat. */
function stahniSOpakovanim(url) {
  var cekani = [1500, 4000];
  var odpoved = stahni(url);

  for (var i = 0; i < cekani.length && odpoved.kod !== 200 && odpoved.kod !== 404; i++) {
    Utilities.sleep(cekani[i]);
    odpoved = stahni(url);
  }
  return odpoved;
}

function rozeber(html) {
  var procenta = html.match(/recommendation__percentage">\s*(\d+)/);
  var nazev = html.match(/data-shop-name="([^"]+)"/);
  var cert = html.match(/recommendation__certificate"[^>]*src="([^"]+)"/);
  var hodnoceni = html.match(/shop-detail-stats__value">\s*([0-9]+[.,]?[0-9]*)/);
  var recenzi = html.match(/Recenz[ei][^0-9<]{0,60}?<[^>]*>\s*([0-9\s ]+)\s*</);

  var certifikat = 'none';
  if (cert && /gold/i.test(cert[1])) certifikat = 'gold';
  else if (cert && /blue/i.test(cert[1])) certifikat = 'blue';

  return {
    nazev: nazev ? nazev[1].replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ') : '',
    procenta: procenta ? Number(procenta[1]) : null,
    certifikat: certifikat,
    hodnoceni: hodnoceni ? Number(hodnoceni[1].replace(',', '.')) : null,
    recenzi: recenzi ? Number(recenzi[1].replace(/[\s ]/g, '')) : null
  };
}

function nactiKlienty(sesit) {
  var list = sesit.getSheetByName(LIST_KLIENTI);
  var radky = list.getDataRange().getValues();
  var klienti = [];

  for (var i = 1; i < radky.length; i++) {
    var r = radky[i];
    if (!r[0]) continue;
    if (String(r[7]).toUpperCase() === 'FALSE') continue;
    klienti.push({ id: r[0], nazev: r[1], trh: r[2], url: r[4] });
  }
  return klienti;
}

/**
 * Na jeden obchod a den drzime prave jeden radek. Neuspesny scrape
 * neprepise uspesne mereni z tehoz dne.
 */
function zapis(sesit, zaznamy) {
  var list = sesit.getSheetByName(LIST_ZAZNAMY);
  var radky = list.getDataRange().getValues();

  var cisloRadku = {};
  var meloHodnotu = {};
  for (var i = 1; i < radky.length; i++) {
    if (!radky[i][0] || !radky[i][1]) continue;
    var klic = radky[i][1] + '|' + Utilities.formatDate(new Date(radky[i][0]), 'Europe/Prague', 'yyyy-MM-dd');
    cisloRadku[klic] = i + 1;
    meloHodnotu[klic] = radky[i][4] !== '' && radky[i][4] !== null;
  }

  var nove = [];

  for (var j = 0; j < zaznamy.length; j++) {
    var z = zaznamy[j];
    var k = z.clientId + '|' + z.date;
    var radek = [z.date, z.clientId, z.clientName, z.market, z.percentage,
                 z.certificate, z.rating, z.reviewCount, z.scrapedAt, z.error];

    if (!cisloRadku[k]) {
      nove.push(radek);
    } else if (z.percentage !== '' || !meloHodnotu[k]) {
      list.getRange(cisloRadku[k], 1, 1, 10).setValues([radek]);
    }
  }

  if (nove.length > 0) {
    list.getRange(list.getLastRow() + 1, 1, nove.length, 10).setValues(nove);
  }
}
