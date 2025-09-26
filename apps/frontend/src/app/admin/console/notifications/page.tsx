"use client";
import React, { useEffect, useState } from 'react';
import { Layout, Card, Space, Button, Table, Form, Input, Select, Switch, message, Typography } from 'antd';

type Rule = { id?: string; eventType: string; channel: string; enabled: boolean; createdAt?: string; updatedAt?: string };
type Notification = { id: string; type?: string; title?: string; message?: string; createdAt?: string };

export default function AdminNotificationsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [form] = Form.useForm();
  const [recent, setRecent] = useState<Notification[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const loadRules = async () => {
    try {
      setLoadingRules(true);
      const r = await fetch('/api/v1/notifications/rules', { cache: 'no-store' });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      const items = Array.isArray(j.items) ? j.items : [];
      setRules(items.map((x: any) => ({ id: String(x.id ?? ''), eventType: x.eventType || x.event_type, channel: x.channel, enabled: !!x.enabled, createdAt: x.createdAt || x.created_at, updatedAt: x.updatedAt || x.updated_at })));
    } catch (e: any) {
      message.error(e?.message || '加载规则失败');
    } finally { setLoadingRules(false) }
  };

  const upsertRule = async () => {
    try {
      const v = await form.validateFields();
      const body = { eventType: v.eventType, channel: v.channel, enabled: !!v.enabled };
      const r = await fetch('/api/v1/notifications/rules', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      message.success('已保存');
      form.resetFields();
      await loadRules();
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    }
  };

  const loadRecent = async () => {
    try {
      setLoadingRecent(true);
      const r = await fetch('/api/v1/notifications/recent?limit=50', { cache: 'no-store' });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      const items = Array.isArray(j.items) ? j.items : Array.isArray(j) ? j : [];
      setRecent(items.map((x: any) => ({ id: String(x.id ?? ''), type: x.type, title: x.title, message: x.message, createdAt: x.createdAt || x.time })));
    } catch (e: any) {
      message.error(e?.message || '加载通知失败');
    } finally { setLoadingRecent(false) }
  };

  const markAllRead = async () => {
    try {
      if (!recent.length) return;
      const lastId = String(recent[0]?.id || recent[recent.length - 1]?.id || '');
      if (!lastId) return;
      const r = await fetch('/api/v1/notifications/read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lastId }) });
      if (!r.ok) throw new Error(await r.text());
      message.success('已标记至最新已读');
      await loadRecent();
    } catch (e: any) {
      message.error(e?.message || '标记失败');
    }
  };

  useEffect(() => { loadRules(); loadRecent(); }, []);

  return (
    <Layout style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card title="通知规则">
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Form form={form} layout="inline" onFinish={upsertRule}>
              <Form.Item name="eventType" label="事件类型" rules={[{ required: true, message: '必填' }]}>
                <Input placeholder="如 SiterankCompleted" style={{ width: 240 }} />
              </Form.Item>
              <Form.Item name="channel" label="渠道" initialValue="inapp" rules={[{ required: true }]}>
                <Select style={{ width: 160 }} options={[{value:'inapp',label:'inapp'}]} />
              </Form.Item>
              <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={true}>
                <Switch />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">保存/更新</Button>
              </Form.Item>
            </Form>

            <Table rowKey={(r)=>r.id || `${r.eventType}-${r.channel}`}
              loading={loadingRules}
              dataSource={rules}
              size="small"
              columns={[
                { title: 'Event', dataIndex: 'eventType' },
                { title: 'Channel', dataIndex: 'channel' },
                { title: 'Enabled', dataIndex: 'enabled', render: (v:boolean)=> v? '✅':'❌' },
                { title: 'Created', dataIndex: 'createdAt' },
                { title: 'Updated', dataIndex: 'updatedAt' },
              ]}
            />
          </Space>
        </Card>

        <Card title="最近通知">
          <Space style={{ marginBottom: 8 }}>
            <Button onClick={loadRecent} loading={loadingRecent}>刷新</Button>
            <Button onClick={markAllRead}>标记至最新已读</Button>
          </Space>
          <Table rowKey={(r)=>r.id} size="small" loading={loadingRecent} dataSource={recent}
            columns={[
              { title: 'ID', dataIndex: 'id' },
              { title: 'Type', dataIndex: 'type' },
              { title: 'Title', dataIndex: 'title' },
              { title: 'Message', dataIndex: 'message' },
              { title: 'Time', dataIndex: 'createdAt', render: (v)=> v? new Date(v).toLocaleString():'' },
            ]}
          />
          <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>仅显示最近 50 条（当前用户维度）。</Typography.Paragraph>
        </Card>
      </Space>
    </Layout>
  );
}

