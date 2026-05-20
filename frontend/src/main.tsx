import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import 'antd/dist/reset.css';
import './styles.css';

import { Dashboard } from './pages/Dashboard';

type Language = 'en' | 'zh';
let currentLanguage: Language = (localStorage.getItem('ops-mcp-language') as Language) || 'en';

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });

function App() {
  const [language, setLanguage] = React.useState<Language>(currentLanguage);
  React.useEffect(() => { localStorage.setItem('ops-mcp-language', language); }, [language]);
  
  const locale = language === 'zh' ? zhCN : enUS;
  const theme = { token: { colorPrimary: '#1677ff', borderRadius: 10 } };

  return (
    <ConfigProvider locale={locale} theme={theme}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<div>Page not found</div>} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
