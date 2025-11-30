import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, FileText, Eye, Download, Upload, Save, Copy, X } from 'lucide-react';
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
      <div className="card p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 rounded-xl mb-6 w-1/3"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-neutral-100 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-50 rounded-xl">
            <FileText className="w-6 h-6 text-primary-600" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900">打印模板管理</h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          新建模板
        </button>
      </div>

      {/* Template Form */}
      {showForm && (
        <div className="mb-6 p-6 border border-neutral-200 rounded-xl bg-neutral-50">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            {editingTemplate ? '编辑模板' : '创建模板'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  模板名称 *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input w-full"
                  placeholder="输入模板名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  模板类型 *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="input w-full"
                >
                  <option value="receipt">收银小票</option>
                  <option value="kitchen">厨房订单</option>
                  <option value="bar">酒水订单</option>
                  <option value="report">报表打印</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  纸张宽度
                </label>
                <select
                  value={formData.paper_width}
                  onChange={(e) => setFormData({ ...formData, paper_width: parseInt(e.target.value) })}
                  className="input w-full"
                >
                  <option value={58}>58mm</option>
                  <option value={80}>80mm</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  字体大小
                </label>
                <select
                  value={formData.font_size}
                  onChange={(e) => setFormData({ ...formData, font_size: e.target.value as any })}
                  className="input w-full"
                >
                  <option value="small">小号</option>
                  <option value="medium">中号</option>
                  <option value="large">大号</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-neutral-700">
                  模板内容 *
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={loadDefaultTemplate}
                    className="text-sm text-primary-600 hover:text-primary-800 font-medium"
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
                    className="input w-full font-mono text-sm"
                    placeholder="输入模板内容，使用 {变量名} 格式插入动态内容"
                  />
                </div>
                <div>
                  <div className="text-sm font-medium text-neutral-700 mb-2">可用变量：</div>
                  <div className="space-y-1 max-h-80 overflow-y-auto p-2 bg-white rounded-xl border border-neutral-200">
                    {templateVariables[formData.type].map((variable) => (
                      <button
                        key={variable}
                        type="button"
                        onClick={() => insertVariable(variable)}
                        className="block w-full text-left px-3 py-2 text-xs bg-neutral-50 hover:bg-primary-50 hover:text-primary-700 rounded-lg font-mono transition-colors border border-transparent hover:border-primary-200"
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
                className="mr-2 rounded text-primary-600 focus:ring-primary-500"
              />
              <label className="text-sm text-neutral-700 select-none">
                设为该类型的默认模板
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="btn btn-primary"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingTemplate ? '更新模板' : '创建模板'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-secondary"
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
          <div className="text-center py-12 text-neutral-500 bg-neutral-50 rounded-xl border border-neutral-200 border-dashed">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">还没有打印模板</p>
            <p className="text-sm opacity-75">点击右上角新建模板</p>
          </div>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="p-4 rounded-xl border border-neutral-200 hover:shadow-md transition-all duration-200 bg-white group">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-3 mb-2">
                    <h3 className="text-lg font-bold text-neutral-900">{template.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 text-xs font-medium bg-primary-50 text-primary-700 rounded-full border border-primary-100">
                        {template.type === 'receipt' ? '收银小票' : 
                         template.type === 'kitchen' ? '厨房订单' :
                         template.type === 'bar' ? '酒水订单' : '报表打印'}
                      </span>
                      {template.is_default && (
                        <span className="px-2.5 py-1 text-xs font-medium bg-success-50 text-success-700 rounded-full border border-success-100">
                          默认
                        </span>
                      )}
                      {!template.is_active && (
                        <span className="px-2.5 py-1 text-xs font-medium bg-neutral-100 text-neutral-600 rounded-full border border-neutral-200">
                          已禁用
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-neutral-500">
                    纸张宽度: {template.paper_width}mm <span className="mx-2">|</span> 字体: {template.font_size === 'small' ? '小号' : template.font_size === 'medium' ? '中号' : '大号'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePreview(template)}
                    className="p-2 text-success-600 hover:bg-success-50 rounded-xl transition-colors"
                    title="预览模板"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleClone(template)}
                    className="p-2 text-primary-600 hover:bg-primary-50 rounded-xl transition-colors"
                    title="克隆模板"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => exportTemplate(template)}
                    className="p-2 text-warning-600 hover:bg-warning-50 rounded-xl transition-colors"
                    title="导出模板"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleEdit(template)}
                    className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors"
                    title="编辑模板"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-2 text-danger-600 hover:bg-danger-50 rounded-xl transition-colors"
                    title="删除模板"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && previewTemplate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100">
              <h3 className="text-lg font-bold text-neutral-900">模板预览 - {previewTemplate.name}</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto bg-neutral-50 flex-1">
              <div className="bg-white p-8 shadow-sm mx-auto" style={{ maxWidth: `${previewTemplate.paper_width === 58 ? '58mm' : '80mm'}`, minHeight: '200px' }}>
                <pre className="whitespace-pre-wrap font-mono text-sm text-neutral-900 leading-tight">
                  {previewTemplate.content}
                </pre>
              </div>
            </div>
            <div className="p-4 border-t border-neutral-100 bg-white flex justify-end">
               <button
                onClick={() => setShowPreview(false)}
                className="btn btn-secondary"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrintTemplateManager;