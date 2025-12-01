import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Link as LinkIcon, ExternalLink, Copy, Check } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

interface Table {
  id: number;
  name: string;
  capacity: number;
  status: string;
  is_active: number;
}

export default function TableQRPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState(window.location.origin);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    loadTables();
    // If in dev, use the likely deployment URL or localhost
    if (window.location.hostname === 'localhost') {
      // Assuming the user might want to test with localhost or a tunnel
    }
  }, []);

  async function loadTables() {
    try {
      const res = await axios.get('/api/tables');
      setTables(res.data.data || []);
    } catch (e) {
      console.error('Failed to load tables', e);
    } finally {
      setLoading(false);
    }
  }

  function getCustomerUrl(tableName: string) {
    return `${baseUrl}/customer/menu?table=${encodeURIComponent(tableName)}`;
  }

  async function copyToClipboard(text: string, id: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  }

  function printQR(table: Table) {
    const url = getCustomerUrl(table.name);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Table ${table.name} QR Code</title>
          <style>
            body { 
              font-family: sans-serif; 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0; 
            }
            .qr-container { 
              text-align: center; 
              padding: 40px; 
              border: 2px solid #000; 
              border-radius: 20px;
            }
            h1 { font-size: 48px; margin: 0 0 20px 0; }
            p { font-size: 24px; margin: 20px 0 0 0; color: #666; }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <h1>Table ${table.name}</h1>
            <div id="qr-target"></div>
            <p>Scan to Order</p>
          </div>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
          <script>
            new QRCode(document.getElementById("qr-target"), {
              text: "${url}",
              width: 300,
              height: 300
            });
            setTimeout(() => {
              window.print();
              window.close();
            }, 500);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  if (loading) return <div className="p-8">Loading tables...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Table QR Codes</h1>
          <p className="text-neutral-500 mt-1">
            Print QR codes for your tables so customers can order from their phones.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-neutral-200">
          <span className="text-sm font-bold text-neutral-500 px-2">Base URL:</span>
          <input 
            type="text" 
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="bg-neutral-100 border-none rounded px-3 py-1 text-sm min-w-[250px]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {tables.map(table => {
          const url = getCustomerUrl(table.name);
          return (
            <div key={table.id} className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 flex flex-col items-center text-center">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-neutral-900">Table {table.name}</h3>
                <p className="text-sm text-neutral-500">{table.capacity} Pax</p>
              </div>
              
              <div className="bg-white p-4 rounded-xl shadow-inner border border-neutral-100 mb-6">
                <QRCodeSVG value={url} size={160} level="H" includeMargin />
              </div>

              <div className="w-full space-y-3">
                <div className="flex items-center gap-2 w-full">
                  <input 
                    type="text" 
                    readOnly 
                    value={url}
                    className="flex-1 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs text-neutral-600 truncate"
                  />
                  <button 
                    onClick={() => copyToClipboard(url, table.id)}
                    className="p-2 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-600"
                    title="Copy Link"
                  >
                    {copiedId === table.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <a 
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 py-2 rounded-xl text-sm font-bold transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Test
                  </a>
                  <button 
                    onClick={() => printQR(table)}
                    className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-xl text-sm font-bold transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {tables.length === 0 && (
        <div className="text-center py-12 text-neutral-500">
          No tables found. Go to Settings to add tables first.
        </div>
      )}
    </div>
  );
}
