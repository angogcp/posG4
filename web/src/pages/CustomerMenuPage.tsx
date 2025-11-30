import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ShoppingBag, ChevronRight, Minus, Plus, X, Utensils } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

interface Category { id: number; name: string; }
interface Product { id: number; category_id: number; name: string; price: number; image_url?: string; code: string; options_json?: any; }
interface CartItem extends Product { qty: number; options?: any; cartId: string; }

export default function CustomerMenuPage() {
  const { formatCurrency } = useSettings();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [tableNumber, setTableNumber] = useState(searchParams.get('table') || '');
  const [pax, setPax] = useState(searchParams.get('pax') || '1');
  const [showWelcome, setShowWelcome] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | 'all'>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState<{id: number, number: string} | null>(null);

  // Fetch Menu
  useEffect(() => {
    loadMenu();
    if (tableNumber) setShowWelcome(false);
  }, []);

  async function loadMenu() {
    try {
      const [catRes, prodRes] = await Promise.all([
        axios.get('/api/customer/categories'),
        axios.get('/api/customer/products')
      ]);
      setCategories(catRes.data.data || []);
      setProducts(prodRes.data.data || []);
      if (catRes.data.data?.length > 0) {
        setActiveCategory(catRes.data.data[0].id);
      }
    } catch (e) {
      console.error('Failed to load menu', e);
    }
  }

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'all') return products;
    return products.filter(p => p.category_id === activeCategory);
  }, [products, activeCategory]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  }, [cart]);

  const cartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }, [cart]);

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(p => p.id === product.id); // Simple check, ignoring options for now
      if (existing) {
        return prev.map(p => p.id === product.id ? { ...p, qty: p.qty + 1 } : p);
      }
      return [...prev, { ...product, qty: 1, cartId: Math.random().toString(36) }];
    });
  }

  function updateQty(cartId: string, delta: number) {
    setCart(prev => prev.map(item => {
      if (item.cartId === cartId) {
        return { ...item, qty: Math.max(0, item.qty + delta) };
      }
      return item;
    }).filter(item => item.qty > 0));
  }

  async function submitOrder() {
    if (!tableNumber) {
      alert('Please enter a table number');
      return;
    }
    if (cart.length === 0) return;

    setSubmitting(true);
    try {
      const payload = {
        items: cart.map(item => ({
          product_id: item.id,
          product_code: item.code,
          product_name: item.name,
          quantity: item.qty,
          unit_price: item.price,
          options: item.options
        })),
        table_number: tableNumber,
        pax: parseInt(pax) || 1
      };

      const res = await axios.post('/api/customer/orders', payload);
      setOrderPlaced(res.data.data);
      setCart([]);
      setShowCart(false);
    } catch (e) {
      console.error(e);
      alert('Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <Utensils className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Order Placed!</h1>
        <p className="text-neutral-600 mb-8">
          Your order #{orderPlaced.number} has been sent to the kitchen.
        </p>
        <button 
          onClick={() => setOrderPlaced(null)}
          className="bg-primary-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-primary-700 transition-colors"
        >
          Order More
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* Header */}
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-bold text-lg">Menu</h1>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowWelcome(true)}
              className="flex items-center gap-2 bg-neutral-100 px-3 py-1.5 rounded-lg text-sm text-neutral-600"
            >
              <span className="font-bold">T{tableNumber || '?'}</span>
              <span className="w-px h-4 bg-neutral-300"></span>
              <span className="font-bold">{pax} Pax</span>
            </button>
          </div>
        </div>
        
        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button 
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === 'all' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat.id ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <div className="p-4 grid grid-cols-1 xs:grid-cols-2 gap-4">
        {filteredProducts.map(product => (
          <div key={product.id} className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-100 flex flex-col">
            {product.image_url && (
              <div className="h-32 bg-neutral-100 rounded-xl mb-3 overflow-hidden">
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
              </div>
            )}
            <h3 className="font-bold text-neutral-900 mb-1">{product.name}</h3>
            <p className="text-sm text-neutral-500 mb-3 line-clamp-2">{product.code}</p>
            <div className="mt-auto flex items-center justify-between">
              <span className="font-bold text-primary-600">{formatCurrency(product.price)}</span>
              <button 
                onClick={() => addToCart(product)}
                className="w-8 h-8 bg-neutral-900 text-white rounded-full flex items-center justify-center hover:bg-neutral-800 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-6 left-6 right-6 z-20">
          <button 
            onClick={() => setShowCart(true)}
            className="w-full bg-neutral-900 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between ring-2 ring-white/20"
          >
            <div className="flex items-center gap-3">
              <div className="bg-primary-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                {cartCount}
              </div>
              <span className="font-bold">View Order</span>
            </div>
            <span className="font-bold text-lg">{formatCurrency(cartTotal)}</span>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="text-xl font-bold">Your Order</h2>
              <button onClick={() => setShowCart(false)} className="p-2 hover:bg-neutral-100 rounded-full">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {cart.map(item => (
                <div key={item.cartId} className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-neutral-900">{item.name}</h4>
                    <p className="text-primary-600 text-sm font-medium">{formatCurrency(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-3 bg-neutral-100 rounded-lg p-1">
                    <button 
                      onClick={() => updateQty(item.cartId, -1)}
                      className="w-8 h-8 bg-white rounded-md shadow-sm flex items-center justify-center text-neutral-600"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-bold w-4 text-center">{item.qty}</span>
                    <button 
                      onClick={() => updateQty(item.cartId, 1)}
                      className="w-8 h-8 bg-white rounded-md shadow-sm flex items-center justify-center text-neutral-600"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-neutral-100 bg-neutral-50 space-y-4">
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(cartTotal)}</span>
              </div>
              <button 
                onClick={submitOrder}
                disabled={submitting || !tableNumber}
                className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? 'Sending...' : 'Place Order'}
                {!submitting && <ChevronRight className="w-5 h-5" />}
              </button>
              {!tableNumber && (
                <p className="text-red-500 text-sm text-center">Please enter your table number above</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Welcome Modal */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Utensils className="w-8 h-8 text-primary-600" />
              </div>
              <h2 className="text-2xl font-bold text-neutral-900">Welcome!</h2>
              <p className="text-neutral-500">Please enter your table details to start ordering.</p>
            </div>

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-2">Table Number</label>
                <input 
                  type="text" 
                  value={tableNumber}
                  onChange={e => setTableNumber(e.target.value)}
                  className="w-full bg-neutral-100 border-none rounded-xl p-4 font-bold text-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g. 5"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-2">Number of Guests (Pax)</label>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setPax(String(Math.max(1, (parseInt(pax) || 1) - 1)))}
                    className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center hover:bg-neutral-200"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <input 
                    type="number" 
                    value={pax}
                    onChange={e => setPax(e.target.value)}
                    className="flex-1 bg-neutral-100 border-none rounded-xl p-4 font-bold text-lg text-center focus:ring-2 focus:ring-primary-500"
                  />
                  <button 
                    onClick={() => setPax(String((parseInt(pax) || 1) + 1))}
                    className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center hover:bg-neutral-200"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <button 
              onClick={() => {
                if (tableNumber) setShowWelcome(false);
              }}
              disabled={!tableNumber}
              className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Start Ordering
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
