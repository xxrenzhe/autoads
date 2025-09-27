"use client";

import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

type Row = { date: string; total: number; success: number; fail: number };

export function SSRFreeChart({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="total" stroke="#8884d8" name="总数" />
        <Line type="monotone" dataKey="success" stroke="#82ca9d" name="成功" />
        <Line type="monotone" dataKey="fail" stroke="#ff6b6b" name="失败" />
      </LineChart>
    </ResponsiveContainer>
  );
}

