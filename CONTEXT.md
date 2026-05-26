# Stadsspel

Een locatiegebaseerd stadsspel waarbij teams strijden om controle over gebieden binnen een stad door opdrachten te voltooien.

## Language

**Stad**:
Een speelbare stad in het spel, met een naam, puntenconfiguratie en een speelgebied van gebieden.
_Avoid_: city, level, map

**Speelgebied**:
De totale geografische begrenzing van een stad waarbinnen het spel wordt gespeeld, opgebouwd uit niet-overlappende gebieden.
_Avoid_: map, zone, arena

**Gebied**:
Een benoemde geografische eenheid binnen een speelgebied die teams kunnen claimen door een opdracht te voltooien.
_Avoid_: zone, level, locatie, checkpoint

**Opdracht**:
De uitdaging gekoppeld aan een gebied die een team moet voltooien om het gebied te claimen.
_Avoid_: challenge, taak, missie

**Capture points**:
Punten die een team ontvangt op het moment dat het een gebied claimt.
_Avoid_: punten, score

**Hold points**:
Punten die een team per minuut ontvangt zolang het een gebied in bezit heeft.
_Avoid_: punten per minuut, bezitspunten

**LAST_APPROVED_WINS**:
Opdrachtmodus waarbij de meest recent goedgekeurde inzending het gebied wint. Teams kunnen elkaar overbieden door terug te keren.
_Avoid_: dynamische modus, overschrijfmodus

**HIGHEST_SCORE_WINS**:
Opdrachtmodus waarbij het team met de hoogste numerieke score het gebied wint.
_Avoid_: scoremodus, punten-modus

**Tikker**:
Een spelend team dat tijdelijk de tikker-rol draagt — kan andere teams taggen (rol overdragen), mag geen opdrachten indienen, en bouwt geen hold points op zolang het de tikker is.
_Avoid_: spelbegeleider, scheidsrechter, monitor

**Admin**:
De spelorganisator die inzendingen beoordeelt en goedkeurt of afkeurt. Geen spelend team.
_Avoid_: tikker, begeleider

**Opdrachtpunt**:
Een handmatig gekozen GPS-coördinaat per gebied waarop de nabijheidseis voor het zien en indienen van opdrachten wordt gebaseerd.
_Avoid_: center_point, centroïde, middelpunt

**Nabijheidseis**:
De per stad configureerbare spelregel die bepaalt binnen welke straal rond het opdrachtpunt een speler moet staan om de opdracht te kunnen zien én in te dienen. Buiten de straal is de opdrachttitel en -beschrijving verborgen; het opdrachtpunt zelf is altijd zichtbaar op de kaart.
_Avoid_: geofence, locatiecheck, proximiteitscheck

## Relationships

- Een **Stad** heeft één **Speelgebied**, bestaande uit meerdere **Gebieden**
- Een **Stad** heeft optioneel een **Nabijheidseis** met een configureerbare straal
- Een **Gebied** heeft precies één **Opdracht** en één **Opdrachtpunt**
- Een **Opdracht** heeft één modus: **LAST_APPROVED_WINS** of **HIGHEST_SCORE_WINS**
- Het claimen van een **Gebied** levert **Capture points** op; het vasthouden ervan levert **Hold points** per minuut
- Een **Tikker** ziet het **Opdrachtpunt** op de kaart maar niet de opdrachttekst; een **Admin** is volledig vrijgesteld van de **Nabijheidseis**

## Example dialogue

> **Dev:** "Als een team een **Gebied** inneemt, krijgen ze dan direct punten?"
> **Domain expert:** "Ja — de **Capture points** worden direct toegekend bij een goedgekeurde **Opdracht**. Daarna lopen de **Hold points** op zolang ze het **Gebied** vasthouden."

## Flagged ambiguities

- "gebied" en "locatie" werden door elkaar gebruikt — resolved: **Gebied** is de canonieke term voor een speelbare zone binnen een **Speelgebied**.
