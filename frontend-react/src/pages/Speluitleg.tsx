import React from 'react';
import uitlegVoorbeeld from '../assets/uitleg-voorbeeld.svg';

const Speluitleg: React.FC = () => {
  return (
    <div className="uitleg-page">
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
            <h3>Stap 2: Bewegen en kiezen</h3>
            <ul>
              <li>Kies een gebied op de kaart.</li>
              <li>Lees de opdracht bij dat gebied.</li>
              <li>Ga naar de locatie en voer de opdracht uit.</li>
            </ul>
          </article>

          <article className="uitleg-card uitleg-step-card step-3">
            <h3>Stap 3: Inzenden en beoordeling</h3>
            <ul>
              <li>Lever minimaal tekst, foto of video in.</li>
              <li>Een admin keurt de inzending goed of af.</li>
              <li>Alleen goedgekeurde inzendingen tellen mee.</li>
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
              <li>Bekijk het scorebord voor de eindranglijst.</li>
              <li>Meeste punten wint.</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="uitleg-section">
        <h2>4) Puntensysteem met voorbeeld</h2>
        <p>
          Voorbeeld: je verovert gebied A. Je krijgt direct capture-punten.
          Houd je het gebied daarna 8 minuten vast, dan krijg je daarbovenop 8 minuten aan hold-punten.
          Wordt het gebied overgenomen, dan stoppen je hold-punten voor dat gebied direct.
        </p>
        <img src={uitlegVoorbeeld} alt="Voorbeeld van opdracht tot scorebord" className="uitleg-image" />
      </section>

      <section className="uitleg-section">
        <h2>5) Extra regels</h2>
        <div className="uitleg-rules">
          <div>
            <h4>Wat doet een tikker?</h4>
            <p>Een tikker jaagt op andere teams en probeert ze te tikken.</p>
          </div>
          <div>
            <h4>Na een tik</h4>
            <p>Het getikte team wordt de nieuwe tikker. De oude tikker wordt weer een normaal team.</p>
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
