import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, ShoppingCart, Package, Truck } from 'lucide-react';
import { supabase, OPME, Supplier } from '../lib/supabase';

export default function OPMEs() {
  const [opmes, setOpmes] = useState<OPME[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingOpme, setEditingOpme] = useState<OPME | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    supplier_id: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [opmesResult, suppliersResult] = await Promise.all([
        supabase
          .from('opmes')
          .select(`
            *,
            supplier:suppliers(*)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('suppliers')
          .select('*')
          .order('name')
      ]);

      if (opmesResult.error) throw opmesResult.error;
      if (suppliersResult.error) throw suppliersResult.error;

      setOpmes(opmesResult.data || []);
      setSuppliers(suppliersResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Prepare data with empty strings converted to null for optional fields
      const submitData = {
        name: formData.name,
        brand: formData.brand || null,
        supplier_id: formData.supplier_id || null,
      };

      if (editingOpme) {
        const { error } = await supabase
          .from('opmes')
          .update(submitData)
          .eq('id', editingOpme.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('opmes')
          .insert([submitData]);
        if (error) throw error;
      }

      setShowModal(false);
      setEditingOpme(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleEdit = (opme: OPME) => {
    setEditingOpme(opme);
    setFormData({
      name: opme.name,
      brand: opme.brand || '',
      supplier_id: opme.supplier_id || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este material OPME?')) return;

    try {
      const { error } = await supabase
        .from('opmes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      brand: '',
      supplier_id: '',
    });
  };

  const filteredOpmes = opmes.filter(opme =>
    opme.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (opme.brand && opme.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (opme.supplier?.name && opme.supplier.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Materiais OPME</h1>
          <p className="text-gray-600 mt-2">Gerencie os materiais OPME (Órteses, Próteses e Materiais Especiais)</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-600 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Novo Material
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome, marca ou fornecedor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* OPMEs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOpmes.map((opme) => (
          <div key={opme.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-teal-600" />
                </div>
                <div className="ml-3">
                  <h3 className="font-semibold text-gray-900">{opme.name}</h3>
                  {opme.brand && (
                    <p className="text-sm text-gray-600">Marca: {opme.brand}</p>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(opme)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(opme.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center text-gray-600">
                <Package className="h-4 w-4 mr-2" />
                <span><strong>Material:</strong> {opme.name}</span>
              </div>
              {opme.supplier && (
                <div className="flex items-center text-gray-600">
                  <Truck className="h-4 w-4 mr-2" />
                  <span><strong>Fornecedor:</strong> {opme.supplier.name}</span>
                </div>
              )}
              <div className="text-gray-600">
                <strong>Criado em:</strong> {new Date(opme.created_at).toLocaleDateString('pt-BR')}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredOpmes.length === 0 && (
        <div className="text-center py-12">
          <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Nenhum material OPME encontrado</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                {editingOpme ? 'Editar Material OPME' : 'Novo Material OPME'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do Material *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Parafuso de Titânio"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Marca
                  </label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Synthes, Stryker (opcional)"
                  />
                  <p className="text-xs text-gray-500 mt-1">Campo opcional</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fornecedor
                  </label>
                  <select
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Selecione um fornecedor (opcional)</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Campo opcional</p>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingOpme(null);
                      resetForm();
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    {editingOpme ? 'Atualizar' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}