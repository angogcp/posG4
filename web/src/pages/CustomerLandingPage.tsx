import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Users, ChevronRight, Utensils } from 'lucide-react';

interface Table {
  id: number;
  name: string;
  capacity: number;
  status: string;
}

export default function CustomerLandingPage() {
  const navigate = useNavigate();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [pax, setPax] = useState('2');
  const [showPaxModal, setShowPaxModal] = useState(false);

  useEffect(() => {
    loadTables();
  }, []);

  async function loadTables() {
    try {
      const res = await axios.get('/api/tables');
      // Filter for active tables if the API returns all
      const allTables = res.data.data || [];
      // We can optionally filter by status if needed, but let's show all active ones
      setTables(allTables.filter((t: any) => t.is_active !== 0));
    } catch (e) {
      console.error('Failed to load tables', e);
    } finally {
      setLoading(false);
    }
  }

  function handleTableClick(table: Table) {
    setSelectedTable(table);
    setShowPaxModal(true);
  }

  function handleStartOrder() {
    if (!selectedTable) return;
    const numPax = parseInt(pax);
    if (!numPax || numPax < 1) {
      alert('Please enter a valid number of guests');
      return;
    }
    navigate(`/customer/menu?table=${encodeURIComponent(selectedTable.name)}&pax=${numPax}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 text-neutral-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm px-6 py-4 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Utensils className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold text-neutral-900">Welcome</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 max-w-md mx-auto w-full flex flex-col">
        <div className="text-center mb-8 mt-4">
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Select Your Table</h2>
          <p className="text-neutral-500">Please choose your table number to browse the menu and order.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {tables.map(table => (
            <button
              key={table.id}
              onClick={() => handleTableClick(table)}
              className={`
                p-4 rounded-xl border text-center transition-all
                ${table.status === 'occupied' 
                  ? 'bg-neutral-100 border-neutral-200 text-neutral-400' 
                  : 'bg-white border-neutral-200 text-neutral-900 hover:border-primary-500 hover:shadow-md active:scale-95'
                }
              `}
            >
              <div className="text-2xl font-bold mb-1">{table.name}</div>
              <div className="text-xs text-neutral-500 flex items-center justify-center gap-1">
                <Users className="w-3 h-3" />
                Max {table.capacity}
              </div>
            </button>
          ))}
        </div>

        {tables.length === 0 && (
          <div className="text-center text-neutral-400 py-10">
            No tables available.
          </div>
        )}
      </div>

      {/* Pax Modal */}
      {showPaxModal && selectedTable && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-xs p-6 shadow-xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-center mb-2">Table {selectedTable.name}</h3>
            <p className="text-center text-neutral-500 mb-6 text-sm">How many people are dining?</p>
            
            <div className="flex items-center justify-center gap-4 mb-8">
              <button 
                onClick={() => setPax(String(Math.max(1, parseInt(pax) - 1)))}
                className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center text-xl font-bold hover:bg-neutral-200"
              >
                -
              </button>
              <div className="text-3xl font-bold w-12 text-center">{pax}</div>
              <button 
                onClick={() => setPax(String(parseInt(pax) + 1))}
                className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center text-xl font-bold hover:bg-neutral-200"
              >
                +
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleStartOrder}
                className="w-full bg-primary-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-primary-700 flex items-center justify-center gap-2"
              >
                Start Ordering
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowPaxModal(false)}
                className="w-full py-3 rounded-xl font-medium text-neutral-500 hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
