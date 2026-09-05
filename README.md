# Heureka OZ Controller

Přehled spokojenosti klientů na Heurece CZ a SK. Aplikace si sama stáhne
z profilu obchodu procento spokojenosti, úroveň certifikátu Ověřeno zákazníky,
logo a jméno obchodu, a každý běh uloží jako jeden řádek do historie.

## Spuštění

```bash
npm install
npm run dev
```

Dashboard běží na <http://localhost:5009>.

Na ploše je zástupce **Heureka_OZ**, který spustí totéž na jedno kliknutí:
otevře okno se serverem a po náběhu i prohlížeč. Když už appka běží, druhé
kliknutí jen otevře prohlížeč — druhý server nezaloží. Zavřením černého okna
appku vypneš. Spouštěcí skript je [`start.cmd`](start.cmd).

Klienta přidáš tlačítkem **Přidat klienta** vpravo nahoře — vyskočí okno,
do kterého vložíš odkaz na jeho profil, např. `https://obchody.heureka.cz/notino-cz/`
nebo `https://obchody.heureka.sk/alza-sk/`. Odkaz stačí zkopírovat z prohlížeče
v jakékoli podobě, aplikace si ho normalizuje sama.

Obchody **bez certifikátu Ověřeno zákazníky** se řadí na začátek a mají červené
ohraničení, ať je na první pohled vidět, kde je problém. Uvnitř obou skupin
(bez certifikátu / s certifikátem) platí pořadí, které si natáhneš ručně.

Tlačítko **•••** nad dlaždicemi přepne přehled do režimu úprav: dlaždice jde
přetahovat myší do libovolného pořadí a u každé se objeví **Odebrat**. Pořadí
se ukládá (je to pořadí řádků v listu `Clients`), takže vydrží i po restartu.
Tlačítkem **Hotovo** se režim ukončí.

Kontrola běží dvěma cestami, obě přes stejný kód:

- **Automaticky** každý den v 5:00 UTC přes GitHub Actions (`.github/workflows/scrape.yml`)
- **Ručně** tlačítkem **Spustit kontrolu** v dashboardu, nebo `npm run scrape` z příkazové řádky

Obchody se procházejí po jednom s pauzou 1,5 s mezi nimi, ať Heureku nezatěžujeme.
Když odmítne požadavek (dělá to při rychlejším sledu), zkusí se to ještě dvakrát
s odstupem 1,5 s a 4 s — bez toho spadl při testech zhruba každý desátý obchod.

## Co se ukládá

| Sloupec | Popis |
|---|---|
| `percentage` | % zákazníků, kteří obchod doporučují (dotazník za 90 dní) |
| `certificate` | `gold` / `blue` / `none` — úroveň Ověřeno zákazníky |
| `rating` | celková spokojenost 0–5 |
| `review_count` | počet recenzí |
| `error` | text chyby, pokud se scrape nepovedl |

`rating` a `review_count` bereme navíc — jsou na stejné stránce zdarma
a pomáhají poznat, jestli procento kleslo kvůli trendu, nebo jedné recenzi.

Na jeden obchod a den drží tabulka **právě jeden řádek** — opakované spuštění
ten stávající přepíše, nepřidá nový. Neúspěšný scrape přitom nikdy nepřepíše
úspěšné měření z téhož dne, takže odpolední výpadek Heureky nesmaže to,
co ráno prošlo.

Kdyby se v tabulce duplicity přece jen objevily (třeba ruční úpravou), slouží
k jejich sloučení `npm run dedupe` (s `-- --dry` napřed jen vypíše, co by udělal;
před zápisem si vždy uloží zálohu do `snapshots-backup-*.json`).

## Jak se data stahují (důležité pro nasazení)

Heureka běží za Cloudflare, který požadavky z Node.js runtime odmítá
challenge stránkou (HTTP 403, hlavička `cf-mitigated: challenge`) — a to
bez ohledu na hlavičky. Aplikace proto stahuje stránky systémovým **curl**
(`src/lib/fetchHtml.ts`), který projde.

Hlásíme se pravdivým User-Agentem s kontaktem:

```
MAIRA-HeurekaMonitor/1.0 (+https://mairateam.com; kontakt: ondrej.wicherek@mairateam.com)
```

Nepředstíráme prohlížeč — Cloudflare tenhle UA pouští, blokuje jen výchozí
`curl/8.9.1` a prázdný UA. Změnit ho jde proměnnou `SCRAPER_USER_AGENT`.

Praktický důsledek: **scrape potřebuje prostředí, kde je curl k dispozici.**
Lokálně na Windows i na běžném Linuxu to platí. Ve Vercel serverless funkci
curl není, takže tam `POST /api/scrape` neprojde — viz sekce o nasazení.

## Napojení Google Sheets

Dokud nejsou vyplněné proměnné, aplikace ukládá do `data/local-store.json`
a dashboard na to upozorní. Napojení Sheetu:

1. Vytvoř prázdnou Google tabulku. Listy `Clients` a `Snapshots` si aplikace
   založí sama i s hlavičkami.
2. V [Google Cloud Console](https://console.cloud.google.com) založ projekt,
   zapni **Google Sheets API** a vytvoř **Service Account**.
3. U service accountu vytvoř klíč typu JSON a stáhni ho.
4. V Google tabulce dej **Sdílet** → e-mail service accountu (`...iam.gserviceaccount.com`)
   → oprávnění **Editor**.
5. Nech si vyplnit `.env.local` ze staženého JSONu — přepisovat privátní klíč
   ručně se nevyplácí:

```bash
npm run setup:google -- "C:\Users\Ondrej\Downloads\klic.json" "<odkaz na tabulku>"
```

   Skript vypíše e-mail service accountu, který máš nasdílet (krok 4), a existující
   `.env.local` napřed zazálohuje. Kdybys to chtěl přece jen ručně:

```
GOOGLE_SHEET_ID=<část URL tabulky mezi /d/ a /edit>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<client_email z JSONu>
GOOGLE_PRIVATE_KEY="<private_key z JSONu, i s \n>"
```

   Klíč patří na jeden řádek v uvozovkách; `\n` uvnitř nech tak, jak jsou v JSONu.

6. Restartuj aplikaci. Upozornění o lokálním úložišti zmizí.

Stažený JSON klíč nikam neposílej a nedávej ho do repozitáře — je to přístup
do tabulky. `.env.local` i záloha `.env.local.bak` jsou v `.gitignore`.

### Přenos dat z lokálního režimu

Pokud jsi klienty přidával ještě před napojením Sheetu, přeneseš je jedním během:

```bash
node --env-file=.env.local scripts/import-local.mjs
```

Skript je idempotentní — co už v tabulce je, přeskočí, takže se nedá spustit
dvakrát „omylem". `data/local-store.json` po přenosu zůstává jako záloha.

## Automatický denní scrape

**Z cloudu scrape nefunguje.** Heureka je za Cloudflare, který blokuje
datacentrové IP adresy. Ověřeno 5. 9. 2026 na GitHub Actions: ze sítě kanceláře
prošlo 20 z 20 obchodů, z runneru o pár minut později 0 z 20 (všechny HTTP 403).
Totéž platí pro Vercel a jakýkoli běžný VPS.

Řešením je **oficiální widget Ověřeno zákazníky** na `/direct/i/`. Ten za bot
ochranou být nemůže, protože musí fungovat návštěvníkům e-shopů, takže odpoví
odkudkoli — z GitHub Actions i z Vercelu.

Widget potřebuje klíč obchodu (`widget_key` v listu `Clients`):

- `npm run keys` ho najde na webech e-shopů, ověří a uloží
- `npm run key -- "<obchod>" "<klíč>"` doplní ručně klíč z administrace
  Ověřeno zákazníky u obchodů, které widget na webu nemají

Widget funguje i pro obchody **bez** certifikátu — vrátí procenta a recenze,
jen v něm chybí zmínka o certifikátu. Podle toho se pozná úroveň:

- žádná zmínka o certifikátu → `none`
- zmínka + příznak `goldTab` ve widget skriptu → `gold`
- zmínka bez `goldTab` → `blue`

U některých klíčů vrací widget prázdnou odpověď (Kulina, Flamaro.sk); ty se
čtou z profilu obchodu.

Obchody bez klíče se čtou z profilu na Heurece, což projde jen z důvěryhodné
sítě. Pro ně je tu `scrape-daily.cmd` (Plánovač úloh Windows, log v
`logs/scrape.log`) — nebo prostě tlačítko v dashboardu.

Google Apps Script (`apps-script/Kod.gs`) byl slepá ulička: Google IP jsou
blokované stejně jako Azure (ověřeno, HTTP 403). Soubor zůstává pro případ,
že by se to změnilo.

Výpadek na pár dní nic nerozbije: tabulka drží jeden řádek na obchod a den,
takže po návratu se prostě naváže. V historii zůstane mezera a slackové
hlášení porovná poslední dva dostupné dny.

Workflow `.github/workflows/scrape.yml` v repozitáři zůstává, ale s vypnutým
cronem — jde spustit jen ručně. Kdyby Heureka blokaci časem uvolnila, stačí
odkomentovat blok `schedule` a ověřit jeden běh.

## Nasazení a přístup

Dashboard běží na <https://heureka-oz-controller.vercel.app>. **Čtení je veřejné** —
data z Heureky nejsou tajná a kolegové se mají podívat bez přihlašování.

**Úpravy vyžadují heslo** (`ADMIN_PASSWORD`): přidat a odebrat klienta, přerovnat
dlaždice, spustit kontrolu. Bez něj by je na veřejné adrese mohl spustit kdokoli.
Nepřihlášený vidí jen tlačítko Přihlásit; heslo drží cookie 30 dní.

Nasazuje se z příkazové řádky:

```bash
vercel --prod
```

Automatický deploy při pushi nejde zapnout — Vercel Hobby plán nepodporuje privátní
repozitáře vlastněné organizací. Buď se nasazuje ručně, nebo je potřeba Pro plán.
Vercel Hobby navíc v podmínkách zakazuje komerční použití, což firemní nástroj je.

Na Vercelu není `curl`, kterým se stahují profily obchodů. Widget endpointy za
Cloudflare nejsou, takže tam stačí běžný `fetch` a `fetchHtml` na něj přepne sám.

## Upozornění do Slacku

Naplánovaná úloha na Databy platformě (`task-a3175111afc4`) hlídá tabulku
a v pracovní dny v 9:00 (Europe/Prague) píše do kanálu `#heureka_overeno_zakazniky`.

Nepotřebuje vlastní Slack aplikaci — běží pod Ondřejovým účtem přes integraci,
která už ve workspace je, takže limit 10 aplikací na free plánu se jí netýká.

Co hlásí, když porovná dva poslední dny u každého obchodu:

- změnu certifikátu (ztráta, zisk, přechod zlatý ↔ modrý)
- pokles spokojenosti o 2 a více procentních bodů

Ve dnech beze změn pošle `BEZE ZMĚN`.

Dvě věci k údržbě:

- **Úloha porovnává jen to, co v tabulce přibude.** Dokud se scrape spouští ručně,
  hlásí změny jen mezi dny, kdy někdo zmáčkl tlačítko.
- **Platnost je 90 dní** — do 4. 12. 2026 je potřeba ji znovu potvrdit,
  jinak se sama zastaví.

## Nasazení na Vercel

Aplikace je běžná Next.js appka, takže deploy je `vercel` nebo propojení
Git repozitáře. Stejné tři proměnné nastav v **Project → Settings → Environment
Variables**. Lokální JSON fallback na Vercelu nefunguje (filesystem je read-only),
takže Sheet musí být napojený.

Dashboard (čtení ze Sheetu) na Vercelu poběží bez problémů. **Scrape ale ne** —
ve Vercel funkci není curl a Node `fetch` Cloudflare odmítne.

Endpoint `/api/scrape` je při nasazení potřeba chránit sdíleným tajemstvím,
aby ho nemohl spustit kdokoli.
