"use client";
import React, { useEffect, useState } from 'react';
import { Layout, Card, Space, Button, Tag, Typography, Row, Col, message } from 'antd';

type Status = { name: string; path: string; ok: boolean | null; status?: number | null };

export default function AdminHealthPage() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Status[]>([
    { name: 'Gateway Ready', path: '/api/go/readyz', ok: null, status: null },
    { name: 'Adscenter Health', path: '/api/go/api/health/adscenter', ok: null, status: null },
    { name: 'Console Health', path: '/api/go/api/health/console', ok: null, status: null },
  ]);

  const load = async () => {
    try {
      setLoading(true);
      const out: Status[] = [];
      for (const it of items) {
        try {
          const r = await fetch(it.path, { cache: 'no-store' });
          out.push({ ...it, ok: r.ok, status: r.status });
        } catch (e) {
          out.push({ ...it, ok: false, status: null });
        }
      }
      setItems(out);
    } catch (e: any) {
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load() }, []);

  return (
    <Layout style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
          <Typography.Title level={3} style={{ margin: 0 }}>系统健康</Typography.Title>
          <Button onClick={load} loading={loading}>刷新</Button>
        </Space>
        <Row gutter={[16,16]}>
          {items.map((it, idx) => (
            <Col xs={24} sm={12} md={8} key={idx}>
              <Card title={it.name}>
                {it.ok === null ? (
                  <Tag color="default">N/A</Tag>
                ) : it.ok ? (
                  <Tag color="success">OK ({it.status})</Tag>
                ) : (
                  <Tag color="error">FAIL ({it.status ?? 'ERR'})</Tag>
                )}
                <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>{it.path}</Typography.Paragraph>
              </Card>
            </Col>
          ))}
        </Row>
      </Space>
    </Layout>
  );
}

