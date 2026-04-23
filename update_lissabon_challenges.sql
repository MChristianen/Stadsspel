BEGIN;

-- Helper: area_id ophalen per stad + wijknaam
CREATE OR REPLACE FUNCTION _get_area(c TEXT, a TEXT) RETURNS INTEGER AS $$
  SELECT ar.id FROM areas ar JOIN cities ct ON ct.id = ar.city_id
  WHERE ct.name = c AND ar.name = a;
$$ LANGUAGE SQL;

-- ============================================================
-- AJUDA — HIGHEST_SCORE_WINS
-- ============================================================
UPDATE challenges SET
  title       = 'Trap-challenge bij Jardim Botânico d''Ajuda',
  description = $d$Ga naar de Jardim Botânico d'Ajuda. https://maps.google.com/?q=Jardim+Botanico+da+Ajuda+Lisboa Een prachtige Botanische tuin met de herkenbare symmetrische trap. Ren van onderaan de trap naar boven en via de andere traptredes weer terug beneden — dat is één ronde. Doe dit met de klok mee of tegen de klok in, net wat je wilt. Je begint voor de trap op het zand en je bent klaar zodra je de trap weer af bent. Hoeveel rondes lukt jullie? Geef het aantal rondes op als score.$d$,
  mode        = 'HIGHEST_SCORE_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'Ajuda');

-- ============================================================
-- ALCÂNTARA — LAST_APPROVED_WINS
-- ============================================================
UPDATE challenges SET
  title       = 'Poseertijd bij LX Factory',
  description = $d$De LX Factory is een oude industriële fabriek die is omgetoverd tot een levendige hotspot vol hippe barretjes, creatieve winkels en indrukwekkende street art. https://maps.google.com/?q=LX+Factory+Lisboa Struin hier rond, kies een standbeeld of artwork met een persoon en ga ervoor staan. Laat één van jullie precies dezelfde houding aannemen als het persoon van dit kunstwerk en leg dit vast op foto. Hoe overtuigender (of juist ongemakkelijker), hoe beter!$d$,
  mode        = 'LAST_APPROVED_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'Alcântara');

-- ============================================================
-- ALVALADE — LAST_APPROVED_WINS
-- ============================================================
UPDATE challenges SET
  title       = 'Rij van groot naar klein bij Santo António',
  description = $d$In deze typisch Portugese wijk, bekend om zijn smalle straatjes en jaarlijkse feestjes tijdens de Festas de Santo António, draait alles om sfeer, muziek en gezelligheid. Ga naar het Santo António beeld https://maps.google.com/?q=Santo+Antonio+Alvalade+Lisboa en zet 3 voorbijgangers van groot naar klein op een rij met het beeld op de achtergrond. Let op: jullie zelf mogen niet op de foto staan!$d$,
  mode        = 'LAST_APPROVED_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'Alvalade');

-- ============================================================
-- AREEIRO — LAST_APPROVED_WINS (was HIGHEST_SCORE_WINS)
-- ============================================================
UPDATE challenges SET
  title       = 'Fiets bij Jardim Fernando Pessa',
  description = $d$In het Jardim Fernando Pessa https://maps.google.com/?q=Jardim+Fernando+Pessa+Lisboa vind je verschillende standbeelden die het dagelijks leven in Lissabon uitbeelden. Zoek het beeld van de twee personen met de fiets. Eén van jullie: ga achterop de fiets van dit standbeeld zitten en zorg dat je er niet vanaf valt! Doe je armen veilig om het middel van de fietser heen!$d$,
  mode        = 'LAST_APPROVED_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'Areeiro');

-- ============================================================
-- ARROIOS — HIGHEST_SCORE_WINS
-- ============================================================
UPDATE challenges SET
  title       = 'Wens bij Fonte Luminosa',
  description = $d$Ga naar het Fonte Luminosa https://maps.google.com/?q=Fonte+Luminosa+Lisboa en doe een wens! Deze indrukwekkende fontein staat bekend om zijn lichtshows en werd ooit gebouwd als symbool van modern Lissabon. Gooi kleingeld in de fontein en zeg hardop een wens naar keuze — we willen die wens horen! Geef als score het totale bedrag in eurocent dat jullie in de fontein hebben gegooid (bijv. €1,35 = score 135).$d$,
  mode        = 'HIGHEST_SCORE_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'Arroios');

-- ============================================================
-- AVENIDAS NOVAS — LAST_APPROVED_WINS
-- ============================================================
UPDATE challenges SET
  title       = 'Selfie bij Parque Eduardo VII',
  description = $d$Bezoek het toppunt van Parque Eduardo VII bovenaan. https://maps.google.com/?q=Miradouro+Parque+Eduardo+VII+Lisboa Vanaf dit hoogste punt heb je één van de strakste uitzichten van Lissabon, met het park dat perfect symmetrisch naar beneden loopt richting de stad. Ga achter de Portugese vlag staan en maak een selfie van jullie twee. Op de achtergrond zie je dan de vlag en het park helemaal naar beneden lopen. Tip: zoek naar Miradouro do Parque Eduardo VII en je ziet de enorme Portugese vlag vanzelf.$d$,
  mode        = 'LAST_APPROVED_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'Avenidas Novas');

-- ============================================================
-- BEATO — LAST_APPROVED_WINS
-- ============================================================
UPDATE challenges SET
  title       = 'Ondersteboven in Beato',
  description = $d$Tussen de straten Impasse Rua C (56 Vale Chelas) en Rua General Vassalo Silva vind je 'Street workout'. https://maps.google.com/?q=Impasse+Rua+C+Vale+Chelas+Lisboa Deze plekken zijn onderdeel van de opkomende urban sports scene in Lissabon, waar locals hun kracht en skills trainen in de buitenlucht. Je herkent deze aan de groene stangen op de zwarte palen. Eén van jullie: ga ondersteboven aan één van deze stangen hangen. Blijf hangen alsof je dit dagelijks doet :)$d$,
  mode        = 'LAST_APPROVED_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'Beato');

-- ============================================================
-- BELÉM — HIGHEST_SCORE_WINS
-- ============================================================
UPDATE challenges SET
  title       = 'Pastéis de nata bij Pastéis de Belém',
  description = $d$Ga naar misschien wel de bekendste bakker van Portugal: Pastéis de Belém. https://maps.google.com/?q=Pasteis+de+Belem+Lisboa Sinds 1837 wordt hier volgens een geheim recept dé originele pastel de nata gemaakt, waar mensen van over de hele wereld voor in de rij staan. Bestel hier hun specialiteit en proef zelf waarom dit zo beroemd is. Geef als score het totale aantal pastéis de nata dat jullie samen eten.$d$,
  mode        = 'HIGHEST_SCORE_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'Belém');

-- ============================================================
-- BENFICA — LAST_APPROVED_WINS
-- ============================================================
UPDATE challenges SET
  title       = 'Op de nek bij Portas Benfica',
  description = $d$Vind de rode Portas Benfica. https://maps.google.com/?q=Portas+de+Benfica+Lisboa De naam betekent letterlijk 'Poorten van Benfica' en het was vroeger een toegangspunt tot het oude dorp Benfica, toen Lissabon nog een stuk kleiner was. Laat een voorbijganger een foto maken van jullie waarbij de één bij de ander achterop z'n nek zit, met de Portas Benfica op de achtergrond. Hoe stabieler jullie blijven zitten, hoe beter de foto ;)$d$,
  mode        = 'LAST_APPROVED_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'Benfica');

-- ============================================================
-- CAMPO DE OURIQUE — HIGHEST_SCORE_WINS
-- ============================================================
UPDATE challenges SET
  title       = 'Wijn bij Mercado de Campo de Ourique',
  description = $d$Tijd om wat te drinken! Bezoek het Mercado de Campo de Ourique. https://maps.google.com/?q=Mercado+Campo+de+Ourique+Lisboa Een geliefde food market onder locals waar je vooral veel Portugezen zelf vindt in plaats van toeristen. Bestel bij één van de kraampjes glazen wijn en proost op Lissabon! Geef als score het totale aantal glazen wijn dat jullie samen drinken.$d$,
  mode        = 'HIGHEST_SCORE_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'Campo de Ourique');

-- ============================================================
-- CAMPOLIDE — HIGHEST_SCORE_WINS (was LAST_APPROVED_WINS)
-- ============================================================
UPDATE challenges SET
  title       = 'Bottle flip bij het Aqueduto das Águas Livres',
  description = $d$Doe de bottle flip challenge met een flesje naar keuze met het Aqueduto das Águas Livres op de achtergrond. https://maps.google.com/?q=Aqueduto+das+Aguas+Livres+Lisboa Dit indrukwekkende aquaduct uit de 18e eeuw overleefde zelfs de grote aardbeving van 1755 en is nog steeds één van de iconen van de stad. Jullie bepalen zelf waar je dit doet, zolang je maar het Aqueduto op de achtergrond hebt. Hoeveel bottle flips kunnen jullie op rij laten lukken? Geef het aantal consecutieve geslaagde flips op als score.$d$,
  mode        = 'HIGHEST_SCORE_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'Campolide');

-- ============================================================
-- CARNIDE — LAST_APPROVED_WINS
-- ============================================================
UPDATE challenges SET
  title       = 'Volkslied bij Coreto de Carnide',
  description = $d$Zing een deel van het eerste refrein van het Portugese volkslied op het Coreto de Carnide https://maps.google.com/?q=Coreto+de+Carnide+Lisboa in het Portugees (5 zinnen: begin met 'Às armas, às armas!'). Dit klassieke muziekpaviljoen is al jarenlang een plek waar locals samenkomen voor muziek en optredens in de wijk. Laat iedereen horen hoe overtuigend en vol passie je het volkslied zingt! De andere persoon filmt deze geweldige scène door voor het bouwwerk te staan.$d$,
  mode        = 'LAST_APPROVED_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'Carnide');

-- ============================================================
-- ESTRELA — LAST_APPROVED_WINS
-- ============================================================
UPDATE challenges SET
  title       = 'Kruisje bij Prazeres Cemetery',
  description = $d$Ga naar het Prazeres Cemetery Lisbon. https://maps.google.com/?q=Cemiterio+dos+Prazeres+Lisboa Ondanks de wat dode uitstraling is dit een bijzondere plek, waar veel bekende Portugezen begraven liggen en het bijna aanvoelt als een openluchtmuseum. Loop naar de centrale kapel (Capela do Cemitério dos Prazeres), sla een kruisje en zeg de laatste zinnen van het gebed: 'In de Naam van de Vader, de Zoon en de heilige Geest. Amen'.$d$,
  mode        = 'LAST_APPROVED_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'Estrela');

-- ============================================================
-- LUMIAR — HIGHEST_SCORE_WINS
-- ============================================================
UPDATE challenges SET
  title       = 'Honden bij Parque das Conchas',
  description = $d$Ga naar het lokale Parque das Conchas e dos Lilases. https://maps.google.com/?q=Parque+das+Conchas+Lumiar+Lisboa Een rustig park waar vooral buurtbewoners komen om te wandelen en hun honden uit te laten. Maak één foto met zo veel mogelijk honden tegelijk in beeld — jullie mogen ook zelf op de foto. Geef als score het aantal honden dat op jullie foto staat.$d$,
  mode        = 'HIGHEST_SCORE_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'Lumiar');

-- ============================================================
-- MARVILA — HIGHEST_SCORE_WINS
-- ============================================================
UPDATE challenges SET
  title       = 'Craft bier bij Dois Corvos Marvila',
  description = $d$Bezoek Dois Corvos Marvila Taproom. https://maps.google.com/?q=Dois+Corvos+Marvila+Taproom+Lisboa Een lokale bierbrouwerij waar ze hun eigen craft bier brouwen en waar liefhebbers samenkomen om nieuwe smaken te ontdekken. Tip: houd rekening met de openingstijden. Saúde! Geef als score het totale aantal biertjes van de brouwerij dat jullie samen drinken.$d$,
  mode        = 'HIGHEST_SCORE_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'Marvila');

-- ============================================================
-- MISERICÓRDIA — LAST_APPROVED_WINS
-- ============================================================
UPDATE challenges SET
  title       = 'Biertje in Pink Street',
  description = $d$Bezoek één van de bars in Pink Street (Rua Cor de Rosa). https://maps.google.com/?q=Rua+Nova+do+Carvalho+Lisboa Dé uitgaansstraat van Lissabon die bekendstaat om zijn felroze wegdek en kleurrijke paraplu's boven de straat. Bestel allebei een biertje, drink deze leeg en film dit met op de achtergrond de prachtige paraplu's. Even die keel openzetten!$d$,
  mode        = 'LAST_APPROVED_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'Misericórdia');

-- ============================================================
-- OLIVAIS — LAST_APPROVED_WINS (was HIGHEST_SCORE_WINS)
-- ============================================================
UPDATE challenges SET
  title       = 'Dier aaien bij Quinta Pedagógica dos Olivais',
  description = $d$Bezoek een van de weinige plekken in Lissabon waar je echt een stukje platteland midden in de stad ervaart: de kinderboerderij Quinta Pedagógica dos Olivais. https://maps.google.com/?q=Quinta+Pedagogica+dos+Olivais+Lisboa Aai één van de dieren en leg dit op foto vast alsof je dit ook echt leuk vindt :)$d$,
  mode        = 'LAST_APPROVED_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'Olivais');

-- ============================================================
-- PARQUE DAS NAÇÕES — LAST_APPROVED_WINS
-- ============================================================
UPDATE challenges SET
  title       = 'Drankje bij Oriente',
  description = $d$We zijn weer terug op Oriente, het moderne deel van Lissabon dat bekendstaat om zijn strakke architectuur en het grote treinstation Gare do Oriente. https://maps.google.com/?q=Gare+do+Oriente+Lisboa Bestel hetzelfde drankje bij dezelfde tent als gisteren. Als jullie het nog weten tenminste!$d$,
  mode        = 'LAST_APPROVED_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'Parque das Nações');

-- ============================================================
-- PENHA DE FRANÇA — LAST_APPROVED_WINS
-- ============================================================
UPDATE challenges SET
  title       = 'Titanic bij Miradouro da Penha de França',
  description = $d$Een vooral rustige wijk met niet heel veel bezienswaardigheden, maar juist daardoor een plek waar je het echte Lissabon ervaart. Het bekendste punt is het Miradouro da Penha de França, https://maps.google.com/?q=Miradouro+da+Penha+de+Franca+Lisboa een uitzichtpunt met een prachtig zicht over de stad. Laat een voorbijganger een foto maken van jullie twee waarbij jullie de romantische houding van de Titanic nadoen met het gezicht richting de stad. Miradouro da Penha de França is ook te herkennen aan het ronde torenvormige gebouw.$d$,
  mode        = 'LAST_APPROVED_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'Penha de França');

-- ============================================================
-- SANTA CLARA — LAST_APPROVED_WINS
-- ============================================================
UPDATE challenges SET
  title       = 'Vliegtuig selfie bij Ponto de Aviões',
  description = $d$Vliegtuig spotten! Ga naar de beroemde spotlocatie Ponto de Aviões, https://maps.google.com/?q=Ponto+de+Avioes+Lisboa vlakbij de landingsbaan van het vliegveld, waar vliegtuigen van heel dichtbij over je heen denderen. Maak een prachtige selfie van jullie beide met op de achtergrond een opstijgend of landend vliegtuig. Timing is alles, dus kies je moment goed!$d$,
  mode        = 'LAST_APPROVED_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'Santa Clara');

-- ============================================================
-- SANTA MARIA MAIOR — LAST_APPROVED_WINS
-- ============================================================
UPDATE challenges SET
  title       = 'Tram 28 rit',
  description = $d$Maak een tramrit met de beroemde tramlijn 28, dé klassieke gele tram die zich een weg baant door de smalle straatjes van het oude Lissabon. Ga hiervoor naar het beginpunt van deze tramlijn: Praça Martim Moniz. https://maps.google.com/?q=Praca+Martim+Moniz+Lisboa Zoek de opstapplaats en film jezelf bij het instappen en bij het uitstappen. Het uitstappen doe je bij R. Graça (Rua da Graça). Zorg dat je onderweg ook nog een beetje overeind blijft in die bochten :)$d$,
  mode        = 'LAST_APPROVED_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'Santa Maria Maior');

-- ============================================================
-- SANTO ANTÓNIO — LAST_APPROVED_WINS (was HIGHEST_SCORE_WINS)
-- ============================================================
UPDATE challenges SET
  title       = 'Pashokje op Avenida da Liberdade',
  description = $d$In deze wijk bevindt zich de Champs-Élysées van Lissabon: de Avenida da Liberdade. https://maps.google.com/?q=Avenida+da+Liberdade+Lisboa Een statige boulevard vol luxe winkels en internationale modehuizen. Dat wordt shoppen dus! Ga naar één van de volgende winkels: Louis Vuitton, Prada, Gucci, Hugo Boss of Armani. Trek iets van bovenkleding aan van één van deze winkels en laat jezelf fotograferen door de ander. Let op: doe dit in de winkel zelf en niet in een pashokje!$d$,
  mode        = 'LAST_APPROVED_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'Santo António');

-- ============================================================
-- SÃO DOMINGOS DE BENFICA — HIGHEST_SCORE_WINS (was LAST_APPROVED_WINS)
-- ============================================================
UPDATE challenges SET
  title       = 'Hoog houden bij Estádio da Luz',
  description = $d$Het Estádio da Luz, ook wel 'Stadium of Light' of 'A Catedral' genoemd, is het grootste voetbalstadion van Portugal! https://maps.google.com/?q=Estadio+da+Luz+Lisboa Laat zien dat je balgevoel niet alleen met een bal werkt! Houd zo lang mogelijk hoog met een willekeurig voorwerp met het Benfica stadion op de achtergrond. De ander filmt dit (max 30 seconden). Hoeveel keer op rij lukt het? Geef dit op als score.$d$,
  mode        = 'HIGHEST_SCORE_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'São Domingos de Benfica');

-- ============================================================
-- SÃO VICENTE DE FORA — LAST_APPROVED_WINS
-- ============================================================
UPDATE challenges SET
  title       = 'Zoen bij Miradouro da Senhora do Monte',
  description = $d$Ga naar het bekendste en mooiste uitzichtpunt van Lissabon: Miradouro da Senhora do Monte. https://maps.google.com/?q=Miradouro+da+Senhora+do+Monte+Lisboa Dit is één van de hoogste punten van de stad en biedt een panoramisch uitzicht over bijna heel Lissabon, inclusief het kasteel en de Taag. Dit is pas een romantische plek! Laat een voorbijganger een foto maken van jullie op dit uitzichtspunt. Omdat het zo'n romantische plek is staan jullie zoenend op de foto :)$d$,
  mode        = 'LAST_APPROVED_WINS'::challengemode
WHERE area_id = _get_area('Lissabon', 'São Vicente de Fora');

DROP FUNCTION _get_area;
COMMIT;
