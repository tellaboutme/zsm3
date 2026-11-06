# Skrzynka #OgarniamŻycie — przewodnik dla pracowników

Skrzynka pozwala uczniom zadać anonimowe pytanie zespołowi wyznaczonemu przez szkołę. Uczeń
może wskazać, kto jego zdaniem najlepiej odpowie (pedagog, psycholog albo dyrekcja), ale to
tylko wskazówka: **każda osoba z rolą Skrzynki widzi każde pytanie.** **Żadne pytanie nie
trafia na stronę samo.** Pracownik decyduje, czy je opublikować, pisze je od nowa własnymi
słowami tak, żeby nie dało się nikogo rozpoznać, dopisuje odpowiedź i potwierdza sprawdzenie
treści.

> **Projekt do zatwierdzenia przez szkołę.** Skrzynka jest wyłączona, dopóki dyrekcja nie
> zatwierdzi zasad z ostatniej części tego dokumentu. Opis postępowania w sprawach pilnych jest
> propozycją, a nie przyjętą procedurą.

## Kto ma dostęp

Pytania widzą tylko osoby z rolą **Skrzynka (pedagog, psycholog)** w panelu. Rolę nadaje
administrator w zakładce _Pracownicy_. Każde konto ma jedną rolę, więc administrator ani
sekretariat nie widzą pytań. Każda zmiana ról jest zapisywana w dzienniku zmian.

Wskazanie adresata przez ucznia nie ogranicza dostępu: pytanie skierowane „do psychologa”
przeczyta też pedagog z rolą Skrzynki i odwrotnie. Formularz mówi o tym uczniowi wprost. Jeśli
szkoła chce, żeby pytanie widziała tylko wskazana osoba, trzeba to najpierw zaprojektować
(osobne role, zastępstwa, sprawy pilne) — obecnie tak nie działa.

## Co widzi uczeń

- Na górze strony `/skrzynka` są numery pomocy: **116 111** (telefon zaufania dla dzieci i
  młodzieży) i **112**, oraz odnośnik do strony _Pomoc w szkole_.
- Strona mówi wprost, że nikt nie czyta pytań na bieżąco, że odpowiedź może pojawić się po
  kilku dniach albo wcale i że publikujemy tylko wybrane pytania.
- Formularz nie ma pól na imię, klasę, e-mail ani telefon. Uczeń nie dostaje potwierdzenia
  e-mailem ani numeru sprawy.

## Jak moderować pytanie

1. Otwórz _Panel → Skrzynka_ i wybierz pytanie ze statusem **Nowe**.
2. Przeczytaj treść od ucznia. Jest widoczna tylko w panelu i nigdy nie trafia na stronę.
   Jeśli wskazuje na zagrożenie, przejdź do części o pytaniach pilnych.
3. Pole _Pytanie do publikacji_ jest na początku **puste**. Napisz w nim pytanie własnymi
   słowami, bez imion i nazwisk, oznaczeń klas, numerów telefonów, adresów e-mail oraz
   szczegółów (wydarzeń, miejsc, dat), po których można rozpoznać autora albo inne osoby. Nie
   wklejaj oryginału — system odrzuci publikację, jeśli pytanie jest takie samo jak oryginał.
4. Napisz odpowiedź i kliknij **Zapisz szkic**. Szkic nie jest widoczny na stronie.
5. Kliknij **Opublikuj pytanie i odpowiedź**. Panel pokaże ostrzeżenia (np. cyfry, adres
   e-mail, wyrazy wielką literą w środku zdania, wzmianki o konkretnych osobach). To tylko
   podpowiedzi — nie zastępują Twojej oceny i niczego nie blokują. Zaznacz potwierdzenie, że
   sprawdziłeś/aś treść, i kliknij **Tak, opublikuj**. Bez potwierdzenia publikacja nie jest
   możliwa, a jeśli ktoś w międzyczasie zmienił szkic, trzeba go sprawdzić ponownie. Panel nie
   pozwoli też opublikować niezapisanych zmian. Przy publikacji oryginalna treść od ucznia
   zostaje usunięta.
6. Jeśli pytanie nie nadaje się do publikacji, kliknij **Odrzuć pytanie**. Odrzucone pytania
   nigdy nie są pokazywane i znikają po 30 dniach.
7. Opublikowaną odpowiedź możesz **wycofać**. Znika wtedy ze strony od razu, a szkic zostaje do
   poprawy.

Jeśli dwie osoby pracują nad tym samym pytaniem, zapisze się tylko pierwsza zmiana. Druga osoba
zobaczy komunikat, że ktoś zmienił pytanie w międzyczasie, a jej tekst zostanie w formularzu.

Jeśli panel pokazuje, że **nie można odczytać zaszyfrowanej treści**, zapis jest zachowany, ale
nie da się go edytować ani opublikować. Zgłoś to administratorowi panelu — najczęściej brakuje
klucza szyfrowania po jego zmianie. Po przywróceniu klucza pytanie znów będzie czytelne.

## Pytania pilne lub niepokojące (propozycja do zatwierdzenia)

Panel nie pokazuje, kto napisał pytanie, i nie należy próbować tego ustalać.

Jeśli pytanie wskazuje, że komuś grozi niebezpieczeństwo (przemoc, krzywdzenie siebie,
zagrożenie życia lub zdrowia):

1. **Nie odpowiadaj w Skrzynce** i nie publikuj pytania.
2. **Od razu** powiadom osobę odpowiedzialną za standardy ochrony małoletnich w szkole i
   postępuj zgodnie z tymi standardami.
3. Zapisz podjęte działania w szkolnej dokumentacji — Skrzynka nie przechowuje takich spraw
   (odrzucone pytania znikają po 30 dniach).
4. Odrzuć pytanie w panelu.

## Jak długo przechowujemy dane

| Dane                                              | Okres                                      |
| ------------------------------------------------- | ------------------------------------------ |
| Pytanie bez decyzji lub ze szkicem                | 90 dni od ostatniej zmiany                 |
| Pytanie odrzucone albo wycofane                   | 30 dni od decyzji                          |
| Oryginalna treść opublikowanego pytania           | usuwana w chwili publikacji                |
| Opublikowane pytanie i odpowiedź                  | do wycofania przez pracownika              |
| Licznik prób z jednokierunkowym skrótem adresu IP | około doby, bez związku z pytaniem         |
| Kopie zapasowe bazy (mechanizm dostawcy)          | ograniczony czas, zależny od planu (≤30 d) |

Przy pytaniu nie zapisujemy adresu IP, godziny wysłania ani danych urządzenia, a treść jest
zaszyfrowana. Licznik prób służy tylko ochronie przed spamem: zawiera skrót adresu IP
utworzony z tajnym kluczem (to nie jest szyfrowanie — kto zna klucz, może sprawdzić, czy dany
adres pasuje) i początek 10-minutowego okna, bez dokładnej godziny. Z jednego adresu (np.
szkolnej sieci Wi-Fi) można wysłać najwyżej 10 pytań na 10 minut.

Skrzynka chroni przed ujawnieniem autora na stronie i przed innymi pracownikami, ale nie jest
„idealnie anonimowa”. Dostawca infrastruktury (Cloudflare) widzi adres i czas połączeń, a
osoba z dostępem administracyjnym do jego dzienników (jeśli są włączone) i do bazy mogłaby
próbować powiązać pytanie z dniem wysłania. Zakres tych dzienników trzeba sprawdzić z
inspektorem ochrony danych.

## Do zatwierdzenia przez szkołę

- Czy Skrzynka ma działać i kto należy do zespołu, który ją prowadzi (każdy członek widzi
  każde pytanie). Jeśli pytanie ma widzieć tylko wskazana osoba, trzeba to osobno
  zaprojektować.
- Procedura w sprawach pilnych oraz osoba odpowiedzialna, zgodnie ze standardami ochrony
  małoletnich.
- Treść strony `/skrzynka`, w tym lista numerów pomocy.
- Okresy przechowywania (uzgodnione z inspektorem ochrony danych) i wpis w informacji o
  przetwarzaniu danych.
- Czy strona Skrzynki i odpowiedzi mogą być widoczne w wyszukiwarkach (obecnie są ukryte przed indeksowaniem).
- Dzienniki techniczne konta Cloudflare i okres kopii zapasowych bazy (sprawdzone z
  inspektorem ochrony danych) oraz Cloudflare Turnstile jako podmiot przetwarzający.
- Limit 10 pytań na 10 minut z jednego adresu (np. szkolnej sieci).
