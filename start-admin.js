#!/usr/bin/env node
/**
 * Agentic RevOps Admin Dashboard Launcher
 * Starts the admin interface and provides system status
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         AGENTIC REVENUE OPERATIONS ADMIN DASHBOARD           ║
║                  Starting Management Interface                ║
╚═══════════════════════════════════════════════════════════════╝
`);

console.log('🚀 Launching Admin Dashboard...\n');

// Check if web directory exists
const webDir = path.join(__dirname, 'src', 'web');
if (!fs.existsSync(webDir)) {
    console.error('❌ Web directory not found:', webDir);
    process.exit(1);
}

// Start the admin server
const serverScript = path.join(webDir, 'server.js');
console.log('📊 Starting admin server...');

const adminServer = spawn('node', [serverScript], {
    cwd: webDir,
    stdio: 'inherit'
});

adminServer.on('error', (error) => {
    console.error('❌ Failed to start admin server:', error);
    process.exit(1);
});

adminServer.on('close', (code) => {
    console.log(`\n📊 Admin server exited with code ${code}`);
    process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down admin dashboard...');
    adminServer.kill('SIGINT');
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Terminating admin dashboard...');
    adminServer.kill('SIGTERM');
});

// Display startup information
setTimeout(() => {
    console.log('\n📱 Admin Dashboard Information:');
    console.log('   🌐 URL: http://localhost:3000');
    console.log('   📊 Features: System monitoring, integration management, settings');
    console.log('   🔧 API: http://localhost:3000/api');
    console.log('   ❤️  Health: http://localhost:3000/health');
    console.log('\n📋 Available Interfaces:');
    console.log('   • Main Dashboard: http://localhost:3000');
    console.log('   • Integration Setup: http://localhost:3000/integration-setup.html');
    console.log('   • HITL Interface: http://localhost:3000/../demo-hitl-interface.html');
    console.log('\n💡 Use Ctrl+C to stop the server');
}, 2000);