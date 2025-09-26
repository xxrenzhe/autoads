"use client";
import React, { useEffect, useState } from 'react';
import { Layout, Card, Space, Button, InputNumber, Table, Typography } from 'antd';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

type Point = { date: string; error: number; warn: number };

export default function AdminIncidentsPage() {
  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Point[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const r = await fetch(`/api/v1/console/incidents?days=${days}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      const arr = Array.isArray(j?.days) ? j.days : [];
      setData(arr);
    } catch (e) {
      // noop
    } finally { setLoading(false) }
  };

  useEffect(()=>{ load() },[]);

  const totalError = data.reduce((a,b)=>a + (b.error||0), 0);
  const totalWarn = data.reduce((a,b)=>a + (b.warn||0), 0);

  return (
    <Layout style={{ padding: 24 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Card title="历史故障趋势（Warn/Error）">
          <Space style={{ marginBottom: 8 }} wrap>
            <span>天数</span>
            <InputNumber min={7} max={90} value={days} onChange={(v)=>setDays(Number(v)||30)} />
            <Button onClick={load} loading={loading}>刷新</Button>
            <Typography.Text type="secondary">总 Warn: {totalWarn}，总 Error: {totalError}</Typography.Text>
          </Space>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" interval={Math.ceil(Math.max(1, data.length/10))} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="warn" stroke="#f59e0b" name="Warn" />
                <Line type="monotone" dataKey="error" stroke="#ef4444" name="Error" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Table
            style={{ marginTop: 12 }}
            size="small"
            rowKey={(r:any)=>r.date}
            dataSource={data}
            columns={[
              { title: '日期', dataIndex: 'date' },
              { title: 'Warn', dataIndex: 'warn' },
              { title: 'Error', dataIndex: 'error' },
            ]}
            pagination={{ pageSize: 15 }}
          />
        </Card>
      </Space>
    </Layout>
  );
}

