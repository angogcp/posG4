import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, Printer, RefreshCw, X, Play, Pause, Settings, Trash2 } from 'lucide-react';
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
        return <Clock className="w-4 h-4 text-warning-500" />;
      case 'processing':
        return <RefreshCw className="w-4 h-4 text-primary-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-danger-500" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-neutral-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-neutral-500" />;
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
    if (priority <= 3) return 'bg-danger-100 text-danger-800 border border-danger-200';
    if (priority <= 6) return 'bg-warning-100 text-warning-800 border border-warning-200';
    return 'bg-success-100 text-success-800 border border-success-200';
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  if (loading) {
    return (
      <div className="card p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 rounded-xl mb-6 w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 bg-neutral-100 rounded-xl"></div>
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-neutral-100 rounded-xl"></div>
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
            <Settings className="w-6 h-6 text-primary-600" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900">打印队列管理</h2>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded text-primary-600 focus:ring-primary-500"
            />
            自动刷新
          </label>
          <button
            onClick={fetchJobs}
            className="btn btn-secondary p-2"
            title="手动刷新"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={addTestJob}
            className="btn btn-primary"
          >
            <Play className="w-4 h-4 mr-2" />
            添加测试任务
          </button>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-warning-50 border border-warning-100 text-center">
          <div className="text-2xl font-bold text-warning-600">{stats.pending}</div>
          <div className="text-sm font-medium text-warning-700">等待中</div>
        </div>
        <div className="p-4 rounded-xl bg-primary-50 border border-primary-100 text-center">
          <div className="text-2xl font-bold text-primary-600">{stats.processing}</div>
          <div className="text-sm font-medium text-primary-700">打印中</div>
        </div>
        <div className="p-4 rounded-xl bg-success-50 border border-success-100 text-center">
          <div className="text-2xl font-bold text-success-600">{stats.completed}</div>
          <div className="text-sm font-medium text-success-700">已完成</div>
        </div>
        <div className="p-4 rounded-xl bg-danger-50 border border-danger-100 text-center">
          <div className="text-2xl font-bold text-danger-600">{stats.failed}</div>
          <div className="text-sm font-medium text-danger-700">失败</div>
        </div>
        <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-center">
          <div className="text-2xl font-bold text-neutral-600">{stats.cancelled}</div>
          <div className="text-sm font-medium text-neutral-700">已取消</div>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            状态筛选
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="input w-full"
          >
            <option value="all">全部状态</option>
            <option value="pending">等待中</option>
            <option value="processing">打印中</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            打印机筛选
          </label>
          <select
            value={selectedPrinter}
            onChange={(e) => setSelectedPrinter(e.target.value)}
            className="input w-full"
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
          <div className="text-center py-12 text-neutral-500 bg-neutral-50 rounded-xl border border-neutral-200 border-dashed">
            <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">没有找到打印任务</p>
            <p className="text-sm opacity-75">当前队列为空</p>
          </div>
        ) : (
          jobs.map((job) => (
            <div key={job.id} className="p-4 rounded-xl border border-neutral-200 hover:shadow-md transition-all duration-200 bg-white group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-3 mb-2">
                    <span className="text-lg font-bold text-neutral-900">
                      #{job.id}
                    </span>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium bg-neutral-100">
                      {getStatusIcon(job.status)}
                      <span className="text-neutral-700">{getStatusText(job.status)}</span>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getPriorityColor(job.priority)}`}>
                      优先级 {job.priority}
                    </span>
                    <span className="px-2.5 py-1 text-xs font-medium bg-primary-50 text-primary-700 rounded-full border border-primary-100">
                      {job.job_type === 'receipt' ? '收银小票' :
                       job.job_type === 'kitchen' ? '厨房订单' :
                       job.job_type === 'bar' ? '酒水订单' :
                       job.job_type === 'report' ? '报表' : '测试'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-neutral-600 mb-3">
                    <div className="flex items-center gap-2">
                      <Printer className="w-4 h-4 text-neutral-400" />
                      <span className="font-medium text-neutral-700">{job.printer_name || `打印机 ${job.printer_id}`}</span>
                    </div>
                    <div>
                      创建: {formatDateTime(job.created_at)}
                    </div>
                    <div>
                      {job.retry_count > 0 && (
                        <span className="text-warning-600 font-medium flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" />
                          重试 {job.retry_count}/{job.max_retries}
                        </span>
                      )}
                    </div>
                  </div>

                  {job.started_at && (
                    <div className="text-sm text-neutral-500 mb-1">
                      开始时间: {formatDateTime(job.started_at)}
                    </div>
                  )}

                  {job.completed_at && (
                    <div className="text-sm text-success-600 mb-1 font-medium">
                      完成时间: {formatDateTime(job.completed_at)}
                    </div>
                  )}

                  {job.error_message && (
                    <div className="text-sm text-danger-600 bg-danger-50 rounded-lg p-3 mb-3 border border-danger-100">
                      <div className="font-bold flex items-center gap-2 mb-1">
                        <AlertCircle className="w-4 h-4" />
                        错误信息
                      </div>
                      {job.error_message}
                    </div>
                  )}

                  <details className="group/details">
                    <summary className="cursor-pointer text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1 select-none">
                      <span className="group-open/details:hidden">查看内容</span>
                      <span className="hidden group-open/details:inline">收起内容</span>
                    </summary>
                    <div className="mt-2 bg-neutral-900 text-neutral-50 rounded-lg p-3 font-mono text-xs whitespace-pre-wrap max-h-40 overflow-y-auto shadow-inner">
                      {job.content}
                    </div>
                  </details>
                </div>

                <div className="flex flex-col gap-2">
                  {(job.status === 'pending' || job.status === 'failed') && (
                    <button
                      onClick={() => cancelJob(job.id)}
                      className="p-2 text-danger-600 hover:bg-danger-50 rounded-xl transition-colors"
                      title="取消任务"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  )}
                  
                  {(job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && (
                    <button
                      onClick={() => deleteJob(job.id)}
                      className="p-2 text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded-xl transition-colors"
                      title="删除任务"
                    >
                      <Trash2 className="w-5 h-5" />
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