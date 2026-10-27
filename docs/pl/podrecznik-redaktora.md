# Podręcznik redaktora — panel pracowników ZSM3

Ten podręcznik opisuje, jak pracownicy szkoły edytują treść strony w panelu: aktualności, strony treści, terminarz, dokumenty i przekierowania. Jest napisany prostym językiem i skierowany do sekretariatu oraz nauczycieli. Nie wymaga wiedzy technicznej.

**Status:** panel powstaje w etapie 3 (panel i CMS). Opis odwzorowuje zachowanie ustalone w [architekturze](architektura.md) oraz w planie strony. Dopóki panel nie ruszy, w pliku nie ma zrzutów ekranu ani opisów nieistniejących jeszcze elementów. Po uruchomieniu panelu ten tekst zostanie uzupełniony.

## 1. Logowanie do panelu

Panel działa pod adresem `/panel` i jest chroniony przez Cloudflare Access. Wchodzi się zwykłą przeglądarką, ze szkolnego komputera albo z domu.

### Jak się zalogować

1. Otwórz adres panelu.
2. Strona logowania zapyta o tożsamość szkolną. Najpierw wybierz konto **Microsoft 365** lub **Google Workspace** szkoły i zaloguj się z uwierzytelnianiem dwuskładnikowym.
3. Jeśli szkoła nie ma kont Microsoft 365 ani Google Workspace, wybierz opcję kodu jednorazowego: podaj szkolny adres e-mail, na który dostaniesz kod, a potem wpisz kod na stronie logowania.
4. System wyświetli to, co obejmuje twoja rola.

### Zasady

- Logujesz się **kontem szkolnym**, nie prywatnym. Adres e-mail musi figurować na liście pracowników prowadzonej przez administratora.
- Czas trwania sesji ustawia aplikacja Access w panelu Cloudflare. Architektura przewiduje **8 godzin**, po których system poprosi o zalogowanie się ponownie. To zaprojektowane celowo, dla bezpieczeństwa.
- Ochrona pracuje dwuetapowo: najpierw Access, a potem system sam weryfikuje token przy każdym żądaniu. Przejście przez logowanie nie zastąpi więc uprawnień — rola wynika z listy pracowników w bazie, a nie z tego, jak wszedłeś.
- Pracuj na komputerze, którego nie używają inne osoby, albo wyloguj się, wychodząc.

## 2. Role pracowników

Rolę ma każdy pracownik wpisany do listy w panelu. Panel zna cztery role:

| Rola             | Co możesz robić                                                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| administrator    | Wszystko w panelu, a dodatkowo prowadzi listę pracowników i ich role (**Pracownicy i role**) oraz przekierowania starych adresów.               |
| sekretariat      | Redaguje treści strony, a od etapu 4 obsługuje wnioski e-wniosek.                                                                               |
| redaktor treści  | Redaguje treści strony: aktualności, strony, terminarz, dokumenty, ogłoszenia i dzwonki. To rola nauczycieli i pracowników prowadzących stronę. |
| redaktor galerii | Prowadzi galerię: tworzy albumy, dodaje zdjęcia, publikuje je (etap 5). To rola nauczycieli odpowiedzialnych za fotoreportaż.                   |

### Pracownicy i role (administrator)

1. Otwórz **Pracownicy i role**.
2. Wpisz szkolny adres e-mail nowej osoby, wybierz rolę i kliknij **Dodaj pracownika**. Ta osoba może się zalogować od razu.
3. Aby zmienić rolę, wybierz nową na liście przy nazwisku i kliknij **Zapisz**.
4. Gdy ktoś odchodzi ze szkoły, odznacz **Konto aktywne** i zapisz. Konto traci dostęp przy następnym żądaniu; zostaje w dzienniku zdarzeń, więc wiadomo, co ta osoba zmieniała.

Swojego konta nie zmienisz: administrator nie może odebrać sobie roli ani wyłączyć siebie, żeby panel nigdy nie został bez administratora. Każda zmiana dostępu trafia do dziennika zdarzeń.

Każda ścieżka panelu ma przypisane role. Sprawy poza twoją rolą kończą się komunikatem o braku dostępu (rozdział 10).

Uwaga: dokładny podział, **kto redaguje który rodzaj treści** (aktualności, dokumenty, terminarz), ustali szkoła przed uruchomieniem panelu — jest to pytanie otwarte w planie strony. Listy zadań w dalszych rozdziałach pokazują, co panel potrafi, a nie przydział osób.

## 3. Aktualności

Aktualności to najczęściej edytowana część strony. Każda wiadomość ma stały zestaw pól.

### Pola aktualności

| Pole              | Do czego służy                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Tytuł             | Nagłówek artykułu. Mówi konkretnie, co się stało (dobre praktyki: rozdział 9).                                                   |
| Data              | Dzień publikacji. Widać ją na karcie newsa, w liście i w archiwum według roku.                                                   |
| Kategoria         | Swobodny tekst, np. „Rekrutacja”, „Zawody”. Lista aktualności jest filtrowana po wpisanej wartości, więc używaj ustalonych nazw. |
| Lead              | Krótkie wprowadzenie, dwa–trzy zdania. Widać go na karcie newsa i w podtytule artykułu.                                          |
| Treść             | Właściwy artykuł. Edytowany w dokumencie strukturalnym (opisanym niżej).                                                         |
| Zdjęcie w tytule  | Zdjęcie główne artykułu: podpis, autor (opcjonalnie) i opis alternatywny.                                                        |
| Dokumenty i album | Opcjonalnie: dołączone pliki oraz powiązany album galerii.                                                                       |
| Status            | Szkic albo opublikowany (rozdział 8). Publikację zaplanowaną przewiduje plan strony.                                             |

Plan strony przewiduje również powiązanie wiadomości z albumem galerii (etap 5). Pola wprowadza system i kontroluje je schematem walidacji; nie da się zapisać treści bez wymaganych pól.

### Edytor treści

Treść aktualności i stron nie jest zwykłym polem HTML. To **dokument strukturalny** w panelu: akapity, nagłówki, listy, cytaty, tabele i filmy dodajesz jako osobne bloki, a panel zapisuje strukturę zamiast kodu HTML. Wyróżnienia i linki wpisujesz w tekście znacznikami opisanymi w tabeli niżej, a panel odczytuje je i zapisuje jako strukturę. Dzięki temu serwer renderuje wyłącznie elementy z listy dozwolonych i nic — nawet kod wstrzyknięty z zewnątrz — nie wykona się na stronie czytelnika.

Co jest dozwolone w treści:

| Element              | Jak go używać                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Akapit               | Zwykły tekst. Najczęściej używany element — zaczynaj od niego.                                                                                                                                                                                                                                                                                      |
| Nagłówek             | Dziel artykuł na sekcje. Dostępne poziomy 2 i 3; nie pomijaj poziomu.                                                                                                                                                                                                                                                                               |
| Lista                | Punktowana albo numerowana: rzeczy do przywiezienia, plan dnia, zgłoszenia.                                                                                                                                                                                                                                                                         |
| Cytat                | Wypowiedź dyrektora albo fragment przepisu. Możesz podać źródło.                                                                                                                                                                                                                                                                                    |
| Tabela               | Rozkład zajęć, godziny dyżurów. Tabela ma podpis opisujący jej treść; kolumn do ośmiu.                                                                                                                                                                                                                                                              |
| Wideo                | Film z YouTube, dodawany przez identyfikator filmu i tytuł. Ładowany po kliknięciu (rozdział 4).                                                                                                                                                                                                                                                    |
| Pogrubienie, kursywa | Jedyne wyróżnienia tekstu — wpisujesz je znacznikami: `**pogrubienie**`, `__kursywa__`, oba naraz `***pogrubienie i kursywa***`. Nie ma koloru, rozmiaru ani zmiany czcionki — to celowe.                                                                                                                                                           |
| Link                 | Wpisujesz znacznikiem `[widoczny tekst](adres)`: do strony szkolnej, do stron innych szkół tylko przez `https://`, do e-maila (`mailto:`) i telefonu (`tel:`). Linki przez zwykłe `http://` nie przechodzą walidacji. Jeżeli znacznik wyróżnienia ma być widoczny dosłownie, w tekście jest bezpiecznie zabezpieczany — panel dba o poprawny zapis. |

O czym warto pamiętać:

- Nie wklejaj długich bloków z Worda bez przeglądu. Najpierw ustal strukturę (akapity, nagłówki, listy), a potem dopiero popraw sformułowania.
- Nie „rysuj” układu spacjami i podkreśleniami — o wygląd dba system, a ty odpowiadasz za treść.
- Tabela ma tyle komórek w każdym wierszu, ile jest kolumn.
- Wideo nie dodaje się przez wklejenie kodu `<iframe>`. Edytor nie przyjmie takiego wpisu, a serwer i tak go nie uruchomi.
- Pełne listy dozwolonych elementów i ograniczenia długości wyznaczają schematy w `packages/contracts/src/rich-text.ts` oraz `content.ts`. W razie wątpliwości pytaj administratora.

## 4. Strony treści

Strony treści pokrywają resztę serwisu: „O szkole”, „Historia”, „Pomoc”, statuty i dokumenty dodatkowe. Każdą stronę buduje się z sekcji, a sekcje z bloków. Sekcja ma identyfikator, tytuł i przynajmniej jeden blok; sekcji na stronie do dwudziestu, bloków na sekcję do czterdziestu.

### Bloki strony

| Blok        | Do czego służy                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| Rich text   | Zwykły tekst z elementów opisanych w rozdziale 3.                                                     |
| Liczby      | Kilka ważnych liczb z podpisami, np. „13 zawodów”, „5 lat nauki”.                                     |
| Oś czasu    | Chronologiczne punkty: podpis, tytuł, opis. Idealna do historii szkoły i projektów.                   |
| Wyróżnienie | Podświetlona ramka z tytułem, tekstem i opcjonalnym łączem do strony — do najważniejszego komunikatu. |
| Pliki       | Lista dokumentów do pobrania (rozdział 6): tytuł, opcjonalny opis, format, rozmiar.                   |

Tymi blokami budujesz sekcje w dowolnej kolejności. Jeśli chcesz opublikować coś wykraczającego poza tymi blokami, najpierw pytaj administratora — może da się to zrobić innym rodzajem treści, albo nowy rodzaj bloku dojdzie w następnym etapie.

### Wideo i mapy

Osadzanie treści z zewnątrz jest celowo ograniczone, żeby strona nie ładowała z Facebooka, YouTube ani Google niczego bez kliknięcia i nie dostarczała odwiedzającym ciasteczek osób trzecich:

- **Wideo** pojawia się jako podgląd z przyciskiem. Film uruchamia dopiero kliknięcie, z domeny `youtube-nocookie.com`.
- **Mapa** nie jest jeszcze osobnym blokiem edytora: podaj adres jako zwykły link w tekście rich text, a interaktywna mapa z podglądem dojdzie w jednym z kolejnych etapów.

Nie próbuj wklejać kodu z zewnętrznego serwisu. Edytor nie przyjmie formatu, którego brak na liście dozwolonych, a serwer nie zamieści czegoś, czego nie sprawdził.

## 5. Terminarz

Terminarz (`/szkola/terminarz`) pokazuje rok szkolny: egzaminy, dni wolne, zebrania, uroczystości. Te same wpisy widać na stronie głównej („Co przed nami”), w menu „Rodzice” i w wyszukiwarce. **Wpis „wolne” albo „przerwa” wyłącza odliczanie „Teraz w szkole” w te dni**, a dzień wcześniej i w sam dzień na każdej stronie pojawia się szary pasek „Jutro / Dziś nie ma zajęć”. Ręczne ogłoszenie (rozdział 11) ma pierwszeństwo przed tym paskiem.

### Pola wydarzenia

| Pole          | Do czego służy                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Data          | Początek wydarzenia. Data w strefie `Europe/Warsaw`.                                           |
| Data końcowa  | Opcjonalna. Musi być później niż data początkowa — do przerw i egzaminów trwających kilka dni. |
| Tytuł         | Krótki i sam objaśniający: „Ferie zimowe”, „Próbna matura — matematyka”.                       |
| Odbiorcy      | Wszyscy, Uczniowie albo Rodzice. Ustala, w którym filtrze wydarzenie się pokaże.               |
| Typ           | Jedna z kategorii z tabeli poniżej.                                                            |
| Uwaga         | Opcjonalna notatka: sala, godzina, wymagane rzeczy (do 300 znaków).                            |
| Kluczowa data | Zaznacz wydarzenia, które powinny widnieć w przeglądzie roku.                                  |

### Typy wydarzeń

| Typ         | Co oznacza                                                              |
| ----------- | ----------------------------------------------------------------------- |
| Rok szkolny | Granice roku: rozpoczęcie, koniec zajęć, zakończenie roku.              |
| Przerwa     | Dłuższa przerwa w zajęciach, np. ferie z datą początku i końca.         |
| Wolne       | Pojedyncze dni wolne od zajęć. Zasila powiadomienie na stronie głównej. |
| Zebranie    | Wywiadówki, rady pedagogiczne, spotkania rady rodziców.                 |
| Uroczystość | Pasowanie, dzień otwarty, rocznice i apel szkolne.                      |
| Oceny       | Terminy wystawiania ocen przewidywanych i końcowych.                    |
| Egzamin     | Egzaminy zawodowe i matura.                                             |
| Praktyki    | Terminy praktyk zawodowych.                                             |

Strona terminarza pokazuje rok jednym rzutem oka (kluczowe daty), pozwala filtrować według odbiorców i typów oraz eksportuje `.ics` do kalendarza telefonu. Dodanie dnia wolnego ma wpływ na całą stronę, dlatego traktuj daty wolne z taką wagą jak egzaminy, a datę kluczowych wydarzeń sprawdzaj dwukrotnie.

## 6. Dokumenty i pliki

Dokumenty przesyłane w panelu trafiają do magazynu R2 (Cloudflare, w UE). Serwer sprawdza format pliku według listy dozwolonych typów, pilnuje rozmiaru (do 100 MB) i buduje nazwę w magazynie ze skrótu SHA-256 treści pliku, więc ponowne przesłanie tego samego pliku nie tworzy duplikatu. Analiza wnętrza pliku (sprawdzenie treści według deklarowanego typu) dojdzie później razem z pełnym przeglądem PDF.

### Dozwolone formaty i rozmiar

| Format | Typowe przeznaczenie                                                      |
| ------ | ------------------------------------------------------------------------- |
| PDF    | Ogłoszenia, zarządzenia, informator, wzory dokumentów, wyniki rekrutacji. |
| DOCX   | Dokumenty Word, które szkoła udostępnia do edycji.                        |
| XLSX   | Arkusze kalkulacyjne, np. wykazy.                                         |
| ODT    | Dokumenty w formacie otwartym (LibreOffice).                              |
| ZIP    | Zbiory plików, np. materiały na kilka godzin.                             |
| 7Z     | Alternatywny format zbioru plików.                                        |
| JPG    | Zdjęcia wymagane w treści (nie w galerii — ta rusza w etapie 5).          |
| PNG    | Obrazy: skany, wykresy, diagramy.                                         |

- Jeden plik może mieć do **100 MB**. Większość szkolnych dokumentów waży setki kilobajtów; duży skan najpierw skompresuj.
- Rozszerzenie pliku (także wielkimi literami, np. `IMG_1001.JPG` albo `Raport.PDF`) musi być na liście niżej; plik większy niż 100 MB panel nie przyjmie.
- Przy przesyłaniu plik dostaje tylko swoją nazwę. **Tytuł i opis** wpisujesz później — gdy dodajesz blok „Pliki” na stronie albo w aktualności (to, co czytelnicy widzą; opis czytają czytniki ekranu i poprawia on wyszukiwanie).
- Schemat dozwolonych formatów jest zdefiniowany w `packages/contracts/src/media.ts` i obejmuje wyłącznie listę powyżej. Panel nie przyjmie innych formatów.

### Lista kontrolna PDF

Lista kontrolna dostępności PDF pojawi się w panelu razem z pełnym przeglądem istniejących PDF (etap 7, przy uruchomieniu serwisu). Już teraz pamiętaj o podstawie: plik PDF musi zawierać prawdziwy tekst, a nie być wyłącznie fotografią kartki. Przy pierwszych plikach pomoże sekretariat i administrator.

## 7. Przekierowania starych adresów

Stara strona WordPress ma tysiące adresów. Po przeniesieniu na nową stronę każdy stary adres musi wskazywać na odpowiednik w nowym serwisie — dzięki temu odnośniki w PDF, w wiadomościach Librusa i w wyszukiwarkach nie zepsują się.

Panel przechowuje tabelę przekierowań:

| Pole        | Co wpisać                                                                      |
| ----------- | ------------------------------------------------------------------------------ |
| Stary adres | Cała ścieżka po nazwie domeny starej strony, łącznie z datą i końcówką adresu. |
| Nowy adres  | Ścieżka wewnątrz nowego serwisu, np. `/aktualnosci`, `/szkola/terminarz`       |

- Przekierowanie jest stałe (kodem 301), więc wyszukiwarki przeniosą pozycje starej strony.
- Przekierowanie nie może być puste, nie może prowadzić na samo siebie i wskazuje wyłącznie ścieżkę wewnątrz serwisu.
- Tę część panelu najpierw zapełni administrator (etap 2), importując listę starych adresów ze starej strony. Sekretariat i nauczyciele zgłaszają niedziałające stare adresy administratorowi.

Jeśli ktoś zgłasza „strony nie znaleziono” (404) pod dawnym adresem — najpierw sprawdź tabelę przekierowań. Jeżeli wpis nie istnieje, dodaj go albo przekaż administratorowi.

## 8. Wersje robocze i publikacja

### Statusy

Każdy element treści ma status:

- **Szkic** — edytujesz go swobodnie. Czytelnicy go nie widzą, nawet pod znanym im adresem.
- **Opublikowany** — widoczny publicznie. Kolejna zmiana wymaga ponownego potwierdzenia publikacji.

Dzięki szkicom przygotujesz artykuł dziś, a opublikujesz w dniu uroczystości. Plan przewiduje też publikację zaplanowaną — ustalasz datę w przyszłości, panel opublikuje treść w wybranym momencie.

### Historia i dziennik zdarzeń

- **Historia wersji**: przed każdą zapisaną zmianą aktualności lub strony serwer zachowuje poprzednią wersję. Pod edytorem otwartej aktualności lub strony jest sekcja **Historia zmian** z ostatnimi 50 wersjami: numer, data i godzina, kto zapisał, status. Przycisk **Przywróć tę wersję** wraca do wybranej treści. Przywrócenie nie zmienia statusu publikacji (szkic zostaje szkicem, opublikowana treść zostaje opublikowana), a bieżąca treść trafia do historii, więc i przywrócenie można cofnąć.
- **Dziennik zdarzeń** zapisuje każdą zmianę wykonaną w panelu: kto, co i kiedy. Nie zawiera danych osobowych wnioskodawców. Dziennik przechowywany jest przez 2 lata.

Dziennik jest znakiem rzetelności, nie inwigilacji redaktorów: szkoła ma dowód, skąd pochodzi każda treść na stronie.

## 9. Dobre praktyki

### Tytuły i leady

- Tytuł mówi konkretnie, co się stało: „Uczniowie technikum lotniczego po zwycięstwie w konkursie mechatronicznym”, nie „Ważny komunikat” ani „Świetne wyniki”.
- Lead podaje najważniejsze w dwóch zdaniach. Czytelnik po leadzie decyduje, czy czytać dalej.
- Nagłówki w treści opisują treść sekcji, nie grają sloganu.

### Tekst alternatywny i podpisy zdjęć

- Każde zdjęcie ma **tekst alternatywny**: opis tego, co widać, czytany przez osoby niewidome. Napisz tak, jakby opowiedzieć telefonicznie: „Uczeń w warsztacie silników lotniczych otwiera komorę silnika”, nie „zdjęcie1.jpg”.
- Jeśli obraz jest wyłącznie ozdobą, jego tekst alternatywny powinien być pusty. O to zadba system; w treściach, które piszesz, uwzględnij właściwych fotografów.
- Podpis pod zdjęciem i autor również pochodzą z rzeczywistych danych: kto fotografował, na jakim wydarzeniu.

### Kolory

Kolorów w treści nie wybierasz. Paletę ustala system projektowy za pomocą tokenów: biel, szarości, ciemny tekst oraz **niebieski i pomarańczowy** — kolory loga szkoły. Niebieski (wraz z odcieniem linku) oznacza powierzchnie markowe; pomarańczowy — działanie główne (przycisk „Rekrutacja”), pasek postępu bieżącej lekcji i ramkę fokusa. Te kolory mają zarezerwowane znaczenie i nie służą do ozdoby: przykładowo pomarańczowy nie nadaje się na mały tekst na jasnym tle, bo ma za mały kontrast. Treść zawsze dostaje właściwy kolor z systemu — ty nie ustalasz barw.

### Zakaz zdjęć stockowych i obrazów generowanych

Stosujemy wyłącznie prawdziwe zdjęcia szkoły, warsztatów i uczniów, za zgodą osób, które na nich są:

- Zero zdjęć stockowych (na przykład „uczniowie z laptopem” z banku zdjęć).
- Zero obrazów generowanych przez AI.
- Wizerunek uczniów: przy każdym dodaniu zdjęć potwierdzasz, że szkoła ma zgody na publikację. Zapis tego potwierdzenia trafia do dziennika zdarzeń, a zdjęcie na żądanie usuwa się w kilka minut.
- Zgody dla zdjęć z archiwum ustala szkoła (pytanie otwarte planu strony). Sprawdź z administratorem, które zdjęcia można ponownie opublikować.

### Prawdziwa szkoła, prawdziwa treść

Plan strony mówi wprost: **prawdziwe zdjęcia, prawdziwe liczby, prawdziwe nazwy i daty.** Nie zapełniaj strony tekstem wypełniaczowym:

- Zakazane sformułowania: „Witamy na stronie naszej szkoły”, „Twoja przyszłość zaczyna się tutaj”, „nowoczesna”, „innowacyjna”, „odkryj”, „pasja” bez dowodu.
- Liczby mają źródło i datę.
- Pisz językiem prostym: krótkie zdania, strona czynna, najważniejsze na początku.
- Jeśli czegoś nie wiesz (godziny sekretariatu, daty wywiadówek), zostaw te dane w szkicu i uzupełnij je prawdziwymi, zamiast podać zmyśloną wartość.

## 10. Pomoc i rozwiązywanie problemów

### Kto zmodyfikował co

Pytanie „kto to zmienił?” rozwiązuje dziennik zdarzeń (rozdział 8): administrator otwiera w panelu **Dziennik zmian** i widzi każdą zmianę z godziną, autorem, rodzajem zmiany i nazwami zmienionych pól; przycisk **Pokaż starsze** sięga dalej w przeszłość. Jeśli widzisz na stronie coś, czego nie rozumiesz, podaj administratorowi adres strony i datę — sprawdzi historię w dzienniku.

### Błąd 403

„Brak dostępu” oznacza, że twoja rola nie obejmuje tej ścieżki. Wracaj do obszarów przypisanych twojej roli:

- treści na co dzień według przydziału ustalonego przez szkołę,
- e-wniosek (od etapu 4) — sekretariat,
- galeria (od etapu 5) — redaktor galerii,
- dostępy, role i ustawienia systemowe — administrator.

Jeśli uważasz, że twoja rola powinna obejmować więcej, zgłoś administratorowi, a on zadecyduje. Prawa nie da się obejść: system sprawdza token przy każdym żądaniu do API panelu.

### Inne problemy

| Problem                                 | Co zrobić                                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Sesja wygasła                           | Zaloguj się ponownie. Treść zapisana w wersjach roboczych pozostała w systemie.                     |
| Nie mogę się zalogować                  | Sprawdź szkolny adres i uwierzytelnianie dwuskładnikowe. Dalej nie działa — zgłoś administratorowi. |
| Formularz nie zapisuje                  | Przeczytaj komunikat. Najczęściej brakuje pola wymaganego albo plik przekracza rozmiar.             |
| Plik nie jest przyjmowany               | Sprawdź format z listy w rozdziale 6 i rzeczywisty typ pliku.                                       |
| Ogłoszenie na stronie jest przestarzałe | W **Ogłoszeniach** zmień ostatni dzień na wczoraj albo usuń ogłoszenie (rozdział 11).               |
| Coś działa inaczej niż w tym pliku      | Budowa idzie do przodu. Zgłoś administratorowi ten plik do aktualizacji.                            |

## 11. Ogłoszenia

Ogłoszenie to pasek nad nagłówkiem **na każdej stronie** szkoły. Służy do krótkich, pilnych informacji: dzień wolny, zmiana planu, awaria dziennika.

1. Otwórz **Ogłoszenia**.
2. Wybierz rodzaj: **Informacja** (szary pasek), **Ważne** (niebieski) albo **Pilne** (czerwony). Informację i ważne ogłoszenie odwiedzający może ukryć; pilnego nie da się ukryć.
3. Wpisz treść (do 300 znaków), pierwszy i ostatni dzień. Ogłoszenie jest widoczne od pierwszego do ostatniego dnia **włącznie**, według czasu w Polsce.
4. Opcjonalnie dodaj link: tekst i adres. Adres strony szkoły zaczyna się od „/”, adres zewnętrzny od „https://”.
5. Kliknij **Zapisz ogłoszenie**.

Naraz widać jedno ogłoszenie: najpierw pilne, potem ważne, potem najnowsze. Lista w panelu pokazuje przy każdym ogłoszeniu, czy jest **widoczne teraz**, **zaplanowane** czy **zakończone**. Zakończonych nie trzeba usuwać — przestają się wyświetlać same. Zmienione ogłoszenie pokazuje się ponownie także osobom, które ukryły jego poprzednią wersję.

## 12. Dzwonki

Godziny lekcji z tego miejsca trafiają na stronę **Dzwonki** i do odliczania **Teraz w szkole** na każdej stronie.

- **Zwykły plan lekcji**: każda lekcja w osobnym wierszu, np. `07:30–08:15`. Kolejność wierszy to numery lekcji.
- **Warianty**: inne plany, np. „Lekcje skrócone od 9. lekcji”. Kliknij **Dodaj wariant**, nadaj nazwę i popraw godziny (nowy wariant zaczyna się od kopii zwykłego planu).
- **Dni ze zmienionym planem**: kliknij **Dodaj dzień**, wybierz datę i wariant. W pozostałe dni obowiązuje zwykły plan.

Kliknij **Zapisz dzwonki**. System sprawdza, czy każda lekcja kończy się po rozpoczęciu i czy lekcje na siebie nie nachodzą; błędny wiersz wskaże komunikat. Minione dni ze zmienionym planem znikają ze strony same.

## 13. Dane stron

W **Dane stron** edytujesz treści, które mają stały układ: **kadrę**, **wywiadówki** (data, harmonogram i sale klas), **kontakty**, **wzory dokumentów**, **partnerów** na stronie głównej, **oferty pracy** , **zawody i kierunki** (kafelki zawodów i strony kierunków w sekcji Kandydaci) oraz **menu i stopkę** (sekcje i kolumny menu, linki pomocnicze, grupy linków w stopce). Adres strony kierunku zmieniaj tylko wtedy, gdy to konieczne, i dodaj przekierowanie ze starego adresu (rozdział 7).

1. Wybierz zestaw z listy. Pod listą jest odnośnik **Zobacz na stronie**.
2. Popraw pola. Listy (np. osoby w grupie, klasy w roczniku, formularze w grupie) mają przyciski **Dodaj**, **W górę**, **W dół** i **Usuń**. Pola „jeden w wierszu” przyjmują po jednej wartości w każdej linii.
3. Plik formularza albo oferty wybierasz z listy plików przesłanych wcześniej w **Dokumentach** (rozdział 6).
4. Kliknij **Zapisz zestaw**. Jeśli coś się nie zgadza, komunikat wskaże miejsce, np. „Grupa 2 › Osoby › Osoba 3 › Funkcja: pole jest puste”.

Każde zapisanie zachowuje poprzednią wersję w **Historii zmian** pod formularzem, więc pomyłkę cofniesz jednym przyciskiem. Oferta pracy po dacie „Ważna do” sama przechodzi do archiwum na stronie.

## Co jeszcze powstanie

Ten podręcznik na razie opisuje etap 3. W kolejnych etapach dojdzie reszta panelu (zgodnie z [architekturą](architektura.md), rozdział 14):

- **Etap 4 — e-wniosek**: obsługa wniosków przez sekretariat, statusy (złożony, w realizacji, gotowy do odbioru, odebrany), e-maile do wnioskodawców, wydawanie dokumentu wyłącznie osobiście po okazaniu dokumentu tożsamości.
- **Etap 5 — galeria**: albumy według lat szkolnych, dodawanie zdjęć przeciąganiem w przeglądarce, która sama je zmniejsza, publikacja po potwierdzeniu zgód wizerunku.
- **Etap 6 — narzędzia społeczności**: krótkie linki `/s/<kod>` tworzone przez pracowników, Skrzynka #OgarniamŻycie moderowana w panelu, statystyki bez plików cookie.
- **Etap 7 — uruchomienie**: szkolenie pracowników, przegląd PDF, rejestracja w wyszukiwarkach i przełączenie DNS.

Rozdziały tego podręcznika zostaną uaktualnione, gdy te części zaczną działać.

## Lokalna praca przy budowie panelu

Ta część jest wyłącznie dla środowiska deweloperskiego i nie opisuje pracy z oficjalnym panelem. Bez Cloudflare Access serwer odrzuciłby każde wejście do panelu, więc lokalnie sprawdza podpisany token z komputera zamiast logowania szkolnego. Kolejność: uruchom `pnpm dev:auth` (serwer kluczy i token ważny 12 godzin; `pnpm dev:auth mint` wystawia świeży), wklej wydrukowaną komendę `sessionStorage.setItem("panel-dev-token", …)` w konsoli przeglądarki na otwartej stronie `/panel`, potem odśwież. Lokalny administrator to `dev@zsm3.local`. Produkcja zostaje bez zmian: Cloudflare Access i szkolne konta, a wartości `ACCESS_TEAM_DOMAIN`, `ACCESS_AUDIENCE` i `PANEL_ORIGIN` dla produkcji są ustawiane sekretami (`wrangler secret put`), nie wartościami deweloperskimi z konfiguracji.
