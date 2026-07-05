import React from 'react';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';

export default function Layout({ children, onLogout }) {
  return (
    <div className="app-layout flex h-screen overflow-hidden bg-canvas">
      <Sidebar onLogout={onLogout} />
      <div id="sidebarBackdrop" className="fixed inset-0 bg-black/30 z-[99] opacity-0 pointer-events-none transition-opacity duration-300"></div>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0 relative">
        <Header />
        <div className="flex-1 overflow-y-auto px-6 pb-10 pt-6 max-md:px-4">
          {children}
        </div>
      </main>
    </div>
  );
}
