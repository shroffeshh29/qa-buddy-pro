import { useState } from 'react'
import './App.css'

const API_BASE = 'http://localhost:8000'

const TABS = [
  { id: 'rag', label: 'RAG Explorer' },
  { id: 'plan', label: 'Test Plan Generator' },
  { id: 'cases', label: 'Test Case Generator' },
  { id: 'flaky', label: 'Flaky Analyzer' },
  { id: 'jira', label: 'Jira Import' },
]

function App() {
  const [activeTab, setActiveTab] = useState('rag')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRun() {
    setLoading(true)
    setOutput('')
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
        setOutput(JSON.stringify(data.results, null, 2) + '\n\n' + data.summary)
      } else if (activeTab === 'jira') {
        res = await fetch(`${API_BASE}/api/jira/fetch-issue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issue_key: input }),
        })
        data = await res.json()
        setOutput(`${data.key}: ${data.summary}\nStatus: ${data.status}\n\n${data.description}`)
      }
    } catch (err) {
      setOutput('Error: ' + err.message)
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

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>QA Buddy Pro</h1>
        <nav>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => {
                setActiveTab(tab.id)
                setInput('')
                setOutput('')
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        <h2>{TABS.find((t) => t.id === activeTab).label}</h2>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholders[activeTab]}
          rows={activeTab === 'flaky' ? 10 : 4}
        />
        <button className="run-button" onClick={handleRun} disabled={loading || !input}>
          {loading ? 'Running...' : 'Run'}
        </button>
        {output && <pre className="output">{output}</pre>}
      </main>
    </div>
  )
}

export default App