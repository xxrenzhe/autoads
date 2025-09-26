"use client";
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function AdminConsolePage() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [sub, setSub] = useState<any>(null);
  const [amount, setAmount] = useState(10);
  const [txLimit, setTxLimit] = useState(10);
  const [newRole, setNewRole] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      qs.set('limit', String(limit)); qs.set('offset', String(offset));
      if (q) qs.set('q', q); if (role) qs.set('role', role);
      const res = await fetch(`/api/console/users?${qs.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch { toast.error('加载用户失败'); } finally { setLoading(false); }
  };
  const openDetail = async (id: string) => {
    try {
      setSelected(null); setSub(null);
      const [d, s, t] = await Promise.all([
        fetch(`/api/console/users/${id}`, { cache: 'no-store' }).then(r=>r.json()),
        fetch(`/api/console/users/${id}/subscription`, { cache: 'no-store' }).then(r=>r.ok?r.json():null),
        fetch(`/api/console/users/${id}/tokens?limit=${txLimit}`, { cache: 'no-store' }).then(r=>r.ok?r.json():null)
      ]);
      setSelected(d); setSub({ ...(s||{}), tokens: t || {} });
    } catch { toast.error('加载详情失败'); }
  }
  const recharge = async (id: string) => {
    try {
      if (!window.confirm(`确认为用户 ${id} 充值 ${amount} Token 吗？`)) return;
      const res = await fetch(`/api/console/users/${id}/tokens`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ amount }) });
      if (res.ok) { toast.success('充值成功'); await openDetail(id) } else toast.error('充值失败');
    } catch { toast.error('充值失败'); }
  }
  const updateRole = async (id: string) => {
    try {
      if (!newRole) { toast.error('请选择角色'); return }
      if (!window.confirm(`确认为用户 ${id} 设置角色为 ${newRole} 吗？`)) return;
      const res = await fetch(`/api/console/users/${id}/role`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ role: newRole }) })
      if (res.ok) { toast.success('角色已更新'); await openDetail(id) } else toast.error('更新失败');
    } catch { toast.error('更新失败') }
  }
  useEffect(()=>{ fetchUsers() },[])

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Admin Console（最小）</h1>
      <div className="flex items-center gap-2">
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="搜索 email/name" className="border rounded px-2 py-1" />
        <select value={role} onChange={(e)=>setRole(e.target.value)} className="border rounded px-2 py-1">
          <option value="">全部角色</option>
          <option value="ADMIN">ADMIN</option>
          <option value="USER">USER</option>
        </select>
        <select value={limit} onChange={(e)=>setLimit(parseInt(e.target.value))} className="border rounded px-2 py-1">
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
        <span className="text-sm text-gray-600">交易显示</span>
        <select value={txLimit} onChange={(e)=>setTxLimit(parseInt(e.target.value))} className="border rounded px-2 py-1">
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
        <button onClick={()=>{ setOffset(0); fetchUsers(); }} disabled={loading} className="border rounded px-3 py-1">搜索</button>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={()=>{ setOffset(o=> Math.max(0, o - limit)); setTimeout(fetchUsers, 0) }} className="border rounded px-3 py-1">上一页</button>
          <button onClick={()=>{ setOffset(o=> o + limit); setTimeout(fetchUsers, 0) }} className="border rounded px-3 py-1">下一页</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded p-3">
          <div className="font-medium mb-2">用户列表</div>
          <div className="max-h-80 overflow-auto text-sm">
            <table className="min-w-full text-xs">
              <thead><tr><th className="text-left px-2 py-1">email</th><th className="text-left px-2 py-1">role</th><th></th></tr></thead>
              <tbody>
                {items.map((u:any)=> (
                  <tr key={u.id} className="border-t">
                    <td className="px-2 py-1">{u.email}</td>
                    <td className="px-2 py-1">{u.role}</td>
                    <td className="px-2 py-1"><button onClick={()=>openDetail(u.id)} className="text-blue-600">详情</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="border rounded p-3">
          <div className="font-medium mb-2">用户详情 / 订阅</div>
          {selected ? (
            <div className="text-sm space-y-2">
              <div>id: <span className="font-mono">{selected.id}</span></div>
              <div>email: {selected.email}</div>
              <div>name: {selected.name}</div>
              <div>role: {selected.role}</div>
              <div>createdAt: {selected.createdAt}</div>
              <div className="mt-2">订阅：{sub ? `${sub.planName} (${sub.status})` : '无'}</div>
              <div className="mt-1">Token 余额：{sub?.tokens?.balance ?? 0}</div>
              {Array.isArray(sub?.tokens?.items) && sub.tokens.items.length>0 && (
                <div className="max-h-40 overflow-auto border rounded mt-1">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50"><tr><th className="px-2 py-1 text-left">time</th><th className="px-2 py-1 text-left">type</th><th className="px-2 py-1 text-right">amount</th></tr></thead>
                    <tbody>
                      {sub.tokens.items.map((t:any,i:number)=> (
                        <tr key={i} className="border-t">
                          <td className="px-2 py-1">{new Date(t.createdAt).toLocaleString()}</td>
                          <td className="px-2 py-1">{t.type}</td>
                          <td className="px-2 py-1 text-right">{t.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex items-center gap-2 mt-3">
                <input type="number" value={amount} onChange={(e)=>setAmount(parseInt(e.target.value||'0')||0)} className="border rounded px-2 py-1 w-24" />
                <button onClick={()=>recharge(selected.id)} className="border rounded px-3 py-1">充值 Token</button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span>角色：</span>
                <select value={newRole} onChange={(e)=>setNewRole(e.target.value)} className="border rounded px-2 py-1">
                  <option value="">选择</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="USER">USER</option>
                </select>
                <button onClick={()=>updateRole(selected.id)} className="border rounded px-3 py-1">更新角色</button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">选择左侧用户查看详情</div>
          )}
        </div>
      </div>
    </div>
  )
}
