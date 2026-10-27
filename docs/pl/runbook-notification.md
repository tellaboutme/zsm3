# Wzory powiadomień o naruszeniu ochrony danych (e-wniosek)

Szablony dla szkoły (administratora) na wypadek naruszenia opisanego w [`RUNBOOK.md`](../RUNBOOK.md). Pola w nawiasach `[[...]]` uzupełnij **lokalnie** — repozytorium jest publiczne, więc nie zapisuj w tej wersji nazwisk, numerów telefonów ani adresów osobistych. Podstawą prawną jest art. 33 i art. 34 RODO; rzeczowe decyzje podejmuje Inspektor Ochrony Danych (IOD) szkoły.

## A. Poinformowanie IOD (natychmiast po kwalifikacji zdarzenia)

Wewnętrzne zgłoszenie dla IOD — wyślij mailem do IOD lub zapisz w dzienniku zdarzeń szkoły:

> **Temat:** Naruszenie ochrony danych — e-wniosek, `[[data i czas UTC]]`
>
> **Kto zgłasza:** `[[imię i rola zgłaszającego]]`
>
> **Co zauważono:** `[[kanał wykrycia: raport z SECURITY.md, logi Cloudflare, wiersz w tabeli outbox_failures, zgłoszenie zewnętrzne]]`
>
> **Zakres możliwej utraty:** `[[tabele D1: requests / staff / audit_log; sekrety Worker; konto Cloudflare/Brevo/GitHub]]`
>
> **Kiedy po raz pierwszy podejrzane działanie:** `[[czas UTC]]`
>
> **Co już zrobiono (przerwanie zagrożenia):** `[[reguła WAF na /api/requests, usunięcie sekretu, rotacja PII_KEY_PRIMARY, …]]`
>
> **Czego jeszcze nie wiemy:** `[[lista niepewności i plan weryfikacji]]`

## B. Zgłoszenie do UODO (art. 33 RODO — nie później niż 72 h od stwierdzenia)

Organ: Prezes Urzędu Ochrony Danych Osobowych (w formie elektronicznej, zgodnie ze wskazaniem UODO). Jeżeli w momencie upływu 72 h brakuje faktów, zgłoś to, co wiadomo, i uzupełnij zgłoszenie etapami (art. 33 ust. 4):

> **Administrator danych:** `[[nazwa szkoły, adres rejestrowy]]`
>
> **IOD (dane kontaktowe):** `[[imię, adres służbowy, telefon, mail]]`
>
> **Opis okoliczności naruszenia:** `[[co się stało, kiedy i w jaki sposób szkoła dowiedziała się o naruszeniu; czy dotyczy przetwarzania przez podmiot przetwarzający (Cloudflare, Brevo) albo osoby dysponującej dostępem na podstawie umowy powierzenia]]`
>
> **Kategoria danych osobowych i przybliżona liczba osób:** `[[np. imię i nazwisko, adres e-mail, klasa lub rocznik, treść uwagi przekazanej przez wnioskodawcę; podaj przybliżoną liczbę osób i rekordów]]`
>
> **Prawdopodobne skutki naruszenia:** `[[np. wyłudzenie tożsamości, nadużycie linku statusu; jeśli dane były zaszyfrowane — opisz realne ryzyko po rotacji klucza]]`
>
> **Środki podjęte lub zaproponowane:** `[[wyłączenie przyjmowania wniosków (WAF/sekret), rotacja sekretów, usunięcie rekordów, kontakt z dostawcami]]`
>
> **Czy naruszenie zgłoszono także innym organom** (np. policji): `[[tak/nie, kiedy]]`

## C. Powiadomienie osób, których dane dotyczą (art. 34 RODO — gdy ryzyko jest wysokie)

Komunikat prostym językiem, wysyłany przez sekretariat (e-mail lub list), z kontaktem telefonicznym:

> **Temat:** Ważna informacja o wniosku złożonym przez e-wniosek
>
> Szanowni Państwo,
>
> W dniu `[[data]]` stwierdziliśmy naruszenie ochrony danych. W wyniku naruszenia mogły zostać odczytane następujące dane: `[[np. imię i nazwisko, adres e-mail, klasa lub rocznik, treść uwagi]]`. `[[Jeżeli dane były zaszyfrowane, napisz wprost: są przechowywane w formie zaszyfrowanej i w wyniku rotacji klucza mogą pozostać nieczytelne dla nikogo.]]`
>
> **Co to może oznaczać:** `[[realne ryzyka wprost, bez tonowania: np. możliwość fałszywych kontaktów podających się za szkołę]]`
>
> **Co zrobiliśmy:** `[[wyłączenie formularza, zamiana kluczy, usunięcie rekordów]]`. Zgłoszenie do UODO: `[[data]]`.
>
> **Co zalecamy Państwu:** `[[czujność wobec wiadomości podających się za szkołę; szkoła NIGDY nie prosi o hasło ani o kod z linku statusu]]`
>
> **Pytania:** sekretariat `[[telefon służbowy, godziny pracy]]`; więcej informacji na stronie szkoły.
>
> Z poważaniem,
>
> `[[imię, nazwisko i funkcja podpisującego]]`
