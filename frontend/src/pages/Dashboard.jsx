import { LogOut, ShieldCheck, UserCircle2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export default function Dashboard() {
  const { user, logout } = useAuth()

  const displayName = user?.first_name || user?.username || user?.email || 'User'

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="w-full rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200">
                <ShieldCheck className="h-4 w-4" />
                Protected area
              </div>
              <h1 className="text-3xl font-semibold text-white sm:text-4xl">
                Welcome, {displayName}
              </h1>
              <p className="mt-3 max-w-2xl text-slate-300">
                Your JWT session is active. This page is ready for course, quiz, and progression
                widgets.
              </p>
            </div>

            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 font-medium text-slate-100 transition hover:border-cyan-400/50 hover:bg-slate-900"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ['Identity', user?.email || 'No profile loaded'],
              ['Role', user?.role || 'Learner'],
              ['Session', 'Access and refresh tokens stored securely in localStorage'],
            ].map(([label, value]) => (
              <article key={label} className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
                <UserCircle2 className="mb-4 h-5 w-5 text-cyan-300" />
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500">{label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">{value}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}