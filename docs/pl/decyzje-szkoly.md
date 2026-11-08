# Decyzje i materiały potrzebne od szkoły przed uruchomieniem strony

Ta lista zbiera w jednym miejscu wszystko, czego nowa strona potrzebuje od szkoły, zanim zastąpi obecną. Część techniczna jest gotowa i działa w wersji podglądowej; poniższe punkty może rozstrzygnąć tylko szkoła. Przy każdym punkcie podano, kto zwykle odpowiada i co od tej odpowiedzi zależy.

W tym publicznym repozytorium nie zapisujemy nazwisk, prywatnych numerów telefonów ani adresów. Odpowiedzi z danymi osobowymi szkoła przechowuje u siebie, a tutaj trafia jedynie informacja, że punkt jest zamknięty.

## 1. Konta i domena

| #   | Co jest potrzebne                                                                                       | Kto      | Od czego zależy                                                     |
| --- | ------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| 1.1 | Konto Cloudflare zarejestrowane na szkołę, z dostępem dla wykonawcy; akceptacja umowy powierzenia (DPA) | dyrekcja | baza danych, pliki, panel, publikacja strony                        |
| 1.2 | Konto Brevo zarejestrowane na szkołę; akceptacja DPA                                                    | dyrekcja | wysyłka wiadomości e-wniosku                                        |
| 1.3 | Przeniesienie obsługi DNS domeny szkoły do Cloudflare (poczta pozostaje bez zmian)                      | dyrekcja | przełączenie adresu na nową stronę i przekierowania starych adresów |
| 1.4 | Informacja, czy szkoła korzysta z Microsoft 365 albo Google Workspace                                   | dyrekcja | logowanie pracowników do panelu przez konto szkolne z MFA           |
| 1.5 | Osoba po stronie szkoły odpowiedzialna za konta (administrator Cloudflare, Brevo i GitHub)              | dyrekcja | instrukcja postępowania przy incydencie (`docs/RUNBOOK.md`, §11)    |

## 2. Ochrona danych osobowych (IOD)

| #   | Co jest potrzebne                                                                           | Kto           | Od czego zależy                          |
| --- | ------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------- |
| 2.1 | Podstawa prawna przetwarzania danych w e-wniosku i okresy przechowywania                    | IOD           | uruchomienie e-wniosku                   |
| 2.2 | Treść informacji o przetwarzaniu danych (klauzula pod formularzem e-wniosku)                | IOD           | uruchomienie e-wniosku                   |
| 2.3 | Wpis do rejestru czynności przetwarzania i decyzja o umowie powierzenia z wykonawcą         | IOD, dyrekcja | dostęp wykonawcy do danych produkcyjnych |
| 2.4 | Zatwierdzenie tekstu polityki prywatności (`/polityka-prywatnosci`) i strony RODO (`/rodo`) | IOD           | publikacja strony                        |
| 2.5 | Zasady publikowania wizerunku uczniów i pracowników                                         | dyrekcja, IOD | galeria i import archiwalnych zdjęć      |

## 3. E-wniosek

| #   | Co jest potrzebne                                                                                         | Kto           | Od czego zależy        |
| --- | --------------------------------------------------------------------------------------------------------- | ------------- | ---------------------- |
| 3.1 | Lista dokumentów, o które można wnioskować, pola dla każdego z nich, zasady odbioru i opłaty za duplikaty | sekretariat   | treść formularza       |
| 3.2 | Zasady składania wniosku (regulamin usługi elektronicznej, art. 8 UŚUDE)                                  | dyrekcja, IOD | uruchomienie e-wniosku |
| 3.3 | Osoba dyżurna w sekretariacie na wypadek pytań wnioskodawców przy incydencie                              | sekretariat   | instrukcja incydentów  |

## 4. Panel i redakcja treści

| #   | Co jest potrzebne                                                                                  | Kto      | Od czego zależy               |
| --- | -------------------------------------------------------------------------------------------------- | -------- | ----------------------------- |
| 4.1 | Lista pracowników z dostępem do panelu i ich role (kto redaguje aktualności, dokumenty, terminarz) | dyrekcja | nadanie dostępu do panelu     |
| 4.2 | Osoba odpowiedzialna za galerię (rola `gallery_editor`)                                            | dyrekcja | dodawanie zdjęć               |
| 4.3 | Termin szkolenia dla redaktorów                                                                    | dyrekcja | przejęcie strony przez szkołę |

## 5. Treść obecnej strony

| #   | Co jest potrzebne                                                                            | Kto           | Od czego zależy                       |
| --- | -------------------------------------------------------------------------------------------- | ------------- | ------------------------------------- |
| 5.1 | Które stare strony mają pozostać jako archiwum (na przykład zakończone konkursy z 2018 roku) | dyrekcja      | przeniesienie treści i przekierowania |
| 5.2 | Zgody na ponowną publikację zdjęć z archiwum (plik zgód dla narzędzia archiwum galerii)      | dyrekcja, IOD | import archiwalnych albumów           |
| 5.3 | Czy potrzebne są strony informacyjne po ukraińsku albo po angielsku dla rodzin z zagranicy   | dyrekcja      | zakres treści                         |

## 6. Skrzynka #OgarniamŻycie

| #   | Co jest potrzebne                                                     | Kto               | Od czego zależy       |
| --- | --------------------------------------------------------------------- | ----------------- | --------------------- |
| 6.1 | Czy Skrzynka ma działać dalej i kto ją moderuje                       | dyrekcja, pedagog | uruchomienie Skrzynki |
| 6.2 | Pozostałe zatwierdzenia opisane w [przewodniku Skrzynki](skrzynka.md) | dyrekcja, IOD     | uruchomienie Skrzynki |

## 7. Dostępność

| #   | Co jest potrzebne                                                                       | Kto                          | Od czego zależy          |
| --- | --------------------------------------------------------------------------------------- | ---------------------------- | ------------------------ |
| 7.1 | Koordynator do spraw dostępności wskazany w deklaracji dostępności                      | dyrekcja                     | deklaracja dostępności   |
| 7.2 | Tekst łatwy do czytania (ETR) i nagranie w polskim języku migowym (PJM) o szkole        | szkoła lub wykonawca ETR/PJM | strona `/dostepnosc`     |
| 7.3 | Dostępne wersje dokumentów PDF publikowanych na stronie (lista dokumentów do przeglądu) | sekretariat                  | przegląd dostępności PDF |

## 8. Wyszukiwarki i wizytówki

| #   | Co jest potrzebne                                                                         | Kto      | Od czego zależy                         |
| --- | ----------------------------------------------------------------------------------------- | -------- | --------------------------------------- |
| 8.1 | Dostęp do Google Business Profile i Bing Places szkoły (albo zgoda na ich założenie)      | dyrekcja | spójne dane kontaktowe w wyszukiwarkach |
| 8.2 | Zgoda na weryfikację domeny w Google Search Console i Bing Webmaster Tools przez wpis DNS | dyrekcja | kontrola indeksowania po przełączeniu   |
