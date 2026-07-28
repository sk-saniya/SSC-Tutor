import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen grid-paper">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <span className="font-display text-lg tracking-tight">
          SSC-Tutor
        </span>
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium hover:text-[var(--color-beaker)] transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 text-sm font-medium rounded-md bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-chalkboard)] transition-colors"
          >
            Sign up free
          </Link>
        </nav>
      </header>

      {/* Hero — the chalkboard, the one dark band on the page */}
      <section className="chalkboard mx-4 md:mx-12 rounded-2xl px-6 md:px-14 py-16 md:py-24">
        <p className="font-accent text-[var(--color-chalk)] text-xl md:text-2xl -rotate-1 inline-block">
          for Class 10 students, board exam year
        </p>
        <h1 className="font-display text-3xl md:text-5xl leading-tight mt-4 max-w-3xl">
          Q: How do you actually solve a doubt at 11pm?
          <br />
          A: You ask, and someone explains it properly.
        </h1>
        <p className="mt-6 max-w-xl text-[15px] md:text-base text-[#cfe0d6]">
          SSC-Tutor answers your NCERT Science and Math questions step by step —
          grounded in your actual syllabus, not a guess. Type it, photograph
          it, attach a text file, or just say it out loud.
        </p>
        <div className="mt-9 flex flex-wrap gap-4">
          <Link
            href="/signup"
            className="px-6 py-3 rounded-md bg-[var(--color-chalk)] text-[var(--color-chalk-ink)] font-semibold hover:brightness-95 transition"
          >
            Start asking questions
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 rounded-md border border-[#3e5c52] text-[var(--color-paper)] font-medium hover:bg-[#274a40] transition"
          >
            I already have an account
          </Link>
        </div>
      </section>

      {/* How it works — a real sequence, so numbering earns its place */}
      <section className="px-6 md:px-12 py-20 max-w-5xl mx-auto">
        <h2 className="font-display text-2xl mb-10">How a doubt gets answered</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              n: "01",
              t: "Ask it your way",
              d: "Type your question, upload a photo of the textbook page, attach a notes file, or just speak it.",
            },
            {
              n: "02",
              t: "It checks the syllabus first",
              d: "SSC-Tutor searches your NCERT chapters for the relevant passage before answering, so the explanation matches what you're taught.",
            },
            {
              n: "03",
              t: "You get a worked answer",
              d: "Step-by-step reasoning for numericals, plain-language explanations for concepts, and a diagram when one would genuinely help.",
            },
          ].map((step) => (
            <div key={step.n} className="margin-rule">
              <span className="font-display text-sm text-[var(--color-margin)]">
                {step.n}
              </span>
              <h3 className="font-semibold mt-2 mb-1.5">{step.t}</h3>
              <p className="text-sm text-[var(--color-muted)] leading-relaxed">
                {step.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Subjects — styled like two notebook tabs */}
      <section className="px-6 md:px-12 py-16 max-w-5xl mx-auto">
        <h2 className="font-display text-2xl mb-10">Two subjects, fully covered</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-xl bg-[var(--color-paper-card)] border border-[var(--color-grid)] p-7">
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4"
              style={{ background: "#e3eff5", color: "var(--color-beaker-ink)" }}
            >
              SCIENCE
            </span>
            <p className="text-sm leading-relaxed text-[var(--color-muted)]">
              Chemical reactions, life processes, light and electricity,
              heredity, our environment — ask about any concept or any
              numerical from a physics or chemistry chapter.
            </p>
          </div>
          <div className="rounded-xl bg-[var(--color-paper-card)] border border-[var(--color-grid)] p-7">
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4"
              style={{ background: "#fbeec4", color: "var(--color-chalk-ink)" }}
            >
              MATH
            </span>
            <p className="text-sm leading-relaxed text-[var(--color-muted)]">
              Quadratic equations, triangles, trigonometry, coordinate
              geometry, probability, statistics — full working shown for
              every problem, not just the final answer.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-12 py-10 text-sm text-[var(--color-muted)] border-t border-[var(--color-grid)] flex flex-wrap items-center justify-between gap-3">
        <span>Built for Class 10 NCERT students.</span>
        <span>SSC-Tutor doesn&apos;t replace your teacher — it&apos;s there at 11pm when they&apos;re not.</span>
      </footer>
    </main>
  );
}
