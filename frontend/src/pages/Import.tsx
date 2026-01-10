import { useState } from 'react';
import { importAPI } from '../lib/api';

export function Import() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    imported: number;
    errors: number;
    details?: any;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const importResult = await importAPI.importGoodreads(file);
      setResult(importResult);
    } catch (error) {
      setResult({
        success: false,
        imported: 0,
        errors: 1,
        details: {
          imported: [],
          errors: [{ title: 'Import failed', error: error instanceof Error ? error.message : 'Unknown error' }],
        },
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Import Books</h1>
          <p className="text-gray-600">Import your Goodreads library</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">How to export from Goodreads:</h2>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
              <li>Go to your Goodreads account</li>
              <li>Navigate to "My Books"</li>
              <li>Click "Import and Export" in the tools section</li>
              <li>Click "Export Library" and download the CSV file</li>
              <li>Upload that file here</li>
            </ol>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center justify-center"
            >
              <svg
                className="w-12 h-12 text-gray-400 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-sm text-gray-600">
                {file ? file.name : 'Click to select CSV file'}
              </span>
            </label>
          </div>

          {file && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {importing ? 'Importing...' : 'Import Books'}
            </button>
          )}

          {result && (
            <div className={`mt-6 p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <h3 className="font-semibold mb-2">Import Results</h3>
              <p>Successfully imported: {result.imported} books</p>
              {result.errors > 0 && <p className="text-red-600">Errors: {result.errors}</p>}

              {result.details?.errors && result.details.errors.length > 0 && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium">View Errors</summary>
                  <ul className="mt-2 text-sm space-y-1">
                    {result.details.errors.map((err: any, i: number) => (
                      <li key={i}>
                        <strong>{err.title}</strong>: {err.error}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
