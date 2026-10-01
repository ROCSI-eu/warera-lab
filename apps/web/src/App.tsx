const projectFacts = [
  "Credential-free public MVP",
  "Economy Lab first",
  "Documented WarEra API only",
  "Observed, derived, assumed, and overridden provenance",
];

export function App() {
  return (
    <main className="shell">
      <section className="hero" aria-labelledby="warera-lab-title">
        <p className="eyebrow">ROCSI · open-source project</p>
        <h1 id="warera-lab-title">WarEra Lab</h1>
        <p className="lede">
          A simulation and analytics workbench for exploring WarEra data and testing transparent
          what-if scenarios.
        </p>
        <p className="status">
          Initial engineering scaffold — simulator features are not live yet.
        </p>
      </section>

      <section className="principles" aria-labelledby="principles-title">
        <h2 id="principles-title">Foundation</h2>
        <ul>
          {projectFacts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </section>

      <footer>
        WarEra Lab is an independent community project and is not affiliated with, endorsed by, or
        operated by WarEra.
      </footer>
    </main>
  );
}
