import React, { useEffect, useState } from 'react';
import { Download, Edit2, FileText, Search, Trash2, Upload } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiClient } from '@/services/api';
import type { Customer, DocumentCategory, DocumentRecord, PagedResult, Project } from '@/types/api';
import { formatBytes, formatDate } from '@/utils/format';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Textarea,
} from '@/components/ui/Primitives';

const CATEGORIES: DocumentCategory[] = ['Contract', 'Proposal', 'Invoice', 'Receipt', 'Report', 'Deliverable', 'Other'];

export function DocumentsPage() {
  const { activeOrg } = useAuth();
  const toast = useToast();

  const [data, setData] = useState<PagedResult<DocumentRecord> | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<DocumentCategory>('Contract');
  const [customerId, setCustomerId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  const [renaming, setRenaming] = useState<DocumentRecord | null>(null);
  const [renameForm, setRenameForm] = useState({ fileName: '', category: 'Other' as DocumentCategory, description: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [docRes, custRes, projRes] = await Promise.all([
        apiClient.get<PagedResult<DocumentRecord>>('/documents', { page, pageSize: 15, search, category: categoryFilter || undefined }),
        apiClient.get<PagedResult<Customer>>('/customers', { page: 1, pageSize: 100 }),
        apiClient.get<PagedResult<Project>>('/projects', { page: 1, pageSize: 100 }),
      ]);
      setData(docRes);
      setCustomers(custRes.items);
      setProjects(projRes.items);
    } catch (err: any) {
      toast.error('Failed to load documents', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, search, categoryFilter, activeOrg?.organizationId]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', category);
      if (customerId) fd.append('customerId', customerId);
      if (projectId) fd.append('projectId', projectId);
      if (description) fd.append('description', description);

      await apiClient.upload('/documents', fd);
      toast.success('Document uploaded securely');
      setUploadOpen(false);
      setFile(null);
      setDescription('');
      load();
    } catch (err: any) {
      toast.error('Upload failed', err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renaming) return;
    try {
      await apiClient.put(`/documents/${renaming.id}`, renameForm);
      toast.success('Document updated');
      setRenaming(null);
      load();
    } catch (err: any) {
      toast.error('Update failed', err.message);
    }
  };

  const handleDelete = async (d: DocumentRecord) => {
    if (!window.confirm(`Delete "${d.fileName}"?`)) return;
    await apiClient.delete(`/documents/${d.id}`);
    toast.success('Document deleted');
    load();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Document Center"
        subtitle="Store contracts, proposals, receipts, and deliverables with tenant-isolated access."
        actions={
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" />
            Upload Document
          </Button>
        }
      />

      <Card padding={false}>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
              placeholder="Search file name..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <Select value={categoryFilter} onChange={(e) => { setPage(1); setCategoryFilter(e.target.value); }} className="w-44">
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>

        {loading ? (
          <div className="p-4"><LoadingState rows={4} /></div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title="No documents uploaded"
              description="Upload PDFs, spreadsheets, images, or archives up to 15 MB."
              action={<Button size="sm" onClick={() => setUploadOpen(true)}><Upload className="h-3.5 w-3.5" /> Upload Document</Button>}
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/60">
                  <tr>
                    <th className="px-4 py-3 font-medium">File</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Linked To</th>
                    <th className="hidden px-4 py-3 font-medium sm:table-cell">Size</th>
                    <th className="hidden px-4 py-3 font-medium lg:table-cell">Uploaded</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.items.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 dark:text-white">{d.fileName}</p>
                        {d.description && <p className="text-xs text-slate-500">{d.description}</p>}
                      </td>
                      <td className="px-4 py-3"><Badge>{d.category}</Badge></td>
                      <td className="hidden px-4 py-3 text-xs text-slate-500 md:table-cell">
                        {[d.customerName, d.projectName].filter(Boolean).join(' · ') || 'Workspace'}
                      </td>
                      <td className="hidden px-4 py-3 font-mono-num text-xs text-slate-500 sm:table-cell">{formatBytes(d.fileSizeBytes)}</td>
                      <td className="hidden px-4 py-3 text-xs text-slate-500 lg:table-cell">{formatDate(d.createdAtUtc)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => apiClient.downloadBlob(`/documents/${d.id}/download`, d.fileName)}
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Download"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setRenaming(d);
                              setRenameForm({ fileName: d.fileName, category: d.category, description: d.description || '' });
                            }}
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Rename / Edit"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDelete(d)} className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={setPage} />
          </>
        )}
      </Card>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Document">
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Select File (PDF, Office, Image, CSV, ZIP — max 15 MB) *</label>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} required className="mt-1.5 block w-full text-xs text-slate-600" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select label="Customer (optional)" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">None</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <Select label="Project (optional)" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">None</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Textarea label="Description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button type="submit" loading={uploading}>Upload</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Edit Document Metadata">
        <form onSubmit={handleRename} className="space-y-4">
          <Input label="File Name *" value={renameForm.fileName} onChange={(e) => setRenameForm({ ...renameForm, fileName: e.target.value })} required />
          <Select label="Category" value={renameForm.category} onChange={(e) => setRenameForm({ ...renameForm, category: e.target.value as DocumentCategory })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Textarea label="Description" rows={2} value={renameForm.description} onChange={(e) => setRenameForm({ ...renameForm, description: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
