import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-brand">
          <span className="brand-mark">SB</span>
          <span>SkillBridge</span>
        </div>
        <div className="landing-nav-actions">
          <Link to="/login" className="btn btn-ghost">Login</Link>
          <Link to="/register" className="btn btn-primary">Get Started</Link>
        </div>
      </header>

      <section className="landing-hero">
        <h1>Find the right job based on your skills</h1>
        <p>
          SkillBridge matches trainees to employers using a real skill-gap
          engine, not a keyword search - see exactly where you stand and
          what to learn next.
        </p>
        <div className="landing-cta">
          <Link to="/register" className="btn btn-primary btn-lg">Get Started</Link>
          <Link to="/login" className="btn btn-secondary btn-lg">Login</Link>
        </div>
      </section>

      <section className="landing-flow">
        {[
          ["Profile", "Tell us your education and skills"],
          ["Skill Matching", "We score you against every open role"],
          ["Job", "Browse roles ranked by fit"],
          ["Application", "Apply and track your status live"],
          ["Employment", "Land the role and get verified"],
        ].map(([title, desc], i, arr) => (
          <div className="landing-flow-step" key={title}>
            <div className="landing-flow-badge">{i + 1}</div>
            <h3>{title}</h3>
            <p>{desc}</p>
            {i < arr.length - 1 && <div className="landing-flow-arrow">→</div>}
          </div>
        ))}
      </section>
    </div>
  );
}
