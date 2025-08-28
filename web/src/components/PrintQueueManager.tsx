import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, Printer, RefreshCw, X, Play, Pause, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PrintJob {
  id: number;
  printer_id: number;
  printer_name?: string;
  template_id?: number;
  job_type: 'receipt' | 'kitchen' | 'bar' | 'report' | 'test';
  priority: number;
  content: string;
  data_json?: any;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error_message?: string;
  retry_count: number;
  max_retries: number;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
}

const PrintQueueManager: React.FC = () => {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<QueueStats>({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    cancelled: 0
  });
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPrinter, setSelectedPrinter] = useState<string>('all');
  const [printers, setPrinters] = useState<Array<{ id: number; name: string }>>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchJobs();
    fetchPrinters();
    
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchJobs();
      }, 5000); // 每5秒刷新
      
      return () => clearInterval(interval);
    }
  }, [selectedStatus, selectedPrinter, autoRefresh]);

  const fetchJobs = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedStatus !== 'all') {
        params.append('status', selectedStatus);
      }
      if (selectedPrinter !== 'all') {
        params.append('printer_id', selectedPrinter);
      }
      params.append('limit', '100');

      const response = await fetch(`/api/print/queue?${params}`);
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
        
        // 计算统计信息
        const newStats: QueueStats = {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          cancelled: 0
        };
        
        data.jobs.forEach((job: PrintJob) => {
          newStats[job.status]++;
        });
        
        setStats(newStats);
      }
    } catch (error) {
      console.error('Failed to fetch print jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrinters = async () => {
    try {
      const response = await fetch('/api/print/printers');
      if (response.ok) {
        const data = await response.json();
        setPrinters(data.printers || []);
      }
    } catch (error) {
      console.error('Failed to fetch printers:', error);
    }
  };

  const cancelJob = async (jobId: number) => {
    try {
      const response = await fetch(`/api/print/queue/${jobId}/cancel`, {
        method: 'PUT'
      });
      
      if (response.ok) {
        await fetchJobs();
        alert('打印任务已取消');
      } else {
        alert('取消失败，请重试');
      }
    } catch (error) {
      console.error('Failed to cancel job:', error);
      alert('取消失败，请重试');
    }
  };

  const deleteJob = async (jobId: number) => {
    if (!confirm('确定要删除这个打印任务吗？')) return;
    
    try {
      const response = await fetch(`/api/print/queue/${jobId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await fetchJobs();
        alert('打印任务已删除');
      } else {
        alert('删除失败，请重试');
      }
    } catch (error) {
      console.error('Failed to delete job:', error);
      alert('删除失败，请重试');
    }
  };

  const addTestJob = async () => {
    if (printers.length === 0) {
      alert('没有可用的打印机');
      return;
    }

    try {
      const response = await fetch('/api/print/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          printer_id: printers[0].id,
          job_type: 'test',
          priority: 5,
          content: `================================
测试打印任务
================================
时间: ${new Date().toLocaleString('zh-CN')}
打印机: ${printers[0].name}
任务类型: 队列测试
================================
这是一个测试打印任务
用于验证打印队列功能
================================`,
          max_retries: 2
        })
      });
      
      if (response.ok) {
        await fetchJobs();
        alert('测试任务已添加到队列');
      } else {
        alert('添加测试任务失败');
      }
    } catch (error) {
      console.error('Failed to add test job:', error);
      alert('添加测试任务失败');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'processing':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'cancelled':
        return <X className="w-4 h-4 text-gray-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '等待中';
      case 'processing':
        return '打印中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      case 'cancelled':
        return '已取消';
      default:
        return '未知';
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority <= 3) return 'bg-red-100 text-red-800';
    if (priority <= 6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
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
          <Settings className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-800">打印队列管理</h2>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            自动刷新
          </label>
          <button
            onClick={fetchJobs}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            title="手动刷新"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={addTestJob}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            添加测试任务
          </button>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-yellow-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-yellow-700">等待中</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.processing}</div>
          <div className="text-sm text-blue-700">打印中</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-sm text-green-700">已完成</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          <div className="text-sm text-red-700">失败</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-600">{stats.cancelled}</div>
          <div className="text-sm text-gray-700">已取消</div>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="flex gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            状态筛选
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部状态</option>
            <option value="pending">等待中</option>
            <option value="processing">打印中</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            打印机筛选
          </label>
          <select
            value={selectedPrinter}
            onChange={(e) => setSelectedPrinter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部打印机</option>
            {printers.map((printer) => (
              <option key={printer.id} value={printer.id.toString()}>
                {printer.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="space-y-4">
        {jobs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>没有找到打印任务</p>
          </div>
        ) : (
          jobs.map((job) => (
            <div key={job.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg font-medium text-gray-900">
                      任务 #{job.id}
                    </span>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(job.status)}
                      <span className="text-sm text-gray-600">{getStatusText(job.status)}</span>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded ${getPriorityColor(job.priority)}`}>
                      优先级 {job.priority}
                    </span>
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                      {job.job_type === 'receipt' ? '收银小票' :
                       job.job_type === 'kitchen' ? '厨房订单' :
                       job.job_type === 'bar' ? '酒水订单' :
                       job.job_type === 'report' ? '报表' : '测试'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-3">
                    <div className="flex items-center gap-1">
                      <Printer className="w-4 h-4" />
                      <span>{job.printer_name || `打印机 ${job.printer_id}`}</span>
                    </div>
                    <div>
                      创建时间: {formatDateTime(job.created_at)}
                    </div>
                    <div>
                      {job.retry_count > 0 && (
                        <span className="text-amber-600">
                          重试 {job.retry_count}/{job.max_retries}
                        </span>
                      )}
                    </div>
                  </div>

                  {job.started_at && (
                    <div className="text-sm text-gray-500 mb-2">
                      开始时间: {formatDateTime(job.started_at)}
                    </div>
                  )}

                  {job.completed_at && (
                    <div className="text-sm text-green-600 mb-2">
                      完成时间: {formatDateTime(job.completed_at)}
                    </div>
                  )}

                  {job.error_message && (
                    <div className="text-sm text-red-600 bg-red-50 rounded p-2 mb-2">
                      <strong>错误信息:</strong> {job.error_message}
                    </div>
                  )}

                  <details className="text-sm">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                      查看打印内容
                    </summary>
                    <div className="mt-2 bg-gray-100 rounded p-2 font-mono text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {job.content}
                    </div>
                  </details>
                </div>

                <div className="flex flex-col gap-2">
                  {(job.status === 'pending' || job.status === 'failed') && (
                    <button
                      onClick={() => cancelJob(job.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="取消任务"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  
                  {(job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && (
                    <button
                      onClick={() => deleteJob(job.id)}
                      className="p-2 text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
                      title="删除任务"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PrintQueueManager;