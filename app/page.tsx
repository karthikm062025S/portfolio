import type { CSSProperties, ReactNode } from "react";
import { CopyEmail } from "./components/CopyEmail";
import { Arch } from "./components/Arch";
import { Diagram } from "./components/Diagram";
import { DiagramPause } from "./components/DiagramPause";
import { Icon } from "./components/Icon";
import { Mark } from "./components/Mark";
import { ThemeToggle } from "./components/ThemeToggle";
import { education, experience, footer, golf, identity, links, nav, projects, showStories, stack, type Story as StoryLines, type Tag } from "./content";

const external = { target: "_blank", rel: "noopener" } as const;
const mail = { href: links.compose, ...external, "aria-label": `Email ${links.email} (opens Gmail in a new tab)` };
// Experience rows arrive one after another; the delay stops growing at the fifth row.
const stagger = (i: number) => ({ "--i": Math.min(i, 4) }) as CSSProperties;

function Tags({ items, label }: { items: Tag[]; label: string }) {
  return (
    <ul className="tags" aria-label={label}>
      {items.map((t) => <li key={t.label}>{t.mark ? <Mark name={t.mark} /> : t.glyph && <Icon name={t.glyph} />}{t.label}</li>)}
    </ul>
  );
}

// The row's lead tag, visible while the row is closed.
function Lead({ tag }: { tag: Tag }) {
  return <span className="r-lead">{tag.mark ? <Mark name={tag.mark} /> : tag.glyph && <Icon name={tag.glyph} />}{tag.label}</span>;
}

// The row's story: label column, then the line.
function Story({ lines }: { lines: StoryLines }) {
  return (
    <dl className="story">
      {lines.map((l) => <div key={l.label}><dt className="label">{l.label}</dt><dd>{l.text}</dd></div>)}
    </dl>
  );
}

// "+" that turns into an "x" when the row is open; CSS does the turn.
const toggle = <span className="pm" aria-hidden="true"><Icon name="plus" /></span>;

function Section({ id, title, sub, children }: { id?: string; title: string; sub?: boolean; children: ReactNode }) {
  const h = `h-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section className={sub ? "sec sec-sub" : "sec"} id={id} aria-labelledby={h}>
      <div className="col">
        <h2 className="head reveal" id={h}>{title}</h2>
        {children}
      </div>
    </section>
  );
}

export default function Home() {
  const [first, ...rest] = identity.name.split(" ");
  return (
    <>
      <header className="nav">
        <div className="nav-in">
          {/* Docks once the hero name has scrolled under the nav (html.docked, set in the boot script). */}
          <div className="nav-name"><a href="#" aria-label={`${identity.name}, back to top`}>{first}<span className="last">{" "}{rest.join(" ")}</span></a></div>
          <nav aria-label="Sections">
            <ul>{nav.map((n) => <li key={n.href}><a href={n.href}>{n.label}</a></li>)}</ul>
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main>
        <section className="hero" aria-label="Introduction">
          <div className="col">
            <p className="kicker label">{identity.kicker}</p>
            <h1 className="name"><span><span>{first}</span></span> <span><span>{rest.join(" ")}</span></span></h1>
            <p className="line">
              {identity.lead}{" "}
              {identity.fields.map((f, i) => (
                <span key={f.label} className="field" style={{ "--i": i } as CSSProperties}>
                  {i === identity.fields.length - 1 && "and "}
                  {/* the glyph never wraps away from its first word */}
                  <span className="nw"><Icon name={f.glyph} />{f.label.split(" ")[0]}</span>
                  {f.label.slice(f.label.indexOf(" ") === -1 ? f.label.length : f.label.indexOf(" "))}{i < identity.fields.length - 1 ? ", " : "."}
                </span>
              ))}
            </p>
            <p className="sub">{identity.sub}</p>
            <ul className="hlinks" aria-label="Contact">
              <li><a className="pill" {...mail}><Icon name="envelope" />Email</a></li>
              <li><a href={links.github} {...external} aria-label="GitHub (opens in a new tab)"><Icon name="github-logo" />GitHub</a></li>
              <li><a href={links.linkedin} {...external} aria-label="LinkedIn (opens in a new tab)"><Icon name="linkedin-logo" />LinkedIn</a></li>
            </ul>
          </div>
        </section>

        <Section id="experience" title="Experience">
          <ul className="rows">
            {experience.map((r, i) => (
              <li key={r.place} className="x reveal" style={stagger(i)}>
                <details>
                  <summary>
                    <span className="r-date label">{r.date}</span>
                    <span className="r-title"><b>{r.place}</b> <span className="muted">· {r.role}</span></span>
                    <span className="r-plain">{r.plain}</span>
                    {r.tag && <Lead tag={r.tag} />}
                    {toggle}
                  </summary>
                  <div className="r-body">
                    {r.diagram && <Diagram name={r.diagram} />}
                    {showStories && r.story ? <Story lines={r.story} /> : r.lines?.map((l) => <p key={l}>{l}</p>)}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="projects" title="Projects">
          <ul className="rows reveal">
            {projects.map((p) => (
              <li key={p.name} className="x proj">
                <details>
                  <summary>
                    <span className="r-title"><b>{p.name}</b></span>
                    <span className="r-plain">{p.plain}</span>
                    <Lead tag={p.tag} />
                    {toggle}
                  </summary>
                  <div className="r-body">
                    <p className="note label">{p.note}</p>
                    {p.arch ? <Arch d={p.arch} /> : <Diagram name={p.diagram} />}
                    {showStories && <Story lines={p.story} />}
                    <Tags items={p.stack} label="Built with" />
                  </div>
                </details>
                <ul className="plinks">
                  {p.links.map((l) => (
                    <li key={l.href}><a href={l.href} {...external} aria-label={l.aria}>{l.label}<Icon name="arrow-up-right" /></a></li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="stack" title="Stack">
          <ul className="rows sk reveal">
            {stack.map((g) => (
              <li key={g.group} className="static">
                <h3 className="sk-g label">{g.group}</h3>
                <Tags items={g.items} label={g.group} />
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Education" sub>
          <ul className="rows reveal">
            <li className="static">
              <span className="r-date label">{education.date}</span>
              <p>{education.line.split(" · ").map((s, i) => <span key={s}>{i > 0 && " · "}<span className="nw">{s}</span></span>)}</p>
            </li>
          </ul>
        </Section>

        <Section id="golf" title="Off the keyboard">
          <p className="ok-line reveal">{golf}</p>
        </Section>

        <Section id="contact" title="Contact">
          <div className="reveal">
            <ul className="c-icons">
              <li><a {...mail}><Icon name="envelope" />{links.email}</a></li>
              <li><CopyEmail email={links.email} /></li>
              <li className="c-soc">
                <a href={links.github} {...external} aria-label="GitHub (opens in a new tab)"><Icon name="github-logo" />GitHub</a>
                <a href={links.linkedin} {...external} aria-label="LinkedIn (opens in a new tab)"><Icon name="linkedin-logo" />LinkedIn</a>
              </li>
            </ul>
          </div>
        </Section>
      </main>
      <footer className="col foot label"><span>{footer.left}</span></footer>
      <DiagramPause />
    </>
  );
}
