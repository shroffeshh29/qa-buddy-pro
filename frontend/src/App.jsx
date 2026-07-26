import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

const API_BASE = 'http://localhost:8000'

const TABS = [
  {
    id: 'rag',
    label: 'RAG Explorer',
    description: 'Ask questions about your test knowledge base in plain English.',
  },
  {
    id: 'plan',
    label: 'Test Plan Generator',
    description: 'Describe a feature or requirement, get a structured test plan back.',
  },
  {
    id: 'cases',
    label: 'Test Case Generator',
    description: 'Describe a feature or requirement, get positive/negative/edge test cases back.',
  },
  {
    id: 'flaky',
    label: 'Flaky Analyzer',
    description: 'Paste CI run history (test_name, run_id, status) to detect flaky tests.',
  },
  {
    id: 'jira',
    label: 'Jira Import',
    description: 'Pull a real Jira ticket by its key to use as a requirement.',
  },
]

function App() {
  const [activeTab, setActiveTab] = useState('rag')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [jiraLink, setJiraLink] = useState(null)

  async function handleRun() {
    setLoading(true)
    setOutput('')
    setJiraLink(null)
    try {
      let res, data
      if (activeTab === 'rag') {
        res = await fetch(`${API_BASE}/api/rag-query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: input }),
        })
        data = await res.json()
        setOutput(data.answer)
      } else if (activeTab === 'plan') {
        res = await fetch(`${API_BASE}/api/test-plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requirement: input }),
        })
        data = await res.json()
        setOutput(data.plan)
      } else if (activeTab === 'cases') {
        res = await fetch(`${API_BASE}/api/test-cases`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requirement: input }),
        })
        data = await res.json()
        setOutput(data.cases)
      } else if (activeTab === 'flaky') {
        res = await fetch(`${API_BASE}/api/flaky-analyzer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv_text: input }),
        })
        data = await res.json()
        const table = data.results
          .map(
            (r) =>
              `| ${r.test_name} | ${r.total_runs} | ${r.pass_rate} | ${r.flip_rate} | ${r.flaky ? '🔴 Flaky' : '🟢 Stable'} |`
          )
          .join('\n')
        setOutput(
          `| Test | Runs | Pass Rate | Flip Rate | Status |\n|---|---|---|---|---|\n${table}\n\n**Analysis:**\n\n${data.summary}`
        )
      } else if (activeTab === 'jira') {
        res = await fetch(`${API_BASE}/api/jira/fetch-issue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issue_key: input }),
        })
        data = await res.json()
        setOutput(
          `### ${data.key}: ${data.summary}\n\n**Status:** ${data.status}\n\n${data.description}`
        )
      }
    } catch (err) {
      setOutput(`**Error:** ${err.message}`)
    }
    setLoading(false)
  }

  const placeholders = {
    rag: 'e.g. Do we have tests for payment issues?',
    plan: 'e.g. Users should be able to reset password via email link',
    cases: 'e.g. Users should be able to reset password via email link',
    flaky: 'Paste CSV: test_name,run_id,status',
    jira: 'e.g. LINEAR-40',
  }

  const currentTab = TABS.find((t) => t.id === activeTab)

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>QA Buddy Pro</h1>
        <p className="tagline">AI-assisted QA, grounded in your own test data</p>
        <nav>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => {
                setActiveTab(tab.id)
                setInput('')
                setOutput('')
                setJiraLink(null)
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        <h2>{currentTab.label}</h2>
        <p className="description">{currentTab.description}</p>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholders[activeTab]}
          rows={activeTab === 'flaky' ? 10 : 4}
        />
        <button className="run-button" onClick={handleRun} disabled={loading || !input}>
          {loading ? (
            <span className="spinner-wrap">
              <span className="spinner" /> Running
            </span>
          ) : (
            'Run'
          )}
        </button>

        {jiraLink && (
          <a className="jira-link" href={jiraLink} target="_blank" rel="noreferrer">
            View ticket in Jira →
          </a>
        )}

        {output && (
          <div className="output">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
          </div>
        )}
      </main>
    </div>
  )
}

export default App