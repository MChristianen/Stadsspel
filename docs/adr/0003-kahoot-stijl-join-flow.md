# Kahoot-stijl join flow: PIN-invoer als startscherm

De app toont bij het opstarten (niet-ingelogde bezoeker op `/`) een landingspagina met twee keuzes: "Neem deel aan een spel" en "Spelleider". "Neem deel" leidt naar een PIN-invoerscherm. De bestaande URL-gebaseerde join (`/join/:code`) blijft werken als alternatief instappunt.

## Considered options

- **URL-only join** (huidige situatie): de spelleider deelt een directe link met de join-code erin. Werkt goed in een browser, maar niet in een native app — deep links vereisen extra configuratie en zijn minder intuïtief dan een PIN typen.
- **Separate landingspagina op een eigen route**: `/uitleg` blijft de entrypoint, landingspagina op `/welkom` of vergelijkbaar. Afgewezen omdat het een extra klik toevoegt en minder goed aansluit bij het direct-actie-gevoel van Kahoot.

## Consequences

- `/` toont voor niet-ingelogde bezoekers de landingspagina in plaats van een redirect naar `/uitleg`.
- `/join` zonder code toont een PIN-invoerveld. Na invullen wordt doorgestuurd naar `/join/:code`, waarna de bestaande registratiestroom verder loopt.
- Wachtwoorden blijven behouden: teams kunnen na het sluiten van de browser terugkomen via teamnaam + wachtwoord.
- De admin-flow wijzigt niet — de "Spelleider"-knop op de landingspagina is een snelkoppeling naar de bestaande `/login`.
- Dit patroon (PIN typen in de app, niet URL volgen) is identiek aan hoe een toekomstige native app zou werken: geen aanpassingen aan de backend nodig bij de overgang naar een app.
