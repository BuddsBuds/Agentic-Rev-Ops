// Clients Management JavaScript
let clients = [];
let filteredClients = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadClients();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', filterClients);
    document.getElementById('statusFilter').addEventListener('change', filterClients);
    document.getElementById('sortBy').addEventListener('change', sortClients);
}

async function loadClients() {
    try {
        const response = await fetch('/api/clients');
        if (response.ok) {
            clients = await response.json();
            filteredClients = [...clients];
            displayClients();
        } else {
            // For demo purposes, show mock data
            loadMockClients();
        }
    } catch (error) {
        console.error('Error loading clients:', error);
        // For demo purposes, show mock data
        loadMockClients();
    }
}

function loadMockClients() {
    clients = [
        {
            id: '1',
            name: 'Acme Corporation',
            domain: 'https://acme.com',
            status: 'active',
            onboarding_completed: true,
            onboarding_progress: 100,
            created_at: '2024-01-15T10:00:00Z',
            metrics: {
                revenue: 2500000,
                growth: 15,
                campaigns: 5,
                social_followers: 25000
            },
            integrations: ['salesforce', 'google', 'mailchimp'],
            primary_contact: 'John Smith'
        },
        {
            id: '2',
            name: 'TechStart Inc.',
            domain: 'https://techstart.io',
            status: 'active',
            onboarding_completed: true,
            onboarding_progress: 100,
            created_at: '2024-01-20T14:30:00Z',
            metrics: {
                revenue: 850000,
                growth: 45,
                campaigns: 3,
                social_followers: 12000
            },
            integrations: ['hubspot', 'notion', 'slack'],
            primary_contact: 'Sarah Johnson'
        },
        {
            id: '3',
            name: 'Global Retail Co.',
            domain: 'https://globalretail.com',
            status: 'onboarding',
            onboarding_completed: false,
            onboarding_progress: 65,
            created_at: '2024-02-01T09:15:00Z',
            metrics: {
                revenue: 0,
                growth: 0,
                campaigns: 0,
                social_followers: 45000
            },
            integrations: ['asana'],
            primary_contact: 'Michael Chen'
        }
    ];
    filteredClients = [...clients];
    displayClients();
}

function displayClients() {
    const grid = document.getElementById('clientsGrid');
    const emptyState = document.getElementById('emptyState');
    const loadingState = document.getElementById('loadingState');
    
    loadingState.classList.add('hidden');
    
    if (filteredClients.length === 0) {
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    grid.innerHTML = filteredClients.map(client => createClientCard(client)).join('');
}

function createClientCard(client) {
    const statusBadge = getStatusBadge(client.status, client.onboarding_progress);
    const integrationIcons = getIntegrationIcons(client.integrations);
    
    return `
        <div class="client-card bg-white rounded-lg shadow-md p-6 cursor-pointer" onclick="showClientDetails('${client.id}')">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="text-xl font-bold text-gray-900">${client.name}</h3>
                    <p class="text-sm text-gray-600 mt-1">${client.domain || 'No domain'}</p>
                </div>
                ${statusBadge}
            </div>
            
            <div class="space-y-3">
                <div class="flex items-center text-sm text-gray-600">
                    <i class="fas fa-user mr-2"></i>
                    <span>${client.primary_contact || 'No primary contact'}</span>
                </div>
                
                <div class="flex items-center text-sm text-gray-600">
                    <i class="fas fa-calendar mr-2"></i>
                    <span>Added ${formatDate(client.created_at)}</span>
                </div>
                
                ${client.status === 'active' ? `
                    <div class="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
                        <div>
                            <p class="text-sm text-gray-600">Revenue</p>
                            <p class="text-lg font-semibold">${formatCurrency(client.metrics.revenue)}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">Growth</p>
                            <p class="text-lg font-semibold ${client.metrics.growth >= 0 ? 'text-green-600' : 'text-red-600'}">
                                ${client.metrics.growth >= 0 ? '+' : ''}${client.metrics.growth}%
                            </p>
                        </div>
                    </div>
                ` : ''}
                
                <div class="flex items-center justify-between mt-4">
                    <div class="flex space-x-2">
                        ${integrationIcons}
                    </div>
                    <button onclick="event.stopPropagation(); goToClientDashboard('${client.id}')" 
                            class="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        View Details <i class="fas fa-arrow-right ml-1"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function getStatusBadge(status, progress) {
    if (status === 'active') {
        return '<span class="px-3 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Active</span>';
    } else if (status === 'onboarding') {
        return `
            <div class="text-right">
                <span class="px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">Onboarding</span>
                <div class="mt-2 w-32">
                    <div class="bg-gray-200 rounded-full h-2">
                        <div class="bg-yellow-600 h-2 rounded-full" style="width: ${progress}%"></div>
                    </div>
                    <p class="text-xs text-gray-600 mt-1">${progress}% complete</p>
                </div>
            </div>
        `;
    } else {
        return '<span class="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Inactive</span>';
    }
}

function getIntegrationIcons(integrations) {
    const icons = {
        salesforce: '<i class="fab fa-salesforce text-blue-500" title="Salesforce"></i>',
        hubspot: '<i class="fas fa-h-square text-orange-500" title="HubSpot"></i>',
        google: '<i class="fab fa-google text-red-500" title="Google Workspace"></i>',
        notion: '<i class="fas fa-sticky-note text-gray-700" title="Notion"></i>',
        asana: '<i class="fas fa-circle text-pink-500" title="Asana"></i>',
        slack: '<i class="fab fa-slack text-purple-600" title="Slack"></i>',
        mailchimp: '<i class="fab fa-mailchimp text-yellow-600" title="Mailchimp"></i>'
    };
    
    return integrations.slice(0, 4).map(integration => 
        icons[integration] || '<i class="fas fa-plug text-gray-400"></i>'
    ).join('');
}

function filterClients() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    
    filteredClients = clients.filter(client => {
        const matchesSearch = client.name.toLowerCase().includes(searchTerm) || 
                            (client.domain && client.domain.toLowerCase().includes(searchTerm)) ||
                            (client.primary_contact && client.primary_contact.toLowerCase().includes(searchTerm));
        
        const matchesStatus = !statusFilter || client.status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });
    
    sortClients();
}

function sortClients() {
    const sortBy = document.getElementById('sortBy').value;
    
    filteredClients.sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'date':
                return new Date(b.created_at) - new Date(a.created_at);
            case 'revenue':
                return (b.metrics?.revenue || 0) - (a.metrics?.revenue || 0);
            default:
                return 0;
        }
    });
    
    displayClients();
}

function showClientDetails(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    const modal = document.getElementById('clientModal');
    const modalName = document.getElementById('modalClientName');
    const modalContent = document.getElementById('modalClientContent');
    const dashboardBtn = document.getElementById('viewDashboardBtn');
    
    modalName.textContent = client.name;
    dashboardBtn.onclick = () => goToClientDashboard(clientId);
    
    modalContent.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <h4 class="font-semibold mb-2">Basic Information</h4>
                <div class="space-y-2 text-sm">
                    <p><span class="text-gray-600">Domain:</span> ${client.domain || 'Not provided'}</p>
                    <p><span class="text-gray-600">Status:</span> ${getStatusBadge(client.status, client.onboarding_progress)}</p>
                    <p><span class="text-gray-600">Added:</span> ${formatDate(client.created_at)}</p>
                    <p><span class="text-gray-600">Primary Contact:</span> ${client.primary_contact || 'Not set'}</p>
                </div>
            </div>
            
            ${client.status === 'active' ? `
                <div>
                    <h4 class="font-semibold mb-2">Performance Metrics</h4>
                    <div class="space-y-2 text-sm">
                        <p><span class="text-gray-600">Revenue:</span> <span class="font-semibold">${formatCurrency(client.metrics.revenue)}</span></p>
                        <p><span class="text-gray-600">Growth Rate:</span> <span class="font-semibold ${client.metrics.growth >= 0 ? 'text-green-600' : 'text-red-600'}">${client.metrics.growth >= 0 ? '+' : ''}${client.metrics.growth}%</span></p>
                        <p><span class="text-gray-600">Active Campaigns:</span> ${client.metrics.campaigns}</p>
                        <p><span class="text-gray-600">Social Followers:</span> ${formatNumber(client.metrics.social_followers)}</p>
                    </div>
                </div>
            ` : '<div></div>'}
        </div>
        
        <div class="mt-6">
            <h4 class="font-semibold mb-2">Connected Integrations</h4>
            <div class="flex flex-wrap gap-3">
                ${client.integrations.map(integration => `
                    <span class="px-3 py-1 bg-gray-100 rounded-full text-sm flex items-center">
                        ${getIntegrationIcons([integration])} <span class="ml-2">${integration}</span>
                    </span>
                `).join('')}
            </div>
        </div>
        
        ${client.status === 'onboarding' ? `
            <div class="mt-6 p-4 bg-yellow-50 rounded-lg">
                <h4 class="font-semibold mb-2 text-yellow-800">Onboarding Status</h4>
                <div class="mb-2">
                    <div class="bg-gray-200 rounded-full h-3">
                        <div class="bg-yellow-600 h-3 rounded-full" style="width: ${client.onboarding_progress}%"></div>
                    </div>
                </div>
                <p class="text-sm text-yellow-700">${client.onboarding_progress}% complete - ${100 - client.onboarding_progress}% remaining</p>
                <button onclick="window.location.href='/client-onboarding.html?id=${client.id}&continue=true'" 
                        class="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm">
                    Continue Onboarding
                </button>
            </div>
        ` : ''}
    `;
    
    modal.classList.remove('hidden');
}

function closeClientModal() {
    document.getElementById('clientModal').classList.add('hidden');
}

function goToClientDashboard(clientId) {
    window.location.href = `/client-dashboard.html?id=${clientId}`;
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    
    return date.toLocaleDateString();
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('clientModal');
    if (event.target === modal) {
        closeClientModal();
    }
}