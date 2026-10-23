import type { LegalDocument } from "../../lib/legal.ts";

const text = (value: string): { type: "text"; text: string } => ({ type: "text", text: value });

export const privacyPolicy: LegalDocument = {
  path: "/polityka-prywatnosci",
  title: "Polityka prywatności serwisu",
  version: "1.0",
  updated: "2026-10-22",
  status: "obowiązuje",
  intro:
    "Jak publiczna część serwisu Zespołu Szkół Mechanicznych nr 3 obchodzi się z danymi osób, które go odwiedzają.",
  sections: [
    {
      id: "administrator",
      title: "Administrator i inspektor ochrony danych",
      document: [
        {
          type: "paragraph",
          content: [
            text(
              "Administratorem danych jest Zespół Szkół Mechanicznych nr 3 im. gen. Władysława Sikorskiego, os. Szkolne 37, 31-978 Kraków, ",
            ),
            {
              type: "link",
              text: "s@zespolszkolmechanicznych.edu.pl",
              href: "mailto:s@zespolszkolmechanicznych.edu.pl",
            },
            text(". Z inspektorem ochrony danych skontaktujesz się pod adresem "),
            {
              type: "link",
              text: "inspektor4@mjo.krakow.pl",
              href: "mailto:inspektor4@mjo.krakow.pl",
            },
            text("."),
          ],
        },
      ],
    },
    {
      id: "przegladanie",
      title: "Przeglądanie serwisu",
      document: [
        {
          type: "paragraph",
          content: [
            text(
              "Czytanie stron serwisu nie wymaga podawania żadnych danych. Serwis nie używa plików cookie, narzędzi analitycznych ani skryptów reklamowych i nie śledzi odwiedzających.",
            ),
          ],
        },
        {
          type: "paragraph",
          content: [
            text(
              "Serwis działa na infrastrukturze Cloudflare, z którą szkoła zawarła umowę powierzenia przetwarzania danych. Aby dostarczyć stronę, przeglądarka przekazuje serwerowi adres IP; szkoła nie zapisuje go we własnych dziennikach zdarzeń, a dzienniki techniczne nie zawierają danych osobowych.",
            ),
          ],
        },
      ],
    },
    {
      id: "przegladarka",
      title: "Dane zapisywane w Twojej przeglądarce",
      document: [
        {
          type: "list",
          ordered: false,
          items: [
            [
              text(
                "Ustawienia dostępności i motyw (rozmiar tekstu, kontrast, krój pisma, podkreślenia, skala szarości, ruch, motyw jasny lub ciemny) zapisują się w pamięci przeglądarki, gdy je zmienisz.",
              ),
            ],
            [
              text(
                "Ukryte komunikaty szkoły są zapamiętywane tylko do zamknięcia karty przeglądarki.",
              ),
            ],
          ],
        },
        {
          type: "paragraph",
          content: [
            text(
              "Te informacje nie są wysyłane do szkoły ani nikomu innemu. Możesz je usunąć przyciskiem „Przywróć domyślne” w ustawieniach dostępności albo czyszcząc dane witryny w przeglądarce.",
            ),
          ],
        },
      ],
    },
    {
      id: "serwisy-zewnetrzne",
      title: "Serwisy zewnętrzne",
      document: [
        {
          type: "paragraph",
          content: [
            text(
              "Filmy z YouTube, mapa OpenStreetMap, dziennik Librus i Biuletyn Informacji Publicznej nie ładują się na stronach szkoły. Otwierają się dopiero po kliknięciu linku i od tej chwili obowiązują zasady prywatności tych serwisów.",
            ),
          ],
        },
      ],
    },
    {
      id: "prawa",
      title: "Twoje prawa",
      document: [
        {
          type: "paragraph",
          content: [
            text(
              "Masz prawo dostępu do swoich danych, ich sprostowania, usunięcia lub ograniczenia przetwarzania oraz prawo sprzeciwu, w zakresie określonym w RODO. Masz też prawo wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych, ul. Stawki 2, 00-193 Warszawa.",
            ),
          ],
        },
      ],
    },
  ],
};
