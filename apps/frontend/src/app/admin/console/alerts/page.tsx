"use client";
import React, { useEffect, useState } from 'react';
import { Layout, Card, Space, Button, Table, Tag, Select, InputNumber, message } from 'antd';

type AlertItem = { id: string; userId: string; type: string; title: string; severity: string; category: string; summary: string; createdAt: string };

export default function AdminAlertsPage() {
  const [items, setItems] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [level, setLevel] = useState<string | undefined>();
  const [since, setSince] = useState<number>(168);
  const [limit, setLimit] = useState<number>(200);

  const load = async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      if (level) qs.set('level', level);
      if (since) qs.set('sinceHours', String(since));
      if (limit) qs.set('limit', String(limit));
      const r = await fetch(`/api/v1/console/alerts?${qs.toString()}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      const arr = Array.isArray(j?.items) ? j.items : [];
      setItems(arr);
    } catch (e:any) { message.error(e?.message || '加载失败') } finally { setLoading(false) }
  };

  const exportCSV = () => {
    let csv = 'id,level,category,type,title,summary,createdAt\n';
    items.forEach(it => {
      csv += [it.id, it.severity, it.category, it.type, it.title, it.summary, it.createdAt].map(v => JSON.stringify(v??'')).join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'alerts.csv'; a.click(); URL.revokeObjectURL(a.href);
  };

  useEffect(()=>{ load() },[]);

  return (
    <Layout style={{ padding: 24 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Card title="告警列表">
          <Space style={{ marginBottom: 8 }} wrap>
            <span>级别</span>
            <Select allowClear value={level} onChange={setLevel} style={{ width: 140 }} options={[{value:'error',label:'error'},{value:'warn',label:'warn'}]} />
            <span>时间(h)</span>
            <InputNumber min={1} max={2160} value={since} onChange={(v)=>setSince(Number(v)||168)} />
            <span>数量</span>
            <InputNumber min={1} max={1000} value={limit} onChange={(v)=>setLimit(Number(v)||200)} />
            <Button onClick={load} loading={loading}>刷新</Button>
            <Button onClick={exportCSV} disabled={!items.length}>导出CSV</Button>
          </Space>
          <Table
            size="small"
            rowKey={(r:any)=>r.id}
            dataSource={items}
            columns={[
              { title: '时间', dataIndex: 'createdAt', render: (v:string)=> v? new Date(v).toLocaleString():'' },
              { title: '级别', dataIndex: 'severity', render: (v:string)=> <Tag color={v==='error'?'red':(v==='warn'?'orange':'default')}>{v||'-'}</Tag> },
              { title: '分类', dataIndex: 'category' },
              { title: '类型', dataIndex: 'type' },
              { title: '标题', dataIndex: 'title' },
              { title: '摘要', dataIndex: 'summary' },
              { title: '用户', dataIndex: 'userId' },
            ]}
            pagination={{ pageSize: 20 }}
          />
        </Card>
      </Space>
    </Layout>
  );
}

