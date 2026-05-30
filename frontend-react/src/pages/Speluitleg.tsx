import React from 'react';
import { Link } from 'react-router-dom';
import uitlegVoorbeeld from '../assets/uitleg-voorbeeld.svg';
import { useAuth } from '../contexts/AuthContext';

const Speluitleg: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="uitleg-page">
      {!isAuthenticated && (
        <Link to="/" style={{ display: 'inline-block', marginBottom: '0.75rem', color: '#244A8F', textDecoration: 'none', fontWeight: 600 }}>
          ← Terug
        </Link>
      )}
      <section className="uitleg-hero">
        <h1>Speluitleg</h1>
        <p>
          Dit is een hybride spel van gebiedsverovering en tikkertje.
          Verzamel met je team zoveel mogelijk punten voor het einde van de speeltijd.
        </p>
      </section>

      <section className="uitleg-section">
        <h2>1) Doel van het spel</h2>
        <p>
          Het team met de meeste punten aan het einde wint. Je scoort punten door gebieden te veroveren
          en gebieden in bezit te houden.
        </p>
      </section>

      <section className="uitleg-section">
        <h2>2) Rollen in het spel</h2>
        <div className="uitleg-rules">
          <div>
            <h4>Normaal team</h4>
            <p>
              Kan opdrachten uitvoeren, gebieden veroveren en punten verdienen.
              Ziet niet live waar andere teams lopen.
            </p>
          </div>
          <div>
            <h4>Tikker-team</h4>
            <p>
              Ziet live locaties van andere teams, maar kan geen opdrachten uitvoeren
              en geen gebieden veroveren.
            </p>
          </div>
        </div>
      </section>

      <section className="uitleg-section">
        <h2>3) Spelverloop in 5 stappen</h2>
        <div className="uitleg-flow-cards">
          <article className="uitleg-card uitleg-step-card step-1">
            <h3>Stap 1: Aanmelden</h3>
            <ul>
              <li>Je krijgt een join-link van de organisator.</li>
              <li>Registreer je team met teamnaam en wachtwoord.</li>
              <li>Wacht tot de admin het spel start.</li>
            </ul>
          </article>

          <article className="uitleg-card uitleg-step-card step-2">
            <h3>Stap 2: Navigeren naar een opdracht</h3>
            <ul>
              <li>Op de kaart zie je voor elk gebied een rood puntje — dat is het opdrachtpunt, de exacte plek waar je de opdracht uitvoert.</li>
              <li>Je eigen locatie is ook zichtbaar op de kaart als blauw/gekleurd bolletje.</li>
              <li>Ga fysiek naar het opdrachtpunt toe. Pas als je dichtbij genoeg bent, wordt de opdrachttekst zichtbaar.</li>
            </ul>
          </article>

          <article className="uitleg-card uitleg-step-card step-3">
            <h3>Stap 3: Inzenden en beoordeling</h3>
            <ul>
              <li>Selecteer het gebied op de kaart en voer de opdracht uit.</li>
              <li>Dien minimaal een foto of video in als bewijs.</li>
              <li>Een admin keurt de inzending goed of af — je ontvangt een melding zodra dit is gedaan.</li>
              <li>Alleen goedgekeurde inzendingen tellen mee.</li>
              <li>Na een inzending geldt 15 minuten cooldown: je kunt in die tijd niet opnieuw indienen voor hetzelfde gebied.</li>
            </ul>
          </article>

          <article className="uitleg-card uitleg-step-card step-4">
            <h3>Stap 4: Veroveren en punten</h3>
            <ul>
              <li>Bij een echte overname krijg je direct capture-punten.</li>
              <li>Zolang je eigenaar bent, verdien je ook punten per minuut.</li>
              <li>Punten per minuut stoppen zodra een ander team overneemt.</li>
              <li>Bij meerdere gebieden lopen punten parallel op.</li>
            </ul>
          </article>

          <article className="uitleg-card uitleg-step-card step-5">
            <h3>Stap 5: Einde spel</h3>
            <ul>
              <li>Op de eindtijd stopt het scoren automatisch.</li>
              <li>Je wordt automatisch doorgestuurd naar de eindranglijst.</li>
              <li>Meeste punten wint.</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="uitleg-section">
        <h2>4) Opdrachtmodi</h2>
        <div className="uitleg-rules">
          <div>
            <h4>🏆 Laatst goedgekeurd wint</h4>
            <p>
              Het team waarvan de inzending als laatste is goedgekeurd, bezit het gebied.
              Teams kunnen elkaar overbieden door terug te gaan en opnieuw in te dienen.
            </p>
          </div>
          <div>
            <h4>📊 Hoogste score wint</h4>
            <p>
              Elk team levert een numerieke score in (bijv. aantal glazen, aantal punten).
              Het team met de hoogste goedgekeurde score bezit het gebied.
            </p>
          </div>
        </div>
      </section>

      <section className="uitleg-section">
        <h2>5) Puntensysteem met voorbeeld</h2>
        <p>
          Voorbeeld: Team Rood verovert gebied A om 10:00 → directe capture-punten bijgeschreven.
          Elke minuut eigenaarschap levert extra hold-punten op.
          Om 10:10 neemt Team Blauw gebied A over: Rood's hold-punten voor dit gebied stoppen direct;
          Blauw ontvangt nu de capture-punten en begint zelf hold-punten op te bouwen.
          Heeft Rood ook gebied B veroverd, dan lopen die hold-punten gewoon door — elk gebied telt afzonderlijk.
        </p>
        <img src={uitlegVoorbeeld} alt="Voorbeeld van opdracht tot scorebord" className="uitleg-image" />
      </section>

      <section className="uitleg-section">
        <h2>6) Extra regels</h2>
        <div className="uitleg-rules">
          <div>
            <h4>Wat doet een tikker?</h4>
            <p>Een tikker jaagt op andere teams en probeert ze fysiek aan te tikken. De tikker ziet de live locaties van alle andere teams op de kaart.</p>
          </div>
          <div>
            <h4>Hoe werkt tikken in de app?</h4>
            <p>Tik het team aan en druk daarna in de app op "Ik heb een team getikt!" Selecteer het getikte team. Dat team ontvangt een melding en moet bevestigen of ontkennen — pas na bevestiging wisselt de tikker-rol.</p>
          </div>
          <div>
            <h4>Na een tik</h4>
            <p>Het getikte team wordt de nieuwe tikker. De oude tikker wordt weer een normaal team en kan opnieuw opdrachten indienen.</p>
          </div>
          <div>
            <h4>Direct terugtikken mag niet</h4>
            <p>De nieuwe tikker mag niet meteen de vorige tikker terug tikken. Eerst moet een ander team getikt worden.</p>
          </div>
          <div>
            <h4>"Tikkers kunnen ook gebieden pakken"</h4>
            <p>Nee. Tikkers kunnen alleen tikken, niet veroveren.</p>
          </div>
          <div>
            <h4>"Capture-punten krijg je altijd opnieuw"</h4>
            <p>Nee. Alleen als de eigenaar echt verandert.</p>
          </div>
          <div>
            <h4>"Punten lopen na eindtijd door"</h4>
            <p>Nee. Op de eindtijd stopt het scoren.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Speluitleg;
