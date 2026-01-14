/**
 * API Documentation Component
 * Shows usage examples for the API
 */
import { Code, Terminal, Copy, Check, ExternalLink } from 'lucide-react'
import { useState } from 'react'

export function ApiDocsPanel() {
  const [copied, setCopied] = useState<string | null>(null)
  
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const examples = [
    {
      id: 'get',
      title: 'Obtener movimientos',
      method: 'GET',
      code: `curl -H "Authorization: Bearer sk_live_TU_TOKEN" \\
  "https://TU_APP.vercel.app/api/v1/movements?limit=10"`
    },
    {
      id: 'post',
      title: 'Crear un gasto',
      method: 'POST',
      code: `curl -X POST \\
  -H "Authorization: Bearer sk_live_TU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "kind": "expense",
    "amount": 45.50,
    "date": "2026-01-14",
    "description": "Comida",
    "account_id": "UUID_DE_TU_CUENTA"
  }' \\
  "https://TU_APP.vercel.app/api/v1/movements"`
    },
    {
      id: 'bulk',
      title: 'Importar varios (bulk)',
      method: 'POST',
      code: `curl -X POST \\
  -H "Authorization: Bearer sk_live_TU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '[
    {"kind": "expense", "amount": 20, "date": "2026-01-10", "account_id": "..."},
    {"kind": "income", "amount": 500, "date": "2026-01-15", "account_id": "..."}
  ]' \\
  "https://TU_APP.vercel.app/api/v1/movements"`
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
        <Code size={20} className="text-primary" />
        <h3 className="font-semibold">Documentación de la API</h3>
      </div>

      {/* Base URL */}
      <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-gray-700">
        <div className="text-xs text-gray-500 mb-1">Base URL</div>
        <code className="text-sm font-mono text-primary">https://TU_APP.vercel.app/api/v1</code>
      </div>

      {/* Authentication */}
      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900">
        <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200 font-medium mb-2">
          <Terminal size={16} />
          Autenticación
        </div>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Incluye el header <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded">Authorization: Bearer sk_live_...</code> en cada petición.
        </p>
      </div>

      {/* Examples */}
      <div className="space-y-4">
        {examples.map(ex => (
          <div key={ex.id} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                  ex.method === 'GET' 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                }`}>
                  {ex.method}
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{ex.title}</span>
              </div>
              <button
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                onClick={() => copyToClipboard(ex.code, ex.id)}
                title="Copiar"
              >
                {copied === ex.id ? (
                  <Check size={14} className="text-green-500" />
                ) : (
                  <Copy size={14} className="text-gray-500" />
                )}
              </button>
            </div>
            <pre className="p-4 bg-gray-900 text-gray-100 text-xs overflow-x-auto">
              <code>{ex.code}</code>
            </pre>
          </div>
        ))}
      </div>

      {/* Link to full docs */}
      <a 
        href="/api/v1" 
        target="_blank"
        className="flex items-center gap-2 text-sm text-primary hover:underline"
      >
        <ExternalLink size={14} />
        Ver endpoint de info completo
      </a>
    </div>
  )
}
