"use client";
import React, { useEffect, useState } from 'react';
import { Layout, Row, Col, Card, Statistic, Space, Button, message, Typography, Table, Tag } from 'antd';

type Counters = Record<string, number>;

export default function AdminConsoleOverview() {
  const [counters, setCounters] = useState<Counters>({});
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [slo, setSlo] = useState<any>({services:{}});
  const [p95Warn, setP95Warn] = useState<number>(800);
  const [errWarn, setErrWarn] = useState<number>(1.0); // percent
  const [savingCfg, setSavingCfg] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/console/stats', { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json();
      setCounters(j.counters || {});
      setUpdatedAt(j.updatedAt || '');
      // load SLO
      try {
        const rs = await fetch('/api/v1/console/slo', { cache: 'no-store' });
        if (rs.ok) setSlo(await rs.json());
      } catch {}
      // load thresholds config
      try {
        const rc = await fetch('/api/v1/console/config/slo_thresholds', { cache: 'no-store' });
        if (rc.ok) {
          const cj = await rc.json();
          const v = cj?.value || {};
          if (typeof v.p95WarnMs === 'number') setP95Warn(v.p95WarnMs);
          if (typeof v.errWarnPercent === 'number') setErrWarn(v.errWarnPercent);
        }
      } catch {}
    } catch (e: any) {
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const items: Array<{ key: string, title: string }> = [
    { key: 'users', title: '用户数' },
    { key: 'offers', title: 'Offer数' },
    { key: 'subscriptionsActive', title: '激活订阅' },
    { key: 'tokensTotal', title: 'Token总量' },
    { key: 'notifications24h', title: '近24h通知' },
    { key: 'siterankAnalyses', title: 'Siterank分析数' },
    { key: 'batchopenTasks', title: 'Batchopen任务数' },
    { key: 'events', title: '事件总数' },
  ];

  return (
    <Layout style={{ padding: 24 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
          <Typography.Title level={3} style={{ margin: 0 }}>管理仪表盘（Ant Design）</Typography.Title>
          <Space>
            <Typography.Text type="secondary">{updatedAt ? `更新于 ${new Date(updatedAt).toLocaleString()}` : ''}</Typography.Text>
            <Button onClick={load} loading={loading}>刷新</Button>
          </Space>
        </Space>

        <Row gutter={[16, 16]}>
          {items.map((it) => (
            <Col xs={24} sm={12} md={8} lg={6} key={it.key}>
              <Card>
                <Statistic title={it.title} value={typeof counters[it.key] === 'number' ? counters[it.key] : '-'} />
              </Card>
            </Col>
          ))}
        </Row>

        <Card title="SLO 指标（P95 与错误率）">
          <Space style={{ marginBottom: 8 }} wrap>
            <span className="text-gray-600">告警阈值：</span>
            <span>P95(ms)</span>
            <input type="number" value={p95Warn} onChange={e=>setP95Warn(parseInt(e.target.value)||0)} className="border rounded px-2 py-1 w-24" />
            <span>错误率(%)</span>
            <input type="number" value={errWarn} onChange={e=>setErrWarn(parseFloat(e.target.value)||0)} className="border rounded px-2 py-1 w-24" />
            <Button onClick={async ()=>{
              try {
                setSavingCfg(true);
                const body = { value: { p95WarnMs: p95Warn, errWarnPercent: errWarn } };
                const r = await fetch('/api/v1/console/config/slo_thresholds', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
                if (!r.ok) throw new Error(await r.text());
                message.success('阈值已保存');
              } catch (e:any) { message.error(e?.message||'保存失败') } finally { setSavingCfg(false) }
            }} loading={savingCfg}>保存</Button>
          </Space>
          <Table
            size="small"
            rowKey={(r:any)=>r.name}
            dataSource={Object.entries(slo.services||{}).map(([name, d]: any)=>({ name, ...(d||{}) }))}
            columns={[
              { title: '服务', dataIndex: 'name' },
              { title: 'P95', dataIndex: 'p95', render: (v:number)=> {
                if (!v) return '-';
                const color = v>=p95Warn? 'red' : (v>=(p95Warn*0.75)? 'orange':'green');
                return <Tag color={color}>{`${v.toFixed(0)} ms`}</Tag>
              } },
              { title: '请求数', dataIndex: 'total' },
              { title: '错误率', dataIndex: 'errorRate', render: (v:number)=> {
                const pct = v*100; const color = pct>=errWarn? 'red': (pct>=(errWarn*0.5)? 'orange':'green');
                return <Tag color={color}>{isFinite(pct)? pct.toFixed(2):'0.00'}%</Tag>
              }},
              { title: '阶段耗时（siterank）', dataIndex: 'notes', render: (n:any)=> {
                if (!n) return '-';
                const parts = [] as string[];
                if (n.resolve_nav_p95_ms) parts.push(`resolve≈${Math.round(n.resolve_nav_p95_ms)}ms`);
                if (n.sw_fetch_p95_ms) parts.push(`sw≈${Math.round(n.sw_fetch_p95_ms)}ms`);
                if (n.ai_score_p95_ms) parts.push(`ai≈${Math.round(n.ai_score_p95_ms)}ms`);
                return parts.length? parts.join(' / '): '-';
              }},
              { title: '健康', dataIndex: 'name', render: (name:string)=> {
                const healthMap:any = { adscenter: '/api/health/adscenter', console: '/api/health/console' };
                const path = healthMap[name];
                if (!path) return '-';
                return <Button size="small" onClick={async ()=>{ try{ const r = await fetch(path); message.info(`${name} ${r.status}`) } catch(e:any){ message.error(e?.message||'failed') } }}>检查</Button>
              }},
            ]}
            pagination={false}
          />
        </Card>
      </Space>
    </Layout>
  );
}
