import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Search, ClipboardList, FileText, AlertTriangle, GitBranch,
  Sun, Moon, Code2, Play, Loader2, Sparkles, Database, Radio,
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const TOOLS = [
  {
    id: 'rag',
    label: 'RAG Explorer',
    icon: Search,
    description: 'Ask questions about your test knowledge base in plain English.',
    placeholder: 'e.g. Do we have tests for payment issues?',
  },
  {
    id: 'plan',
    label: 'Test Plan Generator',
    icon: ClipboardList,
    description: 'Describe a feature or requirement, get a structured test plan back.',
    placeholder: 'e.g. Users should be able to reset password via email link',
  },
  {
    id: 'cases',
    label: 'Test Case Generator',
    icon: FileText,
    description: 'Describe a feature or requirement, get positive/negative/edge test cases back.',
    placeholder: 'e.g. Coupon code field on checkout page',
  },
  {
    id: 'flaky',
    label: 'Flaky Analyzer',
    icon: AlertTriangle,
    description: 'Paste CI run history to detect tests that flip between pass and fail.',
    placeholder: 'test_name,run_id,status\nlogin_test,1,pass\nlogin_test,2,fail',
  },
  {
    id: 'jira',
    label: 'Jira Import',
    icon: GitBranch,
    description: 'Pull a real Jira ticket by its key to use as a requirement.',
    placeholder: 'e.g. LINEAR-40',
  },
]

export default function App() {
  const [dark, setDark] = useState(true)
  const [activeTab, setActiveTab] = useState('rag')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState(null)
  const [flakyResults, setFlakyResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [backendStatus, setBackendStatus] = useState('checking')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((r) => (r.ok ? setBackendStatus('online') : setBackendStatus('offline')))
      .catch(() => setBackendStatus('offline'))
  }, [])

  const tool = TOOLS.find((t) => t.id === activeTab)
  const Icon = tool.icon

  function switchTab(id) {
    setActiveTab(id)
    setInput('')
    setOutput(null)
    setFlakyResults(null)
  }

  async function handleRun() {
    if (!input.trim()) return
    setLoading(true)
    setOutput(null)
    setFlakyResults(null)
    try {
      if (activeTab === 'rag') {
        const res = await fetch(`${API_BASE}/api/rag-query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: input }),
        })
        const data = await res.json()
        setOutput({ text: data.answer, sources: data.context_used || [] })
      } else if (activeTab === 'plan') {
        const res = await fetch(`${API_BASE}/api/test-plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requirement: input }),
        })
        const data = await res.json()
        setOutput({ text: data.plan })
      } else if (activeTab === 'cases') {
        const res = await fetch(`${API_BASE}/api/test-cases`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requirement: input }),
        })
        const data = await res.json()
        setOutput({ text: data.cases })
      } else if (activeTab === 'flaky') {
        const res = await fetch(`${API_BASE}/api/flaky-analyzer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv_text: input }),
        })
        const data = await res.json()
        setFlakyResults(data)
      } else if (activeTab === 'jira') {
        const res = await fetch(`${API_BASE}/api/jira/fetch-issue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issue_key: input }),
        })
        const data = await res.json()
        setOutput({
          text: `### ${data.key}: ${data.summary}\n\n**Status:** ${data.status}\n\n${data.description}`,
        })
      }
    } catch (err) {
      setOutput({ text: `**Error:** ${err.message}` })
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top navbar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center shadow-md shadow-accent/20">
              <Sparkles className="w-4.5 h-4.5 text-white" size={18} />
            </div>
            <span className="font-bold text-lg tracking-tight">QA Buddy Pro</span>
          </div>
          <div className="flex items-center gap-2">
  <a
    href="https://github.com/shroffeshh29/qa-buddy-pro"
    target="_blank"
    rel="noreferrer"
    className="hidden sm:flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors"
  >
    <Code2 size={16} />
    GitHub
  </a>

  <button
    onClick={() => setDark((d) => !d)}
    className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors"
    aria-label="Toggle theme"
  >
    {dark ? <Sun size={18} /> : <Moon size={18} />}
  </button>
</div>
        </div>

        {/* Stats strip */}
        <div className="max-w-7xl mx-auto px-6 pb-3 flex flex-wrap gap-2">
          <StatusPill
            icon={<Radio size={12} className={backendStatus === 'online' ? 'animate-pulse' : ''} />}
            label={backendStatus === 'checking' ? 'Checking backend...' : backendStatus === 'online' ? 'Backend live' : 'Backend offline'}
            tone={backendStatus === 'online' ? 'good' : backendStatus === 'offline' ? 'bad' : 'neutral'}
          />
          <StatusPill icon={<Database size={12} />} label="Vector DB: Qdrant" tone="neutral" />
          <StatusPill icon={<Sparkles size={12} />} label="Model: Llama 3.3 70B" tone="neutral" />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-6">
        {/* Sidebar */}
        <nav className="w-64 shrink-0 space-y-2">
          {TOOLS.map((t) => {
            const TIcon = t.icon
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150 group ${
                  active
                    ? 'bg-gradient-to-br from-accent to-accent-dark border-transparent shadow-lg shadow-accent/25 text-white'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-accent/40 hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      active ? 'bg-white/20' : 'bg-accent/10 text-accent dark:bg-accent/15'
                    }`}
                  >
                    <TIcon size={16} className={active ? 'text-white' : ''} />
                  </div>
                  <span className={`font-semibold text-sm ${active ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
                    {t.label}
                  </span>
                </div>
              </button>
            )
          })}
        </nav>

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-6">
          {/* Header block */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 dark:bg-accent/15 text-accent flex items-center justify-center shrink-0">
              <Icon size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{tool.label}</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">{tool.description}</p>
            </div>
          </div>

          {/* Input block */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={tool.placeholder}
              rows={activeTab === 'flaky' ? 8 : 4}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent placeholder:text-slate-400 dark:placeholder:text-slate-600"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 dark:text-slate-600 font-mono">
                {input.length} characters
              </span>
              <button
                onClick={handleRun}
                disabled={loading || !input.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-accent to-accent-dark hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 transition-all shadow-md shadow-accent/20"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Running
                  </>
                ) : (
                  <>
                    <Play size={16} /> Run
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results block */}
          {loading && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3 animate-pulse">
              <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
              <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-full" />
              <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-5/6" />
            </div>
          )}

          {!loading && !output && !flakyResults && (
            <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-14 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-accent/10 dark:bg-accent/15 text-accent flex items-center justify-center mb-4">
                <Icon size={26} />
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
                Run {tool.label.toLowerCase()} above and the result will appear here.
              </p>
            </div>
          )}

          {!loading && output && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm animate-fadeIn space-y-5">
              <div className="prose-sm max-w-none dark:prose-invert prose-headings:text-accent-dark dark:prose-headings:text-accent-light prose-strong:text-highlight prose-table:text-xs">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{output.text}</ReactMarkdown>
              </div>
              {output.sources && output.sources.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-600">
                    Sources used
                  </p>
                  {output.sources.map((s, i) => (
                    <div
                      key={i}
                      className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-500 dark:text-slate-400 font-mono"
                    >
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && flakyResults && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm animate-fadeIn space-y-4">
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 text-left">
                      <th className="p-3 font-semibold text-slate-500 dark:text-slate-400">Test</th>
                      <th className="p-3 font-semibold text-slate-500 dark:text-slate-400">Runs</th>
                      <th className="p-3 font-semibold text-slate-500 dark:text-slate-400">Pass Rate</th>
                      <th className="p-3 font-semibold text-slate-500 dark:text-slate-400">Flip Rate</th>
                      <th className="p-3 font-semibold text-slate-500 dark:text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flakyResults.results.map((r, i) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="p-3 font-mono">{r.test_name}</td>
                        <td className="p-3">{r.total_runs}</td>
                        <td className="p-3">{r.pass_rate}</td>
                        <td className="p-3">{r.flip_rate}</td>
                        <td className="p-3">
                          {r.flaky ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 bg-red-500/10 px-2 py-1 rounded-full">
                              <AlertTriangle size={11} /> Flaky
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
                              Stable
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{flakyResults.summary}</ReactMarkdown>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function StatusPill({ icon, label, tone }) {
  const toneClasses = {
    good: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    bad: 'bg-red-500/10 text-red-500 dark:text-red-400',
    neutral: 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${toneClasses[tone]}`}>
      {icon} {label}
    </span>
  )
}