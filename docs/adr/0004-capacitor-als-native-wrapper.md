# Capacitor als native wrapper voor de Android-app

De Android-app wordt gebouwd met Capacitor: de bestaande React-webfrontend draait in een Android WebView, aangevuld met een native background-locatieplugin. React Native is afgewezen omdat dat een volledige herschrijving van de frontend vereist, terwijl Capacitor de bestaande codebase intact laat en de webversie parallel bruikbaar houdt. De enige reden voor een native shell is background GPS — alles andere werkt al in de browser.

## Considered options

- **React Native**: echte native componenten, robuuste background-GPS via `expo-location`. Afgewezen omdat het een volledige herschrijving van Game.tsx, Admin.tsx, kaartlogica en de join-flow vereist, zonder functionele meerwaarde voor dit spel.
- **PWA**: geen installatie, maar biedt geen background-GPS op Android. Afgewezen als oplossing voor het kernprobleem.

## Consequences

- De frontend heeft een `Capacitor.isNativePlatform()`-check nodig in de GPS-hook: native gebruikt de background-locatieplugin, browser behoudt `navigator.geolocation.watchPosition()`.
- Camera en bestandskeuze voor inzendingen werken via standaard HTML file inputs — dit moet vroeg in de implementatie worden getest in de WebView.
- De backend heeft geen wijzigingen nodig.
