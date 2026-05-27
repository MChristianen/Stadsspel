"""Seed script to populate and update city data (Amsterdam + Roosendaal) and ensure admin account."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from shapely.geometry import Polygon, Point
from geoalchemy2.shape import from_shape

from app.db.session import SessionLocal
from app.db.models import (
    City,
    Area,
    Challenge,
    ChallengeMode,
    TerritoryOwnership,
    Team,
    AreaTeamPoints,
    Submission,
    SubmissionMedia,
    Approval,
)
import os
import secrets
from pathlib import Path
from app.core.security import get_password_hash
from app.core.logging import logger
from app.core.config import settings


def _get_admin_password() -> str | None:
    """Read ADMIN_PASSWORD from environment or .env file directly."""
    # Try environment variable first (set in shell or by start.ps1)
    value = os.environ.get('ADMIN_PASSWORD')
    if value:
        return value
    # Fall back to explicit .env parse via python-dotenv
    try:
        from dotenv import dotenv_values
        env_path = Path(__file__).parent.parent.parent / ".env"
        env_vars = dotenv_values(env_path)
        return env_vars.get('ADMIN_PASSWORD') or None
    except Exception:
        pass
    # Final fallback: pydantic settings
    return settings.ADMIN_PASSWORD or None


CITY_DATA = [
    {
        "name": "Amsterdam",
        "description": "De hoofdstad van Nederland met 9 karakteristieke wijken",
        "default_capture_points": 60.0,
        "default_hold_points_per_minute": 0.6,
        "areas": [
            {
                "name": "Centrum",
                "description": "Het historische hart van Amsterdam",
                "polygon": [
                    (4.885983, 52.389325), (4.875341, 52.371722), (4.881349, 52.363651),
                    (4.89096, 52.359038), (4.899542, 52.358724), (4.919108, 52.363441),
                    (4.92563, 52.366586), (4.931808, 52.367005), (4.93301, 52.371198),
                    (4.928032, 52.374446), (4.91722, 52.376333), (4.903661, 52.3778),
                    (4.895422, 52.380734), (4.890788, 52.383039), (4.891647, 52.385135),
                    (4.890102, 52.388802), (4.885983, 52.389325)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Foto bij het Centraal Station",
                    "description": "Maak een foto voor het Centraal Station met het gebouw op de achtergrond",
                },
            },
            {
                "name": "West",
                "description": "Westelijk stedelijk gebied van Amsterdam",
                "polygon": [
                    (4.875526, 52.378743), (4.879957, 52.385449), (4.871032, 52.387963),
                    (4.855614, 52.387963), (4.848061, 52.387963), (4.840138, 52.387963),
                    (4.840825, 52.384192), (4.835676, 52.368892), (4.836019, 52.342891),
                    (4.840138, 52.339535), (4.852496, 52.338905), (4.881673, 52.340793),
                    (4.890255, 52.339954), (4.905358, 52.331773), (4.921835, 52.3345),
                    (4.907075, 52.35778), (4.898836, 52.356732), (4.889568, 52.356522),
                    (4.881673, 52.360506), (4.876867, 52.362812), (4.875494, 52.365747),
                    (4.871032, 52.372036), (4.873124, 52.375599), (4.875526, 52.378743)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Foto van een typisch Jordaans pand",
                    "description": "Maak een foto van een karakteristiek grachtenpand in de Jordaan",
                },
            },
            {
                "name": "Zuid",
                "description": "Amsterdam-Zuid met musea, parken en brede lanen",
                "polygon": [
                    (4.882022, 52.337647), (4.844263, 52.335968), (4.830532, 52.336808),
                    (4.815428, 52.336808), (4.802728, 52.330304), (4.802728, 52.326108),
                    (4.815085, 52.316664), (4.829502, 52.308479), (4.850441, 52.30449),
                    (4.882022, 52.297982), (4.894036, 52.295672), (4.909483, 52.291053),
                    (4.93866, 52.287693), (4.940033, 52.290213), (4.932481, 52.301551),
                    (4.915318, 52.317084), (4.911199, 52.32338), (4.882022, 52.337647)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Groepsfoto bij het Museumplein",
                    "description": "Maak een groepsfoto bij het Museumplein met musea op de achtergrond",
                },
            },
            {
                "name": "Nieuw-West",
                "description": "Amsterdam Nieuw-West, diverse wijk met Sloterplas",
                "polygon": [
                    (4.836024, 52.382934), (4.769774, 52.382725), (4.769431, 52.374761),
                    (4.762223, 52.368472), (4.751925, 52.36407), (4.745059, 52.359248),
                    (4.746432, 52.355683), (4.75776, 52.349392), (4.75879, 52.339744),
                    (4.772521, 52.330094), (4.789684, 52.329465), (4.797922, 52.331982),
                    (4.811653, 52.340793), (4.828472, 52.340164), (4.830875, 52.342681),
                    (4.830189, 52.367215), (4.836024, 52.382934)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Selfie bij de Sloterplas",
                    "description": "Maak een selfie met de Sloterplas op de achtergrond",
                },
            },
            {
                "name": "Westpoort",
                "description": "Noordwestelijk gebied rond haven en industrie",
                "polygon": [
                    (4.872067, 52.424198), (4.864515, 52.430269), (4.828472, 52.424617),
                    (4.80822, 52.422104), (4.787967, 52.424617), (4.77355, 52.42985),
                    (4.754328, 52.432362), (4.743, 52.428594), (4.740254, 52.421267),
                    (4.743343, 52.410378), (4.762223, 52.407236), (4.763596, 52.402),
                    (4.782818, 52.399067), (4.781102, 52.393411), (4.770461, 52.38503),
                    (4.834308, 52.386078), (4.834308, 52.391106), (4.836368, 52.395296),
                    (4.840487, 52.397601), (4.872067, 52.424198)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Foto bij een industrieel landmark",
                    "description": "Maak een foto bij een opvallend industrieel of haven-achtig punt",
                },
            },
            {
                "name": "Noord",
                "description": "Amsterdam-Noord, bekend om de NDSM werf en Eye Filmmuseum",
                "polygon": [
                    (4.903295, 52.381258), (4.923547, 52.389221), (4.929383, 52.396763),
                    (4.940024, 52.404932), (4.952038, 52.400115), (4.962679, 52.389849),
                    (4.969201, 52.38042), (4.970231, 52.369101), (4.963366, 52.374132),
                    (4.936248, 52.373294), (4.932129, 52.376438), (4.903295, 52.381258)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Selfie bij het Eye Filmmuseum",
                    "description": "Maak een selfie met het witte Eye gebouw op de achtergrond",
                },
            },
            {
                "name": "Oost",
                "description": "Amsterdam-Oost met het Oosterpark en de Dappermarkt",
                "polygon": [
                    (4.911533, 52.358409), (4.923204, 52.361554), (4.92801, 52.36407),
                    (4.935561, 52.365538), (4.937278, 52.371407), (4.96062, 52.372455),
                    (4.967828, 52.367215), (4.963709, 52.357361), (4.956844, 52.348134),
                    (4.950322, 52.341632), (4.928353, 52.33492), (4.911533, 52.358409)
                ],
                "challenge": {
                    "mode": ChallengeMode.HIGHEST_SCORE_WINS,
                    "title": "Kramen tellen op de Dappermarkt",
                    "description": "Tel hoeveel marktkramen je ziet op de Dappermarkt (alleen tijdens marktdagen)",
                    "score_description": "Hoeveel marktkramen hebben jullie geteld op de Dappermarkt?",
                },
            },
            {
                "name": "Diemen",
                "description": "Zuidoostelijk grensgebied richting Diemen",
                "polygon": [
                    (4.914279, 52.328416), (4.918742, 52.319603), (4.939337, 52.299032),
                    (4.991513, 52.316874), (5.003184, 52.327157), (4.986021, 52.335549),
                    (4.97744, 52.342891), (4.964052, 52.348763), (4.955127, 52.339325),
                    (4.914279, 52.328416)
                ],
                "challenge": {
                    "mode": ChallengeMode.HIGHEST_SCORE_WINS,
                    "title": "Zoek de ArenA",
                    "description": "Maak een foto van de Johan Cruijff ArenA. Bonus punten als je binnen bent!",
                    "score_description": "Hoeveel punten is jullie foto waard? (1 = buiten, 2 = met bord/ingang, 3 = binnen)",
                },
            },
            {
                "name": "Oostzanerwerf",
                "description": "Noordwestelijk overgangsgebied met water, industrie en woonzones",
                "polygon": [
                    (4.840134, 52.390478), (4.872744, 52.418545), (4.882699, 52.42336),
                    (4.896773, 52.422732), (4.90913, 52.417498), (4.934875, 52.406399),
                    (4.923204, 52.398229), (4.918398, 52.391316), (4.909817, 52.386706),
                    (4.899175, 52.382934), (4.894027, 52.391944), (4.886131, 52.393411),
                    (4.879609, 52.387125), (4.870341, 52.390897), (4.840134, 52.390478)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Waterfront teamfoto",
                    "description": "Maak een teamfoto aan het water met een industrieel element in beeld",
                },
            },
        ],
    },
    {
        "name": "Roosendaal",
        "description": "Stad in Noord-Brabant met 5 spelgebieden",
        "default_capture_points": 60.0,
        "default_hold_points_per_minute": 0.6,
        "areas": [
            {
                "name": "Centrum Roosendaal",
                "description": "Winkel- en stationsgebied in het centrum",
                "polygon": [
                    (4.454, 51.526), (4.460, 51.524), (4.467, 51.525), (4.472, 51.529),
                    (4.471, 51.535), (4.466, 51.538), (4.458, 51.537), (4.453, 51.533),
                    (4.454, 51.526)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Maak een stationsselfie",
                    "description": "Maak een teamselfie bij station Roosendaal met stationsbord in beeld",
                },
            },
            {
                "name": "Noordrand",
                "description": "Noordelijk gebied rond woonwijken en groen",
                "polygon": [
                    (4.452, 51.540), (4.459, 51.539), (4.467, 51.541), (4.472, 51.546),
                    (4.471, 51.553), (4.465, 51.556), (4.457, 51.555), (4.451, 51.551),
                    (4.450, 51.545), (4.452, 51.540)
                ],
                "challenge": {
                    "mode": ChallengeMode.HIGHEST_SCORE_WINS,
                    "title": "Tel straatkunst",
                    "description": "Tel hoeveel verschillende street-art werken je vindt in dit gebied",
                    "score_description": "Hoeveel verschillende street-art werken hebben jullie gevonden?",
                },
            },
            {
                "name": "Oost",
                "description": "Oostelijke zone met gemengde bebouwing",
                "polygon": [
                    (4.474, 51.527), (4.482, 51.526), (4.490, 51.529), (4.495, 51.535),
                    (4.494, 51.543), (4.489, 51.547), (4.481, 51.547), (4.475, 51.542),
                    (4.473, 51.534), (4.474, 51.527)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Foto van een lokaal herkenningspunt",
                    "description": "Maak een foto bij een duidelijk herkenningspunt in Roosendaal-Oost",
                },
            },
            {
                "name": "West",
                "description": "Westelijk gebied met wijken en verbindingswegen",
                "polygon": [
                    (4.430, 51.527), (4.436, 51.526), (4.443, 51.528), (4.448, 51.532),
                    (4.447, 51.539), (4.442, 51.545), (4.435, 51.546), (4.429, 51.542),
                    (4.427, 51.535), (4.430, 51.527)
                ],
                "challenge": {
                    "mode": ChallengeMode.HIGHEST_SCORE_WINS,
                    "title": "Scoor met sport",
                    "description": "Voer samen 1 minuut sportoefeningen uit; score = totaal aantal herhalingen",
                    "score_description": "Hoeveel herhalingen hebben jullie samen gedaan in 1 minuut?",
                },
            },
            {
                "name": "Zuid",
                "description": "Zuidelijke zone met parken en woonbuurten",
                "polygon": [
                    (4.446, 51.512), (4.454, 51.511), (4.464, 51.513), (4.472, 51.517),
                    (4.474, 51.522), (4.469, 51.524), (4.460, 51.524), (4.451, 51.522),
                    (4.445, 51.518), (4.446, 51.512)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Groene missie",
                    "description": "Maak een teamfoto met minimaal drie verschillende soorten groen in beeld",
                },
            },
        ],
    },
    {
        "name": "Lissabon",
        "description": "De prachtige hoofdstad van Portugal met 24 historische wijken",
        "default_capture_points": 60.0,
        "default_hold_points_per_minute": 1.0,
        "areas": [
            {
                "name": "Belém",
                "description": "Historische wijk met monumenten en het beroemde Pastéis de Belém",
                "polygon": [
                    (-9.209777, 38.719001), (-9.220246, 38.715787), (-9.222478, 38.706678),
                    (-9.226597, 38.70065), (-9.227283, 38.697568), (-9.23432, 38.689396),
                    (-9.227455, 38.687788), (-9.203255, 38.690333), (-9.188151, 38.693147),
                    (-9.190554, 38.703731), (-9.196389, 38.702123), (-9.197591, 38.703731),
                    (-9.200337, 38.704401), (-9.200509, 38.707348), (-9.207031, 38.709357),
                    (-9.206172, 38.713376), (-9.209777, 38.719001)
                ],
                "challenge": {
                    "mode": ChallengeMode.HIGHEST_SCORE_WINS,
                    "title": "Pastéis de nata bij Pastéis de Belém",
                    "description": "📸 Ga naar misschien wel de bekendste bakker van Portugal, Pastéis de Belém. Sinds 1837 wordt hier volgens een geheim recept dé originele pastel de nata gemaakt, waar mensen van over de hele wereld voor in de rij staan. Bestel zoveel pastéis de nata als jullie aankunnen en eet ze ter plekke op. Jullie score = het totale aantal pastéis de nata dat jullie samen hebben gegeten. Meer is beter! 📍 Pastéis de Belém, Rua de Belém 84 (https://maps.google.com/?q=Pasteis+de+Belem+Lisboa)",
                    "score_description": "Hoeveel pastéis de nata hebben jullie samen opgegeten?",
                },
            },
            {
                "name": "Santa Maria Maior",
                "description": "De oudste wijk van Lissabon met smalle straatjes en authentieke sfeer",
                "polygon": [
                    (-9.140781, 38.702525), (-9.124132, 38.70775), (-9.126364, 38.711366),
                    (-9.130998, 38.711634), (-9.135975, 38.716992), (-9.14284, 38.715117),
                    (-9.140781, 38.702525)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Tram 28 rit",
                    "description": "🎬 Maak een tramrit met de beroemde tramlijn 28, dé klassieke gele tram die zich een weg baant door de smalle straatjes van het oude Lissabon. Ga hiervoor naar het beginpunt van deze tramlijn: Praça Martim Moniz. Zoek de opstapplaats en film julliezelf bij het instappen en film julliezelf bij het uitstappen. Het uitstappen doe je bij R. Graça (Rua da Graça). Zorg dat je onderweg ook nog een beetje overeind blijft in die bochten :) 📍 Praça Martim Moniz (https://maps.google.com/?q=Praca+Martim+Moniz+Lisboa)",
                },
            },
            {
                "name": "Misericórdia",
                "description": "Het neoclassicistische centrum met brede pleinen en historische gebouwen",
                "polygon": [
                    (-9.150907, 38.700516), (-9.141982, 38.701989), (-9.144213, 38.714715),
                    (-9.153653, 38.711902), (-9.150907, 38.700516)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Biertje in Pink Street",
                    "description": "🎬 Bezoek één van de bars in Pink Street (Rua Cor de Rosa), dé uitgaansstraat van Lissabon die bekendstaat om zijn felroze wegdek en kleurrijke paraplu's boven de straat. Bestel allebei een biertje, ad deze leeg en film dit met op de achtergrond de prachtige paraplu's. Even die keel openzetten mannen ;) 📍 Pink Street, Rua Nova do Carvalho (https://maps.google.com/?q=Rua+Nova+do+Carvalho+Lisboa)",
                },
            },
            {
                "name": "Campo de Ourique",
                "description": "Rustige residentiële wijk met lokale markten",
                "polygon": [
                    (-9.174421, 38.712572), (-9.175622, 38.715519), (-9.173562, 38.72168),
                    (-9.160004, 38.723957), (-9.158287, 38.719135), (-9.160175, 38.715787),
                    (-9.174421, 38.712572)
                ],
                "challenge": {
                    "mode": ChallengeMode.HIGHEST_SCORE_WINS,
                    "title": "Wijn bij Mercado de Campo de Ourique",
                    "description": "🎬 Tijd om wat te drinken! Bezoek het Mercado de Campo de Ourique, een geliefde food market onder locals waar je vooral veel Portugezen zelf vindt in plaats van toeristen. Jullie score = het totale aantal glazen wijn dat jullie samen drinken bij één van de kraampjes. Elk leeg glas telt, dus proef maar stevig door! Proost op Lissabon en op de punten! 📍 Mercado de Campo de Ourique (https://maps.google.com/?q=Mercado+Campo+de+Ourique+Lisboa)",
                    "score_description": "Hoeveel glazen wijn hebben jullie samen gedronken?",
                },
            },
            {
                "name": "Santo António",
                "description": "Levendige wijk met restaurants en nachtleven",
                "polygon": [
                    (-9.159326, 38.724157), (-9.157609, 38.719135), (-9.159326, 38.715452),
                    (-9.154434, 38.712505), (-9.143106, 38.715787), (-9.150401, 38.724894),
                    (-9.159326, 38.724157)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Pashokje op Avenida da Liberdade",
                    "description": "📸 In deze wijk bevindt zich de Champs-Élysées van Lissabon: de Avenida da Liberdade, een statige boulevard vol luxe winkels en internationale modehuizen. Dat wordt shoppen dus! Ga naar één van de volgende winkels: Louis Vuitton, Prada, Gucci, Hugo Boss of Armani. Trek iets van bovenkleding aan van één van deze winkels en laat jezelf fotograferen door de ander. Let op: doe dit in de winkel zelf en niet in een pashokje! 📍 Avenida da Liberdade (https://maps.google.com/?q=Avenida+da+Liberdade+Lisboa)",
                },
            },
            {
                "name": "Estrela",
                "description": "Groene wijk met de Basílica da Estrela en prachtige parken",
                "polygon": [
                    (-9.175794, 38.69797), (-9.173734, 38.708554), (-9.174421, 38.7115),
                    (-9.160004, 38.715117), (-9.154855, 38.711768), (-9.153138, 38.704803),
                    (-9.151937, 38.700382), (-9.17545, 38.695425), (-9.175794, 38.69797)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Kruisje bij Prazeres Cemetery",
                    "description": "🎬 Ga naar het Prazeres Cemetery Lisbon. Ondanks de wat dode uitstraling is dit een bijzondere plek, waar veel bekende Portugezen begraven liggen en het bijna aanvoelt als een openluchtmuseum. Loop naar de centrale kapel (Capela do Cemitério dos Prazeres), sla een kruisje en zeg de laatste zinnen van het gebed: \"In de Naam van de Vader, de Zoon en de heilige Geest. Amen\". 📍 Cemitério dos Prazeres (https://maps.google.com/?q=Cemiterio+dos+Prazeres+Lisboa)",
                },
            },
            {
                "name": "Alcântara",
                "description": "Moderne wijk met kunstgaleries en de beroemde brug",
                "polygon": [
                    (-9.17648, 38.695157), (-9.176995, 38.698104), (-9.175107, 38.708018),
                    (-9.177167, 38.715385), (-9.174421, 38.721814), (-9.184204, 38.725028),
                    (-9.190554, 38.725698), (-9.193815, 38.715653), (-9.187465, 38.710697),
                    (-9.189524, 38.705071), (-9.186435, 38.693683), (-9.17648, 38.695157)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Poseertijd bij LX Factory",
                    "description": "🎬 De LX Factory is een oude industriële fabriek die is omgetoverd tot een levendige hotspot vol hippe barretjes, creatieve winkels en indrukwekkende street art. Struin hier rond, kies een standbeeld of artwork met een persoon en ga ervoor staan. Laat één van jullie precies dezelfde houding aannemen als het persoon van dit kunstwerk en leg dit vast op foto. Hoe overtuigender (of juist ongemakkelijker), hoe beter! 📍 LX Factory, Rua Rodrigues de Faria 103 (https://maps.google.com/?q=LX+Factory+Lisboa)",
                },
            },
            {
                "name": "Ajuda",
                "description": "Heuvelachtige wijk met het koninklijk paleis",
                "polygon": [
                    (-9.19227, 38.725028), (-9.208404, 38.719403), (-9.205314, 38.714045),
                    (-9.205486, 38.709893), (-9.199307, 38.70842), (-9.198964, 38.705339),
                    (-9.196389, 38.705205), (-9.195188, 38.703329), (-9.190897, 38.704937),
                    (-9.188838, 38.710429), (-9.195531, 38.715653), (-9.19227, 38.725028)
                ],
                "challenge": {
                    "mode": ChallengeMode.HIGHEST_SCORE_WINS,
                    "title": "Trap-challenge bij Jardim Botânico d'Ajuda",
                    "description": "🎬 Ga naar de Jardim Botânico d'Ajuda. Een prachtige Botanische tuin met de herkenbare symmetrische trap. Doe de trap-challenge: ren in 60 seconden zo vaak mogelijk van onderaan naar boven en weer terug. Jullie score = het aantal complete rondes (omhoog én omlaag) dat één persoon haalt in 60 seconden. De andere persoon filmt en telt. Je begint voor de trap op het zand. Elke complete ronde telt als 1 punt. 📍 Jardim Botânico d'Ajuda (https://maps.google.com/?q=Jardim+Botanico+da+Ajuda+Lisboa)",
                    "score_description": "Hoeveel complete rondes (omhoog én omlaag) heeft één persoon gehaald in 60 seconden?",
                },
            },
            {
                "name": "São Vicente de Fora",
                "description": "Historische wijk met het klooster São Vicente",
                "polygon": [
                    (-9.123446, 38.70842), (-9.116924, 38.712706), (-9.124991, 38.718867),
                    (-9.128252, 38.719671), (-9.134774, 38.71726), (-9.130483, 38.712572),
                    (-9.125677, 38.712438), (-9.123446, 38.70842)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Zoen bij Miradouro da Senhora do Monte",
                    "description": "📸 Ga naar het bekendste en mooiste uitzichtpunt van Lissabon: Miradouro da Senhora do Monte. Dit is één van de hoogste punten van de stad en biedt een panoramisch uitzicht over bijna heel Lissabon, inclusief het kasteel en de Taag. Dit is pas een romantische plek! Laat een voorbijganger een foto maken van jullie op dit uitzichtspunt. Omdat het zo'n romantische plek is staan jullie zoenend op de foto :) 📍 Miradouro da Senhora do Monte (https://maps.google.com/?q=Miradouro+da+Senhora+do+Monte+Lisboa)",
                },
            },
            {
                "name": "Penha de França",
                "description": "Karakteristieke wijk op een heuvel met prachtig uitzicht",
                "polygon": [
                    (-9.116237, 38.71351), (-9.112461, 38.717394), (-9.120185, 38.722349),
                    (-9.122759, 38.726903), (-9.127737, 38.730652), (-9.132542, 38.729715),
                    (-9.130998, 38.72168), (-9.134602, 38.718599), (-9.128252, 38.720742),
                    (-9.124304, 38.719939), (-9.116237, 38.71351)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Titanic bij Miradouro da Penha de França",
                    "description": "📸 Een vooral rustige wijk met niet heel veel bezienswaardigheden, maar juist daardoor een plek waar je het echte Lissabon ervaart. Het bekendste punt is misschien wel Miradouro da Penha de França, een uitzichtpunt met een prachtig zicht over de stad. Zoek dit uitzichtspunt en laat een voorbijganger een foto maken van jullie twee waarbij jullie de romantische houding van de Titanic nadoen met het gezicht richting de stad. Miradouro da Penha de França is ook te herkennen aan het ronde torenvormige gebouw. 📍 Miradouro da Penha de França (https://maps.google.com/?q=Miradouro+da+Penha+de+Franca+Lisboa)",
                },
            },
            {
                "name": "Beato",
                "description": "Opkomende creatieve wijk met industriële geschiedenis",
                "polygon": [
                    (-9.111775, 38.718331), (-9.101649, 38.729045), (-9.122245, 38.73708),
                    (-9.12705, 38.731456), (-9.121558, 38.727706), (-9.118984, 38.722751),
                    (-9.111775, 38.718331)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Ondersteboven in Beato",
                    "description": "📸 Tussen de straten Impasse Rua C (56 Vale Chelas) en Rua General Vassalo Silva vind je 'Street workout'. Deze plekken zijn onderdeel van de opkomende urban sports scene in Lissabon, waar locals hun kracht en skills trainen in de buitenlucht. Je herkent deze aan de groene stangen op de zwarte palen. Eén van jullie: ga ondersteboven aan één van deze stangen hangen. Blijf hangen alsof je dit dagelijks doet :) 📍 Impasse Rua C, Vale Chelas (https://maps.google.com/?q=Impasse+Rua+C+Vale+Chelas+Lisboa)",
                },
            },
            {
                "name": "Marvila",
                "description": "Industriële wijk in transformatie met nieuwe hotspots",
                "polygon": [
                    (-9.101477, 38.730117), (-9.090493, 38.751674), (-9.12911, 38.762784),
                    (-9.130311, 38.749532), (-9.122073, 38.737883), (-9.101477, 38.730117)
                ],
                "challenge": {
                    "mode": ChallengeMode.HIGHEST_SCORE_WINS,
                    "title": "Craft bier bij Dois Corvos Marvila",
                    "description": "📸 Bezoek Dois Corvos Marvila Taproom, een lokale bierbrouwerij waar ze hun eigen craft bier brouwen en waar liefhebbers samenkomen om nieuwe smaken te ontdekken. Jullie score = het totale aantal verschillende craft bieren van de brouwerij dat jullie samen proeven. Hoe meer smaken, hoe hoger de score! Tip: houd rekening met de openingstijden. Saúde! 📍 Dois Corvos Marvila Taproom (https://maps.google.com/?q=Dois+Corvos+Marvila+Taproom+Lisboa)",
                    "score_description": "Hoeveel verschillende craft bieren hebben jullie samen geproefd?",
                },
            },
            {
                "name": "Parque das Nações",
                "description": "Modern gebied met het Oceanarium en futuristische architectuur",
                "polygon": [
                    (-9.090321, 38.753012), (-9.086373, 38.795972), (-9.098731, 38.796373),
                    (-9.100619, 38.786204), (-9.106111, 38.785669), (-9.103193, 38.756225),
                    (-9.090321, 38.753012)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Drankje bij Oriente",
                    "description": "📸 We zijn bij Oriente, het moderne deel van Lissabon dat bekendstaat om zijn strakke architectuur en het grote treinstation Gare do Oriente. Bestel een drankje bij een van de cafés in de buurt. Pak vooral uit! 📍 Gare do Oriente (https://maps.google.com/?q=Gare+do+Oriente+Lisboa)",
                },
            },
            {
                "name": "Olivais",
                "description": "Woonwijk met parken en moderne voorzieningen",
                "polygon": [
                    (-9.10491, 38.757162), (-9.107656, 38.785669), (-9.117267, 38.794099),
                    (-9.123274, 38.797443), (-9.136475, 38.801992), (-9.134429, 38.793028),
                    (-9.138892, 38.786071), (-9.138377, 38.781655), (-9.146443, 38.771484),
                    (-9.147816, 38.768406), (-9.14713, 38.764658), (-9.147645, 38.76265),
                    (-9.129967, 38.76439), (-9.10491, 38.757162)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Dier aaien bij Quinta Pedagógica dos Olivais",
                    "description": "📸 Bezoek een van de weinige plekken in Lissabon waar je echt een stukje platteland midden in de stad ervaart: de kinderboerderij Quinta Pedagógica dos Olivais. Aai één van de dieren en leg dit op foto vast alsof je dit ook echt leuk vindt :) 📍 Quinta Pedagógica dos Olivais (https://maps.google.com/?q=Quinta+Pedagogica+dos+Olivais+Lisboa)",
                },
            },
            {
                "name": "Alvalade",
                "description": "Rustige woonwijk met groenstroken en pleinen",
                "polygon": [
                    (-9.130998, 38.762918), (-9.140266, 38.76265), (-9.148333, 38.761312),
                    (-9.162407, 38.757564), (-9.171503, 38.756091), (-9.163951, 38.744712),
                    (-9.149534, 38.748327), (-9.131513, 38.749264), (-9.130998, 38.762918)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Rij van groot naar klein bij Santo António",
                    "description": "📸 In deze typisch Portugese wijk, bekend om zijn smalle straatjes en jaarlijkse feestjes tijdens de Festas de Santo António, draait alles om sfeer, muziek en gezelligheid. Ga naar het Santo António beeld en zet 3 voorbijgangers van groot naar klein op een rij met het beeld op de achtergrond. Let op: jullie zelf mogen niet op de foto staan! 📍 Santo António, Alvalade (https://maps.google.com/?q=Santo+Antonio+Alvalade+Lisboa)",
                },
            },
            {
                "name": "São Domingos de Benfica",
                "description": "Woonwijk met het historische klooster São Domingos",
                "polygon": [
                    (-9.172876, 38.755957), (-9.174764, 38.757162), (-9.180428, 38.756493),
                    (-9.184204, 38.754485), (-9.186607, 38.751941), (-9.188666, 38.745917),
                    (-9.189696, 38.74016), (-9.176309, 38.733732), (-9.172361, 38.737749),
                    (-9.170302, 38.741231), (-9.165324, 38.744176), (-9.172876, 38.755957)
                ],
                "challenge": {
                    "mode": ChallengeMode.HIGHEST_SCORE_WINS,
                    "title": "Hoog houden bij Estádio da Luz",
                    "description": "🎬 Het Estádio da Luz, ook wel \"Stadium of Light\" of \"A Catedral\" genoemd, is het grootste voetbalstadion van Portugal! Laat zien wat je balgevoel waard is: houd zo vaak mogelijk hoog met een willekeurig voorwerp met het Benfica stadion op de achtergrond. Jullie score = het aantal keer hoog houden zonder dat het voorwerp de grond raakt van één persoon. De ander filmt dit (max 30 seconden) en telt. 📍 Estádio da Luz (https://maps.google.com/?q=Estadio+da+Luz+Lisboa)",
                    "score_description": "Hoeveel keer heeft één persoon het voorwerp hoog gehouden zonder dat het de grond raakte?",
                },
            },
            {
                "name": "Arroios",
                "description": "Multiculturele wijk met diverse gemeenschappen",
                "polygon": [
                    (-9.136413, 38.718265), (-9.132294, 38.721881), (-9.133667, 38.729514),
                    (-9.143707, 38.729246), (-9.149628, 38.72543), (-9.141991, 38.716121),
                    (-9.136413, 38.718265)
                ],
                "challenge": {
                    "mode": ChallengeMode.HIGHEST_SCORE_WINS,
                    "title": "Wens bij Fonte Luminosa",
                    "description": "🎬 Ga naar het Fonte Luminosa en gooi zoveel munten als jullie willen in de fontein! Deze indrukwekkende fontein staat bekend om zijn lichtshows en werd ooit gebouwd als symbool van modern Lissabon. Jullie score = het totale aantal muntstukken dat jullie samen in de fontein gooien. Voor elk muntje moet je hardop een unieke wens uitspreken — die wensen willen we horen op de video! 📍 Fonte Luminosa, Alameda Dom Afonso Henriques (https://maps.google.com/?q=Fonte+Luminosa+Lisboa)",
                    "score_description": "Hoeveel muntstukken hebben jullie samen in de fontein gegooid?",
                },
            },
            {
                "name": "Campolide",
                "description": "Gemengde wijk met wonen, parken en het Aquaduct",
                "polygon": [
                    (-9.174687, 38.722952), (-9.169795, 38.731389), (-9.175287, 38.733465),
                    (-9.171254, 38.737816), (-9.169795, 38.740896), (-9.161814, 38.744511),
                    (-9.158038, 38.739021), (-9.153919, 38.734335), (-9.155635, 38.731858),
                    (-9.157781, 38.729849), (-9.153318, 38.724961), (-9.174687, 38.722952)
                ],
                "challenge": {
                    "mode": ChallengeMode.HIGHEST_SCORE_WINS,
                    "title": "Bottle flip bij het Aqueduto das Águas Livres",
                    "description": "🎬 Doe de bottle flip challenge met een flesje naar keuze met het Aqueduto das Águas Livres op de achtergrond. Dit indrukwekkende aquaduct uit de 18e eeuw overleefde zelfs de grote aardbeving van 1755 en is nog steeds één van de iconen van de stad. Jullie score = het aantal geslaagde bottle flips dat één persoon haalt in 60 seconden. Alleen een perfecte landing telt! De ander filmt en telt. Jullie bepalen zelf waar je staat, zolang het aquaduct maar op de achtergrond zichtbaar is. 📍 Aqueduto das Águas Livres (https://maps.google.com/?q=Aqueduto+das+Aguas+Livres+Lisboa)",
                    "score_description": "Hoeveel geslaagde bottle flips heeft één persoon gehaald in 60 seconden?",
                },
            },
            {
                "name": "Avenidas Novas",
                "description": "Moderne wijk met brede lanen en kantoren",
                "polygon": [
                    (-9.152374, 38.725296), (-9.156665, 38.729782), (-9.152546, 38.734402),
                    (-9.160527, 38.744511), (-9.148341, 38.747657), (-9.146882, 38.741499),
                    (-9.143021, 38.741766), (-9.140103, 38.734871), (-9.140189, 38.729916),
                    (-9.144565, 38.73005), (-9.150057, 38.726166), (-9.152374, 38.725296)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Selfie bij Parque Eduardo VII",
                    "description": "📸 Bezoek het toppunt van Parque Eduardo VII bovenaan. Vanaf dit hoogste punt heb je één van de strakste uitzichten van Lissabon, met het park dat perfect symmetrisch naar beneden loopt richting de stad. Ga achter de Portugese vlag staan en maak een selfie van jullie twee. Op de achtergrond zie je dan de vlag en het park helemaal naar beneden lopen. Tip: zoek naar Miradouro do Parque Eduardo VII en je ziet de enorme Portugese vlag vanzelf. 📍 Miradouro do Parque Eduardo VII (https://maps.google.com/?q=Miradouro+Parque+Eduardo+VII+Lisboa)",
                },
            },
            {
                "name": "Areeiro",
                "description": "Centrale wijk met metrostation en voorzieningen",
                "polygon": [
                    (-9.14714, 38.74759), (-9.14611, 38.742235), (-9.141819, 38.742369),
                    (-9.139416, 38.734938), (-9.139159, 38.729916), (-9.132808, 38.730318),
                    (-9.128089, 38.731523), (-9.123197, 38.737482), (-9.130835, 38.748594),
                    (-9.14714, 38.74759)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Fiets bij Jardim Fernando Pessoa",
                    "description": "📸 In het Jardim Fernando Pessoa vind je verschillende standbeelden die het dagelijks leven in Lissabon uitbeelden. Zoek het beeld van de twee personen met de fiets. Eén van jullie: ga achterop de fiets van dit standbeeld zitten en zorg dat je er niet vanaf valt! Doe je armen veilig om het middel van de fietser heen! 📍 Jardim Fernando Pessoa (https://maps.google.com/?q=Jardim+Fernando+Pessoa+Lisboa)",
                },
            },
            {
                "name": "Benfica",
                "description": "Sportieve wijk met het iconische Estádio da Luz",
                "polygon": [
                    (-9.220246, 38.717394), (-9.210807, 38.722082), (-9.207889, 38.724224),
                    (-9.209948, 38.730117), (-9.203941, 38.740294), (-9.210635, 38.749665),
                    (-9.206859, 38.756359), (-9.200509, 38.759438), (-9.194158, 38.757564),
                    (-9.194502, 38.756225), (-9.187636, 38.752343), (-9.189524, 38.746988),
                    (-9.190211, 38.744176), (-9.190726, 38.739758), (-9.185748, 38.736678),
                    (-9.170988, 38.731054), (-9.175279, 38.72409), (-9.184032, 38.726099),
                    (-9.190554, 38.726635), (-9.220246, 38.717394)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Op de nek bij Portas Benfica",
                    "description": "📸 Vind de rode Portas Benfica. De naam betekent letterlijk \"Poorten van Benfica\" en het was vroeger een toegangspunt tot het oude dorp Benfica, toen Lissabon nog een stuk kleiner was. Laat een voorbijganger een foto maken van jullie waarbij de één bij de ander achterop z'n nek zit, met de Portas Benfica op de achtergrond. Hoe stabieler jullie blijven zitten, hoe beter de foto ;) 📍 Portas de Benfica (https://maps.google.com/?q=Portas+de+Benfica+Lisboa)",
                },
            },
            {
                "name": "Carnide",
                "description": "Noordelijke wijk met mix van oud en nieuw",
                "polygon": [
                    (-9.20652, 38.758099), (-9.210124, 38.763587), (-9.20755, 38.769343),
                    (-9.196909, 38.774562), (-9.190387, 38.78045), (-9.183178, 38.782592),
                    (-9.177857, 38.784063), (-9.177686, 38.779781), (-9.185238, 38.776168),
                    (-9.180947, 38.775098), (-9.17185, 38.767469), (-9.173223, 38.763989),
                    (-9.172194, 38.758367), (-9.179574, 38.75743), (-9.184379, 38.755824),
                    (-9.187126, 38.753548), (-9.192618, 38.756225), (-9.192618, 38.758635),
                    (-9.20017, 38.760643), (-9.20652, 38.758099)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Volkslied bij Coreto de Carnide",
                    "description": "🎬 Zing een deel van het eerste refrein van het Portugese volkslied op het Coreto de Carnide in het Portugees (5 zinnen: begin met \"Às armas, às armas!\"). Dit klassieke muziekpaviljoen is al jarenlang een plek waar locals samenkomen voor muziek en optredens in de wijk. Laat iedereen horen hoe overtuigend en vol passie je het volkslied zingt! De andere persoon filmt deze geweldige scène door voor het bouwwerk te staan. 📍 Coreto de Carnide (https://maps.google.com/?q=Coreto+de+Carnide+Lisboa)",
                },
            },
            {
                "name": "Santa Clara",
                "description": "Wijk met het Nationale Pantheon en authentieke sfeer",
                "polygon": [
                    (-9.138554, 38.801992), (-9.146792, 38.802929), (-9.154172, 38.79731),
                    (-9.160008, 38.795437), (-9.164985, 38.793965), (-9.161724, 38.788212),
                    (-9.15503, 38.782725), (-9.142845, 38.778443), (-9.139755, 38.781655),
                    (-9.140442, 38.78674), (-9.135808, 38.793028), (-9.138554, 38.801992)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Vliegtuig selfie bij Ponto de Aviões",
                    "description": "📸 Vliegtuig spotten! Ga naar de beroemde spotlocatie Ponto de Aviões, vlakbij de landingsbaan van het vliegveld, waar vliegtuigen van heel dichtbij over je heen denderen. Maak een prachtige selfie van jullie beide met op de achtergrond een opstijgend of landend vliegtuig. Timing is alles, dus kies je moment goed! 📍 Ponto de Aviões (https://maps.google.com/?q=Ponto+de+Avioes+Lisboa)",
                },
            },
            {
                "name": "Lumiar",
                "description": "Groene noordelijke wijk met parken en rust",
                "polygon": [
                    (-9.176656, 38.784599), (-9.166358, 38.792895), (-9.16344, 38.787409),
                    (-9.15606, 38.781655), (-9.143874, 38.777239), (-9.149023, 38.768807),
                    (-9.149195, 38.762516), (-9.170477, 38.757564), (-9.171679, 38.763989),
                    (-9.169791, 38.767737), (-9.178544, 38.774696), (-9.18129, 38.776436),
                    (-9.175969, 38.779514), (-9.176656, 38.784599)
                ],
                "challenge": {
                    "mode": ChallengeMode.HIGHEST_SCORE_WINS,
                    "title": "Honden bij Parque das Conchas",
                    "description": "📸 Ga naar het lokale Parque das Conchas e dos Lilases, een rustig park waar vooral buurtbewoners komen om te wandelen en hun honden uit te laten. Jullie score = het totale aantal verschillende honden waarmee jullie samen op de foto gaan. Elke hond telt, maar elke foto moet een andere hond zijn! Woef! Flits! 📍 Parque das Conchas e dos Lilases (https://maps.google.com/?q=Parque+das+Conchas+Lumiar+Lisboa)",
                    "score_description": "Met hoeveel verschillende honden zijn jullie op de foto gegaan?",
                },
            },
        ],
    },
    {
        "name": "Brussel",
        "description": "De Belgische hoofdstad met 15 historische gebieden in het stadscentrum",
        "default_capture_points": 60.0,
        "default_hold_points_per_minute": 1.0,
        "proximity_enabled": True,
        "proximity_radius": 150,
        "areas": [
            {
                "name": "Dansaert",
                "description": "Het modekwartier van Brussel vol hippe winkels, galeries en designerszaken",
                "polygon": [
                    (4.343075, 50.855023), (4.346723, 50.858628), (4.35256, 50.856785),
                    (4.351573, 50.85413), (4.351058, 50.853127), (4.350028, 50.853345),
                    (4.348483, 50.853534), (4.346295, 50.853616), (4.345222, 50.852504),
                    (4.343891, 50.852016), (4.342775, 50.852531), (4.341402, 50.853019),
                    (4.343075, 50.855023),
                ],
                "challenge_point": (4.3437, 50.8558),
                "challenge": {
                    "mode": ChallengeMode.HIGHEST_SCORE_WINS,
                    "title": "Pintjes bij Café Walvis",
                    "description": "Café Walvis is een van de meest iconische kroegen van het Dansaertkwartier — sfeervol, ongekuist en vol Belgisch karakter. https://maps.google.com/?q=Cafe+Walvis+Rue+Antoine+Dansaert+Brussels Bestel hier Belgische pintjes en drink ze op ter plekke. Jullie score = het totale aantal pintjes dat jullie samen hebben gedronken. Proost op het mooiste kwartier van Brussel!",
                    "score_description": "Hoeveel pintjes Belgisch bier hebben jullie samen gedronken?",
                },
            },
            {
                "name": "Koningsstraat",
                "description": "Historisch centrum rond de Place des Martyrs en de Galeries Royales",
                "polygon": [
                    (4.352989, 50.856703), (4.354964, 50.856134), (4.355994, 50.858113),
                    (4.359083, 50.857082), (4.360328, 50.856812), (4.361572, 50.857408),
                    (4.363718, 50.85692), (4.364276, 50.856297), (4.366507, 50.855674),
                    (4.365992, 50.854617), (4.36492, 50.852532), (4.362558, 50.853074),
                    (4.362258, 50.852667), (4.360027, 50.853155), (4.359297, 50.85226),
                    (4.357323, 50.852531), (4.356551, 50.852016), (4.354148, 50.852748),
                    (4.353161, 50.852125), (4.351273, 50.852748), (4.352045, 50.85451),
                    (4.352989, 50.856703),
                ],
                "challenge_point": (4.3577, 50.8542),
                "challenge": {
                    "mode": ChallengeMode.HIGHEST_SCORE_WINS,
                    "title": "Wafels op de Place des Martyrs",
                    "description": "De Place des Martyrs is een van de stilste en mooiste pleinen van Brussel — een neoclassicistisch juweel midden in de drukte. https://maps.google.com/?q=Place+des+Martyrs+Brussels Koop Belgische wafels bij een van de bakkers of kraampjes in de buurt en eet ze op op het plein. Jullie score = het totale aantal wafels dat jullie samen hebben opgegeten.",
                    "score_description": "Hoeveel Belgische wafels hebben jullie samen opgegeten?",
                },
            },
            {
                "name": "Congreskolom",
                "description": "Hoog gelegen wijk met de Colonne du Congrès en uitzicht over de stad",
                "polygon": [
                    (4.368395, 50.858411), (4.370026, 50.858085), (4.369812, 50.857706),
                    (4.373674, 50.856676), (4.375606, 50.857137), (4.377751, 50.855864),
                    (4.377794, 50.853912), (4.377408, 50.853696), (4.377408, 50.85291),
                    (4.374962, 50.852937), (4.375863, 50.851962), (4.37376, 50.851447),
                    (4.373031, 50.852315), (4.37007, 50.851529), (4.369812, 50.851203),
                    (4.368783, 50.851393), (4.368439, 50.85264), (4.365735, 50.853372),
                    (4.368395, 50.858411),
                ],
                "challenge_point": (4.3700, 50.8553),
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Leeuwenpose bij de Congreskolom",
                    "description": "De Congreskolom (Colonne du Congrès) staat symbool voor de Belgische onafhankelijkheid. Aan de voet brandt het Eeuwige Vuur ter nagedachtenis aan de gesneuvelden van de twee wereldoorlogen — bewaakt door vier slapende stenen leeuwen. https://maps.google.com/?q=Colonne+du+Congres+Brussels Imiteer de pose van een van deze leeuwen zo exact mogelijk. Blijf minstens 30 seconden in die pose terwijl de ander filmt.",
                },
            },
            {
                "name": "Vismarkt / Sint-Goriks",
                "description": "De plek waar Brussel ontstond, met de historische Sint-Gorikshallen",
                "polygon": [
                    (4.33754, 50.848603), (4.33784, 50.84947), (4.339085, 50.850635),
                    (4.341144, 50.852803), (4.342475, 50.852342), (4.343891, 50.851691),
                    (4.345479, 50.852287), (4.346551, 50.853372), (4.34844, 50.853345),
                    (4.349685, 50.853182), (4.350886, 50.852884), (4.349985, 50.851014),
                    (4.348741, 50.849848), (4.348998, 50.849552), (4.349856, 50.849145),
                    (4.349127, 50.84844), (4.347453, 50.848494), (4.345908, 50.848088),
                    (4.343505, 50.848305), (4.342775, 50.848007), (4.338098, 50.84722),
                    (4.33754, 50.848603),
                ],
                "challenge_point": (4.3440, 50.8497),
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Kunstcriticus in de Sint-Gorikshallen",
                    "description": "De Sint-Gorikshallen (Halles Saint-Géry) is een schitterende gerestaureerde overdekte markthal uit 1881, gebouwd op de plek waar Brussel is ontstaan. https://maps.google.com/?q=Halles+Saint-Gery+Brussels Ga naar binnen, zoek een van de kunstwerken of tentoonstellingsstukken en poseer ervoor als een ultra-serieuze kunstcriticus: één hand aan de kin, diep in gedachten verzonken, volledig in karakter. Laat de ander dit vastleggen op foto.",
                },
            },
            {
                "name": "Beurs / Sint-Niklaas",
                "description": "Omgeving van de Bourse de Bruxelles en de Sint-Niklaaskerk",
                "polygon": [
                    (4.350414, 50.850851), (4.351101, 50.852477), (4.353333, 50.851854),
                    (4.354277, 50.852477), (4.355393, 50.852098), (4.355822, 50.851935),
                    (4.356165, 50.851827), (4.355307, 50.850933), (4.35698, 50.850336),
                    (4.356337, 50.849794), (4.356122, 50.848874), (4.352903, 50.849795),
                    (4.351659, 50.84863), (4.349298, 50.849823), (4.350414, 50.850851),
                ],
                "challenge_point": (4.3523, 50.8502),
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Reliëfpose bij de Beurs",
                    "description": "De Beurs van Brussel (Bourse de Bruxelles) is een indrukwekkend neoclassicistisch gebouw uit 1873, rijkelijk versierd met reliëffiguren van arbeiders, handelaars en allegorische figuren. https://maps.google.com/?q=Bourse+de+Bruxelles Zoek een van deze figuren op de gevel, imiteer de houding zo exact mogelijk en laat de ander dit vastleggen op foto. Hoe meer jullie lijken op het reliëf, hoe beter!",
                },
            },
            {
                "name": "Muntplein",
                "description": "Het levendige Muntplein met de nationale opera van België",
                "polygon": [
                    (4.35668, 50.848928), (4.356809, 50.84966), (4.357581, 50.850418),
                    (4.355951, 50.85096), (4.357195, 50.852233), (4.358311, 50.852179),
                    (4.359469, 50.851935), (4.360156, 50.85283), (4.362473, 50.852315),
                    (4.362816, 50.852775), (4.364791, 50.852342), (4.363933, 50.850662),
                    (4.363074, 50.848927), (4.362388, 50.849172), (4.360457, 50.848603),
                    (4.358998, 50.848332), (4.357967, 50.848603), (4.35668, 50.848928),
                ],
                "challenge_point": (4.3582, 50.8512),
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Brabançonne voor de Munt",
                    "description": "In 1830 brak hier de Belgische revolutie uit na een operavoorstelling in de Muntschouwburg — de nationale opera van België. https://maps.google.com/?q=Theatre+Royal+de+la+Monnaie+Brussels Zing de eerste strofe van de Brabançonne (het Belgisch volkslied) hardop voor de imposante pilaren van de Munt. Begin met 'O Belgique, ô mère chérie' en zing minstens vier regels. De ander staat voor het gebouw en filmt. Jullie mogen harmonieus... of catastrofaal... zingen.",
                },
            },
            {
                "name": "Park van Brussel",
                "description": "Het Warandepark, het enige koninklijke park dat het publiek vrij mag betreden",
                "polygon": [
                    (4.365, 50.852), (4.365649, 50.853101), (4.368052, 50.852423),
                    (4.368439, 50.851176), (4.370155, 50.850878), (4.370413, 50.851258),
                    (4.372901, 50.851963), (4.373502, 50.851122), (4.376035, 50.851881),
                    (4.37788, 50.849768), (4.377794, 50.847735), (4.377923, 50.845784),
                    (4.377665, 50.844835), (4.369383, 50.846678), (4.369812, 50.847383),
                    (4.369683, 50.848061), (4.369211, 50.848495), (4.36535, 50.847573),
                    (4.363, 50.848), (4.365, 50.852),
                ],
                "challenge_point": (4.3712, 50.8468),
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Standbeeldpose in het Warandepark",
                    "description": "Het Warandepark (Parc de Bruxelles) is het grootste stadspark van Brussel — met het Koninklijk Paleis aan de ene zijde en het Parlement aan de andere. https://maps.google.com/?q=Parc+de+Bruxelles+Brussels Het park staat vol met standbeelden. Zoek een standbeeld, bestudeer de pose en ga ernaast staan in exact dezelfde houding. Laat een voorbijganger een foto maken van jullie én het standbeeld samen in beeld.",
                },
            },
            {
                "name": "Anneessens",
                "description": "Oude volksbuurt met de middeleeuwse Tour Noire en diverse gemeenschappen",
                "polygon": [
                    (4.339106, 50.844999), (4.338355, 50.847112), (4.341853, 50.8476),
                    (4.343397, 50.847844), (4.343634, 50.848034), (4.345822, 50.847884),
                    (4.346788, 50.848006), (4.34771, 50.848223), (4.349191, 50.848142),
                    (4.344235, 50.84363), (4.343398, 50.84397), (4.339857, 50.842953),
                    (4.339106, 50.844999),
                ],
                "challenge_point": (4.3434, 50.8453),
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Middeleeuws gevecht bij de Tour Noire",
                    "description": "De Tour Noire (Zwarte Toren) is een van de weinige overblijfselen van de eerste middeleeuwse stadsmuur van Brussel, gebouwd in de 12e eeuw. Je vindt hem ingebouwd in het Novotel hotel aan de Rue de l'Évêque. https://maps.google.com/?q=Tour+Noire+Bruxelles Voer een overdreven middeleeuws gevecht op voor de toren: één ridder verdedigt de burcht, de ander valt aan. Geen echt contact — dit is pure theater! Laat een voorbijganger de foto maken.",
                },
            },
            {
                "name": "Grote Markt",
                "description": "De Grote Markt, door Victor Hugo omschreven als de mooiste markt ter wereld",
                "polygon": [
                    (4.349363, 50.848101), (4.350286, 50.849064), (4.351723, 50.848291),
                    (4.353011, 50.849484), (4.35432, 50.848995), (4.355821, 50.848644),
                    (4.357109, 50.847654), (4.357967, 50.847031), (4.35844, 50.846272),
                    (4.355693, 50.844077), (4.353697, 50.84321), (4.35168, 50.842464),
                    (4.347368, 50.844755), (4.346745, 50.84489), (4.346101, 50.84519),
                    (4.349363, 50.848101),
                ],
                "challenge_point": (4.3520, 50.8468),
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Manneken Pis-pose op de Grote Markt",
                    "description": "De Grote Markt van Brussel werd door Victor Hugo omschreven als 'de mooiste markt ter wereld', omringd door de gotische gevel van het Stadhuis en schitterende gildhuizen. https://maps.google.com/?q=Grand+Place+Brussels Het bekendste symbool van Brussel is de Manneken Pis. Laat een voorbijganger een foto maken van jullie beiden voor het Stadhuis waarbij jullie de Manneken Pis-pose nadoen. Zo overtuigend mogelijk graag!",
                },
            },
            {
                "name": "Nieuwstraat / Shopping",
                "description": "De Nieuwstraat, de drukste winkelstraat van België",
                "polygon": [
                    (4.357109, 50.844863), (4.359083, 50.8463), (4.357495, 50.847763),
                    (4.358054, 50.848345), (4.358826, 50.848047), (4.360671, 50.848359),
                    (4.362194, 50.848833), (4.362516, 50.848359), (4.362495, 50.847735),
                    (4.362817, 50.847654), (4.360628, 50.843305), (4.359212, 50.843685),
                    (4.357109, 50.844863),
                ],
                "challenge_point": (4.3608, 50.8475),
                "challenge": {
                    "mode": ChallengeMode.HIGHEST_SCORE_WINS,
                    "title": "Bottle flip voor de Inno",
                    "description": "De Nieuwstraat (Rue Neuve) is de drukste winkelstraat van België. Ga naar het grote warenhuis Inno op de Nieuwstraat. https://maps.google.com/?q=Inno+Rue+Neuve+Brussels Doe de bottle flip challenge voor de ingang: flip een flesje naar keuze en probeer het zo vaak mogelijk op rij te laten landen. Jullie score = het maximum aantal consecutieve geslaagde bottle flips. De ander filmt.",
                    "score_description": "Hoeveel consecutieve geslaagde bottle flips hebben jullie gehaald?",
                },
            },
            {
                "name": "Kunstberg / Mont des Arts",
                "description": "De Kunstberg met een van de mooiste panoramauitzichten over Brussel",
                "polygon": [
                    (4.363246, 50.847735), (4.36535, 50.847383), (4.369255, 50.84825),
                    (4.369426, 50.847356), (4.369041, 50.846545), (4.37762, 50.844619),
                    (4.378394, 50.843535), (4.378179, 50.842695), (4.375391, 50.843237),
                    (4.375047, 50.842315), (4.374704, 50.841394), (4.371099, 50.842017),
                    (4.367065, 50.842831), (4.365263, 50.843183), (4.364748, 50.842153),
                    (4.360757, 50.843102), (4.363246, 50.847735),
                ],
                "challenge_point": (4.3632, 50.8465),
                "challenge": {
                    "mode": ChallengeMode.HIGHEST_SCORE_WINS,
                    "title": "Trap-challenge op de Kunstberg",
                    "description": "Ga naar de trappen van de Kunstberg (Mont des Arts). https://maps.google.com/?q=Mont+des+Arts+Brussels Deze beroemde trap verbindt het lagere deel van Brussel met de terrassen bovenaan en biedt een prachtig uitzicht over de stad. Ren van onderaan de trap naar boven en via dezelfde trap weer terug beneden — dat is één ronde. Je begint onderaan de trap en je bent klaar zodra je weer onderaan staat. Hoeveel rondes lukt jullie? Geef het aantal complete rondes op als score.",
                    "score_description": "Hoeveel complete rondes (omhoog én omlaag) heeft één persoon gehaald in 60 seconden?",
                },
            },
            {
                "name": "Marolles / Vossenplein",
                "description": "De Marollen met het Vossenplein en de dagelijkse vlooienmarkt",
                "polygon": [
                    (4.339921, 50.842831), (4.343377, 50.84382), (4.345609, 50.84286),
                    (4.347023, 50.842195), (4.346508, 50.841585), (4.346766, 50.840487),
                    (4.346015, 50.839009), (4.345071, 50.837993), (4.344342, 50.837803),
                    (4.341896, 50.837436), (4.341295, 50.838806), (4.34093, 50.839158),
                    (4.340973, 50.839742), (4.339921, 50.842831),
                ],
                "challenge_point": (4.3427, 50.8395),
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Rommelmarktschat op het Vossenplein",
                    "description": "Het Vossenplein (Place du Jeu de Balle) in de Marollen is de plek voor de dagelijkse vlooienmarkt van Brussel — elke dag van 6 tot 14 uur. https://maps.google.com/?q=Place+du+Jeu+de+Balle+Brussels Koop samen voor maximaal €5 het meest bizarre, hilarische of onverklaarbare voorwerp dat je er vindt. Maak een video van maximaal 30 seconden waarin jullie vol overtuiging uitleggen waarom dit jullie absolute droomkoop is. Als er geen markt is: maak een creatieve teamfoto op het kleurrijke plein.",
                },
            },
            {
                "name": "Sablon / Zavel",
                "description": "Het luxueuze Sablonkwartier met chocolatiers, antiekwinkels en de Zavelkerk",
                "polygon": [
                    (4.344471, 50.843522), (4.346145, 50.845027), (4.351616, 50.84218),
                    (4.355565, 50.843563), (4.356852, 50.844594), (4.358568, 50.843617),
                    (4.360328, 50.84294), (4.364619, 50.841992), (4.364577, 50.840717),
                    (4.36522, 50.840284), (4.36389, 50.839471), (4.361143, 50.838224),
                    (4.35874, 50.840203), (4.357023, 50.839146), (4.353462, 50.836922),
                    (4.350029, 50.838468), (4.348269, 50.83676), (4.345522, 50.837871),
                    (4.346166, 50.83863), (4.347153, 50.840419), (4.346938, 50.841503),
                    (4.347582, 50.842262), (4.344471, 50.843522),
                ],
                "challenge_point": (4.3522, 50.8410),
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Pralineproeverij bij Wittamer",
                    "description": "Wittamer op het Grote Zavel is een van de beroemdste chocolatiers van België — al meer dan 100 jaar een begrip in de stad. https://maps.google.com/?q=Wittamer+Place+du+Grand+Sablon+Brussels Koop een praline per persoon en film een overdreven degustatie van maximaal 30 seconden. Proef als een Michelin-sterrenkok: diepgaand commentaar op smaak, textuur en aroma. Hoe serieuzer de reactie, hoe beter!",
                },
            },
            {
                "name": "Coudenberg / Koningsplein",
                "description": "Het koninklijke Place Royale met het ruiterstandbeeld en het Coudenberg-paleis",
                "polygon": [
                    (4.36595, 50.840257), (4.364876, 50.840852), (4.36492, 50.841882),
                    (4.365479, 50.842939), (4.374576, 50.841098), (4.372644, 50.837654),
                    (4.370583, 50.836516), (4.36595, 50.840257),
                ],
                "challenge_point": (4.3660, 50.8410),
                "challenge": {
                    "mode": ChallengeMode.HIGHEST_SCORE_WINS,
                    "title": "Hoog houden voor Godefroid de Bouillon",
                    "description": "Op het Koningsplein (Place Royale) staat het indrukwekkende ruiterstandbeeld van Godefroid de Bouillon, leider van de Eerste Kruistocht in 1096. https://maps.google.com/?q=Place+Royale+Brussels Houd een willekeurig voorwerp zo lang mogelijk hoog voor het standbeeld. Jullie score = het maximum aantal keer hoog houden zonder dat het voorwerp de grond raakt. De ander filmt dit (max 30 seconden).",
                    "score_description": "Hoeveel keer hebben jullie het voorwerp hoog gehouden zonder dat het de grond raakte?",
                },
            },
            {
                "name": "Paleis van Justitie",
                "description": "Het imposante Paleis van Justitie, een van de grootste 19e-eeuwse gebouwen ter wereld",
                "polygon": [
                    (4.343719, 50.833535), (4.342904, 50.833969), (4.342303, 50.834971),
                    (4.341746, 50.837166), (4.34518, 50.837709), (4.348356, 50.83638),
                    (4.350158, 50.838035), (4.353548, 50.836597), (4.358612, 50.839743),
                    (4.361229, 50.837844), (4.365606, 50.840122), (4.367108, 50.838874),
                    (4.370713, 50.835811), (4.37037, 50.83508), (4.36904, 50.834321),
                    (4.370713, 50.833508), (4.368652, 50.832667), (4.365862, 50.833698),
                    (4.36389, 50.832451), (4.361916, 50.830796), (4.359384, 50.832044),
                    (4.357753, 50.831203), (4.349686, 50.832477), (4.348311, 50.832695),
                    (4.347281, 50.833129), (4.343719, 50.833535),
                ],
                "challenge_point": (4.3565, 50.8354),
                "challenge": {
                    "mode": ChallengeMode.HIGHEST_SCORE_WINS,
                    "title": "Push-ups op de trappen van het Paleis van Justitie",
                    "description": "Het Paleis van Justitie (Palais de Justice) op het Poelaertplein is een van de grootste gebouwen uit de 19e eeuw ter wereld — groter dan de Sint-Pietersbasiliek in Rome. https://maps.google.com/?q=Palais+de+Justice+Bruxelles Ga naar de majestueuze trappen van het Paleis en doe push-ups. Jullie score = het totale aantal push-ups dat jullie samen doen in 60 seconden. Eén van jullie filmt en telt, de ander pompt.",
                    "score_description": "Hoeveel push-ups hebben jullie samen gedaan in 60 seconden?",
                },
            },
        ],
    },
]


def ensure_admin(db):
    """Create or update admin account.

    - No admin exists → create with ADMIN_PASSWORD from env, or auto-generate.
    - Admin exists + ADMIN_PASSWORD in env → update password (intentional reset).
    - Admin exists + no ADMIN_PASSWORD → leave untouched.
    """
    username = settings.ADMIN_USERNAME
    border = "=" * 52
    admin_password = _get_admin_password()

    existing = db.query(Team).filter(
        Team.name == username,
        Team.is_admin == True,
        Team.game_session_id == None,
    ).first()

    if existing:
        if admin_password:
            existing.password_hash = get_password_hash(admin_password)
            db.commit()
            logger.info(border)
            logger.info(f"  Admin wachtwoord bijgewerkt voor: {existing.name}")
            logger.info(border)
        else:
            logger.info(f"Admin account bestaat al: {existing.name}")
        return

    auto_generated = not admin_password
    if auto_generated:
        admin_password = secrets.token_urlsafe(16)

    db.add(Team(
        name=username,
        password_hash=get_password_hash(admin_password),
        color="#000000",
        is_admin=True,
    ))
    db.commit()

    if auto_generated:
        logger.info(border)
        logger.info("  Admin account aangemaakt")
        logger.info(f"  Gebruikersnaam : {username}")
        logger.info(f"  Wachtwoord     : {admin_password}")
        logger.info("  Sla dit op — wordt NIET opnieuw getoond!")
        logger.info(border)
    else:
        logger.info(border)
        logger.info(f"  Admin account aangemaakt: {username}")
        logger.info(border)


def upsert_city(db, city_data: dict):
    """Create or update city, its areas, challenges and ownership records."""
    city = db.query(City).filter(City.name == city_data["name"]).first()
    if not city:
        city = City(
            name=city_data["name"],
            description=city_data["description"],
            default_capture_points=city_data.get("default_capture_points", 60.0),
            default_hold_points_per_minute=city_data.get("default_hold_points_per_minute", 0.6),
            proximity_enabled=city_data.get("proximity_enabled", False),
            proximity_radius=city_data.get("proximity_radius", 150),
        )
        db.add(city)
        db.commit()
        db.refresh(city)
        logger.info(f"Created city: {city.name}")
    else:
        city.description = city_data["description"]
        city.default_capture_points = city_data.get("default_capture_points", 60.0)
        city.default_hold_points_per_minute = city_data.get("default_hold_points_per_minute", 0.6)
        city.proximity_enabled = city_data.get("proximity_enabled", False)
        city.proximity_radius = city_data.get("proximity_radius", 150)
        db.commit()
        logger.info(f"Updated city: {city.name}")

    seed_area_names = {area["name"] for area in city_data["areas"]}

    for area_data in city_data["areas"]:
        polygon = Polygon(area_data["polygon"])
        area = (
            db.query(Area)
            .filter(Area.city_id == city.id, Area.name == area_data["name"])
            .first()
        )

        cp = area_data.get("challenge_point")
        challenge_point_geom = from_shape(Point(cp[0], cp[1]), srid=4326) if cp else None

        if not area:
            area = Area(
                name=area_data["name"],
                description=area_data["description"],
                city_id=city.id,
                capture_points=area_data.get("capture_points"),
                hold_points_per_minute=area_data.get("hold_points_per_minute"),
                geom=from_shape(polygon, srid=4326),
                center_point=from_shape(polygon.centroid, srid=4326),
                challenge_point=challenge_point_geom,
            )
            db.add(area)
            db.commit()
            db.refresh(area)
            logger.info(f"Created area: {city.name} - {area.name}")
        else:
            area.description = area_data["description"]
            area.capture_points = area_data.get("capture_points")
            area.hold_points_per_minute = area_data.get("hold_points_per_minute")
            area.geom = from_shape(polygon, srid=4326)
            area.center_point = from_shape(polygon.centroid, srid=4326)
            area.challenge_point = challenge_point_geom
            db.commit()
            logger.info(f"Updated area geometry: {city.name} - {area.name}")

        challenge_data = area_data["challenge"]
        challenge = db.query(Challenge).filter(Challenge.area_id == area.id).first()
        if not challenge:
            db.add(
                Challenge(
                    area_id=area.id,
                    mode=challenge_data["mode"],
                    title=challenge_data["title"],
                    description=challenge_data["description"],
                    score_description=challenge_data.get("score_description"),
                )
            )
            logger.info(f"Created challenge: {area.name}")
        else:
            challenge.mode = challenge_data["mode"]
            challenge.title = challenge_data["title"]
            challenge.description = challenge_data["description"]
            challenge.score_description = challenge_data.get("score_description")
            logger.info(f"Updated challenge: {area.name}")

        ownership = db.query(TerritoryOwnership).filter(TerritoryOwnership.area_id == area.id).first()
        if not ownership:
            db.add(TerritoryOwnership(area_id=area.id))
            logger.info(f"Created ownership row: {area.name}")

        db.commit()

    # Remove areas that are no longer present in seed data for this city.
    obsolete_areas = (
        db.query(Area)
        .filter(Area.city_id == city.id, Area.name.notin_(seed_area_names))
        .all()
    )
    for obsolete_area in obsolete_areas:
        submission_ids = [
            submission_id
            for (submission_id,) in db.query(Submission.id)
            .filter(Submission.area_id == obsolete_area.id)
            .all()
        ]

        if submission_ids:
            db.query(TerritoryOwnership).filter(
                TerritoryOwnership.last_approved_submission_id.in_(submission_ids)
            ).update(
                {TerritoryOwnership.last_approved_submission_id: None},
                synchronize_session=False,
            )
            db.query(SubmissionMedia).filter(
                SubmissionMedia.submission_id.in_(submission_ids)
            ).delete(synchronize_session=False)
            db.query(Approval).filter(
                Approval.submission_id.in_(submission_ids)
            ).delete(synchronize_session=False)
            db.query(Submission).filter(
                Submission.id.in_(submission_ids)
            ).delete(synchronize_session=False)

        db.query(TerritoryOwnership).filter(
            TerritoryOwnership.area_id == obsolete_area.id
        ).delete(synchronize_session=False)
        db.query(AreaTeamPoints).filter(
            AreaTeamPoints.area_id == obsolete_area.id
        ).delete(synchronize_session=False)
        db.query(Challenge).filter(
            Challenge.area_id == obsolete_area.id
        ).delete(synchronize_session=False)
        db.delete(obsolete_area)
        db.commit()
        logger.info(f"Removed obsolete area: {city.name} - {obsolete_area.name}")


def seed_cities():
    """Seed/update city data and ensure default admin account."""
    db = SessionLocal()
    try:
        for city_data in CITY_DATA:
            upsert_city(db, city_data)
        ensure_admin(db)

        logger.info("=" * 50)
        logger.info("Seed completed")
        logger.info("Cities available: Amsterdam, Roosendaal, Lissabon, Brussel")
        logger.info("=" * 50)
    except Exception as exc:
        logger.error(f"Seed failed: {exc}")
        db.rollback()
        raise
    finally:
        db.close()


def main():
    seed_cities()


if __name__ == "__main__":
    main()
