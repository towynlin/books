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
    <div className="min-h-screen bg-warm-cream">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold font-serif text-forest-green mb-2">Import Books</h1>
          <p className="text-terracotta font-medium">Import your Goodreads library</p>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-soft-peach/20 p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold font-serif text-forest-green mb-2">How to export from Goodreads:</h2>
            <ol className="list-decimal list-inside space-y-2 text-sm text-charcoal/80">
              <li>Go to your Goodreads account</li>
              <li>Navigate to "My Books"</li>
              <li>Click "Import and Export" in the tools section</li>
              <li>Click "Export Library" and download the CSV file</li>
              <li>Upload that file here</li>
            </ol>
          </div>

          <div className="border-2 border-dashed border-soft-peach rounded-2xl p-8 hover:border-terracotta transition-colors">
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
                className="w-12 h-12 text-terracotta mb-3"
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
              <span className="text-sm text-charcoal/60">
                {file ? file.name : 'Click to select CSV file'}
              </span>
            </label>
          </div>

          {file && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="mt-4 w-full bg-forest-green text-white py-3 px-4 rounded-full hover:bg-forest-green/90 disabled:bg-charcoal/40 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {importing ? 'Importing...' : 'Import Books'}
            </button>
          )}

          {result && (
            <div className={`mt-6 p-4 rounded-2xl ${result.success ? 'bg-forest-green/10 border-2 border-forest-green' : 'bg-soft-peach border-2 border-terracotta'}`}>
              <h3 className="font-semibold font-serif text-forest-green mb-2">Import Results</h3>
              <p className="text-charcoal">Successfully imported: {result.imported} books</p>
              {result.errors > 0 && <p className="text-terracotta font-medium">Errors: {result.errors}</p>}

              {result.details?.errors && result.details.errors.length > 0 && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-terracotta">View Errors</summary>
                  <ul className="mt-2 text-sm space-y-1 text-charcoal/80">
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
