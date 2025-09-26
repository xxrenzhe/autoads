"use client";
import React from 'react';
import { ConfigProvider, theme } from 'antd';
import 'antd/dist/reset.css';

export default function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
      {children}
    </ConfigProvider>
  );
}

