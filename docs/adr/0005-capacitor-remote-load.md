# Capacitor-app laadt de frontend remote van de server

De Capacitor-APK bundelt geen frontend-assets maar laadt de webfrontend live van de productieserver. Bij een bugfix of UI-wijziging is alleen een normale frontend-deploy nodig — geen nieuwe APK en geen herinstallatie door spelers. Een nieuwe APK is uitsluitend nodig als native Android-zaken veranderen (permissies, pluginconfiguratie, foreground-service).

## Considered options

- **Gebundeld in de APK**: assets zitten in het installatiepakket, werkt offline. Afgewezen omdat het spel altijd een internetverbinding vereist (GPS-updates, inzendingen, teamlocaties gaan allemaal naar de server), en omdat elke UI-wijziging een herdownload en herinstallatie voor alle spelers betekent.

## Consequences

- Spelers hebben altijd een actieve internetverbinding nodig om de app te gebruiken (was al het geval).
- De APK-distributie via de eigen server is stabiel: de APK verandert zelden, alleen de webdeploy verandert regelmatig.
