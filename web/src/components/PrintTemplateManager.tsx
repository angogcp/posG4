import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, FileText, Eye, Download, Upload, Save, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PrintTemplate {
  id: number;
  name: string;
  type: 'receipt' | 'kitchen' | 'bar' | 'report';
  content: string;
  variables: string[];
  paper_width: number;
  font_size: 'small' | 'medium' | 'large';
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplateFormData {
  name: string;
  type: 'receipt' | 'kitchen' | 'bar' | 'report';
  content: string;
  paper_width: number;
  font_size: 'small' | 'medium' | 'large';
  is_default: boolean;
}

const PrintTemplateManager: React.FC = () => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<PrintTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PrintTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<PrintTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    type: 'receipt',
    content: '',
    paper_width: 80,
    font_size: 'medium',
    is_default: false
  });

  // 模板变量选项
  const templateVariables = {
    receipt: [
      '{store_name}', '{store_address}', '{store_phone}',
      '{order_number}', '{date}', '{time}', '{cashier}',
      '{items}', '{subtotal}', '{discount}', '{tax}', '{total}',
      '{payment_method}', '{paid_amount}', '{change}', '{footer}'
    ],
    kitchen: [
      '{order_number}', '{date}', '{time}', '{table_number}',
      '{items}', '{special_instructions}', '{priority}', '{estimated_time}'
    ],
    bar: [
      '{order_number}', '{date}', '{time}', '{table_number}',
      '{drinks}', '{garnish}', '{priority}', '{special_instructions}'
    ],
    report: [
      '{report_title}', '{date_range}', '{total_sales}', '{order_count}',
      '{top_products}', '{payment_summary}', '{staff_performance}', '{footer}'
    ]
  };

  // 默认模板内容
  const defaultTemplates = {
    receipt: `================================
{store_name}
{store_address}
{store_phone}
================================
订单号: {order_number}
日期: {date} {time}
收银员: {cashier}
================================
{items}
--------------------------------
小计: {subtotal}
折扣: {discount}
税额: {tax}
总计: {total}
--------------------------------
支付方式: {payment_method}
实收: {paid_amount}
找零: {change}
================================
{footer}
================================`,
    kitchen: `==== 厨房订单 ====
订单号: {order_number}
时间: {date} {time}
桌号: {table_number}
==================
{items}
==================
备注: {special_instructions}
优先级: {priority}
预计时间: {estimated_time}
==================`,
    bar: `==== 酒水订单 ====
订单号: {order_number}
时间: {date} {time}
桌号: {table_number}
==================
{drinks}
==================
装饰: {garnish}
优先级: {priority}
备注: {special_instructions}
==================`,
    report: `================================
{report_title}
================================
报表时间: {date_range}
================================
总销售额: {total_sales}
订单数量: {order_count}
================================
热销产品:
{top_products}
================================
支付汇总:
{payment_summary}
================================
员工绩效:
{staff_performance}
================================
{footer}
================================`
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/print/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingTemplate 
        ? `/api/print/templates/${editingTemplate.id}`
        : '/api/print/templates';
      const method = editingTemplate ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchTemplates();
        resetForm();
        alert(editingTemplate ? '模板更新成功' : '模板创建成功');
      } else {
        alert('操作失败，请重试');
      }
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('操作失败，请重试');
    }
  };

  const handleEdit = (template: PrintTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      type: template.type,
      content: template.content,
      paper_width: template.paper_width,
      font_size: template.font_size,
      is_default: template.is_default
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个模板吗？')) return;
    
    try {
      const response = await fetch(`/api/print/templates/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchTemplates();
        alert('模板删除成功');
      } else {
        alert('删除失败，请重试');
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('删除失败，请重试');
    }
  };

  const handlePreview = (template: PrintTemplate) => {
    setPreviewTemplate(template);
    setShowPreview(true);
  };

  const handleClone = (template: PrintTemplate) => {
    setEditingTemplate(null);
    setFormData({
      name: `${template.name} - 副本`,
      type: template.type,
      content: template.content,
      paper_width: template.paper_width,
      font_size: template.font_size,
      is_default: false
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'receipt',
      content: '',
      paper_width: 80,
      font_size: 'medium',
      is_default: false
    });
    setEditingTemplate(null);
    setShowForm(false);
  };

  const insertVariable = (variable: string) => {
    const textarea = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = formData.content.substring(0, start) + variable + formData.content.substring(end);
      setFormData({ ...formData, content: newContent });
      
      // 重新设置光标位置
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + variable.length;
        textarea.focus();
      }, 0);
    }
  };

  const loadDefaultTemplate = () => {
    const defaultContent = defaultTemplates[formData.type];
    setFormData({ ...formData, content: defaultContent });
  };

  const exportTemplate = (template: PrintTemplate) => {
    const dataStr = JSON.stringify(template, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `template_${template.name}_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-800">打印模板管理</h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建模板
        </button>
      </div>

      {/* Template Form */}
      {showForm && (
        <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h3 className="text-lg font-medium mb-4">
            {editingTemplate ? '编辑模板' : '创建模板'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  模板名称 *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="输入模板名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  模板类型 *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="receipt">收银小票</option>
                  <option value="kitchen">厨房订单</option>
                  <option value="bar">酒水订单</option>
                  <option value="report">报表打印</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  纸张宽度
                </label>
                <select
                  value={formData.paper_width}
                  onChange={(e) => setFormData({ ...formData, paper_width: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={58}>58mm</option>
                  <option value={80}>80mm</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  字体大小
                </label>
                <select
                  value={formData.font_size}
                  onChange={(e) => setFormData({ ...formData, font_size: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="small">小号</option>
                  <option value="medium">中号</option>
                  <option value="large">大号</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  模板内容 *
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={loadDefaultTemplate}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    加载默认模板
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <textarea
                    name="content"
                    required
                    rows={15}
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="输入模板内容，使用 {变量名} 格式插入动态内容"
                  />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">可用变量：</div>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {templateVariables[formData.type].map((variable) => (
                      <button
                        key={variable}
                        type="button"
                        onClick={() => insertVariable(variable)}
                        className="block w-full text-left px-2 py-1 text-xs bg-gray-100 hover:bg-blue-100 rounded font-mono"
                      >
                        {variable}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_default}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                className="mr-2"
              />
              <label className="text-sm text-gray-700">
                设为该类型的默认模板
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4 inline mr-2" />
                {editingTemplate ? '更新' : '创建'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Templates List */}
      <div className="space-y-4">
        {templates.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>还没有打印模板</p>
          </div>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-medium text-gray-900">{template.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        {template.type === 'receipt' ? '收银小票' : 
                         template.type === 'kitchen' ? '厨房订单' :
                         template.type === 'bar' ? '酒水订单' : '报表打印'}
                      </span>
                      {template.is_default && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                          默认
                        </span>
                      )}
                      {!template.is_active && (
                        <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                          已禁用
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    纸张宽度: {template.paper_width}mm | 字体: {template.font_size === 'small' ? '小号' : template.font_size === 'medium' ? '中号' : '大号'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePreview(template)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                    title="预览模板"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleClone(template)}
                    className="p-2 text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                    title="克隆模板"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => exportTemplate(template)}
                    className="p-2 text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                    title="导出模板"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(template)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    title="编辑模板"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="删除模板"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && previewTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">模板预览 - {previewTemplate.name}</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="bg-gray-100 p-4 rounded-md">
              <pre className="whitespace-pre-wrap font-mono text-sm">
                {previewTemplate.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrintTemplateManager;