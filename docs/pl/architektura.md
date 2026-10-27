# ZSM3 — Architektura systemu (v1)

Status: **zatwierdzony projekt, etap 0 zrealizowany.** Kolejne etapy ruszają po odpowiedzi szkoły na pytania z rozdziału 15. Wersja angielska: [../en/architecture.md](../en/architecture.md).

## 1. Cele i zakres

**W wersji v1**

1. Publiczna strona internetowa: nowy front-end w Astro; szablon strony jest budowany z wyprzedzeniem, a strony z treścią edytowaną przez szkołę są generowane na bieżąco z bazy D1.
2. **E-wniosek:** składanie przez internet wniosków o dokumenty szkolne, np. przedłużenie lub duplikat legitymacji szkolnej albo zaświadczenie o uczęszczaniu do szkoły. Wnioskodawca sprawdza status przez tajny link i nie potrzebuje konta.
3. **Panel dla pracowników:** sekretariat obsługuje wnioski, nauczyciele prowadzą galerię, administrator zarządza dostępami.
4. **Galeria:** albumy według lat szkolnych, dodawanie zdjęć z panelu, przeniesienie obecnego archiwum (304 albumy, około 5400 zdjęć).

**Zarządzanie treścią:** wszystko, co szkoła edytuje dziś w WordPressie (aktualności, strony, dokumenty, terminarz, komunikaty, dzwonki, oferty pracy), będzie edytowane w panelu, bez pomocy programisty.

**Poza wersją v1:** płatności online, konta uczniów i rodziców, zastąpienie BIP.

**Wymagania pozafunkcjonalne**

- Koszt utrzymania 0 zł miesięcznie na bezpłatnych planach.
- Zgodność z RODO, ustawą o dostępności cyfrowej (WCAG 2.1 AA) oraz OWASP ASVS 5.0 na poziomie 2.
- Żaden krok kontroli jakości nie jest pomijany: zmiana, która nie przejdzie wszystkich testów, nie trafia do gałęzi `main`.

## 2. Wymogi prawne → rozwiązania

| Akt                                        | Wymóg                                                                  | Rozwiązanie                                                                                                                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RODO art. 5, 25                            | minimalizacja danych, privacy by design                                | tylko pola niezbędne do wydania dokumentu; bez PESEL, bez zdjęć, bez adresów IP; szyfrowanie pól (§8.3)                                                                              |
| RODO art. 6                                | podstawa prawna                                                        | art. 6 ust. 1 lit. c/e (zadanie publiczne szkoły), **nie zgoda**; ostatecznie zatwierdza Inspektor Ochrony Danych (IOD)                                                              |
| RODO art. 13                               | klauzula informacyjna                                                  | tekst od IOD pod formularzem z linkiem do pełnej wersji; pole „Zapoznałem(-am) się”, które nie jest zgodą                                                                            |
| RODO art. 17, 21                           | usuwanie danych                                                        | wnioskodawca sam wycofuje wniosek (§7.3); automatyczne usuwanie po upływie okresu przechowywania (§8.4)                                                                              |
| RODO art. 28                               | umowy powierzenia                                                      | konta Cloudflare i Brevo **należą do szkoły**, która akceptuje ich umowy DPA; programista z dostępem do danych produkcyjnych podpisuje ze szkołą umowę powierzenia                   |
| RODO art. 30, 32, 33                       | rejestr czynności, bezpieczeństwo, naruszenia                          | opis przetwarzania do rejestru szkoły (`docs/RODO.md`), środki z §8, procedura zgłoszenia naruszenia w 72 godziny (§12.3)                                                            |
| RODO art. 44+                              | przekazywanie poza EOG                                                 | D1 i R2 w jurysdykcji `eu`; Cloudflare i Brevo na podstawie DPA/SCC; Brevo to firma francuska                                                                                        |
| Ustawa o dostępności cyfrowej (2019)       | WCAG 2.1 AA, deklaracja dostępności                                    | zero błędów axe na każdej stronie w CI; strona `/deklaracja-dostepnosci` według urzędowego wzoru, link w stopce                                                                      |
| Ustawa o zapewnianiu dostępności (2019)    | informacja o działalności w tekście odczytywalnym maszynowo, PJM i ETR | strona `/dostepnosc` z tekstem łatwym do czytania i nagraniem w polskim języku migowym, materiały dostarcza szkoła                                                                   |
| Prawo komunikacji elektronicznej, art. 399 | pliki cookie i pamięć przeglądarki                                     | tylko niezbędne: wybór motywu w `localStorage` (funkcja, o którą prosi użytkownik), sesyjne cookie Access dla pracowników; brak analityki i śledzenia, więc baner nie jest potrzebny |
| UŚUDE art. 8                               | regulamin usługi elektronicznej                                        | strona `/e-wniosek/regulamin`, treść zatwierdza szkoła                                                                                                                               |
| Prawo autorskie art. 81                    | wizerunek                                                              | przy każdym dodaniu zdjęć potwierdzenie posiadania zgód, zapis w dzienniku zdarzeń; usunięcie zdjęcia na żądanie w kilka minut                                                       |
| Rozporządzenie KRI (2024)                  | bezpieczeństwo i dostępność systemów podmiotów publicznych             | rozdziały 8, 10 i 12 tego dokumentu oraz dziennik zdarzeń                                                                                                                            |
| Ustawa o dostępie do informacji publicznej | BIP                                                                    | strona nie zastępuje BIP; link do BIP w nagłówku i stopce                                                                                                                            |

## 3. Schemat ogólny

```
                         ┌──────────────── Cloudflare (konto szkoły) ─────────────────────┐
 Odwiedzający ──HTTPS──► │  WAF (bezpłatne reguły) → Worker „zsm3”                          │
                         │     ├─ Pliki statyczne: HTML, CSS, JS, czcionki, obrazy          │
                         │     ├─ /api/requests/*   publiczne API wniosków (Turnstile, limity) │
                         │     ├─ /api/gallery/*    odczyt galerii (cache na brzegu sieci)  │
                         │     ├─ /media/*          zdjęcia z R2 (cache, niezmienne)        │
 Pracownicy ──Access──►  │     ├─ /panel/*          statyczne strony panelu                 │
 (SSO / kod jednorazowy) │     └─ /api/panel/*      API panelu (JWT Access, role, Origin)   │
                         │  D1 (eu)  — wnioski, galeria, pracownicy, dziennik zdarzeń       │
                         │  R2 (eu)  — zdjęcia galerii                                      │
                         │  Queues   — wysyłka e-maili (ponowienia, kolejka błędów)         │
                         │  Cron     — usuwanie danych po terminie, porządki                │
                         └──────────────────────────────────────────┬──────────────────────┘
                                                                    └──► Brevo (UE) e-mail
```

Jeden Worker pod jednym adresem: brak problemów z CORS, jedno wdrożenie, jedna polityka nagłówków. Gotowe pliki serwuje sieć Cloudflare bez uruchamiania kodu; Worker generuje strony z treścią z bazy D1 przy każdym żądaniu, bez buforowania na brzegu sieci (ADR 0003) i obsługuje `/api/*`, `/media/*` oraz `/panel*`.

## 4. Technologie

| Warstwa         | Wybór                               | Uzasadnienie                                                                                                                                                                           |
| --------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Środowisko      | Cloudflare Workers + Static Assets  | bezpłatne, bez serwerów, jeden adres                                                                                                                                                   |
| Język serwera   | TypeScript 6.0 (tryb ścisły)        | natywny język Workers; typescript-eslint nie obsługuje jeszcze wersji 7.x                                                                                                              |
| HTTP            | Hono                                | mały, sprawdzony router dla Workers; middleware do nagłówków bezpieczeństwa, limitów i ochrony CSRF                                                                                    |
| Walidacja       | Zod 4                               | te same schematy dla formularza i API (`packages/contracts`)                                                                                                                           |
| Baza danych     | D1 (SQLite), migracje SQL           | bezpłatna; wyłącznie zapytania parametryzowane (`bind`)                                                                                                                                |
| Pliki           | R2                                  | 10 GB bezpłatnie, darmowy transfer                                                                                                                                                     |
| JWT             | `jose`                              | weryfikacja tokenów Access według JWKS                                                                                                                                                 |
| E-mail          | Brevo za interfejsem `EmailSender`  | dostawca z UE, 300 e-maili dziennie bezpłatnie; zmiana dostawcy to jeden adapter                                                                                                       |
| Front-end       | Astro 7 (hybrydowo), TypeScript     | szkielet strony budowany z wyprzedzeniem, treść generowana na żądanie i buforowana; JavaScript tylko tam, gdzie potrzebny; brak skryptów i stylów inline, dzięki czemu CSP jest ścisła |
| Kompresja zdjęć | jSquash (WebP, WASM) w Web Workerze | identyczny wynik w każdej przeglądarce                                                                                                                                                 |
| Narzędzia       | Python 3.13 (`tools/`, uv)          | skrypty pomocnicze: import archiwum galerii, kontrole repozytorium                                                                                                                     |
| Node.js         | Node 24 LTS, pnpm 12                | instalowane są tylko wersje starsze niż 7 dni, weryfikacja pochodzenia pakietów, skrypty instalacyjne tylko z białej listy                                                             |

## 5. Struktura repozytorium

```
zsm3/
├─ apps/
│  ├─ worker/                     API, dostęp do bazy D1, migracje i dane przykładowe
│  │  ├─ src/                     http, security, domain, storage, media, routes, mail, jobs
│  │  ├─ migrations/              migracje bazy D1
│  │  ├─ seed/                    przykładowe treści do uruchomień lokalnych i testów
│  │  ├─ test/                    testy jednostkowe, integracyjne (workerd) i bezpieczeństwa
│  │  └─ wrangler.jsonc           Worker wyłącznie do testów
│  └─ web/                        strona Astro i wdrażany Worker (worker/index.ts, wrangler.jsonc)
├─ packages/
│  ├─ contracts/                  schematy Zod wspólne dla strony i API
│  └─ lint-rules/                 własne reguły ESLint i Stylelint
├─ tools/                         pakiet Python zsm3_tools
├─ e2e/                           Playwright, axe i budżety Lighthouse
├─ docs/                          en/, pl/, RODO.md, RUNBOOK.md
└─ .github/                       workflowy CI, Dependabot, zizmor
```

Zdjęcia galerii są przechowywane w R2 (§7.6), nigdy w repozytorium. Szczegółowy opis katalogów zawiera wersja angielska.

## 6. Model danych (D1)

Czas zapisywany jest w UTC (ISO 8601) i wyświetlany w strefie `Europe/Warsaw`. Identyfikatory to UUIDv7.

| Tabela            | Zawartość                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `requests`        | wnioski: typ, status, **zaszyfrowane** dane osobowe (imię, nazwisko, klasa lub rok ukończenia, e-mail, uwaga), skrót tokenu statusu, daty; dane osobowe są usuwane po terminie |
| `albums`          | albumy: rok szkolny, tytuł, opis, okładka, data publikacji                                                                                                                     |
| `photos`          | zdjęcia: album, kolejność, wymiary, tekst alternatywny, klucze plików w R2, skrót SHA-256                                                                                      |
| `staff`           | pracownicy: e-mail, rola (`admin`, `secretariat`, `editor`, `gallery_editor`), aktywność                                                                                       |
| `audit_log`       | dziennik zdarzeń: kto, co i kiedy zmienił, bez danych osobowych wnioskodawców                                                                                                  |
| `outbox_failures` | wiadomości e-mail, których nie udało się wysłać                                                                                                                                |

### Renderowanie

Na żądanie renderowane są: strona główna, huby sekcji, wszystkie listy i artykuły aktualności oraz endpoint wyników wyszukiwania `/szukaj/wyniki.json`. Endpoint odpytuje przez repozytorium wyszukiwania tabelę FTS5 `search_documents` (tokenizator unicode61, tekst bez znaków diakrytycznych w indeksowanych kolumnach `title` i `body`, ranking bm25) i scala te trafienia ze statycznie ocenionymi wpisami; stary statyczny endpoint `/szukaj/indeks.json` pozostaje do czasu kolejnego pull requesta zmieniającego kontrakt. Nieznane kategorie, lata, strony i artykuły zwracają 404 z wyrenderowaną stroną błędu.

## 7. Procesy

### 7.1 Złożenie wniosku

1. Strona `/e-wniosek` zna typy dokumentów i ich pola już w momencie budowania strony.
2. Wysłanie formularza (`POST /api/requests`) przechodzi kolejno przez:
   1. kontrolę typu i rozmiaru danych (maks. 8 KB);
   2. limit częstotliwości: 5 wniosków na 10 minut z jednego adresu, przy czym sam adres IP nie jest zapisywany;
   3. weryfikację Cloudflare Turnstile (ochrona przed botami bez uciążliwej captchy);
   4. pułapkę na boty: ukryte pole musi pozostać puste, a wypełnienie formularza musi trwać co najmniej 3 sekundy;
   5. walidację wszystkich pól według schematu;
   6. limit 3 otwartych wniosków na jeden adres e-mail;
   7. zaszyfrowanie danych osobowych i zapis do bazy;
   8. dwa e-maile: do wnioskodawcy (link do statusu) i do sekretariatu (tylko numer i typ, **bez danych osobowych**).
3. Strona pokazuje link do statusu, który przychodzi także e-mailem.

### 7.2 Sprawdzenie statusu

- Link ma postać `https://<domena>/e-wniosek/status#<token>`. Token (32 losowe bajty) znajduje się **we fragmencie adresu**, więc nie trafia do logów serwera ani nagłówka `Referer`.
- Odpowiedź zawiera typ dokumentu, status, datę zmiany i informację o odbiorze. Nie zawiera danych osobowych.

### 7.3 Wycofanie wniosku

Wnioskodawca może wycofać wniosek przez ten sam link. Dane osobowe są usuwane natychmiast, zostaje tylko anonimowy zapis do statystyk.

### 7.4 Panel: obsługa wniosków

- Panel jest chroniony przez Cloudflare Access. Pracownicy logują się kontem Microsoft 365 lub Google Workspace szkoły (z uwierzytelnianiem dwuskładnikowym), a jeśli szkoła ich nie ma, jednorazowym kodem wysyłanym na adres z listy. Sesja trwa 8 godzin.
- Worker **sam** weryfikuje token Access przy każdym żądaniu, więc nawet obejście Access nie daje dostępu.
- Rola wynika z listy pracowników w bazie. Każda ścieżka panelu ma przypisane role, a testy sprawdzają wszystkie kombinacje.
- Zmiany statusu podlegają ścisłym regułom: `złożony → w realizacji → gotowy do odbioru → odebrany`, a z każdego otwartego stanu możliwe jest odrzucenie. Wnioskodawca dostaje e-mail, gdy dokument jest gotowy lub wniosek odrzucono.
- Każda zmiana trafia do dziennika zdarzeń.
- **Dokument jest wydawany wyłącznie osobiście, po okazaniu dokumentu tożsamości w sekretariacie.** Wniosek online jest tylko zgłoszeniem wstępnym, więc wniosek złożony w cudzym imieniu niczego nie daje.

### 7.5 Panel: galeria

1. Redaktor tworzy album (rok szkolny, tytuł, opis) i przeciąga zdjęcia.
2. Przeglądarka sama zmniejsza każde zdjęcie do dwóch rozmiarów (400 i 1600 px) i zapisuje je w formacie WebP. Przy tym znikają metadane EXIF, w tym lokalizacja GPS.
3. Przed wysłaniem redaktor potwierdza, że szkoła ma zgody na publikację wizerunku.
4. Serwer **nie ufa przeglądarce**: sprawdza strukturę pliku, odrzuca metadane i nietypowe elementy, kontroluje wymiary, a nazwę pliku tworzy z jego skrótu SHA-256.
5. Album jest widoczny publicznie dopiero po kliknięciu „Opublikuj”. Usunięte zdjęcia znikają z magazynu po 30 dniach.

### 7.6 Publiczna galeria

- Publicznie widoczne są tylko opublikowane albumy; odpowiedzi są buforowane w sieci Cloudflare.
- Zdjęcia są serwowane z R2 z długim czasem buforowania i nagłówkami bezpieczeństwa.
- **Import archiwum** wykonuje skrypt `tools/import_gallery.py`: pobiera zdjęcia z obecnej strony, obraca je według EXIF, usuwa metadane, zapisuje w WebP i wysyła do R2. Skrypt można bezpiecznie przerwać i wznowić.

## 8. Bezpieczeństwo

### 8.1 Zagrożenia i zabezpieczenia

| Zagrożenie                      | Zabezpieczenie                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Spam i boty w formularzu        | Turnstile, limity częstotliwości, pułapka, limit otwartych wniosków, WAF                                                              |
| XSS (wstrzyknięcie skryptu)     | ścisła polityka CSP, Trusted Types, zakaz `innerHTML` wymuszany przez linter                                                          |
| SQL injection                   | wyłącznie zapytania parametryzowane; linter blokuje sklejanie zapytań                                                                 |
| CSRF w panelu                   | kontrola nagłówka `Origin`, wyłącznie JSON                                                                                            |
| Obejście logowania              | własna weryfikacja tokenu Access, wyłączone adresy `workers.dev` i podglądy                                                           |
| Podniesienie uprawnień          | role z bazy, macierz dostępu, test każdej pary „ścieżka × rola”                                                                       |
| Odgadnięcie linku do statusu    | 256 bitów losowości, limity, w bazie tylko skrót                                                                                      |
| Złośliwy plik                   | własny parser WebP, biała lista elementów pliku, limity rozmiaru                                                                      |
| Wyciek bazy lub kopii zapasowej | szyfrowanie danych osobowych na poziomie pól, klucz tylko w sekretach Workera                                                         |
| Wyciek przez logi               | logger przyjmuje tylko zdefiniowane zdarzenia bez danych osobowych                                                                    |
| Atak przez zależności           | tylko pakiety starsze niż 7 dni, weryfikacja pochodzenia, audyt i OSV, akcje przypięte do SHA ([supply-chain](../en/supply-chain.md)) |
| Sekrety w repozytorium          | gitleaks w CI, skanowanie sekretów i blokada wypchnięcia w GitHub                                                                     |
| Clickjacking                    | `frame-ancestors 'none'`, `X-Frame-Options: DENY`                                                                                     |
| Awaria dostawcy e-mail          | kolejka z ponowieniami; wniosek jest zapisany niezależnie od wysyłki                                                                  |

### 8.2 Nagłówki HTTP

Każda odpowiedź ma komplet nagłówków bezpieczeństwa: HSTS, ścisłą CSP, `nosniff`, `Referrer-Policy: no-referrer`, wyłączone uprawnienia przeglądarki (kamera, mikrofon, lokalizacja itd.) oraz izolację między domenami (COOP, COEP, CORP). Testy sprawdzają cały zestaw. Cel: ocena A+ w Mozilla Observatory.

### 8.3 Kryptografia

- Dane osobowe wniosku są szyfrowane algorytmem AES-256-GCM. Klucz znajduje się wyłącznie w sekretach Workera i można go wymienić bez przerwy w działaniu.
- Linki do statusu są losowe; w bazie zapisany jest tylko ich skrót.
- Panel odszyfrowuje dane tylko dla oglądanego wniosku lub strony listy.

### 8.4 Okresy przechowywania (wartości domyślne, zatwierdza IOD)

| Dane                                        | Okres                                                     |
| ------------------------------------------- | --------------------------------------------------------- |
| Dane osobowe zamkniętego wniosku            | 30 dni od zamknięcia                                      |
| Dane osobowe wycofanego wniosku             | usuwane natychmiast                                       |
| Otwarty wniosek bez zmian                   | 90 dni, potem odrzucenie z e-mailem i usunięcie jak wyżej |
| Anonimowy zapis wniosku (typ, daty, status) | 2 lata, do statystyk                                      |
| Dziennik zdarzeń                            | 2 lata                                                    |
| Logi Workera                                | kilka dni (okres Cloudflare), bez danych osobowych        |
| Usunięte zdjęcia                            | 30 dni w R2, potem trwałe usunięcie                       |

Usuwanie wykonuje automatycznie zadanie uruchamiane raz na dobę; każde uruchomienie jest zapisywane w dzienniku zdarzeń.

## 9. Prywatność w interfejsie

- Formularz zbiera tylko: typ dokumentu, imię, nazwisko, klasę lub rok ukończenia szkoły, e-mail i opcjonalną uwagę (do 500 znaków) z podpowiedzią „nie wpisuj danych wrażliwych”.
- Pod formularzem: klauzula informacyjna, regulamin i pole „Zapoznałem(-am) się”.
- Brak zbędnych usług zewnętrznych: własne czcionki, mapa jako link, filmy YouTube ładowane dopiero po kliknięciu z domeny `youtube-nocookie.com`.

## 10. Dostępność

- WCAG 2.1 AA: automatyczny test axe na każdej stronie i w każdym stanie formularza, zero dopuszczalnych błędów.
- Formularze: etykieta przy każdym polu, komunikaty błędów powiązane z polami i odczytywane przez czytniki ekranu, brak limitów czasu. Jeśli weryfikacja Turnstile się nie powiedzie, strona podaje telefon i adres sekretariatu.
- Pełna obsługa z klawiatury, także dodawania zdjęć i przeglądarki galerii.
- Tryby dostępności znane z obecnej strony (większy tekst, wysoki kontrast, skala szarości, podkreślone linki) zostają.
- Strony `/deklaracja-dostepnosci` i `/dostepnosc` (tekst łatwy do czytania, PJM).

## 11. Jakość kodu

- Kod bez komentarzy: intencję wyrażają nazwy i struktura. Wymuszają to własne reguły lintera.
- Ścisłe typowanie bez obejść; reguł lintera nie można wyłączyć w kodzie.
- Dane z zewnątrz są zawsze walidowane schematem na wejściu.
- Pokrycie testami 100%, testy mutacyjne (co najmniej 90%), testy end-to-end w Chromium, Firefox, WebKit i na urządzeniu mobilnym, testy dostępności i wydajności (Lighthouse: wydajność ≥ 95, dostępność 100).
- Zmiany trafiają do `main` wyłącznie przez pull request ze wszystkimi testami na zielono.

Pełna lista narzędzi i progów: rozdział 11 wersji angielskiej oraz [development.md](../en/development.md).

## 12. CI/CD i utrzymanie

### 12.1 Automatyczne kontrole (GitHub Actions)

Przy każdej zmianie uruchamiane są: formatowanie, lintery, kontrola typów, testy jednostkowe i integracyjne, testy mutacyjne, testy end-to-end z kontrolą dostępności i Lighthouse oraz zestaw skanerów bezpieczeństwa (pnpm audit, OSV-Scanner, Semgrep, CodeQL, gitleaks, actionlint, ShellCheck, zizmor, OWASP ZAP, przegląd zależności, SBOM). Po wdrożeniu dochodzi środowisko testowe (preview) i wdrożenie produkcyjne po ręcznym zatwierdzeniu.

### 12.2 Środowiska

|         | lokalne                        | preview                   | produkcja           |
| ------- | ------------------------------ | ------------------------- | ------------------- |
| Dane    | testowe                        | fikcyjne                  | prawdziwe           |
| Dostęp  | komputer programisty           | cała strona za logowaniem | panel za logowaniem |
| Sekrety | plik lokalny poza repozytorium | sekrety Cloudflare        | sekrety Cloudflare  |

### 12.3 Utrzymanie

- **Kopie zapasowe:** przywracanie bazy do dowolnego momentu (D1 Time Travel) oraz cotygodniowy eksport do prywatnego magazynu R2, przechowywany 8 tygodni. Dane osobowe w eksporcie są już zaszyfrowane.
- **Monitorowanie:** logi Workerów, powiadomienia Cloudflare o błędach, e-mail do administratora przy nieudanych wysyłkach.
- **Wyłącznik awaryjny:** jedno ustawienie wyłącza przyjmowanie wniosków i pokazuje dane kontaktowe sekretariatu.
- **Naruszenie ochrony danych** (`docs/RUNBOOK.md`): wyłączenie formularzy → wymiana kluczy → natychmiastowa informacja do IOD → IOD decyduje o zgłoszeniu do UODO w ciągu 72 godzin.
- `/.well-known/security.txt` z kontaktem do zgłaszania podatności.

## 13. Koszty

| Usługa              | Bezpłatny limit                                    | Przewidywane użycie           |
| ------------------- | -------------------------------------------------- | ----------------------------- |
| Workers             | 100 000 żądań dziennie; pliki statyczne bez limitu | setki wywołań API dziennie    |
| D1                  | 5 GB                                               | megabajty                     |
| R2                  | 10 GB                                              | archiwum ~2–3 GB po kompresji |
| Access              | 50 użytkowników                                    | sekretariat i nauczyciele     |
| Turnstile, WAF, DNS | bezpłatnie                                         |                               |
| Brevo               | 300 e-maili dziennie                               | kilka dziennie                |
| GitHub Actions      | bez limitu dla publicznych repozytoriów            | ~15 minut na zmianę           |

Razem: **0 zł miesięcznie**. Szkoła ma już własną domenę. Przy dużym wzroście ruchu płatny plan Workers kosztuje 5 USD miesięcznie.

## 14. Etapy

| #   | Etap                    | Rezultat                                                                                                                                                |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Fundament               | **gotowe:** repozytorium, narzędzia, pełne CI, szkielety Workera i strony                                                                               |
| 1   | System wizualny         | kierunek graficzny wybrany ze szkołą, kolory, typografia, komponenty, szablony stron, ustawienia dostępności, „Teraz w szkole”                          |
| 2   | Platforma treści        | model treści w bazie, import obecnej strony, wyszukiwarka, RSS, przekierowania starych adresów, SEO (metadane, mapy strony, dane strukturalne)          |
| 3   | Panel i CMS             | logowanie, role, edycja wszystkich rodzajów treści, historia zmian, dziennik zdarzeń, podręcznik redaktora                                              |
| 4   | E-wniosek               | baza, API wniosków, formularz, status, wycofanie, e-maile, automatyczne usuwanie danych                                                                 |
| 5   | Galeria                 | dodawanie zdjęć w panelu, publiczna galeria, import archiwum                                                                                            |
| 6   | Narzędzia społeczności  | krótkie linki, Skrzynka #OgarniamŻycie, statystyki bez plików cookie                                                                                    |
| 7   | Zgodność i uruchomienie | deklaracja dostępności, ETR/PJM, przegląd PDF, regulamin, pełny skan bezpieczeństwa, ASVS L2, przeniesienie DNS, rejestracja w Google i Bing, szkolenie |

Szczegóły etapów (w języku angielskim): [site-plan.md](../en/site-plan.md).

Każdy etap kończy się zielonym CI i prezentacją na środowisku preview.

## 15. Pytania do szkoły

Rozwój na środowisku preview nie jest od nich zależny; odpowiedzi są potrzebne przed etapem 7.

1. Konta Cloudflare i Brevo zarejestrowane na szkołę, z programistą dodanym jako członek zespołu; akceptacja umów DPA.
2. Przeniesienie obsługi DNS domeny szkoły do Cloudflare (zmiana serwerów nazw; rekordy poczty pozostają bez zmian).
3. IOD: podstawa prawna, okresy przechowywania (§8.4), treść klauzuli, wpis do rejestru czynności przetwarzania, decyzja o umowie powierzenia z programistą.
4. Lista dokumentów, wymagane dla nich pola, zasady odbioru i opłaty za duplikaty.
5. Czy szkoła korzysta z Microsoft 365 lub Google Workspace (logowanie do panelu z uwierzytelnianiem dwuskładnikowym).
6. Lista pracowników i ich role.
7. Zasady zgód na publikację wizerunku uczniów.
8. Materiały do strony `/dostepnosc` (tekst łatwy do czytania, nagranie PJM) oraz koordynator dostępności wskazany w deklaracji.
