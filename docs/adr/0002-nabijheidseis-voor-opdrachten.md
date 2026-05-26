# Opdrachten zijn alleen zichtbaar en indiendbaar binnen de nabijheidsstraal

Spelers kunnen de titel en beschrijving van een opdracht alleen zien — en een inzending doen — als ze zich binnen een configureerbare straal van het opdrachtpunt bevinden. De straal en het aan/uit-zetten van deze eis zijn per stad instelbaar. Het opdrachtpunt is een handmatig gekozen GPS-coördinaat per gebied, geen automatisch berekende centroïde. Buiten de straal toont de app een melding en vraagt om GPS-toestemming als die ontbreekt.

## Considered options

- **Geen locatiecheck** (huidige situatie): opdrachten altijd zichtbaar en indiendbaar van overal. Verlaagt de drempel om het spel te spelen, maar maakt het mogelijk om opdrachten vanuit een café in te dienen zonder de locatie fysiek te bezoeken.
- **Polygooncheck**: valideer of de speler binnen het gebiedspolygoon staat. Afgewezen omdat het polygoon voor grote gebieden (400×400m) te ruim is en de check niet de specifieke interesseplek afdwingt.
- **Handmatig opdrachtpunt met vaste straal**: gekozen punt per gebied, maar straal niet configureerbaar. Afgewezen omdat steden met grotere gebieden een andere straal nodig kunnen hebben.

## Consequences

- Elk gebied krijgt een handmatig in te stellen opdrachtpunt naast de bestaande centroïde.
- De frontend heeft `navigator.geolocation` nodig; bij ontbrekende GPS-toestemming verschijnt een melding.
- Tikkers zien het opdrachtpunt op de kaart maar niet de opdrachttekst, ongeacht hun locatie. Admins zijn volledig vrijgesteld.
