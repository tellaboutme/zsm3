export const school = {
  name: "Zespół Szkół Mechanicznych nr 3",
  city: "Kraków",
  patron: "gen. Władysława Sikorskiego",
  street: "os. Szkolne 37",
  postalCode: "31-978",
  latitude: 50.0765707,
  longitude: 20.0509679,
  phone: "+48126440689",
  phoneLabel: "12 644 06 89",
  secretariatExtension: "104",
  email: "s@zespolszkolmechanicznych.edu.pl",
  officeEmail: "zsm3@mjo.krakow.pl",
  mapUrl:
    "https://www.google.com/maps/place/Technikum+Mechaniczne+Nr+17/@50.0765707,20.048393,989m/data=!3m2!1e3!4b1!4m6!3m5!1s0x4716450cf0a6cd7f:0x8c5ec628100fb271!8m2!3d50.0765707!4d20.0509679!16s%2Fg%2F1tsjcd7r?entry=ttu&g_ep=EgoyMDI2MTAyMC4wIKXMDSoASAFQAw%3D%3D",
  owner: "Gmina Miejska Kraków",
} as const;

export const externalServices = {
  librus: "https://portal.librus.pl/rodzina",
  bip: "https://www.bip.krakow.pl/?bip_id=269",
  virtualTour: "https://zespolszkolmechanicznych.wkraj.pl/html5/index.php?id=81594",
  boardingHouse: "https://bsp2.pl/pl/",
} as const;

export interface ExternalProfile {
  readonly name: string;
  readonly handle: string;
  readonly href: string;
}

export const socialProfiles: readonly ExternalProfile[] = [
  { name: "Facebook", handle: "@zsm3krk", href: "https://www.facebook.com/zsm3krk" },
  { name: "Instagram", handle: "@zsm3krk", href: "https://www.instagram.com/zsm3krk/" },
  { name: "X", handle: "@MechanikTrzyKrk", href: "https://twitter.com/MechanikTrzyKrk" },
];

export const officialSites: readonly ExternalProfile[] = [
  { name: "BIP", handle: "bip.krakow.pl", href: externalServices.bip },
  { name: "Organ prowadzący", handle: "krakow.pl", href: "https://www.krakow.pl/" },
  {
    name: "Wirtualny spacer",
    handle: "zespolszkolmechanicznych.wkraj.pl",
    href: externalServices.virtualTour,
  },
];
