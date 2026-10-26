import { Art } from "./components/Art";
import { CopyEmail } from "./components/CopyEmail";
import { Icon } from "./components/Icon";
import { Mark } from "./components/Mark";
import { ThemeToggle } from "./components/ThemeToggle";
import { about, contact, education, experience, footer, identity, links, projects } from "./content";
import turnerLight from "@/public/art/turner-sunset-and-moonrise-light.jpg";
import turnerDark from "@/public/art/turner-sunset-and-moonrise-dark.jpg";
import geeseLight from "@/public/art/hiroshige-descending-geese-light.jpg";
import geeseDark from "@/public/art/hiroshige-descending-geese-dark.jpg";

const mailto = `mailto:${links.email}`;
const external = { target: "_blank", rel: "noopener" } as const;

export default function Home() {
  return (
    <>
      <div className="wash wash-m" aria-hidden="true">
        <Art light={turnerLight} dark={turnerDark} sizes="100vw" />
      </div>
      <header className="wrap top" id="top">
        <a className="mark" href="#top">{identity.name}</a>
        <div className="top-r">
          <ThemeToggle />
          <a href={mailto}>Email<Icon name="arrow-up-right" /></a>
        </div>
      </header>
      <main>
        <section className="wrap g hero" aria-label="Introduction">
          <h1 className="name">{identity.name}</h1>
          <p className="line">{identity.line}</p>
          <ul className="contact" aria-label="Contact">
            <li><a href={mailto}><Icon name="envelope" />{links.email}</a></li>
            <li><CopyEmail email={links.email} /></li>
            <li>
              <a href={links.github} {...external} aria-label="GitHub (opens in a new tab)"><Icon name="github-logo" />GitHub<Icon name="arrow-up-right" /></a>
              <a href={links.linkedin} {...external} aria-label="LinkedIn (opens in a new tab)"><Icon name="linkedin-logo" />LinkedIn<Icon name="arrow-up-right" /></a>
            </li>
          </ul>
        </section>
        <div className="washrow">
          <div className="wash wash-d" aria-hidden="true">
            <Art light={turnerLight} dark={turnerDark} sizes="50vw" />
          </div>
          <div className="wrap g"><p className="about">{about.join(" ")}</p></div>
        </div>
        <section className="wrap g sec exp" aria-labelledby="h-exp">
          <h2 className="head reveal" id="h-exp"><span className="num">01</span>Experience</h2>
          <ol className="rows">
            {experience.map((r) => (
              <li key={r.role}>
                <p className="r-date label"><span>{r.from}</span> <span>{r.to}</span></p>
                <div className="r-main">
                  {r.tag && <span className="tag label"><Icon name={r.tag.glyph} size={14} />{r.tag.label}</span>}
                  <p><span className="role">{r.role}</span>, <span className="place">{r.place}</span></p>
                  <p className="r-line">{r.line}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="wrap g sec proj" aria-labelledby="h-proj">
          <h2 className="head reveal" id="h-proj"><span className="num">02</span>Projects</h2>
          <ul className="rows">
            {projects.map((p) => (
              <li key={p.name}>
                <div className="p-main">
                  <span className="tag label"><Icon name={p.tag.glyph} size={14} />{p.tag.label}</span>
                  <h3 className="pname">{p.name}</h3>
                  <p className="pdesc">{p.lines.join(" ")}</p>
                  <ul className="stack" aria-label="Built with">
                    {p.stack.map((s) => <li key={s.mark}><Mark name={s.mark} />{s.name}</li>)}
                  </ul>
                </div>
                <ul className="links">
                  {p.links.map((l) => (
                    <li key={l.href}><a href={l.href} {...external} aria-label={l.aria}>{l.label}<Icon name="arrow-up-right" /></a></li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
        <section className="wrap g sec edu" aria-labelledby="h-edu">
          <h2 className="head reveal" id="h-edu"><span className="num">03</span>Education</h2>
          <ul className="rows">
            <li>
              <p className="r-date label">{education.date}</p>
              <div className="r-main">
                <p>{education.school}</p>
                <p>{education.interests}</p>
              </div>
            </li>
          </ul>
        </section>
      </main>
      <section className="band" aria-labelledby="h-contact">
        <div className="band-art" aria-hidden="true">
          <Art light={geeseLight} dark={geeseDark} sizes="100vw" />
        </div>
        <div className="wrap g band-in">
          <div>
            <h2 className="head reveal" id="h-contact"><span className="num">04</span>Contact</h2>
            <p>{contact.lead}</p>
            <div className="band-mail">
              <a href={mailto}><Icon name="envelope" />{links.email}</a>
              <CopyEmail email={links.email} />
            </div>
          </div>
        </div>
      </section>
      <footer className="wrap"><p className="label">{footer}</p></footer>
    </>
  );
}
