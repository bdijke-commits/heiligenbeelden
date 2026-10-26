# Mijn Heiligenbeelden: installeren

Een app voor je verzameling heiligenbeelden. Jij logt in, voegt beelden toe en maakt er foto's van met je telefoon. Bezoekers kijken mee en kunnen reageren, zonder account. Aankoop, prijs en van wie je een beeld kreeg zie alleen jij.

Het werkt net als de Bekerkast, maar met een eigen, nieuw Firebase-project. Je GitHub-account kun je hergebruiken.

## 1. Nieuw Firebase-project

1. Ga naar https://console.firebase.google.com en klik op **Create a project** (Project maken). Noem het bijv. `heiligenbeelden` en zet Google Analytics uit.
2. Ga naar **Settings (tandwiel) → General**, scroll naar **Your apps** en klik op **`</>`** (Web). Geef een bijnaam en klik op **Register app**. Firebase Hosting laat je uit.
3. ✓ Al gedaan: `config.js` is ingevuld voor het project `barbara-s-heiligenbeelden`.

## 2. Inloggen aanzetten

1. Ga naar **Security → Authentication** en klik op **Get started**.
2. Zet onder **Sign-in method** aan: **Email/Password** en **Anonymous**.
3. Ga naar **Users → Add user** en maak `bdijke@gmail.com` aan met een wachtwoord naar keuze.

## 3. Database

1. Ga naar **Databases & Storage → Firestore** en klik op **Create database**. Kies een locatie in Europa (bijv. `eur3`) en **production mode**.
2. Open het tabblad **Rules**, vervang alles door de inhoud van `firestore.rules` en klik op **Publish**.

## 4. Online zetten met GitHub Pages

1. Ga naar https://github.com, klik rechtsboven op **+ → New repository**, noem hem `heiligenbeelden`, kies **Public** en klik op **Create repository**.
2. Klik op **uploading an existing file**, selecteer alle bestanden uit deze map (Cmd+A) en sleep ze erin. Er zitten geen submappen in. Klik op **Commit changes**.
3. Ga naar **Settings → Pages**, kies **Deploy from a branch**, branch `main`, `/ (root)` en klik op **Save**.
4. Na een paar minuten staat de app op `https://bdijke-commits.github.io/heiligenbeelden/`.

GitHub stuurt misschien weer een mail over een "secret" in `config.js`. Die kun je sluiten als **False positive**: de Firebase-sleutel is bedoeld om openbaar te zijn.

## 5. Firebase vertellen waar de app staat

Ga naar **Security → Authentication → Settings → Authorized domains** en voeg `bdijke-commits.github.io` toe.

## 6. Beginnen

Open de app, klik op **Inloggen** en daarna op **+ Beeld toevoegen**. Op je telefoon opent de knop **+ Foto's toevoegen** direct de camera of je fotobibliotheek. Je kunt tot 8 foto's per beeld toevoegen; de eerste is de hoofdfoto.

Zet de app op je beginscherm: op de iPhone via het deelicoon → **Zet op beginscherm**.

---

## Goed om te weten

- **Wie ziet wat?** Iedereen met de link ziet de beelden, foto's, gegevens over de heilige en je toelichting, en kan reageren. Het blok "Hoe kwam het bij jou" (gekocht/gekregen, van wie, prijs, notitie) zie alleen jij.
- **Feestdagen:** vul je bij een beeld de feestdag in, dan verschijnt die bovenaan bij "Feestdagen deze maand". Sorteer op "Op feestdag" voor de jaarkalender vanaf vandaag.
- **Foto's** worden verkleind opgeslagen in de database (ongeveer 200 kB per foto). Het gratis plan heeft 1 GB ruimte: genoeg voor duizenden foto's.
- **Iets aangepast aan de bestanden?** Verhoog dan in `sw.js` het versienummer (`heiligen-v1` → `heiligen-v2`).
